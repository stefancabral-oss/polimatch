import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {QUESTIONS} from '../src/quote-quiz-data.js';
const browser=await ({chromium,webkit}[process.env.POLIMATCH_E2E_BROWSER||'chromium']).launch();
const origin=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
try {
 for(const width of [320,390,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[],api=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url());});
  await page.goto(new URL('quem-disse-isso.html',origin).href);
  await page.locator('[data-answer]').first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Lula',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Flávio Bolsonaro',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:/Ver fonte original/}).count(),0);
  const cardBoxes=await page.locator('[data-answer]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  assert.ok(Math.abs(cardBoxes[0].h-cardBoxes[1].h)<1); assert.equal(cardBoxes[0].y,cardBoxes[1].y);
  assert.ok(cardBoxes.every(b=>b.w>=130 && b.h>=180));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(let i=0;i<10;i++){
   await page.locator(`[data-answer="${QUESTIONS[i].author}"]`).focus();
   await page.keyboard.press('Enter');
   await page.locator('.reveal').waitFor();
   assert.match(await page.locator('.reveal').innerText(),/Você acertou!/i);
   assert.equal(await page.locator('[data-answer]:disabled').count(),2);
   assert.equal(await page.getByRole('link',{name:/Ver fonte original/}).getAttribute('href'),QUESTIONS[i].sourceUrl);
   if(i===0){await page.reload();await page.locator('.reveal').waitFor();assert.match(await page.locator('.progress').innerText(),/1 de 10/);}
   if(i===0 && process.env.POLIMATCH_QUIZ_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_QUIZ_SCREENSHOTS}/${width}-reveal.png`,fullPage:true});
   await page.locator('#next').click();
  }
  assert.match(await page.locator('#result-title').innerText(),/10.*de 10/s);
  assert.match(await page.locator('.score-strip').innerText(),/1750/);
  await page.reload(); await page.locator('#share').waitFor();
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
  await page.locator('#share').click();
  assert.match(await page.locator('#share-copy').inputValue(),/Acertei 10 de 10/);
  await page.locator('#restart').click();
  assert.equal(await page.locator('.reveal').count(),0); assert.match(await page.locator('.score-strip').innerText(),/0\s+acertos/);
  if(process.env.POLIMATCH_QUIZ_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_QUIZ_SCREENSHOTS}/${width}-question.png`,fullPage:true});
  assert.deepEqual(api,[]); assert.deepEqual(errors,[]);
  await page.close();
 }
 const blocked=await browser.newPage();
 await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});});
 await blocked.goto(new URL('quem-disse-isso.html',origin).href);
 await blocked.locator('[data-answer]').first().click();
 assert.match(await blocked.locator('.storage-note').first().innerText(),/Não foi possível salvar/);
 await blocked.locator('.reveal').waitFor();
 await blocked.close();
 console.log('Quote quiz: ten rounds, resume, replay, sharing, unavailable storage, keyboard and four viewports passed.');
}finally{await browser.close();}
