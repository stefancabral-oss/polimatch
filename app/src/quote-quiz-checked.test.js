import test from 'node:test';
import assert from 'node:assert/strict';
import {COMBINED_EDITION,COMBINED_QUESTIONS,DEBATE_QUESTIONS,PEOPLE,QUESTIONS,EDITION} from './quote-quiz-data.js';
import {freshGame,restoreGame,answerQuestion,answerCheck,nextQuestion,checkScore,scoreGame,shareText,storageKeyFor} from './quote-quiz.js';
import {quizChroma} from './quiz-chromas.js';
test('combined edition retains twenty approved items and eight sourced binary checks',()=>{
 assert.equal(COMBINED_QUESTIONS.length,28);assert.equal(DEBATE_QUESTIONS.length,8);
 assert.equal(new Set(COMBINED_QUESTIONS.map(q=>q.id)).size,28);
 for(const q of QUESTIONS)assert.ok(COMBINED_QUESTIONS.includes(q));
 for(const q of DEBATE_QUESTIONS){assert.equal(q.kind,'fact');assert.equal(q.author,q.fact.speaker);assert.ok(q.choices.includes(q.author));assert.ok(q.fact.sources.length>=2);assert.equal(q.date,'2026-10-23');}
 assert.notEqual(storageKeyFor(COMBINED_EDITION),storageKeyFor(EDITION));
 assert.match(quizChroma(PEOPLE[0]).src,/cover\/lula-special/);
 assert.match(quizChroma(PEOPLE[1]).src,/cover\/flavio-bolsonaro-special/);
 assert.match(quizChroma(PEOPLE[2]).src,/inaugural\/janja/);
 assert.match(quizChroma(PEOPLE[3]).src,/politicos\/nikolas-ferreira-v02/);
 assert.equal(quizChroma({id:'lula',personId:2}),null);
});
test('authorship and fact checking are separate guarded steps, with a genuine opt out',()=>{
 const initial=freshGame(COMBINED_EDITION),q=COMBINED_QUESTIONS[0];
 assert.equal(answerCheck(initial,'fake'),initial);
 const wrongAuthor=answerQuestion(initial,'flavio');
 assert.equal(scoreGame(wrongAuthor).correct,0);
 assert.equal(nextQuestion(wrongAuthor),wrongAuthor);
 assert.equal(answerCheck(wrongAuthor,'nonsense'),wrongAuthor);
 assert.deepEqual(restoreGame(JSON.stringify(wrongAuthor),COMBINED_EDITION),wrongAuthor);
 const answered=answerCheck(wrongAuthor,q.fact.verdict);
 assert.equal(checkScore(answered).correct,1);assert.equal(scoreGame(answered).correct,0);assert.equal(scoreGame(answered).points,100);
 assert.equal(answerCheck(answered,'fato'),answered);
 assert.deepEqual(restoreGame(JSON.stringify(answered),COMBINED_EDITION),answered);
 assert.equal(nextQuestion(answered).index,1);
 const skipped=answerCheck(answerQuestion(initial,q.author),'skip');
 assert.equal(checkScore(skipped).skipped,1);assert.equal(checkScore(skipped).correct,0);assert.equal(nextQuestion(skipped).index,1);
 for(const invalid of [{...wrongAuthor,index:1},{...wrongAuthor,verdicts:{unknown:'fake'}},{...initial,verdicts:{[q.id]:'fake'}},{...wrongAuthor,verdicts:[]},{...wrongAuthor,verdicts:{[q.id]:'wrong'}}])assert.deepEqual(restoreGame(invalid,COMBINED_EDITION),initial);
});
test('full combined game resumes safely and shares two distinct results without a gabarito',()=>{
 let state=freshGame(COMBINED_EDITION);
 for(const q of COMBINED_QUESTIONS){
  state=answerQuestion(state,q.author);
  if(q.fact)state=answerCheck(state,q.fact.verdict);
  state=nextQuestion(state);assert.deepEqual(restoreGame(JSON.stringify(state),COMBINED_EDITION),state);
 }
 assert.equal(state.index,28);assert.equal(scoreGame(state).correct,28);assert.equal(scoreGame(state).points,6150);
 assert.deepEqual(checkScore(state),{total:8,correct:8,answered:8,skipped:0});
 assert.equal(nextQuestion(state),state);assert.equal(answerCheck(state,'fake'),state);
 const share=shareText(state,'https://polimatch.com.br/quem-disse-isso.html?edicao=3');
 assert.match(share,/28 de 28/);assert.match(share,/8 de 8/);assert.match(share,/edicao=3/);
 assert.ok(!share.includes(COMBINED_QUESTIONS[0].quote));
});
