// Regras da pesquisa por foto (ICM 68, #324). Funções puras, usadas pelo
// servidor e pela tela: definição das pesquisas, sorteio, telas, validação
// da chave e rodadas. Nada aqui lê relógio, banco ou rede.

// `note` é opcional: uma linha que a entrada da pesquisa mostra abaixo da pergunta.
// `people` é opcional e diz se as cartas são pessoas: a tela usa isso para
// perguntar "quem" ou "qual" (ICM 74, #348).
export function definePhotoSurvey({ id, subject, question, note = "", people = false, cardIds, drawSize, groupSize, opensAt = null, closesAt = null }) {
  if (!subject || !question) throw new Error(`pesquisa ${id}: falta o assunto ou a pergunta`);
  if (typeof note !== "string") throw new Error(`pesquisa ${id}: a observação precisa ser texto`);
  if (typeof people !== "boolean") throw new Error(`pesquisa ${id}: "people" precisa ser verdadeiro ou falso`);
  const cards = Object.freeze([...cardIds].sort());
  if (new Set(cards).size !== cards.length) throw new Error(`pesquisa ${id}: carta repetida`);
  if (drawSize > cards.length || drawSize % groupSize !== 0) {
    throw new Error(`pesquisa ${id}: sorteio de ${drawSize} não fecha em telas de ${groupSize}`);
  }
  return Object.freeze({ id, subject, question, note, people, cardIds: cards, drawSize, groupSize, opensAt, closesAt });
}

// As 20 cartas "Políticos 2026", todas com a mesma moldura
// (app/public/chromas/politicos). Cada jogador recebe 16 por sorteio.
const POLITICS_CARD_IDS = Object.freeze([
  "andre-janones", "bruno-zambelli", "cabo-gilberto-silva", "carlos-bolsonaro", "deltan-dallagnol",
  "erika-hilton", "fernando-haddad", "geraldo-alckmin", "guilherme-boulos", "guilherme-derrite",
  "gustavo-gayer", "jeffrey-chiquini", "joao-campos", "lindbergh-farias", "lucas-pavanato",
  "marina-silva", "nikolas-ferreira", "samia-bonfim", "sergio-moro", "simone-tebet",
]);

// As 16 peças da demonstração de roupas (ICM 73, #345), criadas pelo PoliMatch
// e todas no mesmo padrão de carta (app/public/chromas/roupas). O sorteio é
// de 16: todo mundo vê todas, só a ordem muda.
const CLOTHES_CARD_IDS = Object.freeze([
  "camiseta-onda", "camiseta-sol", "camiseta-raio", "camiseta-cacto", "camiseta-planeta", "camiseta-olho",
  "camiseta-chama", "camiseta-montanha", "camiseta-pipa", "camiseta-flor", "camiseta-xadrez", "camiseta-sem-pressa",
  "moletom-estrela", "moletom-arco", "moletom-folha", "moletom-lua",
]);

// As 20 cartas de famosos e influenciadores (ICM 74, #348), todas no mesmo
// padrão de carta (app/public/chromas/famosos), com foto de licença livre e o
// crédito na carta. Cada pessoa recebe 16 por sorteio, como na política.
const CELEBRITY_CARD_IDS = Object.freeze([
  "anitta", "ivete-sangalo", "ludmilla", "luisa-sonza", "xuxa",
  "tata-werneck", "ana-maria-braga", "juliette", "bruna-marquezine", "iza",
  "pabllo-vittar", "gusttavo-lima", "rodrigo-santoro", "alok", "selton-mello",
  "whindersson-nunes", "felipe-neto", "casimiro", "wagner-moura", "gil-do-vigor",
]);

