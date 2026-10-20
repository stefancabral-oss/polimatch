import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {completedDailySession} from './daily-fixture.mjs';
import {capabilityFixture,voteResponseV2} from './aggregate-fixture.mjs';
const browser=await ({chromium,webkit}[process.env.POLIMATCH_E2E_BROWSER || 'chromium']).launch();
try {
 for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
  const page=await browser.newPage({viewport,serviceWorkers:'block'});
  const seed=completedDailySession(['a','b','c','d'].map(id=>({id,name:`Pessoa ${id}`,role:'Pessoa pública'})));
  const catalog=seed.catalog, answers=[], requests=[], errors=[];
  let version=0, failed=false, free=false;
  page.on('pageerror',e=>errors.push(e.message));
  const ranking=()=>catalog.map((p,i)=>({...p,elo:1000,wins:version,losses:0,decisions:version,winRate:version?100:0,rank:version?i+1:null}));
  function session() {
   const count=answers.length;
   return {...seed,status:count===10?'completed':'active',progress:{answered:count,total:10},answers:[...answers],predictions:answers.map((a,i)=>({slot:a.slot,predictionId:`650e8400-e29b-41d4-a716-${String(i+1).padStart(12,'0')}`,candidateId:null,skipped:true,respondedAt:a.answeredAt})),predictionProgress:{responded:count,predicted:0,skipped:count,total:count},pendingPrediction:null,round:count===10?null:seed.rounds[count],completion:count===10?seed.completion:null};
  }
  await page.addInitScript(()=>localStorage.setItem('polimatch:v4:round-coach','seen'));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const send=(json,status=200)=>route.fulfill({status,json});
   if(path==='/api/capabilities') return send(capabilityFixture([]));
   if(path==='/api/game-capabilities') return send({version:1,orderedChoices:true,pairs:false,discard:false,mirror:false,collection:false});
   if(path==='/api/candidates') return send({candidates:catalog});
   if(path==='/api/player') return send({recoveryKey:'pm2_'+'a'.repeat(43)},201);
   if(path==='/api/player/state') return send({version,duels:version,ranking:ranking()});
   if(path==='/api/daily-session') return send(session());
   if(path==='/api/daily-vote' || path==='/api/round-vote') {
    const body=route.request().postDataJSON(); requests.push(body);
    assert.equal(body.selectionIds.length,2); assert.notEqual(...body.selectionIds); assert.equal(body.winnerId,body.selectionIds[0]);
    if(!failed) {failed=true; return route.abort('failed');}
    const daily=path==='/api/daily-vote';
    const ids=daily?seed.rounds[body.slot-1].candidateIds:body.candidateIds;
    version++;
    if(daily) answers.push({slot:body.slot,answerId:body.answerId,winnerId:body.winnerId,selectionIds:body.selectionIds,answeredAt:'2026-09-16T12:00:00.000Z'});
    const tier={id:'contender',label:'No páreo',level:2};
    const feedback={primaryEvent:'confirm',rankingEvent:'confirm',zebra:false,outcomes:ids.map(id=>({id,result:body.selectionIds.includes(id)?'winner':'loser',selectionOrder:body.selectionIds.includes(id)?body.selectionIds.indexOf(id)+1:null,delta:id===body.selectionIds[0]?24:id===body.selectionIds[1]?8:-16,elo:1000,previousTier:tier,tier,tierChange:null}))};
    const round={id:body.answerId||body.roundId,status:'created',winnerId:body.winnerId,selectionIds:body.selectionIds,scoringRuleset:'ordered-two-v1',candidateIds:ids,comparisons:5,feedbackScope:'personal',personalFeedback:feedback};
    return send(voteResponseV2({round,vote:round,player:{version,duels:version,ranking:ranking()},...(daily?{dailySession:session()}: {})},{aggregate:false}));
   }
   return send({error:'unexpected mock '+path},404);
  });
  await page.goto(process.env.POLIMATCH_E2E_URL||'http://127.0.0.1:4173/');
  await page.locator('.bottom-nav [data-screen="duel"]').click();
  const cards=page.locator('[data-vote]:visible');
  await cards.first().waitFor();
  assert.equal(await cards.count(),4);
  await page.getByRole('heading',{name:'Escolha duas cartas',exact:true}).waitFor();
  await cards.nth(0).click();
  assert.equal(requests.length,0); assert.equal(await cards.nth(0).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.round-instruction:visible').innerText(),/1\/2/);
  await cards.nth(0).click(); assert.equal(requests.length,0); assert.equal(await cards.nth(0).getAttribute('aria-pressed'),'false');
  await cards.nth(0).click(); await cards.nth(1).click();
  await page.locator('#retry-vote:visible').waitFor();
  const retryBody=structuredClone(requests[0]);
  await cards.nth(2).evaluate(b=>b.click()); assert.equal(requests.length,1);
  await page.locator('#retry-vote').click();
  await page.waitForFunction(()=>document.querySelector('[data-feedback-channels]')?.hidden===false);
  assert.deepEqual(requests[1],retryBody);
  assert.equal(await page.locator('[data-discard-panel]:visible').count(),0);
  assert.match(await page.locator('[data-feedback-channels]').innerText(),/\+24/);
  assert.match(await page.locator('[data-feedback-channels]').innerText(),/\+8/);
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.card-outcome.loss:visible').count(),2);
  if(process.env.POLIMATCH_ORDERED_SCREENSHOTS) await page.screenshot({path:`${process.env.POLIMATCH_ORDERED_SCREENSHOTS}/${viewport.width}-confirmed.png`,fullPage:true});
  for(let slot=2;slot<=10;slot++) {
   await page.waitForFunction(()=>document.querySelector('[data-game-mode="daily"]')?.getAttribute('aria-busy')==='false' && document.querySelectorAll('[data-vote][aria-disabled="false"]').length===4);
   await cards.nth(0).click(); await cards.nth(1).click();
   await page.waitForFunction(()=>document.querySelector('[data-feedback-channels]')?.hidden===false);
   if(slot<10) await page.waitForFunction(()=>document.querySelector('[data-feedback-channels]')?.hidden===true);
  }
  await page.waitForFunction(()=>document.body.textContent.includes('10/10'));
  assert.equal(answers.length,10); assert.equal(version,10); assert.equal(requests.length,11);
  await page.getByRole("heading",{name:"Suas escolhas por rodada"}).waitFor();
  assert.match(await page.locator(".daily-receipt").innerText(),/1ª.*2ª/s);
  await page.reload();
  await page.locator('.bottom-nav [data-screen="duel"]').click();
  await page.waitForFunction(()=>document.body.textContent.includes('10/10'));
  assert.equal(requests.length,11);
  await page.locator('#start-free-mode').click();
  await cards.first().waitFor();
  const beforeFree=requests.length;
  await cards.nth(0).click(); assert.equal(requests.length,beforeFree);
  // Skipping an unconfirmed table clears its draft.
  await page.locator('#skip-round').click();
  assert.equal(await page.locator('[data-vote][aria-pressed="true"]').count(),0);
  await cards.nth(0).click(); await cards.nth(1).click();
  await page.waitForFunction(()=>document.querySelector('[data-feedback-channels]')?.hidden===false);
  assert.equal(requests.length,beforeFree+1);
  assert.equal(await page.locator('[data-discard-panel]:visible').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`${viewport.width}: two ordered taps, unmark, retry with same pair/ID, no discard, ten daily rounds and reload passed`);
  await page.close();
 }
} finally {await browser.close();}
