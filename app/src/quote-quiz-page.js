import './quote-quiz.css';
import {EDITION, LEGACY_EDITION, editionFor} from './quote-quiz-data.js';
import {portraitSlot} from './photos.js';
import {freshGame, restoreGame, answerQuestion, nextQuestion, scoreGame, shareText, formatQuizDate, storageKeyFor} from './quote-quiz.js';

const edition = editionFor(new URLSearchParams(location.search).get('edicao') === '1' ? LEGACY_EDITION : EDITION);
const {questions,people} = edition;
const storageKey = storageKeyFor(edition.id);
const root = document.querySelector('#quiz');
let state=freshGame(edition.id), canSave=true, sharing=false;
try {state=restoreGame(localStorage.getItem(storageKey),edition.id);} catch {canSave=false;}
const escape = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const personName = id => people.find(person=>person.id===id).name;
const proposal = question => question.kind === 'proposal';
function save() {
  try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {canSave=false;}
}
function sourceLinks(question) {
  return `<div class="source"><time datetime="${question.date}">${escape(question.dateLabel||formatQuizDate(question.date))}</time>
    <a href="${escape(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fonte original ↗<span class="sr-only">: ${escape(question.sourceLabel)} (abre em outra aba)</span></a></div>
    ${question.relatedSource?`<a class="related-source" href="${escape(question.relatedSource.url)}" target="_blank" rel="noopener noreferrer">${escape(question.relatedSource.label)} ↗</a>`:''}`;
}
function cards(question,answered) {
  return `<div class="choices" aria-label="Escolha o autor">${question.choices.map(id=>{
    const person=people.find(person=>person.id===id);
    const status=answered ? id===question.author ? 'correct' : state.answers[state.index]===id ? 'incorrect' : 'muted' : '';
    return `<button class="person-card ${status}" type="button" data-answer="${id}" ${answered?'disabled':''}>
      <div class="photo"><img src="${portraitSlot(person.personId)}" alt="" width="400" height="480">
      ${answered&&id===question.author?`<span class="answer-badge">✓ ${proposal(question)?'Plano identificado':'Autor da frase'}</span>`:''}</div>
      <span class="person-name">${escape(person.name)}</span></button>`;
  }).join('')}</div>`;
}
function reveal(question,answered) {
  if (!answered) return '<p class="hint">A fonte e o contexto aparecem depois da resposta.</p>';
  return `<section class="reveal" tabindex="-1" aria-labelledby="reveal-title">
    <p class="eyebrow">${state.answers[state.index]===question.author?'Acertou na mosca!':'Essa te pegou!'}</p>
    <h2 id="reveal-title">${proposal(question)?'Está no plano de':'Foi'} ${personName(question.author)}.</h2>
    <p>${escape(question.context)}</p>${sourceLinks(question)}
    <button class="primary" type="button" id="next">${state.index===questions.length-1?'Ver meu resultado':'Próxima frase →'}</button></section>`;
}
function review() {
  return `<details class="review"><summary>Rever frases, propostas e fontes</summary><ol>${questions.map((q,i)=>`<li>
    <span class="eyebrow">${proposal(q)?'Proposta resumida · sem citação literal':'Fala registrada'}</span>
    <p>${proposal(q)?escape(q.quote):`“${escape(q.quote)}”`}</p>
    <strong>${personName(q.author)}</strong> · ${state.answers[i]===q.author?'Acertou':'Não acertou'}
    <p>${escape(q.context)}</p>${sourceLinks(q)}</li>`).join('')}</ol></details>`;
}
function result(score) {
  const percentage=score.correct/questions.length;
  return `<section class="result" aria-labelledby="result-title"><p class="eyebrow">Edição concluída</p>
    <h2 id="result-title">${score.correct}<small> de ${questions.length}</small></h2>
    <p>${percentage===1?'Gabaritou. Memória política afiada!':percentage>=.8?'Você reconheceu quase todas as vozes.':'Cada frase agora tem um contexto a mais.'}</p>
    <p>Melhor sequência: <strong>${score.bestStreak}</strong> · <strong>${score.points} pontos</strong></p>
    <button class="primary" id="share" type="button">Compartilhar resultado ↗</button>
    <p id="share-status" role="status" aria-live="polite"></p>
    <textarea id="share-copy" aria-label="Copie seu resultado para compartilhar" readonly hidden></textarea>
    <button class="secondary" id="restart" type="button">Jogar novamente</button>${review()}</section>`;
}
function render(focus='') {
  const score=scoreGame(state), complete=state.index===questions.length;
  const question=questions[state.index], answered=state.answers.length>state.index;
  root.innerHTML=`<div class="quiz-shell"><header class="quiz-header">
    <a class="brand" href="./" aria-label="PoliMatch — início"><img src="./icon.svg" alt="" width="32" height="32">PoliMatch</a><a class="back" href="./">← Início</a></header>
    <main id="content"><div class="quiz-title"><div><p class="eyebrow">${edition.id===EDITION?'Vozes da corrida presidencial':'Lula ou Flávio?'}</p>
    <h1 tabindex="-1">Quem disse isso?</h1></div><span class="progress" role="status" aria-label="${complete?'Jogo concluído':'Progresso do jogo'}">${complete?'✓ Concluído':`${state.index+1} de ${questions.length}`}</span></div>
    <p class="intro">${complete?'Confira seu resultado e desafie alguém a reconhecer essas vozes.':proposal(question)?'De quem é a proposta? Toque no autor do plano.':'Parece óbvio? Toque em quem você acha que disse.'}</p>
    ${complete?result(score):`<section class="question ${proposal(question)?'proposal':''}" aria-label="${proposal(question)?'Proposta da rodada':'Frase da rodada'}">
      ${proposal(question)?'<span class="question-kind">Proposta resumida · sem citação literal</span>':'<span class="quote-mark" aria-hidden="true">“</span>'}
      ${proposal(question)?`<p class="proposal-text">${escape(question.quote)}</p>`:`<blockquote>${escape(question.quote)}</blockquote>`}
      <p>${proposal(question)?'Qual plano traz essa proposta?':'Quem falou?'}</p></section>
      ${cards(question,answered)}${reveal(question,answered)}`}
    <div class="score-strip" aria-label="Seu placar"><span><strong>${score.correct}</strong> acertos</span><span><strong>${score.points}</strong> pontos</span><span><strong>${score.streak}</strong> em sequência</span></div>
    <details class="rules"><summary>Como funciona a pontuação?</summary><p>100 pontos por acerto. Cada acerto seguido acrescenta 25 de bônus, até 100 de bônus por pergunta. Um erro encerra a sequência. Este jogo mede conhecimento e não altera seu ranking de preferências.</p></details>
    <p class="storage-note">${canSave?'Progresso salvo neste navegador.':'Não foi possível salvar neste navegador. Você pode continuar jogando nesta aba.'} Edição ${edition.number} · ${questions.length} perguntas.</p>
    <details class="rules editorial-note"><summary>Sobre as falas desta edição</summary><p>${edition.id===EDITION?'Curadoria de episódios polêmicos e falas históricas de Lula, propostas do plano de Flávio e participações de Janja e Nikolas. Inclui linguagem ofensiva em registros históricos.':''} As falas mantêm a autoria e recebem contexto após responder. Reconhecer o autor não confirma a afirmação. Propostas são resumos identificados, sem aspas, e não medidas já realizadas.</p></details>
    </main><footer><a href="./quem-disse-isso.html?edicao=${edition.id===EDITION?'1':'2'}">${edition.id===EDITION?'Jogar edição anterior':'Jogar edição presidencial'}</a><span>Conhecimento, uma frase por vez.</span></footer></div>`;
  if (focus) root.querySelector(focus)?.focus();
}
root.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if (!button||button.disabled) return;
  if (button.dataset.answer) {
    const updated=answerQuestion(state,button.dataset.answer);
    if (updated===state) return;
    state=updated; save(); render('.reveal');
  }
  if (button.id==='next') {
    state=nextQuestion(state); save(); render('h1');
    root.querySelector('h1').scrollIntoView({block:'start',behavior:'auto'});
  }
  if (button.id==='restart') {state=freshGame(edition.id);save();render('h1');}
  if (button.id==='share'&&!sharing) {
    sharing=true;button.disabled=true;
    const url=new URL('./quem-disse-isso.html',location.href);
    url.searchParams.set('edicao',edition.number);
    const text=shareText(state,url.href),status=document.querySelector('#share-status');
    try {
      if (navigator.share) {await navigator.share({title:'Quem disse isso? — PoliMatch',text});status.textContent='Resultado pronto para compartilhar.';}
      else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(text);status.textContent='Resultado copiado. Cole na conversa que preferir.';}
      else throw new Error('copy-unavailable');
    } catch(error) {
      if (error.name!=='AbortError') {
        const copy=document.querySelector('#share-copy');copy.hidden=false;copy.value=text;copy.focus();copy.select();
        status.textContent='Copie o texto abaixo para compartilhar.';
      }
    } finally {sharing=false;button.disabled=false;}
  }
});
addEventListener('storage',event=>{
  if (event.key===storageKey) {state=restoreGame(event.newValue,edition.id);render();}
});
render();
