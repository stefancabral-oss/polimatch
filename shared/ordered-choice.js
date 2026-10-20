/** Versioned scoring: first > second > two equally unselected cards. */
export const ORDERED_CHOICE_RULESET = 'ordered-two-v1';
export const ORDERED_PAIR_POINTS = 8;

export function orderedChoiceComparisons(candidateIds, selectionIds, winnerId = selectionIds?.[0]) {
  if (!Array.isArray(candidateIds) || candidateIds.length !== 4 || new Set(candidateIds).size !== 4
    || !Array.isArray(selectionIds) || selectionIds.length !== 2
    || selectionIds.some(id => typeof id !== 'string' || !candidateIds.includes(id))
    || selectionIds[0] === selectionIds[1] || winnerId !== selectionIds[0]) {
    throw new TypeError('Escolha duas cartas diferentes, em ordem.');
  }
  const [first, second] = selectionIds;
  const rest = candidateIds.filter(id => !selectionIds.includes(id));
  return [
    { winnerId: first, loserId: second },
    ...rest.map(loserId => ({ winnerId: first, loserId })),
    ...rest.map(loserId => ({ winnerId: second, loserId })),
  ];
}
