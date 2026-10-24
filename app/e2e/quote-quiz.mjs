import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {QUESTIONS,PEOPLE,LEGACY_EDITION} from '../src/quote-quiz-data.js';
import {STORAGE_KEY} from '../src/quote-quiz.js';
const browser=await ({chromium,webkit}[process.env.POLIMATCH_E2E_BROWSER||'chromium']).launch();
const origin=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
try {
 for(const width of [320,390,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[],api=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url());});
  await page.goto(new URL('quem-disse-isso.html?edicao=2',origin).href);
  await page.locator('[data-answer]').first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Lula',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Flávio Bolsonaro',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:/Ver fonte original/}).count(),0);
  const cardBoxes=await page.locator('[data-answer]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  assert.ok(Math.abs(cardBoxes[0].h-cardBoxes[1].h)<1); assert.equal(cardBoxes[0].y,cardBoxes[1].y);
  assert.ok(cardBoxes.every(b=>b.w>=130 && b.h>=180));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(let i=0;i<QUESTIONS.length;i++){
   // Bind the keyboard action to the answer so WebKit cannot send it to a stale focus target.
   await page.locator(`[data-answer="${QUESTIONS[i].author}"]`).press('Enter');
   await page.locator('.reveal').waitFor();
   assert.match(await page.locator('.reveal').innerText(),/Acertou na mosca!/i);
   assert.equal(await page.locator('[data-answer]:disabled').count(),2);
   assert.equal(await page.getByRole('link',{name:/Ver fonte original/}).getAttribute('href'),QUESTIONS[i].sourceUrl);
   if(QUESTIONS[i].kind==='proposal'){assert.equal(await page.locator('blockquote').count(),0);assert.match(await page.locator('.question-kind').innerText(),/SEM CITAÇÃO LITERAL/i);}
   if(i===0){await page.reload();await page.locator('.reveal').waitFor();assert.match(await page.locator('.progress').innerText(),/1 de 20/);}
   if(i===0 && process.env.POLIMATCH_QUIZ_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_QUIZ_SCREENSHOTS}/${width}-reveal.png`,fullPage:true});
   await page.locator('#next').click();
  }
  assert.match(await page.locator('#result-title').innerText(),/20.*de 20/s);
  assert.match(await page.locator('.score-strip').innerText(),/3750/);
  const completed=page.getByRole('status',{name:'Jogo concluído',exact:true});
  assert.equal(await completed.count(),1);
  const statusStyle=await completed.evaluate(node=>{const style=getComputedStyle(node);return {tag:node.tagName,border:style.borderTopWidth,radius:style.borderRadius,background:style.backgroundColor,tabIndex:node.tabIndex};});
  assert.deepEqual(statusStyle,{tag:'SPAN',border:'0px',radius:'0px',background:'rgba(0, 0, 0, 0)',tabIndex:-1});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.POLIMATCH_QUIZ_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_QUIZ_SCREENSHOTS}/${width}-result.png`,fullPage:true});
  await page.reload(); await page.locator('#share').waitFor();
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
  await page.locator('#share').click();
  assert.match(await page.locator('#share-copy').inputValue(),/Acertei 20 de 20/);
  assert.match(await page.locator('#share-copy').inputValue(),/edicao=2/);
  await page.getByText('Rever frases, propostas e fontes',{exact:true}).click();
  assert.equal(await page.locator('.review li').count(),20);
  await page.locator('#restart').click();
  assert.equal(await page.locator('.reveal').count(),0); assert.match(await page.locator('.score-strip').innerText(),/0\s+acertos/);
  if(process.env.POLIMATCH_QUIZ_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_QUIZ_SCREENSHOTS}/${width}-question.png`,fullPage:true});
  assert.deepEqual(api,[]); assert.deepEqual(errors,[]);
  await page.getByRole('link',{name:'Jogar edição anterior',exact:true}).click();
  await page.locator('[data-answer]').first().waitFor();
  assert.match(await page.locator('.progress').innerText(),/1 de 10/);
  await page.locator('[data-answer]').first().click();
  await page.locator('.reveal').waitFor();
  await page.getByRole('link',{name:'Jogar edição presidencial',exact:true}).click();
  await page.locator('[data-answer]').first().waitFor();
  assert.match(await page.locator('.progress').innerText(),/1 de 20/);
  assert.equal(await page.locator('.reveal').count(),0);
  await page.getByRole('link',{name:'Jogar edição anterior',exact:true}).click();
  await page.locator('.reveal').waitFor();
  await page.close();
 }
 const blocked=await browser.newPage();
 await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});});
 await blocked.goto(new URL('quem-disse-isso.html?edicao=2',origin).href);
 await blocked.locator('[data-answer]').first().click();
 assert.match(await blocked.locator('.storage-note').first().innerText(),/Não foi possível salvar/);
 await blocked.locator('.reveal').waitFor();
 await blocked.close();
 console.log('Quote quiz: twenty rounds and preserved legacy edition, resume, replay, sharing, unavailable storage, keyboard and four viewports passed.');
}finally{await browser.close();}
