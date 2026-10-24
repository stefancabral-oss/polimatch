import test from 'node:test';
import assert from 'node:assert/strict';
import {FACT_EDITION as edition} from './fact-check-data.js';
import {FACT_STORAGE_KEY,freshFacts,restoreFacts,answerFact,nextFact,factScore,factShare} from './fact-check.js';
test('curadoria usa somente vereditos binários publicados, com registro e prova localizável',()=>{
  assert.equal(edition.questions.length,8);
  assert.equal(new Set(edition.questions.map(q=>q.id)).size,8);
  for(const speaker of ['lula','flavio']) assert.equal(edition.questions.filter(q=>q.speaker===speaker).length,4);
  assert.ok(edition.questions.some(q=>q.verdict==='fake'));
  assert.ok(edition.questions.some(q=>q.verdict==='fato'));
  for(const q of edition.questions){
    assert.equal(q.originalVerdict,q.verdict==='fato'?'Verdadeiro':'Falso');
    assert.ok(edition.people[q.speaker]);
    assert.ok(q.statement&&q.explanation&&q.scope);
    assert.ok(q.sources.some(s=>s.kind==='speech'));
    assert.ok(q.sources.some(s=>s.kind==='evidence'));
    for(const s of q.sources){assert.equal(new URL(s.url).protocol,'https:');assert.ok(s.label&&s.locator);}
  }
  const hunger=edition.questions.find(q=>q.id==='fome-33-milhoes');
  assert.match(hunger.explanation,/2022/);assert.match(hunger.scope,/2021\/2022/);
  assert.match(edition.questions.find(q=>q.id==='mercados-agro').scope,/não significa 700 países/);
  assert.match(edition.questions.find(q=>q.id==='celular-cerveja').scope,/repetiu a acusação.*Flávio/);
});
test('uma resposta por afirmação, avanço guardado, restauração estrita e placar independente',()=>{
  let s=freshFacts();
  assert.equal(nextFact(s),s);assert.equal(answerFact(s,'lula'),s);
  assert.equal(restoreFacts({edition:'outra',index:0,answers:[]}).index,0);
  for(const [i,q] of edition.questions.entries()){
    const answered=answerFact(s,i===1?'fake':q.verdict);
    assert.equal(answerFact(answered,q.verdict),answered);
    assert.deepEqual(restoreFacts(JSON.stringify(answered)),answered);
    assert.deepEqual(restoreFacts({...answered,answers:[...answered.answers.slice(0,-1),{id:'outra-frase',answer:q.verdict}]}),freshFacts());
    s=nextFact(answered);assert.equal(s.index,i+1);
  }
  assert.equal(factScore(s),7);assert.equal(nextFact(s),s);assert.equal(answerFact(s,'fato'),s);
  assert.deepEqual(restoreFacts(JSON.stringify(s)),s);
  for(const raw of ['broken',null,{...s,index:99},{...s,answers:[null]},{...s,index:-1}]) assert.deepEqual(restoreFacts(raw),freshFacts());
  assert.match(FACT_STORAGE_KEY,/globo-20261023-v1/);
  const share=factShare(s,'https://polimatch.com.br/fato-ou-fake.html');
  assert.match(share,/Acertei 7 de 8/);assert.doesNotMatch(share,/gabarito|pib-apos/i);
});
