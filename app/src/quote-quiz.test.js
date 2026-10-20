import test from 'node:test';
import assert from 'node:assert/strict';
import {EDITION,LEGACY_EDITION,PEOPLE,QUESTIONS,editionFor} from './quote-quiz-data.js';
import {freshGame,restoreGame,answerQuestion,nextQuestion,scoreGame,shareText,formatQuizDate,storageKeyFor} from './quote-quiz.js';
test('presidential curation identifies four real authors and two valid options per question',()=>{
 assert.equal(QUESTIONS.length,20);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,20);
 assert.deepEqual(PEOPLE.map(p=>p.id),['lula','flavio','janja','nikolas']);
 assert.deepEqual(PEOPLE.map(p=>QUESTIONS.filter(q=>q.author===p.id).length),[8,8,2,2]);
 const excerpts={},planWords=[];
 for(const q of QUESTIONS){
  assert.equal(q.choices.length,2);assert.equal(new Set(q.choices).size,2);assert.ok(q.choices.includes(q.author));
  assert.ok(q.choices.every(id=>PEOPLE.some(p=>p.id===id)));
  const url=new URL(q.sourceUrl);assert.equal(url.protocol,'https:');
  assert.ok(q.context.length>40);assert.match(q.date,/^\d{4}(-\d{2}-\d{2})?$/);
  if(q.kind==='proposal'){
   assert.equal(q.author,'flavio');assert.equal(url.hostname,'www.tse.jus.br');assert.match(url.hash,/^#page=\d+$/);
   assert.ok(!/[“”"]/.test(q.quote));planWords.push(q.quote,q.context);
  }else{assert.equal(q.kind,'quote');excerpts[q.sourceUrl]=(excerpts[q.sourceUrl]||0)+q.quote.split(/\s+/).length;}
 }
 for(const count of Object.values(excerpts))assert.ok(count<=25,`${count} words quoted from one source`);
 assert.ok(planWords.join(' ').split(/\s+/).length<=200,'Plan summaries remain within source allowance');
});
test('a distractor not offered by the question and a second click are rejected',()=>{
 const initial=freshGame(),answered=answerQuestion(initial,QUESTIONS[0].author);
 assert.equal(answerQuestion(initial,'janja'),initial);assert.equal(answerQuestion(initial,'invalid'),initial);
 assert.equal(answerQuestion(answered,'flavio'),answered);assert.equal(nextQuestion(initial),initial);
 assert.equal(nextQuestion(answered).index,1);
});
test('knowledge score supports twenty rounds, bounded streak bonus and no duplicate answers',()=>{
 let state=freshGame();for(const q of QUESTIONS){state=nextQuestion(answerQuestion(state,q.author));}
 assert.deepEqual(scoreGame(state),{correct:20,streak:20,bestStreak:20,points:3750});
 assert.equal(answerQuestion(state,'lula'),state);
 let mixed=freshGame();mixed=nextQuestion(answerQuestion(mixed,QUESTIONS[0].author));
 mixed=nextQuestion(answerQuestion(mixed,QUESTIONS[1].choices.find(id=>id!==QUESTIONS[1].author)));
 mixed=answerQuestion(mixed,QUESTIONS[2].author);
 assert.deepEqual(scoreGame(mixed),{correct:2,streak:1,bestStreak:1,points:200});
});
test('restore validates edition, offered answers and cursor, ignoring fabricated score',()=>{
 for(const invalid of [null,'broken',{edition:EDITION,answers:['janja'],index:1},{edition:EDITION,answers:[],index:20},{edition:'old',answers:[],index:0},{edition:EDITION,answers:['lula','flavio'],index:0}])assert.deepEqual(restoreGame(invalid),freshGame());
 const saved={edition:EDITION,answers:[QUESTIONS[0].author],index:0,points:99999};
 assert.deepEqual(restoreGame(JSON.stringify(saved)),{edition:EDITION,answers:[QUESTIONS[0].author],index:0});
});
test('legacy game retains original questions, storage key, resume and score',()=>{
 assert.notEqual(storageKeyFor(EDITION),storageKeyFor(LEGACY_EDITION));
 assert.equal(storageKeyFor(LEGACY_EDITION),'polimatch.quote-quiz.v1');
 const edition=editionFor(LEGACY_EDITION);assert.equal(edition.questions.length,10);
 let state=freshGame(LEGACY_EDITION);
 for(const q of edition.questions)state=nextQuestion(answerQuestion(state,q.author));
 assert.deepEqual(restoreGame(JSON.stringify(state),LEGACY_EDITION),state);
 assert.equal(scoreGame(state).points,1750);assert.deepEqual(restoreGame(state),freshGame());
});
test('sharing names the edition and score, without leaking quotations or correct responses',()=>{
 const text=shareText(freshGame(),'https://polimatch.com.br/quem-disse-isso.html?edicao=2');
 assert.match(text,/Acertei 0 de 20/);assert.match(text,/edicao=2/);
 for(const q of QUESTIONS)assert.ok(!text.includes(q.quote));
});
test('historical records with only a year never invent an exact speech day',()=>{
 assert.equal(formatQuizDate('2000'),'2000');assert.match(formatQuizDate('2023-06-29'),/29 de junho de 2023/);
});
