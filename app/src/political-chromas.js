import ARTS from './political-chromas.json' with { type: 'json' };
import { inauguralChroma } from './inaugural-chromas.js';

const byPerson = new Map(ARTS.map(art => [art.id, art]));

// The presidential arena opts into this edition. Main-home artwork and the
// inaugural edition remain stable for their existing callers.
export function presidentialChroma(personId) {
  return byPerson.get(personId) || inauguralChroma(personId);
}
