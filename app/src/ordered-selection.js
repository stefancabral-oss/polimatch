/** Only a second distinct tap commits. Tapping the first again clears the draft. */
export function selectOrderedCard(current, id, candidateIds) {
  if (!candidateIds.includes(id) || candidateIds.length !== 4 || current.length > 1) return { selectionIds: current, complete: false };
  const selectionIds = current[0] === id ? [] : [...current, id];
  return { selectionIds, complete: selectionIds.length === 2 };
}
