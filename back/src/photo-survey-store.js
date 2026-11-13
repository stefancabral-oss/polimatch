import { randomInt as cryptoRandomInt } from "node:crypto";
import {
  PHOTO_SURVEYS,
  drawCards,
  drawGroups,
  photoSurveyById,
  publicPhotoSurvey,
  validateBracket,
} from "../../shared/photo-survey.js";

// Pesquisa por foto (ICM 68, #324): o servidor emite o sorteio de cada
// jogador e grava a resposta dele uma única vez. Nada aqui toca votos, Elo
// nem cotas do jogo atual.

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

    INSERT INTO schema_migrations(id) VALUES ('2026-11-13-photo-survey-v1') ON CONFLICT DO NOTHING;
  `);
}

// Usado pelo login Google: um anônimo que só respondeu a pesquisas, sem jogar,
// também precisa ser ligado à conta, senão a conta responderia de novo.
export async function photoSurveyResponseCount(client, playerId) {
  const result = await client.query(
    "SELECT count(*)::integer AS count FROM photo_survey_responses WHERE player_id = $1",
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

export function photoSurveyStore({
  pool,
  findPlayer,
  clock = () => new Date(),
  surveys = PHOTO_SURVEYS,
  randomInt = cryptoRandomInt,
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

  // A identidade é o jogador mais os anônimos incorporados a ele no login
  // Google. Vale a resposta mais antiga.
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

  return {
    async photoSurvey(surveyId, { now } = {}) {
      return publicPhotoSurvey(requiredSurvey(surveyId), instant(now));
    },

    async photoSurveyDraw(recoveryKey, surveyId, { now } = {}) {
      const survey = requiredSurvey(surveyId);
      const at = instant(now);
      const view = publicPhotoSurvey(survey, at);
      return transaction(recoveryKey, async (client, player) => {
        const prior = await identityResponse(client, survey.id, player.id);
        if (prior) return { survey: view, draw: drawView(survey, prior.shown_ids), response: publicResponse(prior) };
        let shownIds = await playerDraw(client, survey.id, player.id);
        if (!shownIds) {
          if (view.status !== "open") throw closedError(view.status);
          shownIds = drawCards(survey, (limit) => randomInt(limit));
          await client.query(
            "INSERT INTO photo_survey_draws(survey_id, player_id, shown_ids, issued_at) VALUES($1, $2, $3, $4)",
            [survey.id, player.id, shownIds, at],
          );
        }
        return { survey: view, draw: drawView(survey, shownIds), response: null };
      });
    },

    async photoSurveyRespond({ recoveryKey, surveyId, answerId, pickIds, championId, now } = {}) {
      const survey = requiredSurvey(surveyId);
      if (typeof answerId !== "string" || !UUID_PATTERN.test(answerId)) throw invalidResponse("answer-id");
      const receipt = answerId.toLowerCase();
      const at = instant(now);
      const view = publicPhotoSurvey(survey, at);
      return transaction(recoveryKey, async (client, player) => {
        const prior = await identityResponse(client, survey.id, player.id);
        if (prior) {
          const response = publicResponse(prior);
          // A mesma escolha é uma repetição idempotente; outra escolha não
          // regrava, nem com o mesmo recibo.
          if (sameIds(prior.pick_ids, pickIds) && prior.champion_id === championId) {
            return { status: "alreadyProcessed", survey: view, draw: drawView(survey, prior.shown_ids), response };
          }
          throw surveyError("esta pesquisa já foi respondida", 409, "PHOTO_SURVEY_ALREADY_ANSWERED", response);
        }
        const shownIds = await playerDraw(client, survey.id, player.id);
        if (!shownIds) throw surveyError("sorteio ainda não emitido", 409, "PHOTO_SURVEY_DRAW_REQUIRED");
        if (view.status !== "open") throw closedError(view.status);
        const bracket = validateBracket(survey, shownIds, { pickIds, championId });
        if (!bracket.ok) throw invalidResponse(bracket.reason);
        // O recibo é único entre todas as respostas: o de outra pessoa não serve.
        const taken = await client.query("SELECT 1 FROM photo_survey_responses WHERE answer_id = $1", [receipt]);
        if (taken.rowCount) throw invalidResponse("answer-id");
        const inserted = await client.query(`INSERT INTO photo_survey_responses
            (survey_id, player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING answer_id, shown_ids, pick_ids, champion_id, responded_at`,
        [survey.id, player.id, receipt, shownIds, bracket.pickIds, bracket.championId, at]);
        return {
          status: "created",
          survey: view,
          draw: drawView(survey, shownIds),
          response: publicResponse(inserted.rows[0]),
        };
      });
    },
  };
}
