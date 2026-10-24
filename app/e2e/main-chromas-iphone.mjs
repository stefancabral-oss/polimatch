import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import CATALOG from '../../shared/elections-2026.json' with {type:'json'};
import {completedDailySession} from './daily-fixture.mjs';
import {capabilityFixture} from './aggregate-fixture.mjs';
import {approvedEditorialCandidates} from './editorial-fixtures.mjs';
const kind=process.env.POLIMATCH_E2E_BROWSER||'chromium';
const base=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
const shots=process.env.POLIMATCH_IPHONE_SCREENSHOTS;
if(shots) await mkdir(shots,{recursive:true});
const people=approvedEditorialCandidates([65,2,35,12].map(id=>CATALOG.find(p=>p.personId===id)));
const seed=completedDailySession(people);
const daily={...seed,status:'active',progress:{answered:0,total:10},answers:[],predictions:[],predictionProgress:{responded:0,predicted:0,skipped:0,total:0},round:seed.rounds[0],completion:null};
const browser=await {chromium,webkit}[kind].launch();
try {
 for(const height of [650,740,820,956]){
  const context=await browser.newContext({viewport:{width:440,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('polimatch:v4:round-coach','seen'));
  const page=await context.newPage(),errors=[];let votes=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   const json=path==='/api/capabilities'?capabilityFixture([]):path==='/api/game-capabilities'?{version:1,orderedChoices:true,pairs:false,discard:false,mirror:false,collection:true}:path==='/api/candidates'?{candidates:people}:path==='/api/player'?{recoveryKey:'pm2_'+'a'.repeat(43)}:path==='/api/player/state'?{ranking:[],duels:0,version:0}:path==='/api/daily-session'?daily:path==='/api/collection'?{enabled:true,purchasable:false,total:0,items:[]}:{};
   if(path.includes('-vote'))votes++;
   return route.fulfill({json});
  });
  await page.goto(base);
  if(height===820)await page.addStyleTag({content:'.app-scroll-area{padding-top:62px!important}.bottom-nav{padding-bottom:40px!important}'});
  await page.locator('.bottom-nav [data-screen="duel"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-panel="duel"] .is-chroma-ready').length===3);
  const inspect=()=>page.evaluate(()=>{
   const area=document.querySelector('.app-scroll-area'),nav=document.querySelector('.bottom-nav').getBoundingClientRect();
   return {overflow:area.scrollHeight-area.clientHeight,navTop:nav.top,cards:[...document.querySelectorAll('[data-panel="duel"] .candidate-wrap')].filter(c=>!c.hidden).map(c=>{
    const b=c.querySelector('.candidate-card'),i=c.querySelector('[data-game-chroma]'),p=c.querySelector('.profile-trigger'),r=c.getBoundingClientRect();
    return {id:b.dataset.vote,top:r.top,bottom:r.bottom,width:r.width,buttonHeight:p.getBoundingClientRect().height,ready:b.classList.contains('is-chroma-ready'),src:i.getAttribute('src'),loaded:i.naturalWidth,aria:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed')};
   })};
  });
  for(const selected of [false,true]){
   if(selected)await page.locator('[data-vote]').first().tap();
   const g=await inspect();assert.equal(g.cards.length,4);assert.ok(g.overflow<=2,JSON.stringify(g));
   assert.ok(g.cards.every(c=>c.top>=0&&c.bottom<=g.navTop&&c.buttonHeight>=44),JSON.stringify(g));
   assert.match(g.cards[0].src,/politicos\/carlos-bolsonaro-v02/);assert.match(g.cards[1].src,/cover\/flavio/);assert.equal(g.cards[2].src,null);assert.match(g.cards[3].src,/politicos\/fernando-haddad-v02/);
   assert.equal(votes,0);assert.equal(g.cards[0].pressed,String(selected));
  }
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-vote][aria-pressed="true"] .card-outcome')).opacity)>.99);
  const stamp=await page.locator('[data-vote][aria-pressed="true"] .card-outcome').evaluate(n=>({w:n.clientWidth,sw:n.scrollWidth,h:n.clientHeight,sh:n.scrollHeight}));
  assert.ok(stamp.sw<=stamp.w+1&&stamp.sh<=stamp.h+1,JSON.stringify(stamp));
  if(shots)await page.screenshot({path:`${shots}/${kind}-440x${height}.png`});
  await page.locator('.profile-trigger').first().click();await page.locator('#profile-title').waitFor();
  assert.match(await page.locator('#profile-title').innerText(),/Carlos/);await page.locator('#close-modal').click();
  assert.equal(await page.locator('[data-vote]').first().getAttribute('aria-pressed'),'true');
  // Start the failure before requesting a fresh document, including WebKit's decoded-image cache.
  await page.route('**/chromas/politicos/carlos-*',route=>route.abort());await page.reload();await page.locator('.bottom-nav [data-screen="duel"]').click();
  const fallback=page.locator('[data-vote]').first();await fallback.waitFor();
  await page.waitForFunction(()=>{const b=document.querySelector('[data-vote]'),i=b?.querySelector('[data-game-chroma]');return i?.complete&&!i.naturalWidth&&!b.classList.contains('is-chroma-ready');});
  assert.match(await fallback.innerText(),/Carlos/);assert.deepEqual(errors,[]);await context.close();
  console.log(`${kind} 440x${height}: daily full art, all four cards and controls fit, first selection/profile/fallback passed`);
 }
}finally{await browser.close();}
