import { randomUUID } from "node:crypto";

// Banco em memória para os testes de unidade do store da pesquisa por foto.
// Entende só as consultas que o store faz e aplica as restrições das tabelas
// de verdade: chaves primárias, recibo único em cada tabela, resposta só com
// sorteio da mesma rodada e rodada a partir de 2 nas tabelas de rodadas.
// Consulta desconhecida é erro, para o teste não passar sem olhar o banco.
// O SQL de verdade, as travas e a imutabilidade são provados num PostgreSQL
// em back/scripts/photo-survey-smoke.mjs.

const squash = (sql) => sql.replace(/\s+/g, " ").trim();
const result = (rows) => ({ rowCount: rows.length, rows });

function constraint(message) {
  return Object.assign(new Error(message), { code: "23505" });
}

export function createPhotoSurveyMemoryDb() {
  let tables = { draws: [], responses: [], roundDraws: [], roundResponses: [], links: [] };
  const players = new Map();
  const statements = [];
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
    addPlayer({ registered = true } = {}) {
      const player = { id: randomUUID(), key: `pms_${randomUUID()}`, registered };
      players.set(player.key, player);
      return player;
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
    rows(table) {
      return structuredClone(tables[table]);
    },
    statements,
  };
}
