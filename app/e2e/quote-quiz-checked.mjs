import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {COMBINED_EDITION,COMBINED_QUESTIONS as questions,PEOPLE,EDITION} from '../src/quote-quiz-data.js';
import {storageKeyFor} from '../src/quote-quiz.js';
import {quizChroma} from '../src/quiz-chromas.js';
const kind=process.env.POLIMATCH_E2E_BROWSER||'chromium';
const base=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
const shots=process.env.POLIMATCH_CHECKED_SCREENSHOTS;
if(shots)await mkdir(shots,{recursive:true});
const browser=await {chromium,webkit}[kind].launch();
try{
 for(const width of [320,440,768,1440]){
  const page=await browser.newPage({viewport:{width,height:width===440?740:900},isMobile:width<=440,hasTouch:width<=440,serviceWorkers:'block'});
  const errors=[],api=[],seen=new Set();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
  await page.goto(new URL('quem-disse-isso.html',base).href);
  await page.locator('[data-answer]').first().waitFor();
  assert.match(await page.locator('.progress').innerText(),/1 de 28/);
  const oldProgress=JSON.stringify({edition:EDITION,answers:['lula'],index:0});
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:storageKeyFor(EDITION),value:oldProgress});
  let checked=0;
  for(const [i,q] of questions.entries()){
   await page.waitForFunction(()=>document.querySelectorAll('[data-answer].has-loaded-chroma').length===2);
   assert.equal(await page.locator('.fact-stamp').count(),0);
   assert.equal(await page.locator('[data-check]').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const id of q.choices){
    const p=PEOPLE.find(p=>p.id===id),card=page.locator(`[data-answer="${id}"]`);
    assert.equal(await card.getAttribute('aria-label'),p.name);
    assert.equal(await card.locator('[data-quiz-chroma]').getAttribute('src'),quizChroma(p).src);
    const geometry=await card.locator('.quiz-full-chroma').evaluate(img=>{const r=img.getBoundingClientRect();return {ratio:r.width/r.height,loaded:img.naturalWidth};});
    assert.ok(Math.abs(geometry.ratio-5/7)<.01);assert.ok(geometry.loaded>0);seen.add(id);
    assert.equal(await card.locator('.person-name').evaluate(n=>getComputedStyle(n).visibility),'hidden');
   }
   if(i===0&&shots)await page.screenshot({path:`${shots}/${kind}-${width}-choose.png`,fullPage:true});
   const wrong=q.fact&&checked<2;
   await page.locator(`[data-answer="${wrong?q.choices.find(id=>id!==q.author):q.author}"]`).press('Enter');
   await page.locator('.reveal').waitFor();
   assert.equal(await page.locator('[data-answer]:disabled').count(),2);
   if(q.fact){
    assert.equal(await page.locator('#next').count(),0);
    assert.equal(await page.locator('.fact-stamp').count(),0);
    assert.equal(await page.locator('.fact-sources').count(),0);
    assert.equal(await page.locator('[data-check]').count(),3);
    if(checked===0){await page.reload();await page.locator('[data-check]').first().waitFor();assert.equal(await page.locator('.fact-stamp').count(),0);}
    const value=checked===1?'fake':checked===2?'skip':q.fact.verdict;
    await page.locator(`[data-check="${value}"]`).click();
    await page.locator('.fact-stamp').waitFor();
    assert.equal(await page.locator('.fact-stamp').innerText(),q.fact.verdict.toUpperCase());
    assert.equal(await page.locator('[data-check]').count(),0);
    assert.equal(await page.locator('.fact-sources a').count(),q.fact.sources.length);
    for(const [j,s] of q.fact.sources.entries())assert.equal(await page.locator('.fact-sources a').nth(j).getAttribute('href'),s.url);
    const stamp=await page.locator('.fact-stamp').evaluate(n=>{const r=n.getBoundingClientRect();return {size:parseFloat(getComputedStyle(n).fontSize),left:r.left,right:r.right,w:innerWidth};});
    assert.ok(stamp.size>=48&&stamp.left>=0&&stamp.right<=stamp.w);
    if(checked===1)assert.match(await page.locator('.quiz-fact-reveal>.eyebrow').innerText(),/errou a checagem/i);
    if(checked===2)assert.match(await page.locator('.quiz-fact-reveal>.eyebrow').innerText(),/sem responder/i);
    if(checked===0){await page.reload();await page.locator('.fact-stamp').waitFor();assert.equal(await page.locator('.fact-stamp').innerText(),'FAKE');}
    if(shots&&checked<2)await page.screenshot({path:`${shots}/${kind}-${width}-${q.fact.verdict}.png`,fullPage:true});
    checked++;
   }else assert.equal(await page.locator('.fact-stamp').count(),0,'authorship alone must never invent a factual verdict');
   await page.locator('#next').click();
  }
  assert.equal(checked,8);assert.equal(seen.size,4);
  assert.match(await page.locator('#result-title').innerText(),/26.*de 28/s);
  assert.match(await page.locator('.checked-result').innerText(),/6 de 8.*1 puladas/s);
  await page.reload();await page.locator('#share').waitFor();
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
  await page.locator('#share').click();assert.match(await page.locator('#share-copy').inputValue(),/26 de 28/);assert.match(await page.locator('#share-copy').inputValue(),/6 de 8/);assert.match(await page.locator('#share-copy').inputValue(),/edicao=3/);
  await page.getByText('Rever frases, propostas e fontes',{exact:true}).click();
  assert.equal(await page.locator('.review>ol>li').count(),28);assert.equal(await page.locator('.review-verdict').count(),8);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKeyFor(EDITION)),oldProgress);
  await page.locator('#restart').click();assert.match(await page.locator('.progress').innerText(),/1 de 28/);assert.equal(await page.locator('.reveal').count(),0);
  assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),storageKeyFor(COMBINED_EDITION))).verdicts,{});
  await page.getByRole('link',{name:'Jogar edição anterior',exact:true}).click();await page.locator('.reveal').waitFor();assert.match(await page.locator('.progress').innerText(),/1 de 20/);
  assert.deepEqual(errors,[]);assert.deepEqual(api,[]);await page.close();
  console.log(`${kind} ${width}: 28 authors, 8 independent checks, skip, large truthful verdicts, latest 4 Chromas, sources, reload, review, replay and preserved old progress passed`);
 }
 const broken=await browser.newPage();
 await broken.route('**/chromas/cover/lula-*',route=>route.abort());
 await broken.goto(new URL('quem-disse-isso.html',base).href);
 await broken.waitForFunction(()=>{const i=document.querySelector('[data-answer="lula"] [data-quiz-chroma]');return i?.complete&&!i.naturalWidth;});
 assert.equal(await broken.locator('[data-answer="lula"]').evaluate(n=>n.classList.contains('has-loaded-chroma')),false);
 const photo=broken.locator('[data-answer="lula"] .quiz-photo-reserve');await photo.evaluate(i=>i.decode());assert.ok(await photo.evaluate(i=>i.naturalWidth>0));assert.equal(await broken.locator('[data-answer="lula"] .person-name').evaluate(n=>getComputedStyle(n).visibility),'visible');
 await broken.locator('[data-answer="lula"]').click();await broken.locator('[data-check="skip"]').click();await broken.locator('.fact-stamp').waitFor();await broken.close();
 const blocked=await browser.newPage();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
 await blocked.goto(new URL('quem-disse-isso.html',base).href);await blocked.locator('[data-answer="lula"]').click();await blocked.locator('[data-check="fake"]').click();await blocked.locator('.fact-stamp').waitFor();assert.match(await blocked.locator('.storage-note').first().innerText(),/Não foi possível salvar/);await blocked.close();
}finally{await browser.close();}
