import { randomUUID } from "node:crypto";

// Banco em memória para os testes de unidade do store da pesquisa por foto.
// Entende só as consultas que o store faz e aplica as restrições das tabelas
// de verdade: chaves primárias, recibo único em cada tabela, resposta só com
// sorteio da mesma rodada e rodada a partir de 2 nas tabelas de rodadas.
// Consulta desconhecida é erro, para o teste não passar sem olhar o banco.
// O SQL de verdade, as travas e a imutabilidade são provados num PostgreSQL
// em back/scripts/photo-survey-smoke.mjs.
//
// Perfil (ICM 76, #354): entende também as consultas do store do perfil, com
// a conta Google de cada jogador (player_identities), as duas tabelas do
// perfil, o nome único sem diferença de caixa e a regra de "ligado só com
// nome, aceite e data". O SQL de verdade e a disputa simultânea pelo mesmo
// nome são provados em back/scripts/profile-smoke.mjs.

const squash = (sql) => sql.replace(/\s+/g, " ").trim();
const result = (rows) => ({ rowCount: rows.length, rows });

function constraint(message) {
  return Object.assign(new Error(message), { code: "23505" });
}

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export function createPhotoSurveyMemoryDb() {
  let tables = {
    draws: [], responses: [], roundDraws: [], roundResponses: [], links: [],
    identities: [], profileSettings: [], profileSurveys: [],
  };
  const players = new Map();
  const statements = [];
  // Chamado uma vez antes da próxima gravação em profile_settings: o teste
  // planta ali o que outra conta gravou entre a conferência e a gravação.
  let beforeProfileUpsert = null;
  // Uma transação por vez, como a trava por jogador faz no banco de verdade.
  let queue = Promise.resolve();

  const sameRound = (row, surveyId, playerId, round) => row.survey_id === surveyId && row.player_id === playerId && row.round === round;
  const receiptRow = (row) => ({
    answer_id: row.answer_id,
    shown_ids: row.shown_ids,
    pick_ids: row.pick_ids,
    champion_id: row.champion_id,
    responded_at: row.responded_at,
  });

  function run(sql, values) {
    if (sql.includes("pg_advisory_xact_lock")) return result([{}]);

    if (sql.startsWith("SELECT answer_id, shown_ids, pick_ids, champion_id, responded_at FROM photo_survey_responses") && sql.includes("player_history_links")) {
      const [surveyId, playerId] = values;
      const identity = new Set([playerId, ...tables.links.filter((link) => link.player_id === playerId).map((link) => link.source_player_id)]);
      const rows = tables.responses
        .filter((row) => row.survey_id === surveyId && identity.has(row.player_id))
        .sort((left, right) => left.responded_at - right.responded_at || left.answer_id.localeCompare(right.answer_id));
      return result(rows.slice(0, 1).map(receiptRow));
    }

    if (sql.startsWith("SELECT shown_ids FROM photo_survey_draws WHERE survey_id = $1 AND player_id = $2")) {
      const [surveyId, playerId] = values;
      return result(tables.draws.filter((row) => row.survey_id === surveyId && row.player_id === playerId).map((row) => ({ shown_ids: row.shown_ids })));
    }

    if (sql.startsWith("INSERT INTO photo_survey_draws(survey_id, player_id, shown_ids, issued_at)")) {
      const [surveyId, playerId, shownIds, issuedAt] = values;
      if (tables.draws.some((row) => row.survey_id === surveyId && row.player_id === playerId)) throw constraint("photo_survey_draws_pkey");
      tables.draws.push({ survey_id: surveyId, player_id: playerId, shown_ids: [...shownIds], issued_at: issuedAt });
      return result([]);
    }

    if (sql.startsWith("INSERT INTO photo_survey_responses (survey_id, player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at)")) {
      const [surveyId, playerId, answerId, shownIds, pickIds, championId, respondedAt] = values;
      if (tables.responses.some((row) => row.answer_id === answerId)) return result([]);
      if (tables.responses.some((row) => row.survey_id === surveyId && row.player_id === playerId)) throw constraint("photo_survey_responses_pkey");
      if (!tables.draws.some((row) => row.survey_id === surveyId && row.player_id === playerId)) throw constraint("resposta sem sorteio");
      const row = { survey_id: surveyId, player_id: playerId, answer_id: answerId, shown_ids: [...shownIds], pick_ids: [...pickIds], champion_id: championId, responded_at: respondedAt };
      tables.responses.push(row);
      return result([receiptRow(row)]);
    }

    if (sql.startsWith("SELECT d.round, d.player_id AS owner_id, d.shown_ids AS draw_ids, r.answer_id, r.shown_ids, r.pick_ids, r.champion_id, r.responded_at FROM photo_survey_round_draws d LEFT JOIN photo_survey_round_responses r") && sql.includes("player_history_links")) {
      const [surveyId, playerId] = values;
      const identity = new Set([playerId, ...tables.links.filter((link) => link.player_id === playerId).map((link) => link.source_player_id)]);
      const rows = tables.roundDraws
        .filter((row) => row.survey_id === surveyId && identity.has(row.player_id))
        .map((draw) => ({ draw, response: tables.roundResponses.find((row) => sameRound(row, surveyId, draw.player_id, draw.round)) || null }))
        // A ordem do banco: rodada; respondida antes de aberta; a resposta mais
        // antiga; o sorteio mais antigo; o jogador.
        .sort((left, right) => left.draw.round - right.draw.round
          || Number(!left.response) - Number(!right.response)
          || (left.response && right.response ? left.response.responded_at - right.response.responded_at : 0)
          || left.draw.issued_at - right.draw.issued_at
          || left.draw.player_id.localeCompare(right.draw.player_id))
        .map(({ draw, response }) => {
          const empty = { answer_id: null, shown_ids: null, pick_ids: null, champion_id: null, responded_at: null };
          return { round: draw.round, owner_id: draw.player_id, draw_ids: draw.shown_ids, ...(response ? receiptRow(response) : empty) };
        });
      return result(rows);
    }

    if (sql.startsWith("INSERT INTO photo_survey_round_draws(survey_id, player_id, round, shown_ids, issued_at)")) {
      const [surveyId, playerId, round, shownIds, issuedAt] = values;
      if (!Number.isInteger(round) || round < 2) throw constraint("photo_survey_round_draws_round_check");
      if (tables.roundDraws.some((row) => sameRound(row, surveyId, playerId, round))) throw constraint("photo_survey_round_draws_pkey");
      tables.roundDraws.push({ survey_id: surveyId, player_id: playerId, round, shown_ids: [...shownIds], issued_at: issuedAt });
      return result([]);
    }

    if (sql.startsWith("INSERT INTO photo_survey_round_responses (survey_id, player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at, round)")) {
      const [surveyId, playerId, answerId, shownIds, pickIds, championId, respondedAt, round] = values;
      if (tables.roundResponses.some((row) => row.answer_id === answerId)) return result([]);
      if (!Number.isInteger(round) || round < 2) throw constraint("photo_survey_round_responses_round_check");
      if (tables.roundResponses.some((row) => sameRound(row, surveyId, playerId, round))) throw constraint("photo_survey_round_responses_pkey");
      if (!tables.roundDraws.some((row) => sameRound(row, surveyId, playerId, round))) throw constraint("resposta sem sorteio da rodada");
      const row = { survey_id: surveyId, player_id: playerId, round, answer_id: answerId, shown_ids: [...shownIds], pick_ids: [...pickIds], champion_id: championId, responded_at: respondedAt };
      tables.roundResponses.push(row);
      return result([receiptRow(row)]);
    }

    if (sql.startsWith("SELECT 1 FROM photo_survey_responses WHERE answer_id = $1 UNION ALL SELECT 1 FROM photo_survey_round_responses WHERE answer_id = $1")) {
      const [answerId] = values;
      const used = [...tables.responses, ...tables.roundResponses].some((row) => row.answer_id === answerId);
      return result(used ? [{}] : []);
    }

    // --- Perfil (ICM 76) ---
    const sameAccount = (row, provider, subject) => row.provider === provider && row.subject === subject;

    if (sql === "SELECT provider, subject FROM player_identities WHERE provider = 'google' AND player_id = $1") {
      const [playerId] = values;
      return result(tables.identities.filter((row) => row.provider === "google" && row.player_id === playerId).map(({ provider, subject }) => ({ provider, subject })));
    }

    if (sql === "SELECT handle, enabled, consent_version, consented_at FROM profile_settings WHERE provider = $1 AND subject = $2") {
      const [provider, subject] = values;
      return result(tables.profileSettings.filter((row) => sameAccount(row, provider, subject))
        .map(({ handle, enabled, consent_version, consented_at }) => ({ handle, enabled, consent_version, consented_at })));
    }

    if (sql === "SELECT survey_id FROM profile_surveys WHERE provider = $1 AND subject = $2") {
      const [provider, subject] = values;
      return result(tables.profileSurveys.filter((row) => sameAccount(row, provider, subject)).map(({ survey_id }) => ({ survey_id })));
    }

    if (sql === "SELECT 1 FROM profile_settings WHERE lower(handle) = $1 AND NOT (provider = $2 AND subject = $3)") {
      const [handle, provider, subject] = values;
      return result(tables.profileSettings.filter((row) => row.handle?.toLowerCase() === handle && !sameAccount(row, provider, subject)).map(() => ({})));
    }

    if (sql.startsWith("INSERT INTO profile_settings (provider, subject, handle, enabled, consent_version, consented_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (provider, subject) DO UPDATE SET")) {
      if (beforeProfileUpsert) {
        const plant = beforeProfileUpsert;
        beforeProfileUpsert = null;
        plant(tables);
      }
      const [provider, subject, handle, enabled, consentVersion, consentedAt, updatedAt] = values;
      if (!tables.identities.some((row) => sameAccount(row, provider, subject))) throw Object.assign(new Error("profile_settings sem conta"), { code: "23503" });
      if (handle !== null && !HANDLE_PATTERN.test(handle)) throw Object.assign(new Error("profile_settings_handle_check"), { code: "23514" });
      if (enabled && (handle === null || consentVersion === null || consentedAt === null)) throw Object.assign(new Error("profile_settings_check"), { code: "23514" });
      if (handle !== null && tables.profileSettings.some((row) => row.handle?.toLowerCase() === handle.toLowerCase() && !sameAccount(row, provider, subject))) {
        throw Object.assign(constraint("profile_settings_handle_idx"), { constraint: "profile_settings_handle_idx" });
      }
      const row = { provider, subject, handle, enabled, consent_version: consentVersion, consented_at: consentedAt, updated_at: updatedAt };
      const index = tables.profileSettings.findIndex((entry) => sameAccount(entry, provider, subject));
      if (index >= 0) tables.profileSettings[index] = row;
      else tables.profileSettings.push(row);
      return result([]);
    }

    if (sql === "DELETE FROM profile_surveys WHERE provider = $1 AND subject = $2") {
      const [provider, subject] = values;
      const before = tables.profileSurveys.length;
      tables.profileSurveys = tables.profileSurveys.filter((row) => !sameAccount(row, provider, subject));
      return { rowCount: before - tables.profileSurveys.length, rows: [] };
    }

    if (sql === "INSERT INTO profile_surveys (provider, subject, survey_id) SELECT $1, $2, unnest($3::text[])") {
      const [provider, subject, surveyIds] = values;
      if (!tables.profileSettings.some((row) => sameAccount(row, provider, subject))) throw Object.assign(new Error("profile_surveys sem perfil"), { code: "23503" });
      for (const surveyId of surveyIds) {
        if (tables.profileSurveys.some((row) => sameAccount(row, provider, subject) && row.survey_id === surveyId)) throw constraint("profile_surveys_pkey");
        tables.profileSurveys.push({ provider, subject, survey_id: surveyId });
      }
      return result([]);
    }

    if (sql.startsWith("SELECT s.provider, s.subject, s.handle, i.player_id FROM profile_settings s JOIN player_identities i")
      && sql.endsWith("WHERE lower(s.handle) = $1 AND s.enabled")) {
      const [handle] = values;
      const rows = tables.profileSettings
        .filter((row) => row.enabled && row.handle?.toLowerCase() === handle)
        .flatMap((row) => tables.identities.filter((identity) => sameAccount(identity, row.provider, row.subject))
          .map((identity) => ({ provider: row.provider, subject: row.subject, handle: row.handle, player_id: identity.player_id })));
      return result(rows);
    }

    throw new Error(`consulta inesperada: ${sql}`);
  }

  const pool = {
    async connect() {
      let release;
      const turn = new Promise((resolve) => { release = resolve; });
      const previous = queue;
      queue = previous.then(() => turn);
      await previous;
      let snapshot = null;
      return {
        async query(text, values = []) {
          const sql = squash(text);
          statements.push(sql);
          if (sql === "BEGIN") { snapshot = structuredClone(tables); return result([]); }
          if (sql === "COMMIT") { snapshot = null; return result([]); }
          if (sql === "ROLLBACK") { if (snapshot) tables = snapshot; snapshot = null; return result([]); }
          return run(sql, values);
        },
        release,
      };
    },
  };

  return {
    pool,
    // Como o findPlayer do servidor: devolve o jogador da chave ou recusa com 401.
    async findPlayer(_client, recoveryKey) {
      const player = players.get(recoveryKey);
      if (!player) throw Object.assign(new Error("sessão não encontrada ou expirada"), { status: 401 });
      return { id: player.id };
    },
    // Como o requireCpfRegistration do servidor: sem cadastro, 403.
    async requireRegistration(_client, playerId) {
      const player = [...players.values()].find((entry) => entry.id === playerId);
      if (!player?.registered) {
        throw Object.assign(new Error("cadastro com CPF obrigatório para responder"), { status: 403, code: "CPF_REGISTRATION_REQUIRED" });
      }
    },
    // Como o hasCpfRegistration do servidor: a conta do jogador tem cadastro.
    async hasRegistration(_client, playerId) {
      const player = [...players.values()].find((entry) => entry.id === playerId);
      return Boolean(player?.registered) && tables.identities.some((row) => row.player_id === playerId);
    },
    // `account: false` é um visitante anônimo, sem conta Google.
    addPlayer({ registered = true, account = true } = {}) {
      const player = { id: randomUUID(), key: `pms_${randomUUID()}`, registered, subject: account ? `google-${randomUUID()}` : null };
      players.set(player.key, player);
      if (account) tables.identities.push({ provider: "google", subject: player.subject, player_id: player.id });
      return player;
    },
    // A conta de `from` passa a ter `to` como jogador ativo, como no login
    // que reúne dois históricos; `from` fica ligado a `to`.
    moveAccount(from, to) {
      const identity = tables.identities.find((row) => row.subject === from.subject);
      identity.player_id = to.id;
      to.subject = from.subject;
      to.registered = from.registered;
      from.subject = null;
      tables.links.push({ source_player_id: from.id, player_id: to.id });
    },
    // Uma vez, antes da próxima gravação em profile_settings.
    onProfileUpsert(plant) {
      beforeProfileUpsert = plant;
    },
    // A conta do jogador deixa de ter cadastro.
    unregister(player) {
      players.get(player.key).registered = false;
    },
    // O jogador `source` foi incorporado a `player` no login Google.
    link(source, player) {
      tables.links.push({ source_player_id: source.id, player_id: player.id });
    },
    counts() {
      return {
        draws: tables.draws.length,
        responses: tables.responses.length,
        roundDraws: tables.roundDraws.length,
        roundResponses: tables.roundResponses.length,
      };
    },
    profileCounts() {
      return { settings: tables.profileSettings.length, surveys: tables.profileSurveys.length };
    },
    rows(table) {
      return structuredClone(tables[table]);
    },
    statements,
  };
}
