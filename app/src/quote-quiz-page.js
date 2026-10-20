import "./quote-quiz.css";
import {EDITION, PEOPLE, QUESTIONS} from "./quote-quiz-data.js";
import {portraitSlot} from "./photos.js";
import {STORAGE_KEY, freshGame, restoreGame, answerQuestion, nextQuestion, scoreGame, shareText} from "./quote-quiz.js";
const root = document.querySelector("#quiz");
let state = freshGame(), canSave = true;
try {state = restoreGame(localStorage.getItem(STORAGE_KEY));} catch {canSave = false;}
const escape = text => String(text).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const personName = id => PEOPLE.find(person => person.id === id).name;
const dateLabel = date => new Intl.DateTimeFormat("pt-BR", {day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
function save() {try {localStorage.setItem(STORAGE_KEY, JSON.stringify(state));} catch {canSave = false;}}
function header() {return `<header class="quiz-header"><a class="brand" href="./" aria-label="PoliMatch — início"><img src="./icon.svg" alt="" width="32" height="32">PoliMatch</a><a class="back" href="./">← Início</a></header>`;}
function render(focus = "") {
 const score = scoreGame(state), complete = state.index === QUESTIONS.length;
 const question = QUESTIONS[state.index], answered = state.answers.length > state.index;
 root.innerHTML = `<div class="quiz-shell">${header()}<main id="content">
 <div class="quiz-title"><div><p class="eyebrow">Lula ou Flávio?</p><h1 tabindex="-1">Quem disse isso?</h1></div><span class="progress">${complete ? "Concluído" : `${state.index+1} de ${QUESTIONS.length}`}</span></div>
 <p class="intro">Reconheça a frase. Toque em quem você acha que disse.</p>
 ${complete ? result(score) : `<section class="question" aria-label="Frase da rodada"><span class="quote-mark" aria-hidden="true">“</span><blockquote>${escape(question.quote)}</blockquote><p>Quem falou?</p></section>
 <div class="choices" aria-label="Escolha o autor">${PEOPLE.map(person => `<button class="person-card ${answered ? person.id === question.author ? "correct" : state.answers[state.index] === person.id ? "incorrect" : "muted" : ""}" type="button" data-answer="${person.id}" ${answered ? "disabled" : ""}><div class="photo"><img src="${portraitSlot(person.personId)}" alt="" width="400" height="480">${answered && person.id === question.author ? `<span class="answer-badge">✓ Autor da frase</span>` : ""}</div><span class="person-name">${escape(person.name)}</span></button>`).join("")}</div>
 ${answered ? `<section class="reveal" tabindex="-1" aria-labelledby="reveal-title"><p class="eyebrow">${state.answers[state.index] === question.author ? "Você acertou!" : "Essa era de outra pessoa"}</p><h2 id="reveal-title">Foi ${personName(question.author)}.</h2><p>${escape(question.context)}</p><div class="source"><time datetime="${question.date}">${dateLabel(question.date)}</time><a href="${escape(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fonte original ↗<span class="sr-only">: ${escape(question.sourceLabel)} (abre em outra aba)</span></a></div><button class="primary" type="button" id="next">${state.index === QUESTIONS.length-1 ? "Ver meu resultado" : "Próxima frase →"}</button></section>` : `<p class="hint">A fonte e o contexto aparecem depois da resposta.</p>`}`}
 <div class="score-strip" aria-label="Seu placar"><span><strong>${score.correct}</strong> acertos</span><span><strong>${score.points}</strong> pontos</span><span><strong>${score.streak}</strong> em sequência</span></div>
 <details class="rules"><summary>Como funciona a pontuação?</summary><p>100 pontos por acerto. Cada acerto seguido acrescenta 25 de bônus, até 100 de bônus por pergunta. Um erro encerra a sequência. Este jogo mede conhecimento e não altera seu ranking de preferências.</p></details>
 <p class="storage-note">${canSave ? "Progresso salvo neste navegador." : "Não foi possível salvar neste navegador. Você pode continuar jogando nesta aba."} Edição 01 · 10 frases históricas, 5 de cada pessoa.</p>
 <p class="storage-note">As frases preservam a fala registrada, com contexto após a resposta. Reconhecer o autor não significa concordar com a afirmação.</p>
 </main><footer><a href="./">Voltar ao PoliMatch</a><span>Conhecimento, uma frase por vez.</span></footer></div>`;
 if (focus) root.querySelector(focus)?.focus();
}
function result(score) {return `<section class="result" aria-labelledby="result-title"><p class="eyebrow">Edição concluída</p><h2 id="result-title">${score.correct}<small> de ${QUESTIONS.length}</small></h2><p>${score.correct >= 8 ? "Você reconheceu quase todas as vozes." : "Cada frase agora tem um contexto a mais."}</p><p>Melhor sequência: <strong>${score.bestStreak}</strong> · <strong>${score.points} pontos</strong></p><button class="primary" id="share" type="button">Compartilhar resultado ↗</button><p id="share-status" role="status" aria-live="polite"></p><textarea id="share-copy" aria-label="Copie seu resultado para compartilhar" readonly hidden></textarea><button class="secondary" id="restart" type="button">Jogar novamente</button><details class="review"><summary>Rever frases e fontes</summary><ol>${QUESTIONS.map((q,i)=>`<li><p>“${escape(q.quote)}”</p><strong>${personName(q.author)}</strong> · ${state.answers[i] === q.author ? "Acertou" : "Não acertou"}<p>${escape(q.context)}</p><time datetime="${q.date}">${dateLabel(q.date)}</time> · <a href="${escape(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(q.sourceLabel)} ↗</a></li>`).join("")}</ol></details></section>`;}
let sharing = false;
root.addEventListener("click", async event => {
 const button = event.target.closest("button"); if (!button || button.disabled) return;
 if (button.dataset.answer) {const updated = answerQuestion(state, button.dataset.answer); if(updated === state) return; state = updated; save(); render(".reveal");}
 if (button.id === "next") {state = nextQuestion(state); save(); render("h1"); root.querySelector("h1").scrollIntoView({block:"start",behavior:"instant"});}
 if (button.id === "restart") {state = freshGame(); save(); render("h1");}
 if (button.id === "share" && !sharing) {
  sharing = true; button.disabled = true;
  const text = shareText(state, new URL("./quem-disse-isso.html", location.href).href);
  const status = document.querySelector("#share-status");
  try {
   if (navigator.share) {await navigator.share({title:"Quem disse isso? — PoliMatch",text}); status.textContent = "Resultado pronto para compartilhar.";}
   else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(text); status.textContent = "Resultado copiado. Cole na conversa que preferir.";}
   else throw new Error("copy-unavailable");
  } catch(error) {if(error.name !== "AbortError") {const copy = document.querySelector("#share-copy"); copy.hidden = false; copy.value = text; copy.focus(); copy.select(); status.textContent = "Copie o texto abaixo para compartilhar.";}}
  finally {sharing = false; button.disabled = false;}
 }
});
// Reconcile another tab without overwriting a later answer with stale local state.
addEventListener("storage", event => {if(event.key === STORAGE_KEY) {state = restoreGame(event.newValue); render();}});
render();
