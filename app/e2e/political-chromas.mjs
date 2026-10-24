import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import ARTS from '../src/political-chromas.json' with { type:'json' };
const kind = process.env.POLIMATCH_E2E_BROWSER || 'chromium';
const base = process.env.POLIMATCH_E2E_URL || 'http://127.0.0.1:4173/';
const browser = await {chromium, webkit}[kind].launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({viewport:{width,height:1000}, serviceWorkers:'block'});
    const page = await context.newPage(), errors=[];
    let votes=0;
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('**/api/**', route=>{
      if(route.request().url().includes('/round-vote')) votes++;
      return route.fulfill({json:route.request().url().endsWith('/api/player') ? {recoveryKey:'pm2_'+'a'.repeat(43)} : {ranking:[],duels:0,version:0}});
    });
    await page.goto(new URL('duelos-da-corrida.html',base).href);
    await page.locator('#race-show-roster').click();
    for (const art of ARTS) {
      await page.locator(`#roster-grid [data-profile="${art.id}"]`).click();
      const card=page.locator('.profile-tcg .is-chroma-ready');
      await card.waitFor();
      const g=await card.evaluate(c=>{
        const i=c.querySelector('[data-chroma-art]'),r=c.getBoundingClientRect(),a=i.getBoundingClientRect();
        return {loaded:i.naturalWidth,src:i.getAttribute('src'),ratio:a.width/a.height,cardW:r.width,artW:a.width,
          name:getComputedStyle(c.querySelector('.tcg-name')).display,edge:getComputedStyle(c.querySelector('.tcg-edge')).visibility};
      });
      assert.equal(g.src,art.src);assert.ok(g.loaded>0);assert.ok(Math.abs(g.ratio-5/7)<.01);
      assert.ok(Math.abs(g.cardW-g.artW)<=2);assert.equal(g.name,'none');assert.equal(g.edge,'hidden');
      assert.equal(await page.locator('#profile-heading').innerText(),art.name);
      assert.equal(await page.locator('#profile-close').isVisible(),true);
      await page.locator('#profile-close').click();
    }
    await page.route('**/chromas/politicos/gustavo-gayer-*',route=>route.abort());
    // WebKit can retain already decoded images within a document despite routing.
    // Start a fresh document with the failure installed before requesting this art.
    await page.reload();
    await page.locator('#race-show-roster').click();
    await page.locator('#roster-grid [data-profile="gustavo-gayer"]').click();
    await page.waitForFunction(()=>{
      const c=document.querySelector('.profile-tcg .tcg-card'),i=c?.querySelector('[data-chroma-art]');
      return i?.complete&&!i.naturalWidth&&!c.classList.contains('is-chroma-ready');
    });
    const fallback=page.locator('.profile-tcg .tcg-art img');await fallback.evaluate(i=>i.decode());
    assert.ok(await fallback.evaluate(i=>i.naturalWidth>0));
    assert.equal(await page.locator('.profile-tcg .tcg-name').innerText(),'Gustavo Gayer');
    await page.locator('#profile-close').click();
    assert.equal(votes,0,'viewing art must never submit votes');assert.deepEqual(errors,[]);
    await context.close();
    console.log(`${kind} ${width}: 20 complete political Chromas, exact identities, one frame/name, profile controls and original-photo fallback passed`);
  }
} finally {await browser.close();}
