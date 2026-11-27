import { randomInt as cryptoRandomInt } from "node:crypto";
import {
  PHOTO_SURVEYS,
  drawCards,
  drawGroups,
  drawRound,
  personalRanking,
  photoSurveyById,
  publicPhotoSurvey,
  seenPairKeys,
  surveyProgress,
  totalPairCount,
  validateBracket,
} from "../../shared/photo-survey.js";
import { requireCpfRegistration } from "./registration-store.js";

// Pesquisa por foto (ICM 68, #324): o servidor emite o sorteio de cada
// jogador e grava a resposta dele uma única vez por rodada. Nada aqui toca
// votos, Elo nem cotas do jogo atual.
//
// Desde a ICM 71 (#336) o sorteio e a resposta só valem para a conta com
// cadastro com CPF. A conferência acontece antes de qualquer leitura ou
// gravação, em toda rodada: sem cadastro, nem a resposta já dada é devolvida.
//
// Rodadas (ICM 75, #350): depois de responder, a pessoa pode jogar rodadas
// novas da mesma pesquisa enquanto houver dupla de cartas que ela ainda não
// viu. Uma rodada só começa depois de a anterior ser respondida.
// - A rodada 1 fica em photo_survey_draws e photo_survey_responses e segue a
//   regra de identidade: o jogador mais os anônimos ligados a ele no login
//   Google, valendo a resposta mais antiga.
// - As rodadas 2 em diante ficam em photo_survey_round_draws e
//   photo_survey_round_responses e seguem a mesma regra de identidade: são
//   procuradas no jogador e nos ligados a ele, e a rodada nova é gravada no
//   nome do jogador ativo.
// - Nenhuma rota soma respostas. O progresso e a última rodada respondida
//   devolvidos são os da própria pessoa.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function surveyError(message, status, code, current) {
  const error = Object.assign(new Error(message), { status, code });
  if (current !== undefined) error.current = current;
  return error;
}

const invalidResponse = (reason) => surveyError(
  "resposta não corresponde ao sorteio",
  400,
  "PHOTO_SURVEY_RESPONSE_INVALID",
  { reason },
);

const invalidDraw = (reason) => surveyError(
  "pedido de sorteio inválido",
  400,
  "PHOTO_SURVEY_DRAW_INVALID",
  { reason },
);

// `next` pede a rodada seguinte: só verdadeiro ou falso. `round` diz a que
// rodada a resposta pertence: só inteiro a partir de 1. Ausentes, vale o
// comportamento de quem não conhece rodadas.
export const isPhotoSurveyNext = (value) => value === undefined || typeof value === "boolean";
export const isPhotoSurveyRound = (value) => value === undefined || (Number.isSafeInteger(value) && value >= 1);

