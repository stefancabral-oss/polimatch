import {FACT_EDITION as edition} from './fact-check-data.js';
export const FACT_STORAGE_KEY=`polimatch.fact-check.v1:${edition.id}`;
export const freshFacts=()=>({edition:edition.id,index:0,answers:[]});
export function restoreFacts(raw) {
  try {
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(!s||s.edition!==edition.id||!Array.isArray(s.answers)||s.answers.length>edition.questions.length) return freshFacts();
    if(!s.answers.every((a,i)=>a?.id===edition.questions[i].id&&['fato','fake'].includes(a.answer))) return freshFacts();
    if(!Number.isInteger(s.index)||s.index<Math.max(0,s.answers.length-1)||s.index>s.answers.length) return freshFacts();
    return {edition:edition.id,index:s.index,answers:s.answers.map(({id,answer})=>({id,answer}))};
  } catch {return freshFacts();}
}
export function answerFact(s,answer) {
  const q=edition.questions[s.index];
  if(s.edition!==edition.id||!q||s.answers.length!==s.index||!['fato','fake'].includes(answer)) return s;
  return {...s,answers:[...s.answers,{id:q.id,answer}]};
}
export function nextFact(s) {
  if(s.edition!==edition.id||s.index>=edition.questions.length||s.answers.length!==s.index+1) return s;
  return {...s,index:s.index+1};
}
export const factScore=s=>s.answers.reduce((n,a,i)=>n+Number(a.answer===edition.questions[i]?.verdict),0);
export function factShare(s,url) {
  return `Acertei ${factScore(s)} de ${edition.questions.length} no Fato ou fake? do PoliMatch — ${edition.label}. Confira as falas e as provas: ${url}`;
}
