// Regras da pesquisa por foto (ICM 68, #324). Funções puras, usadas pelo
// servidor e pela tela: definição das pesquisas, sorteio, telas e validação
// da chave. Nada aqui lê relógio, banco ou rede.

function definePhotoSurvey({ id, question, cardIds, drawSize, groupSize, opensAt = null, closesAt = null }) {
  const cards = Object.freeze([...cardIds].sort());
  if (new Set(cards).size !== cards.length) throw new Error(`pesquisa ${id}: carta repetida`);
  if (drawSize > cards.length || drawSize % groupSize !== 0) {
    throw new Error(`pesquisa ${id}: sorteio de ${drawSize} não fecha em telas de ${groupSize}`);
  }
  return Object.freeze({ id, question, cardIds: cards, drawSize, groupSize, opensAt, closesAt });
}

export const PHOTO_SURVEYS = Object.freeze([
  definePhotoSurvey({
    id: "politica-2026-01",
    question: "Quem você prefere?",
    // As 20 cartas "Políticos 2026", todas com a mesma moldura
    // (app/public/chromas/politicos). Cada jogador recebe 16 por sorteio.
    cardIds: [
      "andre-janones", "bruno-zambelli", "cabo-gilberto-silva", "carlos-bolsonaro", "deltan-dallagnol",
      "erika-hilton", "fernando-haddad", "geraldo-alckmin", "guilherme-boulos", "guilherme-derrite",
      "gustavo-gayer", "jeffrey-chiquini", "joao-campos", "lindbergh-farias", "lucas-pavanato",
      "marina-silva", "nikolas-ferreira", "samia-bonfim", "sergio-moro", "simone-tebet",
    ],
    drawSize: 16,
    groupSize: 4,
  }),
]);

export function photoSurveyById(id, surveys = PHOTO_SURVEYS) {
  return surveys.find((survey) => survey.id === id) || null;
}

// `opensAt` é inclusivo e `closesAt` exclusivo, como na edição diária.
export function photoSurveyStatus(survey, now) {
  const instant = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(instant)) throw new TypeError("instante inválido");
  if (survey.opensAt && instant < Date.parse(survey.opensAt)) return "scheduled";
  if (survey.closesAt && instant >= Date.parse(survey.closesAt)) return "closed";
  return "open";
}

export function publicPhotoSurvey(survey, now) {
  return {
    id: survey.id,
    question: survey.question,
    cardIds: [...survey.cardIds],
    drawSize: survey.drawSize,
    groupSize: survey.groupSize,
    screens: survey.drawSize / survey.groupSize,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
    status: photoSurveyStatus(survey, now),
  };
}

// Fisher–Yates parcial: cada carta tem a mesma chance de entrar e de ocupar
// cada posição. `randomInt(n)` devolve um inteiro em [0, n).
export function drawCards(survey, randomInt) {
  const deck = [...survey.cardIds];
  for (let index = 0; index < survey.drawSize; index += 1) {
    const remaining = deck.length - index;
    const offset = randomInt(remaining);
    if (!Number.isInteger(offset) || offset < 0 || offset >= remaining) {
      throw new RangeError("randomInt devolveu valor fora do intervalo");
    }
    [deck[index], deck[index + offset]] = [deck[index + offset], deck[index]];
  }
  return deck.slice(0, survey.drawSize);
}

export function drawGroups(shownIds, groupSize) {
  const groups = [];
  for (let start = 0; start < shownIds.length; start += groupSize) {
    groups.push(shownIds.slice(start, start + groupSize));
  }
  return groups;
}

const isCardIdList = (value, length) => Array.isArray(value)
  && value.length === length
  && value.every((id) => typeof id === "string" && id !== "")
  && new Set(value).size === length;

// A chave é conferida contra o sorteio gravado (`shownIds`), não contra o
// conjunto atual: uma carta retirada depois não invalida quem já a recebeu.
export function validateBracket(survey, shownIds, { pickIds, championId } = {}) {
  if (!isCardIdList(shownIds, survey.drawSize)) return { ok: false, reason: "shown" };
  const groups = drawGroups(shownIds, survey.groupSize);
  if (!isCardIdList(pickIds, groups.length)) return { ok: false, reason: "picks" };
  if (pickIds.some((id, index) => !groups[index].includes(id))) return { ok: false, reason: "pick-outside-group" };
  if (typeof championId !== "string" || !pickIds.includes(championId)) return { ok: false, reason: "champion" };
  return { ok: true, pickIds: [...pickIds], championId };
}
