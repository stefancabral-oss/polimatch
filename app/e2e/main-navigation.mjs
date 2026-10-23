import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {completedDailySession} from './daily-fixture.mjs';
import {capabilityFixture} from './aggregate-fixture.mjs';
const kind=process.env.POLIMATCH_E2E_BROWSER||'chromium';
const base=process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/';
const shots=process.env.POLIMATCH_MAIN_MENU_SCREENSHOTS;
if(shots) await mkdir(shots,{recursive:true});
const browser=await {chromium,webkit}[kind].launch();
const daily=completedDailySession(Array.from({length:4},(_,i)=>({id:`p${i}`,name:`Pessoa ${i}`,role:'Pessoa pública'})));
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('polimatch:v4:round-coach','seen'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   let json={error:'unexpected '+path},status=404;
   if(path==='/api/capabilities') json=capabilityFixture([]),status=200;
   if(path==='/api/game-capabilities') json={version:1,pairs:false,discard:false,mirror:false,collection:true},status=200;
   if(path==='/api/candidates') json={candidates:daily.catalog},status=200;
   if(path==='/api/player') json={recoveryKey:'pm2_'+'a'.repeat(43)},status=201;
   if(path==='/api/player/state') json={ranking:[],duels:0,version:0},status=200;
   if(path==='/api/daily-session') json=daily,status=200;
   if(path==='/api/collection') json={enabled:true,purchasable:false,total:0,items:[]},status=200;
   return route.fulfill({status,json});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.bottom-nav:not([hidden])').waitFor();
  for(const height of [568,844,1000]){
   await page.setViewportSize({width,height});
   for(const screen of ['topics','duel','collection','ranking','topics']){
    await page.locator(`.bottom-nav [data-screen="${screen}"]`).click();
    await page.locator(`[data-panel="${screen}"]:not([hidden])`).waitFor();
    const g=await page.evaluate(()=>{
     const area=document.querySelector('.app-scroll-area');
     const nav=document.querySelector('.bottom-nav');
     const n=nav.getBoundingClientRect();
     return {area:area&&{bottom:area.getBoundingClientRect().bottom,scroll:area.scrollTop,overflow:area.scrollWidth>area.clientWidth},nav:{top:n.top,bottom:n.bottom,width:n.width},height:innerHeight,width:innerWidth,bodyScroll:scrollY,position:getComputedStyle(nav).position,buttons:[...nav.querySelectorAll('button:not([hidden])')].map(b=>b.getBoundingClientRect().height)};
    });
    assert.ok(g.area,'main app requires its own content scroll area');
    assert.ok(g.area.bottom<=g.nav.top+1,'main menu must not cover active content');
    assert.ok(Math.abs(g.nav.bottom-g.height)<2,'main menu must follow viewport bottom');
    assert.equal(g.position,'relative');assert.equal(g.bodyScroll,0);assert.equal(g.area.overflow,false);
    assert.equal(g.area.scroll,0,'changing panel resets content scroll');
    assert.equal(g.nav.width,g.width);assert.ok(g.buttons.every(h=>h>=44));
    await page.locator('.app-scroll-area').evaluate(a=>{a.scrollTop=a.scrollHeight;});
   }
  }
  if(shots&&width===390){await page.setViewportSize({width,height:844});await page.locator('.app-scroll-area').evaluate(a=>a.scrollTop=0);await page.screenshot({path:`${shots}/${kind}-390-main-menu.png`});}
  assert.deepEqual(errors,[]);await context.close();console.log(`${kind} ${width}: four main destinations, three heights, scroll reset and no menu overlap passed`);
 }
}finally{await browser.close();}
