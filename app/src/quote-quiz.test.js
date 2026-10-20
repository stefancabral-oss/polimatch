import test from 'node:test';
import assert from 'node:assert/strict';
import {EDITION,PEOPLE,QUESTIONS} from './quote-quiz-data.js';
import {freshGame,restoreGame,answerQuestion,nextQuestion,scoreGame,shareText} from './quote-quiz.js';
test('edition contains ten balanced verified quotations with limited excerpts per source',()=>{
 assert.equal(QUESTIONS.length,10); assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,10);
 const words={};
 for(const p of PEOPLE) assert.equal(QUESTIONS.filter(q=>q.author===p.id).length,5);
 for(const q of QUESTIONS){
  const url=new URL(q.sourceUrl); assert.equal(url.protocol,'https:'); assert.match(url.hostname,/\.(?:leg\.br|ebc\.com\.br)$/);
  assert.ok(q.context.length>50); assert.match(q.date,/^\d{4}-\d{2}-\d{2}$/);
  words[q.sourceUrl]=(words[q.sourceUrl]||0)+q.quote.split(/\s+/).length;
 }
 for(const count of Object.values(words)) assert.ok(count<=25,`${count} words from a source`);
});
test('double tap cannot advance or overwrite a revealed response',()=>{
 const initial=freshGame(); const answered=answerQuestion(initial,'lula');
 assert.equal(answerQuestion(answered,'flavio'),answered); assert.equal(answerQuestion(initial,'invalid'),initial);
 assert.equal(nextQuestion(initial),initial); assert.equal(nextQuestion(answered).index,1);
});
test('score is recomputed, streak bounded, and all ten answers can finish',()=>{
 let state=freshGame();
 for(const q of QUESTIONS){state=answerQuestion(state,q.author);state=nextQuestion(state);}
 assert.deepEqual(scoreGame(state),{correct:10,streak:10,bestStreak:10,points:1750});
 assert.equal(answerQuestion(state,'lula'),state);
 const broken={...freshGame(),answers:[QUESTIONS[0].author,PEOPLE.find(p=>p.id!==QUESTIONS[1].author).id,QUESTIONS[2].author]};
 assert.deepEqual(scoreGame(broken),{correct:2,streak:1,bestStreak:1,points:200});
});
test('restore rejects invalid edition, holes, forged score and cursor skipping',()=>{
 for(const invalid of [null,'broken',{edition:EDITION,answers:['other'],index:1},{edition:EDITION,answers:[],index:10},{edition:'old',answers:[],index:0},{edition:EDITION,answers:['lula','flavio'],index:0}]) assert.deepEqual(restoreGame(invalid),freshGame());
 const saved={edition:EDITION,answers:['lula'],index:0,points:99999};
 assert.deepEqual(restoreGame(JSON.stringify(saved)),{edition:EDITION,answers:['lula'],index:0});
});
test('shared challenge contains score and edition URL, no quoted answers',()=>{
 const text=shareText(freshGame(),'https://polimatch.com.br/quem-disse-isso.html');
 assert.match(text,/Acertei 0 de 10/); assert.match(text,/quem-disse-isso\.html/);
 for(const q of QUESTIONS) assert.ok(!text.includes(q.quote));
});
