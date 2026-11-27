import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_VERSION, isValidHandle, normalizeHandle } from "../../shared/profile.js";
import { personResult } from "./photo-survey-store.js";
import { hasCpfRegistration, registrationRequiredError } from "./registration-store.js";

// Perfil público da pessoa (ICM 76, #354, decisão 0008).
//
// - O perfil pertence à conta (provider + subject), como o cadastro: se o
//   jogador ativo da conta muda quando dois históricos são reunidos, o perfil
//   acompanha a conta.
// - Nasce desligado. Só conta com cadastro com CPF liga. Ligar exige o aceite
//   da versão atual e um nome de perfil válido e livre; desligar não exige
//   nada e vale na hora, porque a leitura pública confere `enabled` a cada
//   pedido.
// - As marcações de pesquisa ficam guardadas mesmo com o perfil desligado.
// - O perfil público mostra só o nome de perfil e, por pesquisa marcada em que
//   a pessoa tem rodada respondida, a primeira colocada dela. Perfil desligado
//   e nome inexistente respondem igual. Nenhuma rota soma pessoas.

function profileError(message, status, code, current) {
  const error = Object.assign(new Error(message), { status, code });
  if (current !== undefined) error.current = current;
  return error;
}

const invalidProfile = (reason) => profileError("perfil inválido", 400, "PROFILE_INVALID", { reason });
const consentRequired = () => profileError("aceite do perfil obrigatório", 400, "PROFILE_CONSENT_REQUIRED");
const handleTaken = () => profileError("nome de perfil em uso", 409, "PROFILE_HANDLE_TAKEN");
const profileNotFound = () => profileError("perfil não encontrado", 404, "PROFILE_NOT_FOUND");
const googleAccountRequired = () => profileError("entre com Google para ver o seu perfil", 403, "GOOGLE_ACCOUNT_REQUIRED");

// O índice único do nome de perfil. O erro de violação dele vira 409.
const HANDLE_INDEX = "profile_settings_handle_idx";

