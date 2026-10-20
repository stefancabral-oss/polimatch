import {EDITION, PEOPLE, QUESTIONS} from "./quote-quiz-data.js";
export const STORAGE_KEY = "polimatch.quote-quiz.v1";
const validPerson = id => PEOPLE.some(person => person.id === id);
export function freshGame() { return {edition: EDITION, answers: [], index: 0}; }
export function restoreGame(raw) {
  try {
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!state || state.edition !== EDITION || !Array.isArray(state.answers) || state.answers.length > QUESTIONS.length || !state.answers.every(validPerson)) return freshGame();
    const n = state.answers.length;
    // Only the current revealed question or the next unanswered question is valid.
    if (!Number.isInteger(state.index) || state.index < Math.max(0,n-1) || state.index > n) return freshGame();
    return {edition: EDITION, answers: [...state.answers], index: state.index};
  } catch { return freshGame(); }
}
export function answerQuestion(state, person) {
  if (!validPerson(person) || state.index >= QUESTIONS.length || state.answers.length !== state.index) return state;
  return {...state, answers: [...state.answers, person]};
}
export function nextQuestion(state) {
  if (state.answers.length !== state.index + 1) return state;
  return {...state, index: state.index + 1};
}
export function scoreGame(state) {
  let correct = 0, streak = 0, bestStreak = 0, points = 0;
  state.answers.forEach((id,index) => {
    if (id === QUESTIONS[index].author) {correct++; streak++; points += 100 + Math.min(streak-1,4)*25; bestStreak = Math.max(bestStreak,streak);}
    else streak = 0;
  });
  return {correct,streak,bestStreak,points};
}
export function shareText(state, url) {
  return `Acertei ${scoreGame(state).correct} de ${QUESTIONS.length} no Quem disse isso? — Lula ou Flávio. Você reconhece as frases? Jogue a mesma edição: ${url}`;
}
