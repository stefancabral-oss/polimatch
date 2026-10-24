import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEWED_FACT_EDITION} from './fact-check-reviewed.js';
import {REVIEWED_EDITION,REVIEWED_QUESTIONS,COMBINED_EDITION,COMBINED_QUESTIONS,EDITION,QUESTIONS} from './quote-quiz-data.js';
import {freshGame,restoreGame,answerQuestion,answerCheck,nextQuestion,checkScore,scoreGame,shareText,storageKeyFor} from './quote-quiz.js';
test('reviewed edition adds a precise documentary question without regrading old editions',()=>{
 const facts=REVIEWED_FACT_EDITION.questions;
 assert.equal(facts.length,7);assert.equal(REVIEWED_QUESTIONS.length,27);
 assert.equal(COMBINED_QUESTIONS.length,28);assert.equal(QUESTIONS.length,20);
 assert.equal(new Set(REVIEWED_QUESTIONS.map(q=>q.id)).size,27);
 for(const old of QUESTIONS)assert.ok(REVIEWED_QUESTIONS.includes(old));
 for(const q of facts){assert.ok(q.sources.some(s=>s.primary&&s.kind==='evidence'));assert.ok(q.quizSummary);assert.ok(q.reviewed);}
 assert.ok(!facts.some(q=>['wifi-brasil','mercados-agro'].includes(q.id)),'uncorroborated precision is withheld, not declared false');
 const debt=facts.find(q=>q.id==='desenrola-primeiro-mes');
 assert.equal(debt.verdict,'fake');assert.match(debt.statement,/criação legal.*janeiro/);
 assert.match(debt.sourceVerdict,/Enganoso/);assert.match(debt.scope,/não inteiramente falsa/);
 assert.match(facts.find(q=>q.id==='pib-apos-2010').explanation,/4,0% em 2011 e 4,8% em 2021/);
 assert.ok(facts.find(q=>q.id==='selic-debate').sources.some(s=>new URL(s.url).hostname==='api.bcb.gov.br'));
 assert.notEqual(storageKeyFor(REVIEWED_EDITION),storageKeyFor(COMBINED_EDITION));
 const old=answerCheck(answerQuestion(freshGame(COMBINED_EDITION),'lula'),'fake');
 assert.deepEqual(restoreGame(old,COMBINED_EDITION),old);
 assert.deepEqual(restoreGame(old,REVIEWED_EDITION),freshGame(REVIEWED_EDITION));
 assert.notEqual(storageKeyFor(REVIEWED_EDITION),storageKeyFor(EDITION));
});
test('new questions preserve guarded answers, opt out, full resume and separate scores',()=>{
 let state=freshGame(REVIEWED_EDITION);
 for(const [i,q] of REVIEWED_QUESTIONS.entries()){
  assert.equal(nextQuestion(state),state);
  state=answerQuestion(state,q.author);
  if(q.fact){assert.equal(nextQuestion(state),state);state=answerCheck(state,i===6?'skip':q.fact.verdict);assert.equal(answerCheck(state,'fake'),state);}
  state=nextQuestion(state);assert.deepEqual(restoreGame(JSON.stringify(state),REVIEWED_EDITION),state);
 }
 assert.equal(state.index,27);assert.equal(scoreGame(state).correct,27);
 assert.deepEqual(checkScore(state),{total:7,correct:6,answered:6,skipped:1});
 assert.match(shareText(state,'https://polimatch.com.br/quem-disse-isso.html?edicao=4'),/27 de 27.*6 de 7.*edicao=4/);
});