// Migração aditiva. `reject_vote_mutation()` é criada por createCleanSchema,
// que roda antes na mesma transação de boot.
export async function installPhotoSurveySchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS photo_survey_draws (
      survey_id text NOT NULL,
      player_id uuid NOT NULL REFERENCES anonymous_players(id),
      shown_ids text[] NOT NULL CHECK (cardinality(shown_ids) > 0),
      issued_at timestamptz NOT NULL,
      PRIMARY KEY (survey_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS photo_survey_responses (
      survey_id text NOT NULL,
      player_id uuid NOT NULL REFERENCES anonymous_players(id),
      answer_id uuid NOT NULL UNIQUE,
      shown_ids text[] NOT NULL CHECK (cardinality(shown_ids) > 0),
      pick_ids text[] NOT NULL CHECK (cardinality(pick_ids) > 0),
      champion_id text NOT NULL,
      responded_at timestamptz NOT NULL,
      PRIMARY KEY (survey_id, player_id),
      FOREIGN KEY (survey_id, player_id) REFERENCES photo_survey_draws (survey_id, player_id)
    );

    DROP TRIGGER IF EXISTS photo_survey_draws_are_immutable ON photo_survey_draws;
    CREATE TRIGGER photo_survey_draws_are_immutable
      BEFORE UPDATE OR DELETE ON photo_survey_draws
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();

    DROP TRIGGER IF EXISTS photo_survey_responses_are_immutable ON photo_survey_responses;
    CREATE TRIGGER photo_survey_responses_are_immutable
      BEFORE UPDATE OR DELETE ON photo_survey_responses
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();

    -- O login Google pergunta, por jogador, se ele participou de alguma pesquisa.
    CREATE INDEX IF NOT EXISTS photo_survey_draws_player_idx ON photo_survey_draws (player_id);

    INSERT INTO schema_migrations(id) VALUES ('2026-11-13-photo-survey-v1') ON CONFLICT DO NOTHING;

    -- Rodadas 2 em diante (ICM 75, #350). A rodada 1 continua nas duas
    -- tabelas acima, que não mudam. A resposta referencia o sorteio da mesma
    -- rodada, e as duas tabelas são imutáveis como as da rodada 1.
    CREATE TABLE IF NOT EXISTS photo_survey_round_draws (
      survey_id text NOT NULL,
      player_id uuid NOT NULL REFERENCES anonymous_players(id),
      round integer NOT NULL CHECK (round >= 2),
      shown_ids text[] NOT NULL CHECK (cardinality(shown_ids) > 0),
      issued_at timestamptz NOT NULL,
      PRIMARY KEY (survey_id, player_id, round)
    );
    CREATE TABLE IF NOT EXISTS photo_survey_round_responses (
      survey_id text NOT NULL,
      player_id uuid NOT NULL REFERENCES anonymous_players(id),
      round integer NOT NULL CHECK (round >= 2),
      answer_id uuid NOT NULL UNIQUE,
      shown_ids text[] NOT NULL CHECK (cardinality(shown_ids) > 0),
      pick_ids text[] NOT NULL CHECK (cardinality(pick_ids) > 0),
      champion_id text NOT NULL,
      responded_at timestamptz NOT NULL,
      PRIMARY KEY (survey_id, player_id, round),
      FOREIGN KEY (survey_id, player_id, round) REFERENCES photo_survey_round_draws (survey_id, player_id, round)
    );

    DROP TRIGGER IF EXISTS photo_survey_round_draws_are_immutable ON photo_survey_round_draws;
    CREATE TRIGGER photo_survey_round_draws_are_immutable
      BEFORE UPDATE OR DELETE ON photo_survey_round_draws
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();

    DROP TRIGGER IF EXISTS photo_survey_round_responses_are_immutable ON photo_survey_round_responses;
    CREATE TRIGGER photo_survey_round_responses_are_immutable
      BEFORE UPDATE OR DELETE ON photo_survey_round_responses
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();

    INSERT INTO schema_migrations(id) VALUES ('2026-11-26-photo-survey-rounds-v1') ON CONFLICT DO NOTHING;
  `);
}

// Usado pelo login Google: um anônimo que participou de uma pesquisa, mesmo
// sem jogar, precisa ser ligado à conta. Basta o sorteio: se a chave anônima
// continuasse valendo, uma aba aberta com ela gravaria uma segunda resposta
// da mesma pessoa. Toda resposta tem sorteio, então contar sorteios cobre os
// dois casos. Só os sorteios da rodada 1 entram na conta: as rodadas
// seguintes exigem cadastro, e jogador sem conta não tem cadastro.
export async function photoSurveyParticipation(client, playerId) {
  const result = await client.query(
    "SELECT count(*)::integer AS count FROM photo_survey_draws WHERE player_id = $1",
    [playerId],
  );
  return Number(result.rows[0].count);
}

const sameIds = (left, right) => Array.isArray(right)
  && left.length === right.length
  && left.every((id, index) => id === right[index]);

function publicResponse(row) {
  return {
    answerId: row.answer_id,
    pickIds: row.pick_ids,
    championId: row.champion_id,
    respondedAt: new Date(row.responded_at).toISOString(),
  };
}

// A identidade é o jogador mais os anônimos incorporados a ele no login
// Google. Vale a resposta mais antiga. As rodadas seguintes usam a mesma
// identidade, em personRounds.
async function identityResponse(client, surveyId, playerId) {
  const result = await client.query(`SELECT answer_id, shown_ids, pick_ids, champion_id, responded_at
    FROM photo_survey_responses
    WHERE survey_id = $1
      AND player_id IN (SELECT $2::uuid UNION ALL SELECT source_player_id FROM player_history_links WHERE player_id = $2)
    ORDER BY responded_at, answer_id LIMIT 1`, [surveyId, playerId]);
  return result.rows[0] || null;
}

async function playerDraw(client, surveyId, playerId) {
  const result = await client.query(
    "SELECT shown_ids FROM photo_survey_draws WHERE survey_id = $1 AND player_id = $2",
    [surveyId, playerId],
  );
  return result.rows[0]?.shown_ids || null;
}

// As rodadas da pessoa na pesquisa, em ordem: o número, as cartas do
// sorteio e a resposta gravada, ou null enquanto a rodada está aberta.
// A rodada 1 respondida usa as cartas da resposta da identidade. As rodadas
// seguintes seguem a mesma identidade: o jogador mais os incorporados a ele.
// Quando dois jogadores da mesma identidade têm a mesma rodada, vale a
// respondida mais antiga e, sem resposta, o sorteio mais antigo. `ownerId`
// é o jogador em cujo nome o sorteio da rodada foi gravado: a resposta dela
// é gravada no mesmo nome.
export async function personRounds(client, survey, playerId) {
  const first = await identityResponse(client, survey.id, playerId);
  const firstShown = first ? first.shown_ids : await playerDraw(client, survey.id, playerId);
  const rounds = firstShown ? [{ round: 1, shownIds: firstShown, response: first, ownerId: playerId }] : [];
  const later = await client.query(`SELECT d.round, d.player_id AS owner_id, d.shown_ids AS draw_ids,
      r.answer_id, r.shown_ids, r.pick_ids, r.champion_id, r.responded_at
    FROM photo_survey_round_draws d
    LEFT JOIN photo_survey_round_responses r
      ON r.survey_id = d.survey_id AND r.player_id = d.player_id AND r.round = d.round
    WHERE d.survey_id = $1
      AND d.player_id IN (SELECT $2::uuid UNION ALL SELECT source_player_id FROM player_history_links WHERE player_id = $2)
    ORDER BY d.round, (r.answer_id IS NULL), r.responded_at, d.issued_at, d.player_id`, [survey.id, playerId]);
  for (const row of later.rows) {
    const round = Number(row.round);
    // A ordem da consulta põe primeiro a linha que vale em cada rodada.
    if (rounds.some((entry) => entry.round === round)) continue;
    rounds.push({ round, shownIds: row.draw_ids, response: row.answer_id ? row : null, ownerId: row.owner_id });
  }
  return rounds;
}

// As rodadas respondidas, no formato de seenPairKeys, surveyProgress e
// personalRanking.
export const answeredRounds = (rounds) => rounds
  .filter((entry) => entry.response)
  .map((entry) => ({ shownIds: entry.response.shown_ids, pickIds: entry.response.pick_ids, championId: entry.response.champion_id }));

// Resultado da pessoa (ICM 76, #354, decisão 0008): as mesmas rodadas
// respondidas que o progresso usa, pontuadas por personalRanking. Só lê.
export async function personResult(client, survey, playerId) {
  const answered = answeredRounds(await personRounds(client, survey, playerId));
  return { answeredRounds: answered.length, ranking: personalRanking(survey, answered) };
}

export function photoSurveyStore({
  pool,
  findPlayer,
  clock = () => new Date(),
  surveys = PHOTO_SURVEYS,
  randomInt = cryptoRandomInt,
  requireRegistration = requireCpfRegistration,
}) {
  function requiredSurvey(surveyId) {
    const survey = photoSurveyById(typeof surveyId === "string" ? surveyId : "", surveys);
    if (!survey) throw surveyError("pesquisa não encontrada", 404, "PHOTO_SURVEY_NOT_FOUND");
    return survey;
  }

  const instant = (now) => (now instanceof Date ? now : clock());
  const drawView = (survey, shownIds) => ({ groups: drawGroups(shownIds, survey.groupSize) });
  const closedError = (status) => surveyError("pesquisa fechada", 409, "PHOTO_SURVEY_CLOSED", { status });

  // findPlayer trava `player:<id>` até o fim da transação: sorteios e
  // respostas do mesmo jogador, em abas diferentes, entram em fila.
  async function transaction(recoveryKey, fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const player = await findPlayer(client, recoveryKey);
      await requireRegistration(client, player.id);
      const result = await fn(client, player);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // O progresso é só da pessoa que pede: rodadas respondidas e duplas vistas
  // por ela. Com rodada aberta não cabe outra, então `canContinue` é falso.
  function progressOf(survey, rounds, status) {
    const progress = surveyProgress(survey, answeredRounds(rounds), status);
    return { ...progress, canContinue: progress.canContinue && rounds.every((entry) => entry.response) };
  }

  // A última rodada que a pessoa respondeu: a própria rodada devolvida, quando
  // ela está respondida, ou a anterior, quando há rodada aberta. Sem rodada
  // respondida, null. É o que a tela usa para mostrar a escolha da pessoa
  // enquanto a rodada nova não tem resposta.
  function lastAnsweredOf(rounds) {
    const entry = rounds.findLast((candidate) => candidate.response);
    return entry ? { round: entry.round, response: publicResponse(entry.response) } : null;
  }

  // O que as duas rotas devolvem sobre uma rodada: os campos de antes das
  // rodadas (`survey`, `draw`, `response`) mais `round`, `progress` e
  // `lastAnswered`.
  const roundView = (view, survey, rounds, entry) => ({
    survey: view,
    draw: drawView(survey, entry.shownIds),
    response: entry.response ? publicResponse(entry.response) : null,
    round: entry.round,
    progress: progressOf(survey, rounds, view.status),
    lastAnswered: lastAnsweredOf(rounds),
  });

  // O recibo é único entre todas as respostas, de todas as rodadas e das duas
  // tabelas. A trava é derivada do recibo e vale até o fim da transação: quem
  // chega depois com o mesmo recibo, de qualquer jogador, só confere as
  // tabelas quando a gravação anterior já terminou.
  async function receiptIsFree(client, receipt) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`photo-survey-receipt:${receipt}`]);
    const used = await client.query(`SELECT 1 FROM photo_survey_responses WHERE answer_id = $1
      UNION ALL
      SELECT 1 FROM photo_survey_round_responses WHERE answer_id = $1
      LIMIT 1`, [receipt]);
    return used.rowCount === 0;
  }

  return {
    async photoSurvey(surveyId, { now } = {}) {
      return publicPhotoSurvey(requiredSurvey(surveyId), instant(now));
    },

    // Resultado da pessoa (ICM 76, #354). As mesmas recusas do sorteio
    // (sessão, cadastro, pesquisa inexistente) e nenhuma gravação: com a
    // pesquisa fechada o resultado continua legível. Nada de outras pessoas.
    async photoSurveyResult(recoveryKey, surveyId) {
      const survey = requiredSurvey(surveyId);
      return transaction(recoveryKey, async (client, player) => ({
        surveyId: survey.id,
        ...(await personResult(client, survey, player.id)),
      }));
    },

    // Sem `next`: emite a rodada 1 para quem não tem rodada nenhuma e, para
    // os demais, devolve a última rodada, aberta ou respondida. Com `next`
    // verdadeiro, emite a rodada seguinte quando a última está respondida, a
    // pesquisa está aberta e sobra dupla por ver; nos outros casos responde
    // como sem `next`.
    async photoSurveyDraw(recoveryKey, surveyId, { now, next } = {}) {
      const survey = requiredSurvey(surveyId);
      if (!isPhotoSurveyNext(next)) throw invalidDraw("next");
      const at = instant(now);
      const view = publicPhotoSurvey(survey, at);
      return transaction(recoveryKey, async (client, player) => {
        const rounds = await personRounds(client, survey, player.id);
        const last = rounds.at(-1);
        if (!last) {
          if (view.status !== "open") throw closedError(view.status);
          const shownIds = drawCards(survey, (limit) => randomInt(limit));
          await client.query(
            "INSERT INTO photo_survey_draws(survey_id, player_id, shown_ids, issued_at) VALUES($1, $2, $3, $4)",
            [survey.id, player.id, shownIds, at],
          );
          rounds.push({ round: 1, shownIds, response: null, ownerId: player.id });
        } else if (next === true && last.response && view.status === "open") {
          const seen = seenPairKeys(survey, answeredRounds(rounds));
          if (seen.size < totalPairCount(survey)) {
            // As cartas da rodada nova saem do servidor, com prioridade para
            // as duplas que a pessoa ainda não viu.
            const shownIds = drawRound(survey, seen, (limit) => randomInt(limit));
            await client.query(
              "INSERT INTO photo_survey_round_draws(survey_id, player_id, round, shown_ids, issued_at) VALUES($1, $2, $3, $4, $5)",
              [survey.id, player.id, last.round + 1, shownIds, at],
            );
            rounds.push({ round: last.round + 1, shownIds, response: null, ownerId: player.id });
          }
        }
        return roundView(view, survey, rounds, rounds.at(-1));
      });
    },

    // Sem `round`, a resposta é da rodada 1: é o que manda um aplicativo de
    // antes das rodadas, que só conhece essa. Com `round`, a rodada precisa
    // existir: a aberta ou uma já respondida.
    async photoSurveyRespond({ recoveryKey, surveyId, answerId, pickIds, championId, round, now } = {}) {
      const survey = requiredSurvey(surveyId);
      if (typeof answerId !== "string" || !UUID_PATTERN.test(answerId)) throw invalidResponse("answer-id");
      if (!isPhotoSurveyRound(round)) throw invalidResponse("round");
      const receipt = answerId.toLowerCase();
      const at = instant(now);
      const view = publicPhotoSurvey(survey, at);
      return transaction(recoveryKey, async (client, player) => {
        const rounds = await personRounds(client, survey, player.id);
        const target = rounds.find((entry) => entry.round === (round === undefined ? 1 : round));
        if (!target) {
          if (round !== undefined) throw invalidResponse("round");
          throw surveyError("sorteio ainda não emitido", 409, "PHOTO_SURVEY_DRAW_REQUIRED");
        }
        if (target.response) {
          // A mesma escolha é uma repetição idempotente; outra escolha não
          // regrava, nem com o mesmo recibo.
          if (sameIds(target.response.pick_ids, pickIds) && target.response.champion_id === championId) {
            return { status: "alreadyProcessed", ...roundView(view, survey, rounds, target) };
          }
          throw surveyError(
            target.round === 1 ? "esta pesquisa já foi respondida" : "esta rodada já foi respondida",
            409,
            "PHOTO_SURVEY_ALREADY_ANSWERED",
            publicResponse(target.response),
          );
        }
        if (view.status !== "open") throw closedError(view.status);
        const bracket = validateBracket(survey, target.shownIds, { pickIds, championId });
        if (!bracket.ok) throw invalidResponse(bracket.reason);
        // Se o recibo já foi usado, por qualquer pessoa e em qualquer rodada,
        // nada é gravado aqui.
        if (!(await receiptIsFree(client, receipt))) throw invalidResponse("answer-id");
        // A resposta de uma rodada nova vai no nome de quem recebeu o sorteio dela.
        const values = [survey.id, target.round === 1 ? player.id : target.ownerId, receipt, target.shownIds, bracket.pickIds, bracket.championId, at];
        const inserted = target.round === 1
          ? await client.query(`INSERT INTO photo_survey_responses
              (survey_id, player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (answer_id) DO NOTHING
            RETURNING answer_id, shown_ids, pick_ids, champion_id, responded_at`, values)
          : await client.query(`INSERT INTO photo_survey_round_responses
              (survey_id, player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at, round)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (answer_id) DO NOTHING
            RETURNING answer_id, shown_ids, pick_ids, champion_id, responded_at`, [...values, target.round]);
        if (!inserted.rowCount) throw invalidResponse("answer-id");
        target.response = inserted.rows[0];
        return { status: "created", ...roundView(view, survey, rounds, target) };
      });
    },
  };
}
