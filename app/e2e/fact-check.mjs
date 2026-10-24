import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {FACT_EDITION as edition} from '../src/fact-check-data.js';
import {FACT_STORAGE_KEY} from '../src/fact-check.js';
const browserName=process.env.POLIMATCH_E2E_BROWSER||'chromium';
const browser=await ({chromium,webkit}[browserName]).launch();
const origin=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
const shots=process.env.POLIMATCH_FACT_SCREENSHOTS;
if(shots)await mkdir(shots,{recursive:true});
try{
 for(const width of [320,390,440,1440]){
  const page=await browser.newPage({viewport:{width,height:width===440?740:900},serviceWorkers:'block'});
  const errors=[],api=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('polimatch.quote-quiz.v1:sentinel','preserved'));
  await page.goto(new URL('fato-ou-fake.html',origin).href);
  await page.locator('[data-verdict]').first().waitFor();
  assert.equal(await page.locator('.fact-sources').count(),0);
  const boxes=await page.locator('[data-verdict]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom};}));
  assert.ok(boxes.every(b=>b.h>=44&&b.w>=120&&b.b<=innerHeightFor(width)));
  assert.equal(boxes[0].y,boxes[1].y);assert.ok(Math.abs(boxes[0].w-boxes[1].w)<1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(shots)await page.screenshot({path:`${shots}/${browserName}-${width}-question.png`,fullPage:true});
  for(const [i,q] of edition.questions.entries()){
   assert.equal(await page.locator('#statement').innerText(),q.statement);
   const value=i===1?'fake':q.verdict;
   await page.locator(`[data-verdict="${value}"]`).press('Enter');
   await page.locator('.reveal').waitFor();
   assert.equal(await page.locator('[data-verdict]:disabled').count(),2);
   assert.match(await page.locator('#verdict-title').innerText(),q.verdict==='fato'?/É fato/:/É fake/);
   assert.match(await page.locator('.reveal>.eyebrow').innerText(),i===1?/Agora você sabe/i:/Você acertou/i);
   assert.equal(await page.locator('.fact-sources a').count(),q.sources.length);
   for(const [j,s] of q.sources.entries()){
    const link=page.locator('.fact-sources a').nth(j);
    assert.equal(await link.getAttribute('href'),s.url);assert.equal(await link.getAttribute('target'),'_blank');
    assert.match(await link.getAttribute('rel'),/noopener/);
    // Exercise the real anchor/popup action, isolate the external page itself from this app regression test.
    await page.context().route(s.url.split('#')[0],route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Fonte externa</title><p>Fixture externa</p>'}));
    const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;
    await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),s.url);await popup.close();
   }
   if(i===0){await page.reload();await page.locator('.reveal').waitFor();assert.match(await page.locator('.progress').innerText(),/1 de 8/);if(shots)await page.screenshot({path:`${shots}/${browserName}-${width}-reveal.png`,fullPage:true});}
   await page.locator('#next').click();
  }
  assert.match(await page.locator('#result-title').innerText(),/7.*de 8/s);
  assert.equal(await page.getByRole('status',{name:'Jogo concluído'}).count(),1);
  await page.reload();await page.locator('#share').waitFor();
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
  await page.locator('#share').click();assert.match(await page.locator('#share-copy').inputValue(),/Acertei 7 de 8/);
  assert.match(await page.locator('#share-copy').inputValue(),/fato-ou-fake.html/);
  await page.getByText('Rever todas as afirmações e provas',{exact:true}).click();
  assert.equal(await page.locator('.review>ol>li').count(),8);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByText('Como escolhemos e checamos as falas?',{exact:true}).click();
  assert.match(await page.locator('.rules').innerText(),/não mede quem mentiu mais/);
  if(shots)await page.screenshot({path:`${shots}/${browserName}-${width}-result.png`,fullPage:true});
  // Both native share paths and clipboard, including cancellation, preserve the result.
  await page.evaluate(()=>{window.shareCalls=[];Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.shareCalls.push(data)});});
  await page.locator('#share').click();assert.equal(await page.evaluate(()=>window.shareCalls.length),1);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancelled','AbortError');}}));
  await page.locator('#share').click();assert.equal(await page.locator('#share').isEnabled(),true);
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}});});
  await page.locator('#share').click();assert.match(await page.evaluate(()=>window.copied),/Acertei 7 de 8/);
  await page.locator('#restart').click();assert.equal(await page.locator('.reveal').count(),0);
  assert.match(await page.locator('.score-strip').innerText(),/0\s+acertos/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('polimatch.quote-quiz.v1:sentinel')),'preserved');
  assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),FACT_STORAGE_KEY)).answers.length,0);
  await page.getByRole('link',{name:'Jogar Quem disse isso?',exact:true}).click();await page.locator('[data-answer]').first().waitFor();
  await page.getByRole('link',{name:'Fato ou fake? · edição anterior',exact:true}).click();await page.locator('[data-verdict]').first().waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
  assert.equal(await page.getByRole('link',{name:'Voltar ao início',exact:true}).getAttribute('href'),'./');
  await page.close();
 }
 const page=await browser.newPage();
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
 await page.goto(new URL('fato-ou-fake.html',origin).href);await page.locator('[data-verdict]').first().click();
 await page.locator('.reveal').waitFor();assert.match(await page.locator('.storage-note').innerText(),/Não foi possível salvar/);await page.close();
 console.log('Fato ou fake: 8 items, all controls and source anchors, resume, review, replay, three sharing paths, blocked storage and 4 widths passed.');
}finally{await browser.close();}
function innerHeightFor(width){return width===440?740:900;}
