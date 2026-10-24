import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ARTS from './political-chromas.json' with { type: 'json' };
import ROSTER from '../../shared/presidential-roster.json' with { type: 'json' };
import { presidentialChroma } from './political-chromas.js';
import { inauguralChroma } from './inaugural-chromas.js';
import { homeCoverChroma } from './home-cover.js';
import { tcgCardMarkup } from './tcg-card.js';

const evidence = JSON.parse(readFileSync(new URL('../../stages/29_political_chromas/output/manifest.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('twenty political artworks match the roster, masters and responsive exports', () => {
  const ids = ROSTER.categories.find(c => c.id === 'politicos').members.map(m => m.id);
  assert.equal(ARTS.length, 20);
  assert.deepEqual(ARTS.map(a => a.id), ids);
  assert.equal(new Set(ARTS.map(a => a.id)).size, 20);
  for (const art of ARTS) {
    const person = ROSTER.people.find(p => p.id === art.id);
    const proof = evidence.find(p => p.id === art.id);
    assert.equal(art.name, person.name);
    assert.equal(hash(readFileSync(new URL(`../../${proof.master}`, import.meta.url))), art.masterSha256);
    assert.equal(hash(readFileSync(new URL(`../public${person.photo.path}`, import.meta.url))), person.photo.sha256);
    for (const variant of proof.variants) {
      const bytes = readFileSync(new URL(`../public${variant.src}`, import.meta.url));
      assert.equal(hash(bytes), variant.sha256);
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.ok(bytes.length < 600000);
      assert.equal(variant.width / variant.height, 5 / 7);
    }
  }
});

test('new edition keeps the original photo and selection controls, and leaves the home cover stable', () => {
  for (const art of ARTS) {
    const person = ROSTER.people.find(p => p.id === art.id);
    const html = tcgCardMarkup(person, {chroma: presidentialChroma(person.id)});
    assert.ok(html.includes(art.src));
    assert.ok(html.includes(person.photo.path));
    assert.match(html, /data-chroma-art/);
    assert.match(html, /retrato artístico com IA/);
    assert.match(html, /class="tcg-choice"/);
    assert.ok(!html.includes('is-chroma-ready'));
  }
  assert.equal(presidentialChroma('janja'), inauguralChroma('janja'));
  assert.equal(presidentialChroma('unknown'), null);
  assert.equal(homeCoverChroma('nikolas-ferreira'), inauguralChroma('nikolas-ferreira'));
  assert.notEqual(homeCoverChroma('nikolas-ferreira').src, presidentialChroma('nikolas-ferreira').src);
});
