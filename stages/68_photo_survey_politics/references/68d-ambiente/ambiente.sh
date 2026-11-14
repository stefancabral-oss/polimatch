#!/bin/bash
# Ambiente descartável da 68d. Tudo local: build da página, seis bancos, seis
# APIs abertas, uma API com a pesquisa fechada e a porta de entrada.
# Nada aqui fala com produção.
#
# Uso: ambiente.sh subir | parar | estado
#
# Precisa de: dependências instaladas em app/ e back/, e um PostgreSQL local
# descartável. Variáveis:
#   POLIMATCH_68D_PG   endereço do servidor PostgreSQL, sem o nome do banco.
#                      Só aceita 127.0.0.1 ou localhost: o roteiro apaga e
#                      recria os bancos pm68d_1 a pm68d_6.
#                      (padrão: postgresql://postgres@127.0.0.1:54329)
#   POLIMATCH_68D_DIR  pasta de trabalho, fora do repositório. O roteiro apaga
#                      e recria `dist` e `fechada` dentro dela, e só mexe numa
#                      pasta que ele mesmo criou.
#                      (padrão: polimatch-68d na pasta temporária do sistema)
#
# Atenção: o servidor do PoliMatch escuta em todas as interfaces. Enquanto o
# ambiente está de pé, as sete APIs ficam visíveis na rede local, sem senha e
# confiando no cabeçalho de rede. Use numa rede de confiança e pare ao terminar.
set -u
export LC_ALL=en_US.UTF-8
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE" && git rev-parse --show-toplevel)"
TMP="${TMPDIR:-/tmp}"
WORK="${POLIMATCH_68D_DIR:-${TMP%/}/polimatch-68d}"
WORK="${WORK%/}"
RUN="$WORK/run"
DIST="$WORK/dist"
CLOSED="$WORK/fechada"
MARK="$WORK/.polimatch-68d"
PG="${POLIMATCH_68D_PG:-postgresql://postgres@127.0.0.1:54329}"
PSQL="$(command -v psql)"

recusar() { echo "recusado: $1" >&2; exit 1; }

# O banco precisa ser local: o roteiro apaga e recria bancos.
case "$PG" in
  postgresql://*@127.0.0.1:*|postgresql://*@localhost:*|postgresql://127.0.0.1:*|postgresql://localhost:*) ;;
  *) recusar "POLIMATCH_68D_PG precisa apontar para 127.0.0.1 ou localhost" ;;
esac

