import './quote-quiz.css';
import './fact-check.css';
import './quote-quiz-checked.css';
import {EDITION, COMBINED_EDITION, LEGACY_EDITION, editionFor} from './quote-quiz-data.js';
import {portraitSlot} from './photos.js';
import {quizChroma} from './quiz-chromas.js';
import {freshGame, restoreGame, answerQuestion, answerCheck, checkScore, nextQuestion, scoreGame, shareText, formatQuizDate, storageKeyFor} from './quote-quiz.js';

const requested=new URLSearchParams(location.search).get('edicao');
const edition = editionFor(requested==='1'?LEGACY_EDITION:requested==='2'?EDITION:COMBINED_EDITION);
const combined=edition.id===COMBINED_EDITION;
const {questions,people} = edition;
const storageKey = storageKeyFor(edition.id);
const root = document.querySelector('#quiz');
const settleArt=event=>{
  const img=event.target;if(!img?.matches?.('[data-quiz-chroma]'))return;
  img.closest('.person-card')?.classList.toggle('has-loaded-chroma',img.complete&&img.naturalWidth>0);
};
root.addEventListener('load',settleArt,true);root.addEventListener('error',settleArt,true);
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
    const art=quizChroma(person);
    const status=answered ? id===question.author ? 'correct' : state.answers[state.index]===id ? 'incorrect' : 'muted' : '';
    return `<button class="person-card quiz-chroma-card ${status}" type="button" data-answer="${id}" aria-label="${escape(person.name)}" aria-describedby="quiz-art-note" ${answered?'disabled':''}>
      <span class="quiz-chroma-view"><img class="quiz-photo-reserve" src="${portraitSlot(person.personId)}" alt="" width="400" height="480">
      <span class="person-name">${escape(person.name)}</span>
      ${art?`<img class="quiz-full-chroma" data-quiz-chroma src="${escape(art.src)}" srcset="${escape(art.srcset)}" sizes="(max-width:600px) 43vw, 220px" width="1060" height="1484" alt="" decoding="async">`:''}</span>
      <span class="quiz-card-status">${answered&&id===question.author?`✓ ${proposal(question)?'Plano identificado':'Autor da frase'}`:answered&&state.answers[state.index]===id?'Sua escolha':''}</span></button>`;
  }).join('')}</div>`;
}
function checkedEvidence(q){
  const fact=q.fact;
  return `<p class="checked-claim"><strong>O que foi checado</strong>${escape(fact.statement)}</p><h3>Por quê?</h3><p>${escape(fact.explanation)}</p><p class="fact-scope"><strong>O recorte importa.</strong>${escape(fact.scope)}</p><h3>Confira as provas</h3><ol class="fact-sources">${fact.sources.map(s=>`<li><span class="eyebrow">${s.kind==='speech'?'Registro da fala':'Prova e contexto'}</span><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)} ↗<span class="sr-only"> (abre em outra aba)</span></a><p>${escape(s.locator)}</p></li>`).join('')}</ol><p class="fact-checked">Checagem citada: ${escape(fact.originalVerdict)} · fontes consultadas em 24/10/2026.</p>`;
}
function checkReveal(q){
  const value=state.verdicts?.[q.id];
  if(!value)return `<section class="quiz-check-step" aria-labelledby="check-title"><p class="eyebrow">Agora é com você · checagem</p><h3 id="check-title">O que foi dito é fato ou fake?</h3><p>Escolha a sua resposta antes de ver as provas.</p><div class="fact-choices" role="group" aria-label="Sua resposta sobre o conteúdo"><button type="button" data-check="fato">Fato</button><button type="button" data-check="fake">Fake</button></div><button type="button" class="quiz-skip-check" data-check="skip">Ver a checagem sem responder</button></section>`;
  return `<section class="quiz-fact-reveal" tabindex="-1" aria-labelledby="fact-verdict-title"><p class="eyebrow">${value==='skip'?'Você preferiu ver sem responder':value===q.fact.verdict?'Você acertou a checagem':'Você errou a checagem'}</p><h3 id="fact-verdict-title" class="fact-stamp ${q.fact.verdict}">${q.fact.verdict.toUpperCase()}</h3>${checkedEvidence(q)}</section>`;
}
function reveal(question,answered) {
  if (!answered) return '<p class="hint">A fonte e o contexto aparecem depois da resposta.</p>';
  return `<section class="reveal" tabindex="-1" aria-labelledby="reveal-title">
    <p class="eyebrow">${state.answers[state.index]===question.author?'Acertou na mosca!':'Essa te pegou!'}${question.fact?' · Autoria':''}</p>
    <h2 id="reveal-title">${proposal(question)?'Está no plano de':'Foi'} ${personName(question.author)}.</h2>
    ${question.fact?checkReveal(question):`<p>${escape(question.context)}</p>${sourceLinks(question)}`}
    ${!question.fact||state.verdicts?.[question.id]?`<button class="primary" type="button" id="next">${state.index===questions.length-1?'Ver meu resultado':'Próxima frase →'}</button>`:''}</section>`;
}
function review() {
  return `<details class="review"><summary>Rever frases, propostas e fontes</summary><ol>${questions.map((q,i)=>`<li>
    <span class="eyebrow">${q.fact?'Debate da Globo · afirmação resumida':proposal(q)?'Proposta resumida · sem citação literal':'Fala registrada'}</span>
    <p>${proposal(q)||q.fact?escape(q.quote):`“${escape(q.quote)}”`}</p>
    <strong>${personName(q.author)}</strong> · ${state.answers[i]===q.author?'Acertou':'Não acertou'}
    ${q.fact?`<p class="review-verdict ${q.fact.verdict}">${q.fact.verdict.toUpperCase()} · ${state.verdicts[q.id]==='skip'?'Checagem pulada':state.verdicts[q.id]===q.fact.verdict?'Acertou a checagem':'Errou a checagem'}</p>${checkedEvidence(q)}`:`<p>${escape(q.context)}</p>${sourceLinks(q)}`}</li>`).join('')}</ol></details>`;
}
function result(score) {
  const checked=checkScore(state);
  const percentage=score.correct/questions.length;
  return `<section class="result" aria-labelledby="result-title"><p class="eyebrow">Edição concluída</p>
    <h2 id="result-title">${score.correct}<small> de ${questions.length}</small></h2>
    <p>${percentage===1?'Gabaritou. Memória política afiada!':percentage>=.8?'Você reconheceu quase todas as vozes.':'Cada frase agora tem um contexto a mais.'}</p>
    ${checked.total?`<p class="checked-result"><strong>${checked.correct} de ${checked.total}</strong> checagens certas · ${checked.skipped} puladas</p>`:''}
    <p>Melhor sequência de autores: <strong>${score.bestStreak}</strong> · <strong>${score.points} pontos</strong></p>
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
    <main id="content"><div class="quiz-title"><div><p class="eyebrow">${combined?'Vozes + Fato ou fake':edition.id===EDITION?'Vozes da corrida presidencial':'Lula ou Flávio?'}</p>
    <h1 tabindex="-1">Quem disse isso?</h1></div><span class="progress" role="status" aria-label="${complete?'Jogo concluído':'Progresso do jogo'}">${complete?'✓ Concluído':`${state.index+1} de ${questions.length}`}</span></div>
    <p class="intro">${complete?'Confira seu resultado e desafie alguém a reconhecer essas vozes.':question.fact?'Quem disse isso no debate da Globo? Depois, escolha Fato ou Fake.':proposal(question)?'De quem é a proposta? Toque no autor do plano.':'Parece óbvio? Toque em quem você acha que disse.'}</p>
    ${complete?result(score):`<section class="question ${proposal(question)?'proposal':''}" aria-label="${proposal(question)?'Proposta da rodada':'Frase da rodada'}">
      ${question.fact?'<span class="question-kind">Globo · 23/10/2026 · afirmação resumida, sem citação literal</span>':proposal(question)?'<span class="question-kind">Proposta resumida · sem citação literal</span>':'<span class="quote-mark" aria-hidden="true">“</span>'}
      ${proposal(question)||question.fact?`<p class="proposal-text">${escape(question.quote)}</p>`:`<blockquote>${escape(question.quote)}</blockquote>`}
      <p>${proposal(question)?'Qual plano traz essa proposta?':'Quem falou?'}</p></section>
      ${cards(question,answered)}${reveal(question,answered)}`}
    <div class="score-strip" aria-label="Seu placar"><span><strong>${score.correct}</strong> ${combined?'autores certos':'acertos'}</span>${combined?`<span><strong>${checkScore(state).correct}</strong> checagens certas</span>`:''}<span><strong>${score.points}</strong> pontos</span>${!combined?`<span><strong>${score.streak}</strong> em sequência</span>`:''}</div>
    <details class="rules"><summary>Como funciona a pontuação?</summary><p>100 pontos por autor certo. Cada autor certo seguido acrescenta 25 de bônus, até 100 de bônus por pergunta. Um erro de autoria encerra a sequência. ${combined?'Cada checagem certa soma mais 100 pontos; pular não pontua. Autoria e verdade do conteúdo têm resultados separados.':''} Este jogo mede conhecimento e não altera seu ranking de preferências.</p></details>
    <p class="storage-note">${canSave?'Progresso salvo neste navegador.':'Não foi possível salvar neste navegador. Você pode continuar jogando nesta aba.'} Edição ${edition.number} · ${questions.length} perguntas.</p>
    <p class="storage-note" id="quiz-art-note">Cartas com retratos artísticos com IA.</p>
    <details class="rules editorial-note"><summary>Sobre as falas desta edição</summary><p>${edition.id!==LEGACY_EDITION?'Curadoria de episódios polêmicos e falas históricas de Lula, propostas do plano de Flávio e participações de Janja e Nikolas. Inclui linguagem ofensiva em registros históricos.':''} As falas mantêm a autoria e recebem contexto após responder. Reconhecer o autor não confirma a afirmação. Propostas são resumos identificados, sem aspas, e não medidas já realizadas.</p>${combined?'<p>São 20 itens presidenciais e 8 afirmações checadas do debate de 23/10/2026. Somente os oito itens têm veredito factual publicado. Opiniões e promessas não recebem FAKE por erro de autoria. As checagens mantêm recorte e fontes; esta seleção não mede quem mentiu mais. Você pode responder ou ver as provas sem responder.</p>':''}</details>
    </main><footer><a href="./quem-disse-isso.html?edicao=${combined?'2':edition.id===EDITION?'1':'2'}">${edition.id===LEGACY_EDITION?'Jogar edição presidencial':'Jogar edição anterior'}</a>${!combined?'<a href="./quem-disse-isso.html">Jogar edição com checagem</a>':''}<a href="./fato-ou-fake.html">Fato ou fake? · Debate da Globo</a></footer></div>`;
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
  if(button.dataset.check){
    const updated=answerCheck(state,button.dataset.check);if(updated===state)return;
    state=updated;save();render('.quiz-fact-reveal');
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
  if (event.key===storageKey||event.key===null) {state=restoreGame(event.key===null?null:event.newValue,edition.id);render();}
});
render();
