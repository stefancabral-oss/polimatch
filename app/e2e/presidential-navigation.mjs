import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
const kind=process.env.POLIMATCH_E2E_BROWSER || 'chromium';
const base=process.env.POLIMATCH_E2E_URL || 'http://127.0.0.1:4173/';
const screenshots=process.env.POLIMATCH_MENU_SCREENSHOTS;
if(screenshots) await mkdir(screenshots,{recursive:true});
const browser=await {chromium,webkit}[kind].launch();
try {
  for(const width of [320,390,430,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',route=>route.fulfill({json:route.request().url().endsWith('/api/player')?{recoveryKey:'pm2_'+'a'.repeat(43)}:{ranking:[],duels:0,version:0}}));
    await page.goto(new URL('duelos-da-corrida.html',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('#race-start').waitFor();
    const geometry=async()=>{
      const g=await page.evaluate(()=>{
        const area=document.querySelector('.race-scroll-area');
        const nav=document.querySelector('.race-nav');
        return {area:area&&{top:area.getBoundingClientRect().top,bottom:area.getBoundingClientRect().bottom},
          nav:{top:nav.getBoundingClientRect().top,bottom:nav.getBoundingClientRect().bottom},height:innerHeight,
          overflow:document.documentElement.scrollWidth>innerWidth,scrollY,
          buttons:[...nav.children].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),
          position:getComputedStyle(nav).position};
      });
      assert.ok(g.area,'content must have a dedicated scroll region');
      assert.ok(g.area.bottom<=g.nav.top+1,'navigation must never cover content');
      assert.ok(Math.abs(g.nav.bottom-g.height)<2,'navigation must follow dynamic viewport bottom');
      assert.equal(g.position,'relative');assert.equal(g.overflow,false);assert.equal(g.scrollY,0);
      assert.ok(g.buttons.every(b=>b.width>=44&&b.height>=44));
    };
    for(const height of [568,640,844,1000]){
      await page.setViewportSize({width,height});await geometry();
      await page.locator('.race-scroll-area').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      await geometry();
    }
    if(screenshots && [390,1440].includes(width)){
      await page.setViewportSize({width,height:844});
      await page.locator('.race-scroll-area').evaluate(el=>{el.scrollTop=0;});
      await page.screenshot({path:`${screenshots}/${kind}-${width}-menu.png`});
    }
    await page.locator('#nav-roster').click();
    await page.locator('#race-roster').waitFor({state:'visible'});
    assert.equal(await page.locator('.race-scroll-area').evaluate(el=>el.scrollTop),0);
    await page.locator('#roster-search').fill('Nikolas');
    await page.locator('#roster-grid [data-profile="nikolas-ferreira"]').click();
    await page.locator('#race-profile').waitFor({state:'visible'});
    await page.locator('#profile-close').click();
    await page.locator('#race-profile').waitFor({state:'hidden'});
    assert.ok(await page.locator('#roster-grid [data-profile="nikolas-ferreira"]').evaluate(el=>el===document.activeElement));
    await page.locator('#nav-ranking').click();
    await page.locator('#race-ranking').waitFor({state:'visible'});await geometry();
    await page.locator('#nav-play').click();
    await page.locator('#race-arena').waitFor({state:'visible'});await geometry();
    await page.locator('#race-table [data-card]').first().click();
    assert.equal(await page.locator('#race-table [aria-pressed="true"]').count(),1);
    await page.locator('.race-nav a').click();
    await page.waitForURL(new URL('./',base).href);
    assert.deepEqual(errors,[]);
    await context.close();console.log(`${kind} ${width}: 4 heights, no overlay, scroll reset, profile focus and four navigation destinations passed`);
  }
} finally {await browser.close();}
