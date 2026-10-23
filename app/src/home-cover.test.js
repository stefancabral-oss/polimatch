import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import SPECIALS from './cover-chromas.json' with { type: 'json' };
import { HOME_COVER_PEOPLE, homeCoverChroma } from './home-cover.js';
import { tcgCardMarkup } from './tcg-card.js';

test('home cover uses the requested identities and complete artwork without changing game editions', () => {
  assert.deepEqual(HOME_COVER_PEOPLE.map(p => p.id), ['flavio-bolsonaro', 'lula', 'nikolas-ferreira', 'janja']);
  for (const person of HOME_COVER_PEOPLE) {
    const art = homeCoverChroma(person.id);
    assert.equal(art.name, person.name);
    const html = tcgCardMarkup(person, {decorative:true, chroma:art});
    assert.ok(html.includes(art.src));
    assert.ok(html.includes(person.photo.path));
    assert.ok(!html.includes('is-chroma-ready'), 'retain fallback until image load');
  }
  for (const art of SPECIALS) {
    assert.ok(!tcgCardMarkup(art).includes('data-chroma-art'), 'special cover must not change in-game editions');
    for (const variant of art.variants) {
      const bytes = readFileSync(new URL(`../public${variant.src}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256);
      assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
      assert.ok(bytes.length < 600_000);
    }
  }
});
