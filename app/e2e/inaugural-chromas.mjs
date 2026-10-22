import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import ARTS from '../src/inaugural-chromas.json' with { type: 'json' };
const kind = process.env.POLIMATCH_E2E_BROWSER || 'chromium';
const base = process.env.POLIMATCH_E2E_URL || 'http://127.0.0.1:4173/';
const screenshots = process.env.POLIMATCH_CHROMA_SCREENSHOTS;
if (screenshots) await mkdir(screenshots, {recursive:true});
const browser = await {chromium,webkit}[kind].launch();
try {
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',route=>route.fulfill({json:route.request().url().endsWith('/api/player') ? {recoveryKey:'pm2_'+'a'.repeat(43)} : {ranking:[],duels:0,version:0}}));
    await page.goto(new URL('duelos-da-corrida.html',base).href);
    await page.locator('.showcase-card-0 .is-chroma-ready').waitFor();
    assert.equal(await page.locator('.showcase-card .is-chroma-ready').count(),4);
    await page.locator('#race-show-roster').click();
    for (const art of ARTS) {
      await page.locator(`#roster-grid [data-profile="${art.id}"]`).click();
      const card=page.locator('.profile-tcg .is-chroma-ready');
      await card.waitFor();
      const geometry=await card.evaluate(node=>{
        const art=node.querySelector('[data-chroma-art]');const r=node.getBoundingClientRect(),a=art.getBoundingClientRect();
        return {w:r.width,h:r.height,aw:a.width,ah:a.height,name:getComputedStyle(node.querySelector('.tcg-name')).display,edge:getComputedStyle(node.querySelector('.tcg-edge')).visibility,loaded:art.naturalWidth};
      });
      assert.ok(geometry.loaded>0);
      assert.ok(Math.abs(geometry.aw/geometry.ah-5/7)<.01);
      assert.ok(Math.abs(geometry.w-geometry.aw)<=2);
      assert.equal(geometry.name,'none');assert.equal(geometry.edge,'hidden');
      assert.equal(await page.locator('#profile-heading').innerText(),art.name);
      if(screenshots && ['nikolas-ferreira','erika-hilton'].includes(art.id))
        await page.screenshot({path:`${screenshots}/${kind}-${width}-${art.id}.png`,fullPage:false});
      await page.locator('#profile-close').click();
    }
    // Both responsive variants fail: retain the actual person's original photo/name.
    await page.route('**/chromas/inaugural/nikolas-*',route=>route.abort());
    await page.reload();
    await page.waitForFunction(()=>{const c=document.querySelector('.showcase-card-0 .tcg-card');return c && !c.classList.contains('is-chroma-ready') && c.querySelector('[data-chroma-art]').complete;});
    assert.equal(await page.locator('.showcase-card-0 .tcg-name').evaluate(n=>getComputedStyle(n).display),'block');
    const fallback=page.locator('.showcase-card-0 .tcg-art img');
    await fallback.evaluate(img=>img.decode());
    assert.ok(await fallback.evaluate(img=>img.naturalWidth>0));
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(`${kind} ${width}: ten complete Chroma profiles, legible single name/frame, original-photo network fallback passed`);
  }
} finally {await browser.close();}