// Migração aditiva: só cria tabelas. As duas não são imutáveis: a pessoa liga,
// desliga e muda marcações. Nenhuma tabela existente muda.
export async function installProfileSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS profile_settings (
      provider text NOT NULL,
      subject text NOT NULL,
      handle text CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
      enabled boolean NOT NULL DEFAULT false,
      consent_version text CHECK (consent_version <> ''),
      consented_at timestamptz,
      updated_at timestamptz NOT NULL,
      PRIMARY KEY (provider, subject),
      FOREIGN KEY (provider, subject) REFERENCES player_identities (provider, subject) ON DELETE CASCADE,
      -- Ligado só com nome, aceite e data do aceite.
      CHECK (NOT enabled OR (handle IS NOT NULL AND consent_version IS NOT NULL AND consented_at IS NOT NULL))
    );
    -- Único sem diferença entre maiúsculas e minúsculas. O nome já é gravado
    -- em minúsculas; o índice garante a regra também em pedidos simultâneos.
    CREATE UNIQUE INDEX IF NOT EXISTS ${HANDLE_INDEX} ON profile_settings (lower(handle));

    CREATE TABLE IF NOT EXISTS profile_surveys (
      provider text NOT NULL,
      subject text NOT NULL,
      survey_id text NOT NULL CHECK (survey_id <> ''),
      PRIMARY KEY (provider, subject, survey_id),
      FOREIGN KEY (provider, subject) REFERENCES profile_settings (provider, subject) ON DELETE CASCADE
    );

    INSERT INTO schema_migrations(id) VALUES ('2026-11-26-profiles-v1') ON CONFLICT DO NOTHING;
  `);
}

/**
 * Confere o corpo do PUT sem tocar o banco. `enabled: false` só desliga:
 * `handle` e `consentVersion` são ignorados, para que nada impeça desligar.
 * `surveys` ausente mantém as marcações; presente, só ids das pesquisas
 * conhecidas, sem repetição.
 */
export function checkProfileUpdate({ enabled, handle, surveys, consentVersion } = {}, knownSurveys = PHOTO_SURVEYS) {
  if (typeof enabled !== "boolean") throw invalidProfile("enabled");
  let marked;
  if (surveys !== undefined) {
    const known = new Set(knownSurveys.map((survey) => survey.id));
    if (!Array.isArray(surveys) || surveys.some((id) => typeof id !== "string" || !known.has(id))) throw invalidProfile("surveys");
    marked = [...new Set(surveys)];
  }
  if (!enabled) return { enabled, surveys: marked };
  if (handle !== undefined && !isValidHandle(handle)) throw invalidProfile("handle");
  if (consentVersion !== PROFILE_CONSENT_VERSION) throw consentRequired();
  return { enabled, handle: handle === undefined ? undefined : normalizeHandle(handle), surveys: marked, consentVersion };
}

export function profileStore({
  pool,
  findPlayer,
  clock = () => new Date(),
  surveys = PHOTO_SURVEYS,
  hasRegistration = hasCpfRegistration,
}) {
  const instant = (now) => (now instanceof Date ? now : clock());

  async function withClient(fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function googleAccount(client, playerId) {
    const result = await client.query(
      "SELECT provider, subject FROM player_identities WHERE provider = 'google' AND player_id = $1",
      [playerId],
    );
    return result.rows[0] || null;
  }

  async function settingsOf(client, { provider, subject }) {
    const result = await client.query(
      "SELECT handle, enabled, consent_version, consented_at FROM profile_settings WHERE provider = $1 AND subject = $2",
      [provider, subject],
    );
    return result.rows[0] || null;
  }

  // As marcações, na ordem das pesquisas. Pesquisa que saiu da lista não aparece.
  async function markedOf(client, { provider, subject }) {
    const result = await client.query(
      "SELECT survey_id FROM profile_surveys WHERE provider = $1 AND subject = $2",
      [provider, subject],
    );
    const marked = new Set(result.rows.map((row) => row.survey_id));
    return surveys.filter((survey) => marked.has(survey.id));
  }

  // A primeira colocada da pessoa em cada pesquisa dada em que ela tem rodada
  // respondida, pelas mesmas rodadas que o progresso e o resultado usam.
  async function firstPlacesOf(client, playerId, list) {
    const places = [];
    for (const survey of list) {
      const { ranking } = await personResult(client, survey, playerId);
      if (ranking.length) places.push({ survey, cardId: ranking[0].cardId });
    }
    return places;
  }

  async function ownView(client, playerId, account) {
    const settings = await settingsOf(client, account);
    const marked = await markedOf(client, account);
    return {
      enabled: Boolean(settings?.enabled),
      handle: settings?.handle ?? null,
      consentVersion: settings?.consent_version ?? null,
      consentedAt: settings?.consented_at ? new Date(settings.consented_at).toISOString() : null,
      surveys: marked.map((survey) => survey.id),
      firstPlaces: (await firstPlacesOf(client, playerId, surveys)).map(({ survey, cardId }) => ({ surveyId: survey.id, cardId })),
      canEnable: await hasRegistration(client, playerId),
    };
  }

  return {
    /** A vista da própria pessoa. Exige conta Google; cadastro não é exigido para ler. */
    async myProfile(recoveryKey) {
      return withClient(async (client) => {
        const player = await findPlayer(client, recoveryKey);
        const account = await googleAccount(client, player.id);
        if (!account) throw googleAccountRequired();
        return ownView(client, player.id, account);
      });
    },

    /**
     * Liga, desliga e muda as marcações. Ligar exige conta com cadastro;
     * desligar só exige a conta, para que nada impeça desligar. O nome de
     * perfil, depois de gravado, não muda: um link antigo nunca passa a
     * mostrar as escolhas de outra pessoa.
     */
    async updateProfile({ recoveryKey, now, ...body } = {}) {
      const change = checkProfileUpdate(body, surveys);
      const at = instant(now);
      return withClient(async (client) => {
        // findPlayer trava `player:<id>`.
        const player = await findPlayer(client, recoveryKey);
        if (change.enabled && !(await hasRegistration(client, player.id))) throw registrationRequiredError();
        const account = await googleAccount(client, player.id);
        if (!account) throw registrationRequiredError();
        // A conta pode estar em mais de um jogador ao longo do tempo: a trava
        // da conta põe em fila dois pedidos dela, mesmo de jogadores diferentes.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`profile:${account.provider}:${account.subject}`]);
        const current = await settingsOf(client, account);
        let next;
        if (change.enabled) {
          const handle = change.handle ?? current?.handle;
          if (!handle) throw invalidProfile("handle");
          // O nome já gravado não muda.
          if (current?.handle && handle !== current.handle) throw invalidProfile("handle-locked");
          if (handle !== current?.handle) {
            const taken = await client.query(
              "SELECT 1 FROM profile_settings WHERE lower(handle) = $1 AND NOT (provider = $2 AND subject = $3)",
              [handle, account.provider, account.subject],
            );
            if (taken.rowCount) throw handleTaken();
          }
          // A data do aceite só muda quando o perfil é ligado de novo ou a versão muda.
          const keepsConsent = current?.enabled && current.consent_version === change.consentVersion;
          next = {
            handle,
            enabled: true,
            consentVersion: change.consentVersion,
            consentedAt: keepsConsent ? current.consented_at : at,
          };
        } else {
          next = {
            handle: current?.handle ?? null,
            enabled: false,
            consentVersion: current?.consent_version ?? null,
            consentedAt: current?.consented_at ?? null,
          };
        }
        try {
          await client.query(`INSERT INTO profile_settings
              (provider, subject, handle, enabled, consent_version, consented_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (provider, subject) DO UPDATE SET
              handle = EXCLUDED.handle,
              enabled = EXCLUDED.enabled,
              consent_version = EXCLUDED.consent_version,
              consented_at = EXCLUDED.consented_at,
              updated_at = EXCLUDED.updated_at`,
          [account.provider, account.subject, next.handle, next.enabled, next.consentVersion, next.consentedAt, at]);
        } catch (error) {
          // Outra conta gravou o mesmo nome depois da conferência acima: o
          // índice único segura este pedido até ela terminar e então recusa.
          if (error?.code === "23505" && error.constraint === HANDLE_INDEX) throw handleTaken();
          throw error;
        }
        if (change.surveys) {
          await client.query("DELETE FROM profile_surveys WHERE provider = $1 AND subject = $2", [account.provider, account.subject]);
          if (change.surveys.length) {
            await client.query(
              "INSERT INTO profile_surveys (provider, subject, survey_id) SELECT $1, $2, unnest($3::text[])",
              [account.provider, account.subject, change.surveys],
            );
          }
        }
        return ownView(client, player.id, account);
      });
    },

    /**
     * O perfil público pelo nome. Desligado, inexistente ou nome inválido:
     * a mesma recusa. Só pesquisas marcadas com rodada respondida, na ordem
     * das pesquisas.
     */
    async publicProfile(handleParam) {
      const handle = normalizeHandle(handleParam);
      if (!isValidHandle(handle)) throw profileNotFound();
      return withClient(async (client) => {
        const found = await client.query(`SELECT s.provider, s.subject, s.handle, i.player_id
          FROM profile_settings s
          JOIN player_identities i ON i.provider = s.provider AND i.subject = s.subject
          WHERE lower(s.handle) = $1 AND s.enabled`, [handle]);
        const row = found.rows[0];
        if (!row) throw profileNotFound();
        const marked = await markedOf(client, row);
        const places = await firstPlacesOf(client, row.player_id, marked);
        return {
          handle: row.handle,
          surveys: places.map(({ survey, cardId }) => ({ surveyId: survey.id, subject: survey.subject, question: survey.question, cardId })),
        };
      });
    },
  };
}
