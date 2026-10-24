import ROSTER from '../../shared/presidential-roster.json' with { type: 'json' };
import SPECIALS from './cover-chromas.json' with { type: 'json' };
import { presidentialChroma } from './political-chromas.js';

const identities = [...ROSTER.people, {id:'lula',personId:1}, {id:'flavio-bolsonaro',personId:2}];
const byPersonId = new Map(identities.filter(p => Number.isInteger(p.personId)).map(person => [person.personId, person.id]));
const canonicalIds = new Set(identities.map(person => person.id));
const specials = new Map(SPECIALS.map(art => [art.id, art]));

export function mainGameChroma(candidate = {}) {
  const hasPersonId = candidate.personId !== undefined && candidate.personId !== null;
  const value = candidate.personId;
  const numericId = typeof value === 'number' || (typeof value === 'string' && /^\d{1,3}$/.test(value)) ? Number(value) : NaN;
  const id = hasPersonId ? byPersonId.get(numericId)
    : canonicalIds.has(candidate.id) ? candidate.id : null;
  if (!id) return null;
  // A known canonical ID must never receive another person's artwork.
  if (canonicalIds.has(candidate.id) && candidate.id !== id) return null;
  return presidentialChroma(id) || specials.get(id) || null;
}

export function patchGameChroma(button, image, art) {
  if (!image) return;
  const source = art?.src || '';
  if ((image.getAttribute('src') || '') !== source) {
    button.classList.toggle('is-chroma-ready', false);
    image.removeAttribute('srcset');
    image.removeAttribute('src');
    if (source) {
      image.setAttribute('srcset', art.srcset);
      image.setAttribute('src', source);
    }
  }
  image.hidden = !source;
  button.classList.toggle('has-chroma-art', Boolean(source));
  if (!source) button.classList.toggle('is-chroma-ready', false);
}

export function installMainChromas(root) {
  const settle = event => {
    const image = event.target;
    if (!image?.matches?.('[data-game-chroma]')) return;
    const sources = [image.getAttribute('src'), ...(image.getAttribute('srcset') || '').split(',').map(s => s.trim().split(' ')[0])];
    const current = image.currentSrc && new URL(image.currentSrc, location.href).pathname;
    image.closest('.candidate-card')?.classList.toggle('is-chroma-ready',
      !image.hidden && image.complete && image.naturalWidth > 0 && sources.includes(current));
  };
  root.addEventListener('load', settle, true);
  root.addEventListener('error', settle, true);
}
