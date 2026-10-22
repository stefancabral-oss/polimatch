import { nextBalancedGroup } from "./domain.js";
export const PRESIDENTIAL_STORAGE_KEY = "polimatch:presidential:v1";
export const PRESIDENTIAL_SESSION_LENGTH = 10;

export function freshPresidentialRound(
  people,
  {
    queue = [],
    previous = [],
    random = Math.random,
    uuid = () => crypto.randomUUID(),
  } = {},
) {
  const next = nextBalancedGroup(
    people,
    queue.map((id) => people.find((p) => p.id === id)).filter(Boolean),
    previous,
    4,
    random,
  );
  return {
    roundId: uuid(),
    candidateIds: next.group.map((p) => p.id),
    queue: next.queue.map((p) => p.id),
    selectionIds: [],
    pending: null,
  };
}

export function restoredPresidentialSession(raw, people, { topicId } = {}) {
  const ids = new Set(people.map((p) => p.id));
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray(raw.candidateIds) ||
    raw.candidateIds.length !== 4 ||
    new Set(raw.candidateIds).size !== 4 ||
    raw.candidateIds.some((id) => !ids.has(id)) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      raw.roundId || "",
    ) ||
    !Array.isArray(raw.selectionIds) ||
    raw.selectionIds.length > 2 ||
    new Set(raw.selectionIds).size !== raw.selectionIds.length ||
    raw.selectionIds.some((id) => !raw.candidateIds.includes(id)) ||
    !Number.isSafeInteger(raw.completed) ||
    raw.completed < 0 ||
    raw.completed > PRESIDENTIAL_SESSION_LENGTH
  )
    return null;
  if (
    raw.confirmed &&
    (raw.pending || raw.selectionIds.length !== 2 || raw.completed < 1)
  )
    return null;
  if (raw.selectionIds.length === 2 && !raw.pending && !raw.confirmed)
    return null;
  if (
    raw.pending &&
    (raw.confirmed ||
      raw.pending.roundId !== raw.roundId ||
      raw.selectionIds.length !== 2 ||
      raw.pending.winnerId !== raw.selectionIds[0] ||
      (topicId && raw.pending.topicId !== topicId) ||
      raw.pending.selectionIds?.join(":") !== raw.selectionIds.join(":") ||
      raw.pending.candidateIds?.join(":") !== raw.candidateIds.join(":") ||
      !Number.isSafeInteger(raw.pending.playerVersion) ||
      raw.pending.playerVersion < 0 ||
      !Number.isSafeInteger(raw.pending.personalDuels) ||
      raw.pending.personalDuels < 0)
  )
    return null;
  return {
    roundId: raw.roundId,
    candidateIds: [...raw.candidateIds],
    selectionIds: [...raw.selectionIds],
    queue: Array.isArray(raw.queue)
      ? [...new Set(raw.queue.filter((id) => ids.has(id)))]
      : [],
    completed: raw.completed,
    pending: raw.pending ? structuredClone(raw.pending) : null,
    confirmed:
      raw.confirmed === true && !raw.pending && raw.selectionIds.length === 2,
  };
}

export function categoryDistribution(category) {
  return {
    flavio: category.members.filter((m) => m.support === "flavio").length,
    lula: category.members.filter((m) => m.support === "lula").length,
    unique: new Set(category.members.map((m) => m.id)).size,
  };
}
