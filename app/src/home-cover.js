import SPECIALS from './cover-chromas.json' with { type: 'json' };
import ROSTER from '../../shared/presidential-roster.json' with { type: 'json' };
import { inauguralChroma } from './inaugural-chromas.js';

const specials = new Map(SPECIALS.map(art => [art.id, art]));
export const HOME_COVER_PEOPLE = ['flavio-bolsonaro', 'lula', 'nikolas-ferreira', 'janja']
  .map(id => specials.get(id) || ROSTER.people.find(person => person.id === id));

// These two special editions belong to the home showcase, not to game inventory.
export function homeCoverChroma(id) {
  return specials.get(id) || inauguralChroma(id);
}
