import './quote-quiz.css';
import './fact-check.css';
import {FACT_EDITION as edition} from './fact-check-data.js';
import {FACT_STORAGE_KEY,freshFacts,restoreFacts,answerFact,nextFact,factScore,factShare} from './fact-check.js';
import {portraitSlot} from './photos.js';
const root=document.querySelector('#facts');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let state=freshFacts(),canSave=true,sharing=false;
try {state=restoreFacts(localStorage.getItem(FACT_STORAGE_KEY));} catch {canSave=false;}
function save(){try{localStorage.setItem(FACT_STORAGE_KEY,JSON.stringify(state));}catch{canSave=false;}}
function sources(q) {
  return `<ol class="fact-sources">${q.sources.map(s=>`<li><span class="eyebrow">${s.kind==='speech'?'Registro da fala':'Prova e contexto'}</span><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗<span class="sr-only"> (abre em outra aba)</span></a><p>${esc(s.locator)}</p></li>`).join('')}</ol>`;
}
function explanation(q) {
  return `<h3>Por quê?</h3><p>${esc(q.explanation)}</p><p class="fact-scope"><strong>O recorte importa.</strong> ${esc(q.scope)}</p><h3>Confira as provas</h3>${sources(q)}<p class="fact-checked">Veredito da checagem citada: ${esc(q.originalVerdict)}. Fontes consultadas em 24/10/2026.</p>`;
}
function question(q,answered) {
  const person=edition.people[q.speaker];
  return `<section class="question fact-question" aria-labelledby="statement"><div class="fact-speaker"><img src="${portraitSlot(person.personId)}" width="42" height="42" alt=""><div><span class="eyebrow">${esc(q.topic)} · dito por</span><strong>${esc(person.name)}</strong></div></div><p id="statement" class="fact-statement">${esc(q.statement)}</p><p class="fact-summary">Afirmação resumida · sem transcrição literal</p></section>
    <div class="fact-choices" role="group" aria-label="Essa afirmação é fato ou fake?">${['fato','fake'].map(v=>`<button type="button" data-verdict="${v}" ${answered?'disabled':''} ${answered?`class="${v===q.verdict?'is-answer':state.answers[state.index].answer===v?'is-wrong':'is-muted'}"`:''}><span aria-hidden="true">${v==='fato'?'✓':'×'}</span>${v==='fato'?'Fato':'Fake'}</button>`).join('')}</div>
    ${answered?`<section class="reveal fact-reveal" tabindex="-1" aria-labelledby="verdict-title"><p class="eyebrow">${state.answers[state.index].answer===q.verdict?'Você acertou!':'Agora você sabe.'}</p><h2 id="verdict-title">${q.verdict==='fato'?'✓ É fato.':'× É fake.'}</h2>${explanation(q)}<button class="primary" id="next" type="button">${state.index===edition.questions.length-1?'Ver meu resultado':'Próxima afirmação →'}</button></section>`:'<p class="hint">Responda para revelar a explicação e as provas.</p>'}`;
}
function result() {
  const n=factScore(state);
  return `<section class="result" aria-labelledby="result-title"><p class="eyebrow">Debate conferido</p><h2 id="result-title">${n}<small> de ${edition.questions.length}</small></h2><p>${n===edition.questions.length?'Você passou pelo debate com os fatos em dia.':'O debate termina. As provas ficam.'}</p><button class="primary" id="share" type="button">Compartilhar resultado ↗</button><p id="share-status" role="status" aria-live="polite"></p><textarea id="share-copy" aria-label="Copie seu resultado para compartilhar" readonly hidden></textarea><button class="secondary" id="restart" type="button">Jogar novamente</button><details class="review"><summary>Rever todas as afirmações e provas</summary><ol>${edition.questions.map((q,i)=>`<li><p class="eyebrow">${esc(edition.people[q.speaker].name)} · ${esc(q.topic)}</p><h2>${esc(q.statement)}</h2><p><strong>${q.verdict==='fato'?'Fato':'Fake'}</strong> · ${state.answers[i].answer===q.verdict?'Você acertou':'Você errou'}</p>${explanation(q)}</li>`).join('')}</ol></details></section>`;
}
function render(focus='') {
  const complete=state.index===edition.questions.length,answered=state.answers.length>state.index;
  root.innerHTML=`<div class="quiz-shell fact-shell"><a class="skip-link" href="#content">Pular para o jogo</a><header class="quiz-header"><a class="brand" href="./" aria-label="PoliMatch — início"><img src="./icon.svg" alt="" width="32" height="32">PoliMatch</a><a class="back" href="./">← Início</a></header><main id="content"><div class="quiz-title"><div><p class="eyebrow">Globo · 23 de outubro de 2026</p><h1 tabindex="-1">Fato ou fake?</h1></div><span class="progress" role="status" aria-label="${complete?'Jogo concluído':'Progresso do jogo'}">${complete?'✓ Concluído':`${state.index+1} de ${edition.questions.length}`}</span></div><p class="intro">${complete?'Seu resultado é sobre estas oito afirmações.':'Lula e Flávio falaram. Os dados confirmam?'} Escolha, descubra o porquê e confira a fonte.</p>${complete?result():question(edition.questions[state.index],answered)}<div class="score-strip" aria-label="Seu placar"><span><strong>${factScore(state)}</strong> acertos</span><span><strong>${factScore(state)*100}</strong> pontos</span></div><details class="rules"><summary>Como escolhemos e checamos as falas?</summary><p>Esta edição reúne oito afirmações objetivas do debate presidencial da Globo de 23/10/2026. Os textos são resumos identificados, não citações literais. Cada item liga o registro da fala às provas e mantém seu recorte temporal.</p><p>Fato corresponde a verdadeiro; fake, a falso na checagem citada. Opiniões, promessas futuras e casos classificados como exagerados, imprecisos, sem contexto ou sem prova não entram neste jogo binário. Não concluímos que ausência de prova é falsidade.</p><p>São quatro afirmações por candidato. A seleção não mede quem mentiu mais no debate. 100 pontos por acerto, sem alterar votos ou ranking. Fontes consultadas em 24/10/2026. Edição independente do PoliMatch, sem vínculo com a Globo ou com o selo Fato ou Fake do g1.</p></details><p class="storage-note">${canSave?'Progresso salvo neste navegador.':'Não foi possível salvar neste navegador. Você pode jogar nesta aba.'} Edição anterior de 23/10/2026. A revisão documental está no Quem disse isso.</p></main><footer><a href="./quem-disse-isso.html">Jogar Quem disse isso?</a><a href="./">Voltar ao início</a></footer></div>`;
  if(focus) root.querySelector(focus)?.focus();
}
root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.verdict){const updated=answerFact(state,button.dataset.verdict);if(updated===state)return;state=updated;save();render('.reveal');}
  if(button.id==='next'){state=nextFact(state);save();render('h1');root.querySelector('h1').scrollIntoView({block:'start'});}
  if(button.id==='restart'){state=freshFacts();save();render('h1');root.querySelector('h1').scrollIntoView({block:'start'});}
  if(button.id==='share'&&!sharing){
    sharing=true;button.disabled=true;
    const text=factShare(state,new URL('./fato-ou-fake.html',location.href).href),status=root.querySelector('#share-status');
    try {
      if(navigator.share){await navigator.share({title:'Fato ou fake? — PoliMatch',text});status.textContent='Resultado pronto para compartilhar.';}
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);status.textContent='Resultado copiado. Cole na conversa que preferir.';}
      else throw new Error('copy-unavailable');
    } catch(error){if(error.name!=='AbortError'){const copy=root.querySelector('#share-copy');copy.hidden=false;copy.value=text;copy.focus();copy.select();status.textContent='Copie o texto abaixo para compartilhar.';}}
    finally{sharing=false;button.disabled=false;}
  }
});
addEventListener('storage',event=>{if(event.key===FACT_STORAGE_KEY||event.key===null){state=restoreFacts(event.key===null?null:event.newValue);render();}});
render();