# A pasta de trabalho é apagada em parte a cada subida: só vale uma pasta que
# este roteiro criou (ou vazia), fora do repositório e fora da pasta pessoal.
[ -n "$WORK" ] && [ "$WORK" != "/" ] && [ "$WORK" != "${HOME%/}" ] || recusar "pasta de trabalho inválida: '$WORK'"
case "$WORK/" in "$REPO"/*) recusar "a pasta de trabalho não pode ficar dentro do repositório" ;; esac
if [ -d "$WORK" ] && [ ! -f "$MARK" ] && [ -n "$(ls -A "$WORK" 2>/dev/null)" ]; then
  recusar "a pasta '$WORK' já tem arquivos e não foi criada por este roteiro"
fi
mkdir -p "$RUN" && : > "$MARK"

# Só encerra processo que este roteiro abriu: confere o comando antes.
parar() {
  for pidfile in "$RUN"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile")"
    case "$(ps -p "$pid" -o command= 2>/dev/null)" in
      *back/src/server.js*|*porta.mjs*) kill "$pid" 2>/dev/null ;;
    esac
    rm -f "$pidfile"
  done
}

estado() {
  for port in 3301 3302 3303 3304 3305 3306 3316; do
    printf "api %s: %s\n" "$port" "$(curl -s -m 4 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/health")"
  done
  for port in 4201 4202 4203 4204 4205 4206 4211 4212 4213 4214 4215 4216; do
    printf "rede %s: página %s, pesquisa %s\n" "$port" \
      "$(curl -s -m 4 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/pesquisa.html")" \
      "$(curl -s -m 4 -H "Origin: http://127.0.0.1:$port" "http://127.0.0.1:3100/api/photo-surveys/politica-2026-01" | head -c 60)"
  done
  curl -s -m 4 "http://127.0.0.1:3100/__controle"; echo
}

subir() {
  parar
  sleep 1
  cd "$REPO" || exit 1
  echo "commit: $(git rev-parse --short HEAD) ($(git status --porcelain | wc -l | tr -d ' ') arquivos alterados)"

  # 1. Build da página, com a API em outra origem, como em produção.
  (cd app && env VITE_API_URL=http://127.0.0.1:3100 VITE_GOOGLE_CLIENT_ID=e2e-client.apps.googleusercontent.com \
    node node_modules/vite/bin/vite.js build --outDir "$DIST" --emptyOutDir > "$RUN/build.log" 2>&1) || { echo "BUILD FALHOU"; tail -15 "$RUN/build.log"; exit 1; }
  echo "build: $(ls "$DIST" | wc -l | tr -d ' ') entradas em $DIST"

  # 2. Cópia do servidor com a pesquisa fechada (só muda a janela).
  rm -rf "$CLOSED" && mkdir -p "$CLOSED/back" "$CLOSED/app"
  cp -R back/src "$CLOSED/back/src" && cp back/package.json "$CLOSED/back/" && ln -s "$REPO/back/node_modules" "$CLOSED/back/node_modules"
  cp -R shared "$CLOSED/shared" && cp -R app/src "$CLOSED/app/src"
  # No macOS a cópia de app/public é um clone, sem ocupar disco; fora dele, cópia comum.
  cp -cR app/public "$CLOSED/app/public" 2>/dev/null || cp -R app/public "$CLOSED/app/public"
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const text = fs.readFileSync(file, "utf8");
    const patched = text.replace("    drawSize: 16,\n    groupSize: 4,\n  }),", "    drawSize: 16,\n    groupSize: 4,\n    closesAt: \"2026-11-01T03:00:00.000Z\",\n  }),");
    if (patched === text) { console.error("não achei onde fechar a pesquisa"); process.exit(1); }
    fs.writeFileSync(file, patched);
  ' "$CLOSED/shared/photo-survey.js" || exit 1

  # 3. Bancos novos e APIs.
  for n in 1 2 3 4 5 6; do
    db="pm68d_$n"
    "$PSQL" "$PG/postgres" -q -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" -c "CREATE DATABASE $db" > /dev/null || exit 1
    # `cd` em comando separado: assim o processo em segundo plano é o próprio
    # servidor, e o número guardado é o dele.
    (cd "$REPO" || exit 1
      env PORT=$((3300 + n)) DATABASE_URL="$PG/$db" PHOTO_SURVEYS_ENABLED=true TRUST_PROXY_HOPS=1 \
        node back/src/server.js > "$RUN/api-$n.log" 2>&1 &
      echo $! > "$RUN/api-$n.pid")
  done
  for n in 1 2 3 4 5 6; do
    for i in $(seq 1 40); do curl -fsS "http://127.0.0.1:$((3300 + n))/api/health" > /dev/null 2>&1 && break; sleep 0.5; done
  done
  (cd "$CLOSED" || exit 1
    env PORT=3316 DATABASE_URL="$PG/pm68d_6" PHOTO_SURVEYS_ENABLED=true TRUST_PROXY_HOPS=1 \
      node back/src/server.js > "$RUN/api-fechada.log" 2>&1 &
    echo $! > "$RUN/api-fechada.pid")
  for i in $(seq 1 40); do curl -fsS "http://127.0.0.1:3316/api/health" > /dev/null 2>&1 && break; sleep 0.5; done

  # 4. Porta de entrada: páginas das seis redes e a API de cada uma.
  (node "$HERE/porta.mjs" "$DIST" > "$RUN/porta.log" 2>&1 & echo $! > "$RUN/porta.pid")
  sleep 1
  estado
}

case "${1:-}" in
  subir) subir ;;
  parar) parar; echo "parado" ;;
  estado) estado ;;
  *) echo "uso: $0 subir|parar|estado"; exit 1 ;;
esac
