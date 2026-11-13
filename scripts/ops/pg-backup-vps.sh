#!/usr/bin/env bash
# Backup lógico do PostgreSQL do PoliMatch para rodar por cron (alternativa ao
# backup agendado do Dokploy). Gera um dump no formato custom do pg_dump e um
# manifesto com sha256 e contagem de linhas por tabela, lidas do próprio dump.
# Opcionalmente cifra com age e envia com rclone para um bucket fora da VPS.
# Procedimento completo em docs/ops/BACKUP.md.
set -euo pipefail
umask 077

usage() {
  cat <<'USAGE'
Uso: BACKUP_DATABASE_URL=postgresql://usuario@host/banco scripts/ops/pg-backup-vps.sh

Obrigatório:
  BACKUP_DATABASE_URL        banco a copiar (prefira .pgpass ou socket a senha na URL)

Opcionais:
  BACKUP_DIR                 diretório local dos arquivos (padrão: ./polimatch-backups)
  BACKUP_PREFIX              prefixo dos nomes (padrão: polimatch)
  BACKUP_LOCAL_KEEP          quantos backups manter no disco local (padrão: 7)
  BACKUP_RELEASE_REVISION    SHA do release em produção, gravado no manifesto
  BACKUP_REQUIRED_MIGRATION  linha que precisa estar em schema_migrations
                             (padrão: 20260913_eleicoes_2026_clean_start)
  PG_DUMP / PG_RESTORE       comandos (padrão: pg_dump / pg_restore). Aceitam
                             "docker exec -i <container> pg_dump", por exemplo.
  BACKUP_AGE_RECIPIENTS_FILE arquivo de destinatários age; cifra o dump enviado
  BACKUP_RCLONE_REMOTE       destino rclone, ex.: r2-polimatch:polimatch-backups
  BACKUP_MONTHLY             1 força a cópia mensal (padrão: só no dia 01 UTC)
  BACKUP_SUCCESS_URL         URL chamada com GET ao final com sucesso (monitor)
  AGE / RCLONE / CURL        comandos (padrão: age / rclone / curl)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

fail() {
  echo "pg-backup: $*" >&2
  exit 1
}

[[ -n "${BACKUP_DATABASE_URL:-}" ]] || { usage >&2; fail "defina BACKUP_DATABASE_URL"; }
BACKUP_DIR="${BACKUP_DIR:-./polimatch-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-polimatch}"
BACKUP_LOCAL_KEEP="${BACKUP_LOCAL_KEEP:-7}"
BACKUP_REQUIRED_MIGRATION="${BACKUP_REQUIRED_MIGRATION:-20260913_eleicoes_2026_clean_start}"
BACKUP_RELEASE_REVISION="${BACKUP_RELEASE_REVISION:-}"
read -r -a pg_dump_cmd <<< "${PG_DUMP:-pg_dump}"
read -r -a pg_restore_cmd <<< "${PG_RESTORE:-pg_restore}"
read -r -a age_cmd <<< "${AGE:-age}"
read -r -a rclone_cmd <<< "${RCLONE:-rclone}"
read -r -a curl_cmd <<< "${CURL:-curl}"

[[ "$BACKUP_PREFIX" =~ ^[A-Za-z0-9_-]+$ ]] || fail "BACKUP_PREFIX aceita só letras, números, _ e -"
[[ "$BACKUP_LOCAL_KEEP" =~ ^[1-9][0-9]*$ ]] || fail "BACKUP_LOCAL_KEEP deve ser inteiro positivo"
if [[ -n "$BACKUP_RELEASE_REVISION" && ! "$BACKUP_RELEASE_REVISION" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]]; then
  fail "BACKUP_RELEASE_REVISION deve ser um SHA completo"
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

json_string() {
  local value=${1//\\/\\\\}
  value=${value//\"/\\\"}
  printf '"%s"' "$value"
}

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
base="$BACKUP_PREFIX-$timestamp"
mkdir -p "$BACKUP_DIR"
work=$(mktemp -d "$BACKUP_DIR/.parcial-$timestamp.XXXXXX")
trap 'rm -rf "$work"' EXIT

dump="$work/$base.dump"
# Snapshot consistente do pg_dump; a saída vai por stdout para funcionar também
# via docker exec, sem arquivo dentro do container.
"${pg_dump_cmd[@]}" --format=custom --compress=6 --dbname="$BACKUP_DATABASE_URL" > "$dump"
[[ -s "$dump" ]] || fail "pg_dump não gerou dados"

"${pg_restore_cmd[@]}" --list < "$dump" > "$work/toc.txt"
grep -q '^;     Format: CUSTOM$' "$work/toc.txt" || fail "dump fora do formato custom"
grep -Eq '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA public schema_migrations ' "$work/toc.txt" \
  || fail "dump sem os dados de schema_migrations; restaurá-lo faria a API recusar o boot"
header() {
  sed -n "s/^;     $1: //p" "$work/toc.txt" | head -n 1
}
database_name=$(header dbname)
server_version=$(header 'Dumped from database version')
pg_dump_version=$(header 'Dumped by pg_dump version')

# Contagem a partir do conteúdo do dump: cada linha de dado do COPY em texto é
# uma linha da tabela, e o bloco termina em "\.". A chave é esquema.tabela sem
# as aspas de identificador, igual à que o drill monta a partir do catálogo.
"${pg_restore_cmd[@]}" --data-only --file=- < "$dump" | awk '
  /^COPY [^ ]+ .*FROM stdin;$/ { table = $2; gsub(/"/, "", table); rows = 0; inside = 1; next }
  inside && $0 == "\\." { print "T\t" table "\t" rows; inside = 0; next }
  inside {
    rows++
    if (table == "public.schema_migrations") { split($0, field, "\t"); print "M\t" field[1] }
  }
' > "$work/counts.tsv"

# Nomes de tabela e ids de migração entram literais no JSON do manifesto.
if grep -q '["\\]' "$work/counts.tsv"; then
  fail "nome de tabela ou migração com aspas ou barra invertida"
fi
grep -qxF "M"$'\t'"$BACKUP_REQUIRED_MIGRATION" "$work/counts.tsv" \
  || fail "schema_migrations do dump não tem $BACKUP_REQUIRED_MIGRATION"
table_count=$(grep -c $'^T\t' "$work/counts.tsv" || true)
[[ "$table_count" -gt 0 ]] || fail "nenhuma tabela com dados no dump"
total_rows=$(awk -F'\t' '$1 == "T" { sum += $3 } END { print sum + 0 }' "$work/counts.tsv")
dump_sha256=$(sha256_of "$dump")
dump_bytes=$(wc -c < "$dump" | tr -d ' ')

uploaded_file="$dump"
encrypted_json="null"
if [[ -n "${BACKUP_AGE_RECIPIENTS_FILE:-}" ]]; then
  [[ -s "$BACKUP_AGE_RECIPIENTS_FILE" ]] || fail "BACKUP_AGE_RECIPIENTS_FILE vazio ou ausente"
  "${age_cmd[@]}" --encrypt -R "$BACKUP_AGE_RECIPIENTS_FILE" -o "$dump.age" "$dump"
  [[ -s "$dump.age" ]] || fail "age não gerou o arquivo cifrado"
  encrypted_json="{\"file\": $(json_string "$base.dump.age"), \"sha256\": $(json_string "$(sha256_of "$dump.age")"), \"tool\": \"age\"}"
  uploaded_file="$dump.age"
  rm -f "$dump"
fi

manifest="$work/$base.manifest.json"
{
  printf '{\n'
  printf '  "format": "polimatch-pg-backup-manifest/v1",\n'
  printf '  "createdAt": %s,\n' "$(json_string "$created_at")"
  printf '  "database": %s,\n' "$(json_string "$database_name")"
  printf '  "serverVersion": %s,\n' "$(json_string "$server_version")"
  printf '  "pgDumpVersion": %s,\n' "$(json_string "$pg_dump_version")"
  if [[ -n "$BACKUP_RELEASE_REVISION" ]]; then
    printf '  "releaseRevision": %s,\n' "$(json_string "$BACKUP_RELEASE_REVISION")"
  else
    printf '  "releaseRevision": null,\n'
  fi
  printf '  "dumpFile": %s,\n' "$(json_string "$base.dump")"
  printf '  "dumpFormat": "pg_dump custom",\n'
  printf '  "dumpBytes": %s,\n' "$dump_bytes"
  printf '  "sha256": %s,\n' "$(json_string "$dump_sha256")"
  printf '  "encrypted": %s,\n' "$encrypted_json"
  printf '  "requiredMigration": %s,\n' "$(json_string "$BACKUP_REQUIRED_MIGRATION")"
  printf '  "schemaMigrations": ['
  awk -F'\t' '$1 == "M" { printf "%s\"%s\"", (n++ ? ", " : ""), $2 }' "$work/counts.tsv"
  printf '],\n'
  printf '  "tableCount": %s,\n' "$table_count"
  printf '  "totalRows": %s,\n' "$total_rows"
  printf '  "tables": {\n'
  awk -F'\t' '$1 == "T" { rows[++n] = sprintf("    \"%s\": %s", $2, $3) } END { for (i = 1; i <= n; i++) printf "%s%s\n", rows[i], (i < n ? "," : "") }' "$work/counts.tsv"
  printf '  }\n'
  printf '}\n'
} > "$manifest"

final_file="$BACKUP_DIR/$(basename "$uploaded_file")"
final_manifest="$BACKUP_DIR/$base.manifest.json"
mv "$uploaded_file" "$final_file"
mv "$manifest" "$final_manifest"

if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  targets=(daily)
  if [[ "${BACKUP_MONTHLY:-}" == "1" || "$(date -u +%d)" == "01" ]]; then
    targets+=(monthly)
  fi
  for target in "${targets[@]}"; do
    for file in "$final_file" "$final_manifest"; do
      "${rclone_cmd[@]}" copy --immutable "$file" "${BACKUP_RCLONE_REMOTE%/}/$target/"
    done
  done
fi

# Retenção local curta: o histórico longo fica no bucket (ver BACKUP.md).
manifests=()
while IFS= read -r found; do
  manifests+=("$found")
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$BACKUP_PREFIX-*.manifest.json" | sort)
if (( ${#manifests[@]} > BACKUP_LOCAL_KEEP )); then
  for old in "${manifests[@]:0:${#manifests[@]}-BACKUP_LOCAL_KEEP}"; do
    old_base="${old%.manifest.json}"
    rm -f "$old" "$old_base.dump" "$old_base.dump.age"
  done
fi

if [[ -n "${BACKUP_SUCCESS_URL:-}" ]]; then
  "${curl_cmd[@]}" -fsS -m 10 --retry 3 -o /dev/null "$BACKUP_SUCCESS_URL"
fi

printf '{"result": "ok", "file": %s, "manifest": %s, "sha256": %s, "tables": %s, "totalRows": %s}\n' \
  "$(json_string "$(basename "$final_file")")" "$(json_string "$(basename "$final_manifest")")" \
  "$(json_string "$dump_sha256")" "$table_count" "$total_rows"
