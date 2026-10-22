import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ARTS from './inaugural-chromas.json' with { type: 'json' };
import ROSTER from '../../shared/presidential-roster.json' with { type: 'json' };
import { inauguralChroma } from './inaugural-chromas.js';
import { tcgCardMarkup } from './tcg-card.js';

test('only the ten approved identities have complete art, backed by the approved masters', () => {
  assert.equal(ARTS.length, 10);
  assert.equal(new Set(ARTS.map(a => a.id)).size, 10);
  for (const art of ARTS) {
    const person = ROSTER.people.find(p => p.id === art.id);
    assert.equal(person?.name, art.name);
    assert.ok(!ROSTER.excludedIds.includes(art.id));
    const master = readFileSync(new URL(`../../stages/23_chromas_104/output/artwork/${art.id}-v01.png`, import.meta.url));
    assert.equal(createHash('sha256').update(master).digest('hex'), art.masterSha256);
    for (const item of art.srcset.split(', ')) {
      const [path] = item.split(' ');
      const file = new URL(`../public${path}`, import.meta.url);
      const bytes = readFileSync(file);
      assert.equal(bytes.subarray(0,4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
      assert.ok(statSync(file).size < 600_000, `oversize derivative ${path}`);
    }
  }
  assert.equal(inauguralChroma('sergio-moro'), null);
  assert.equal(inauguralChroma('unknown'), null);
});

test('full-art cards retain original-photo fallback, accessible name and dynamic selection indicators', () => {
  const person = ROSTER.people.find(p => p.id === 'nikolas-ferreira');
  const html = tcgCardMarkup(person);
  assert.match(html, /data-chroma-art/);
  assert.match(html, /srcset=/);
  assert.match(html, /retrato artístico com IA/);
  assert.ok(html.includes(person.photo.path));
  assert.match(html, /class="tcg-choice"/);
  assert.match(html, /class="tcg-outcome"/);
  assert.ok(!html.includes('is-chroma-ready'), 'do not hide the fallback before image load');
  const basic = tcgCardMarkup(ROSTER.people.find(p => p.id === 'sergio-moro'));
  assert.ok(!basic.includes('data-chroma-art'));
});