// A ordem é a da capa: a primeira pesquisa aberta sem resposta fica em destaque.
export const PHOTO_SURVEYS = Object.freeze([
  definePhotoSurvey({
    id: "politica-2026-01",
    subject: "Política",
    question: "Quem você prefere?",
    cardIds: POLITICS_CARD_IDS,
    drawSize: 16,
    groupSize: 4,
    people: true,
  }),
  // Segunda pergunta sobre as mesmas cartas (ICM 70, #334). Sorteio e resposta
  // são por pesquisa: responder uma não responde a outra.
  definePhotoSurvey({
    id: "politica-2026-02",
    subject: "Política",
    question: "Em quem você confia mais?",
    cardIds: POLITICS_CARD_IDS,
    drawSize: 16,
    groupSize: 4,
    people: true,
  }),
  // Famosos e influenciadores (ICM 74, #348). Vem depois das de política e
  // antes da de roupas na ordem da capa.
  definePhotoSurvey({
    id: "famosos-01",
    subject: "Famosos",
    question: "De quem você é mais fã?",
    note: "Fotos de licença livre.",
    cardIds: CELEBRITY_CARD_IDS,
    drawSize: 16,
    groupSize: 4,
    people: true,
  }),
  // Demonstração de roupas (ICM 73, #345). Vem depois das de política e da de
  // famosos na ordem da capa.
  definePhotoSurvey({
    id: "roupas-demo-01",
    subject: "Roupas",
    question: "Qual você usaria?",
    note: "Peças de demonstração, desenhadas com IA pelo PoliMatch.",
    cardIds: CLOTHES_CARD_IDS,
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

// `people` não sai daqui: a tela lê esse campo da definição que ela mesma importa.
export function publicPhotoSurvey(survey, now) {
  return {
    id: survey.id,
    subject: survey.subject,
    question: survey.question,
    note: survey.note ?? "",
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

// Rodadas (ICM 75, #350). Uma pessoa pode jogar rodadas novas da mesma
// pesquisa enquanto houver confronto que ela ainda não viu. Confronto é uma
// dupla de cartas que apareceu junta numa tela de uma rodada respondida: uma
// das telas de voto ou a final. Não importa qual das duas foi escolhida.

// A dupla não tem ordem: (a, b) e (b, a) dão a mesma chave. Os códigos das
// cartas são slugs, sem "|".
export function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addPairs(keys, cards, current) {
  const present = cards.filter((id) => current.has(id));
  for (let left = 0; left < present.length; left += 1) {
    for (let right = left + 1; right < present.length; right += 1) {
      if (present[left] !== present[right]) keys.add(pairKey(present[left], present[right]));
    }
  }
}

// As duplas que uma rodada respondida mostrou: as de dentro de cada tela de
// voto e as da final, entre as escolhidas. Dupla com carta que saiu da
// pesquisa não entra. Devolve um Set de chaves.
export function roundPairKeys(survey, shownIds, pickIds) {
  const current = new Set(survey.cardIds);
  const keys = new Set();
  for (const group of drawGroups(Array.isArray(shownIds) ? shownIds : [], survey.groupSize)) addPairs(keys, group, current);
  addPairs(keys, Array.isArray(pickIds) ? pickIds : [], current);
  return keys;
}

// `rounds` são as rodadas respondidas, cada uma com `shownIds` e `pickIds`.
// Rodada com sorteio e sem resposta não entra nesta lista.
export function seenPairKeys(survey, rounds) {
  const keys = new Set();
  for (const round of rounds) {
    for (const key of roundPairKeys(survey, round.shownIds, round.pickIds)) keys.add(key);
  }
  return keys;
}

// Todas as duplas das cartas atuais: 190 com 20 cartas, 120 com 16.
export function totalPairCount(survey) {
  return (survey.cardIds.length * (survey.cardIds.length - 1)) / 2;
}

// O que a pessoa já viu e se ainda cabe rodada nova. `status` é o da janela
// da pesquisa. Quem chama precisa conferir, à parte, se há rodada com sorteio
// e sem resposta: uma rodada só começa depois de a anterior ser respondida.
export function surveyProgress(survey, rounds, status) {
  const seenPairs = seenPairKeys(survey, rounds).size;
  const totalPairs = totalPairCount(survey);
  return {
    answeredRounds: rounds.length,
    seenPairs,
    totalPairs,
    canContinue: rounds.length > 0 && seenPairs < totalPairs && status === "open",
  };
}

function checkedRandom(randomInt, limit) {
  const value = randomInt(limit);
  if (!Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError("randomInt devolveu valor fora do intervalo");
  }
  return value;
}

function shuffled(list, randomInt) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = checkedRandom(randomInt, index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// Uma montagem. Cada tela recebe, a cada passo, a carta livre que traz mais
// duplas novas para ela. Quando nenhuma carta traz dupla nova (é o caso da
// tela ainda vazia) e cabem duas, entra uma dupla ainda não vista de cartas
// livres, se existir: por isso a primeira tela começa sempre por uma dupla
// nova enquanto houver alguma. Empate é decidido pelo sorteio.
// As cartas são tratadas pelo índice em `cardIds`; `fresh[a][b]` diz se a
// dupla ainda não foi vista.
function assembleRound(survey, fresh, randomInt) {
  const free = survey.cardIds.map((_id, index) => index);
  const take = (card) => free.splice(free.indexOf(card), 1)[0];
  const pick = (list) => list[checkedRandom(randomInt, list.length)];
  const freshPairsAmongFree = () => {
    const pairs = [];
    for (let left = 0; left < free.length; left += 1) {
      for (let right = left + 1; right < free.length; right += 1) {
        if (fresh[free[left]][free[right]]) pairs.push([free[left], free[right]]);
      }
    }
    return pairs;
  };
  const groups = [];
  let covered = 0;
  for (let screen = 0; screen < survey.drawSize / survey.groupSize; screen += 1) {
    const group = [];
    while (group.length < survey.groupSize) {
      let best = -1;
      let tied = [];
      for (const card of free) {
        const gain = group.reduce((sum, member) => sum + (fresh[card][member] ? 1 : 0), 0);
        if (gain > best) { best = gain; tied = [card]; } else if (gain === best) tied.push(card);
      }
      if (best === 0 && survey.groupSize - group.length >= 2) {
        const pairs = freshPairsAmongFree();
        if (pairs.length) {
          const [first, second] = pick(pairs);
          group.push(take(first), take(second));
          covered += 1;
          continue;
        }
      }
      group.push(take(pick(tied)));
      covered += best;
    }
    groups.push(group);
  }
  return { groups, covered };
}

const ROUND_ATTEMPTS = 12;

// Sorteio de uma rodada nova (da segunda em diante). `seenKeys` são as chaves
// das duplas que a pessoa já viu. Devolve `drawSize` cartas na ordem das
// telas, como `drawCards`. Enquanto houver dupla não vista, a rodada traz pelo
// menos uma dentro de uma tela de voto: a primeira tela de cada montagem
// começa por uma. Entre algumas montagens fica a que cobre mais duplas novas;
// a ordem das telas e das cartas em cada tela é embaralhada no fim. Sem dupla
// por ver, vale o sorteio simples.
export function drawRound(survey, seenKeys, randomInt) {
  const seen = seenKeys instanceof Set ? seenKeys : new Set(seenKeys);
  const cards = survey.cardIds;
  const fresh = cards.map((a) => cards.map((b) => a !== b && !seen.has(pairKey(a, b))));
  if (!fresh.some((row) => row.includes(true))) return drawCards(survey, randomInt);
  let best = null;
  for (let attempt = 0; attempt < ROUND_ATTEMPTS; attempt += 1) {
    const candidate = assembleRound(survey, fresh, randomInt);
    if (!best || candidate.covered > best.covered) best = candidate;
  }
  return shuffled(best.groups.map((group) => shuffled(group, randomInt)), randomInt).flat().map((card) => cards[card]);
}
