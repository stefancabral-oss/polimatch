import {EDITION, EDITIONS, editionFor} from './quote-quiz-data.js';
export const STORAGE_KEY = 'polimatch.quote-quiz.v1';
export function freshGame(edition=EDITION) {
  return {edition:editionFor(edition).id, answers:[], index:0};
}
export function restoreGame(raw, edition=EDITION) {
  try {
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const {questions} = editionFor(edition);
    if (!state || state.edition !== edition || !Array.isArray(state.answers) || state.answers.length > questions.length) return freshGame(edition);
    if (!state.answers.every((answer,i)=>questions[i].choices.includes(answer))) return freshGame(edition);
    const n = state.answers.length;
    if (!Number.isInteger(state.index) || state.index < Math.max(0,n-1) || state.index > n) return freshGame(edition);
    return {edition, answers:[...state.answers], index:state.index};
  } catch {return freshGame(edition);}
}
export function answerQuestion(state, person) {
  const question = EDITIONS[state.edition]?.questions[state.index];
  if (!question || !question.choices.includes(person) || state.answers.length !== state.index) return state;
  return {...state, answers:[...state.answers,person]};
}
export function nextQuestion(state) {
  if (state.answers.length !== state.index + 1) return state;
  return {...state, index:state.index + 1};
}
export function scoreGame(state) {
  const {questions} = editionFor(state.edition);
  let correct=0, streak=0, bestStreak=0, points=0;
  state.answers.forEach((id,index)=>{
    if (id === questions[index]?.author) {
      correct++; streak++; points+=100+Math.min(streak-1,4)*25;
      bestStreak=Math.max(bestStreak,streak);
    } else streak=0;
  });
  return {correct,streak,bestStreak,points};
}
export function shareText(state,url) {
  const edition=editionFor(state.edition);
  return `Acertei ${scoreGame(state).correct} de ${edition.questions.length} no Quem disse isso? — ${edition.label}. Você reconhece as vozes? Jogue a mesma edição: ${url}`;
}
export function formatQuizDate(date) {
  if (/^\d{4}$/.test(date)) return date;
  return new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
}
export function storageKeyFor(edition) {
  return edition === 'lula-flavio-01' ? STORAGE_KEY : `${STORAGE_KEY}:${editionFor(edition).id}`;
}
