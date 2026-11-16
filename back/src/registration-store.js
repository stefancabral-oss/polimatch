import { createHmac } from "node:crypto";
import { AGE_RANGES, GENDERS, STATES } from "../../shared/registration.js";
import { editionWindow, editorialDateKey } from "./daily-session.js";

// Cadastro com CPF (ICM 71, #336). Quem responde uma pesquisa por foto
// precisa de conta Google com cadastro. Este módulo nunca recebe o número do
// CPF: a rota entrega o código já calculado, e só ele é guardado.

const CPF_KEY_LABEL = "polimatch:cpf-registration:v1";
const CPF_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Pedidos de cadastro por conta em cada dia editorial de São Paulo. */
export const REGISTRATION_ATTEMPTS_PER_DAY = 5;

/**
 * O código que representa um CPF no banco. A chave é derivada do segredo do
 * servidor com um rótulo próprio, para o mesmo texto não dar o mesmo código
 * que o pseudônimo de rede. Trocar o segredo muda todos os códigos: antes de
 * trocar é preciso migrar os cadastros.
 */
export function cpfPseudonym(digits, secret) {
  if (!secret) throw new Error("VOTER_NETWORK_SECRET é obrigatório");
  if (typeof digits !== "string" || !/^\d{11}$/.test(digits)) throw new Error("CPF deve chegar com onze dígitos");
  const key = createHmac("sha256", String(secret)).update(CPF_KEY_LABEL).digest();
  return createHmac("sha256", key).update(digits).digest("hex");
}

function registrationError(message, status, code, extra = {}) {
  return Object.assign(new Error(message), { status, code }, extra);
}

export const registrationRequiredError = () => registrationError(
  "cadastro com CPF obrigatório para responder",
  403,
  "CPF_REGISTRATION_REQUIRED",
);

// Migração aditiva: só cria tabelas. O cadastro pertence à conta
// (provider + subject), não ao jogador ativo, que pode mudar quando dois
// históricos são reunidos.
export async function installRegistrationSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cpf_registrations (
      provider text NOT NULL,
      subject text NOT NULL,
      cpf_hmac char(64) NOT NULL UNIQUE CHECK (cpf_hmac ~ '^[0-9a-f]{64}$'),
      age_range text NOT NULL CHECK (age_range <> ''),
      gender text NOT NULL CHECK (gender <> ''),
      state char(2) NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
      consent_version text NOT NULL CHECK (consent_version <> ''),
      consented_at timestamptz NOT NULL,
      registered_at timestamptz NOT NULL,
      PRIMARY KEY (provider, subject),
      FOREIGN KEY (provider, subject) REFERENCES player_identities (provider, subject) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cpf_registration_attempts (
      provider text NOT NULL,
      subject text NOT NULL,
      day date NOT NULL,
      used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
      PRIMARY KEY (provider, subject, day)
    );

    INSERT INTO schema_migrations(id) VALUES ('2026-11-16-cpf-registration-v1') ON CONFLICT DO NOTHING;
  `);
}

/** A conta Google do jogador tem cadastro com CPF. */
export async function hasCpfRegistration(client, playerId) {
  const result = await client.query(`SELECT 1 FROM cpf_registrations registration
    JOIN player_identities identity
      ON identity.provider = registration.provider AND identity.subject = registration.subject
    WHERE identity.player_id = $1`, [playerId]);
  return result.rowCount > 0;
}

/** Para as rotas que só valem para quem tem cadastro. Roda dentro da transação de quem chama. */
export async function requireCpfRegistration(client, playerId) {
  if (!(await hasCpfRegistration(client, playerId))) throw registrationRequiredError();
}

const listed = (list, value) => typeof value === "string" && list.some((item) => item.id === value);

export function registrationStore({ pool, findPlayer, clock = () => new Date() }) {
  return {
    /**
     * Grava o cadastro da conta. Devolve `created`, ou `alreadyRegistered`
     * quando a conta repete o próprio CPF. As recusas saem como erro, depois
     * de a tentativa ter sido contada.
     */
    async registerCpf({ recoveryKey, cpfHash, ageRange, gender, state, consentVersion, now } = {}) {
      // A rota já conferiu tudo com as regras de shared/; aqui é a última barreira.
      if (typeof cpfHash !== "string" || !CPF_HASH_PATTERN.test(cpfHash)) throw registrationError("cadastro inválido", 400, "CPF_INVALID");
      if (!listed(AGE_RANGES, ageRange) || !listed(GENDERS, gender) || !STATES.includes(state)
        || typeof consentVersion !== "string" || !consentVersion) {
        throw registrationError("cadastro inválido", 400, "REGISTRATION_INVALID");
      }
      const at = now instanceof Date ? now : clock();
      const day = editorialDateKey(at);
      const client = await pool.connect();
      let refusal = null;
      let result = null;
      try {
        await client.query("BEGIN");
        // findPlayer trava `player:<id>`: dois pedidos da mesma conta entram em fila.
        const player = await findPlayer(client, recoveryKey);
        const identity = await client.query(
          "SELECT provider, subject FROM player_identities WHERE provider = 'google' AND player_id = $1",
          [player.id],
        );
        if (!identity.rowCount) throw registrationError("entre com Google para se cadastrar", 403, "GOOGLE_ACCOUNT_REQUIRED");
        const { provider, subject } = identity.rows[0];
        const mine = await client.query(
          "SELECT cpf_hmac, registered_at FROM cpf_registrations WHERE provider = $1 AND subject = $2",
          [provider, subject],
        );
        if (mine.rowCount) {
          if (mine.rows[0].cpf_hmac !== cpfHash) throw registrationError("esta conta já tem cadastro", 409, "REGISTRATION_EXISTS");
          result = { status: "alreadyRegistered", registeredAt: new Date(mine.rows[0].registered_at).toISOString() };
        } else {
          const attempt = await client.query(`INSERT INTO cpf_registration_attempts (provider, subject, day, used)
            VALUES ($1, $2, $3::date, 1)
            ON CONFLICT (provider, subject, day) DO UPDATE SET used = cpf_registration_attempts.used + 1
            RETURNING used`, [provider, subject, day]);
          if (Number(attempt.rows[0].used) > REGISTRATION_ATTEMPTS_PER_DAY) {
            const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(editionWindow(day).closesAt) - at.getTime()) / 1000));
            throw registrationError("muitas tentativas de cadastro hoje", 429, "REGISTRATION_ATTEMPT_LIMIT", { retryAfterSeconds });
          }
          // Se outra conta gravar o mesmo CPF ao mesmo tempo, o índice único
          // segura este pedido até ela terminar, e aqui nada é gravado.
          const inserted = await client.query(`INSERT INTO cpf_registrations
              (provider, subject, cpf_hmac, age_range, gender, state, consent_version, consented_at, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            ON CONFLICT (cpf_hmac) DO NOTHING
            RETURNING registered_at`, [provider, subject, cpfHash, ageRange, gender, state, consentVersion, at]);
          if (inserted.rowCount) result = { status: "created", registeredAt: new Date(inserted.rows[0].registered_at).toISOString() };
          // A tentativa fica contada: a recusa só sai depois do COMMIT.
          else refusal = registrationError("este CPF já tem cadastro em outra conta", 409, "CPF_ALREADY_REGISTERED");
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      if (refusal) throw refusal;
      return result;
    },
  };
}
