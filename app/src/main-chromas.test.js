import test from 'node:test';
import assert from 'node:assert/strict';
import CATALOG from '../../shared/elections-2026.json' with {type:'json'};
import ROSTER from '../../shared/presidential-roster.json' with {type:'json'};
import ARTS from './political-chromas.json' with {type:'json'};
import {mainGameChroma,patchGameChroma} from './main-chromas.js';

test('daily snapshot identity resolves all twenty political editions and both presidential specials',()=>{
 for(const art of ARTS){
  assert.equal(mainGameChroma({id:art.id}).src,art.src);
  const person=ROSTER.people.find(p=>p.id===art.id);
  if(person.personId)assert.equal(mainGameChroma({id:'opaque-daily-snapshot',personId:person.personId}).src,art.src);
 }
 for(const id of ['lula','flavio-bolsonaro']){
  const person=CATALOG.find(p=>p.id===id);
  assert.match(mainGameChroma({id:'snapshot',personId:person.personId}).src,/\/chromas\/cover\//);
 }
 assert.equal(mainGameChroma({id:'lula',personId:2}),null);
 assert.equal(mainGameChroma({id:'unknown',name:'Carlos Bolsonaro'}),null);
 assert.equal(mainGameChroma({id:'unknown',personId:true}),null);
 assert.equal(mainGameChroma({id:'rui-costa',personId:35}),null);
});
function element(){const attrs=new Map(),classes=new Set();return{hidden:false,classList:{toggle(c,on){on?classes.add(c):classes.delete(c)},contains:c=>classes.has(c)},getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,String(v)),removeAttribute:k=>attrs.delete(k)};}
test('persistent slot clears old artwork before changing identities and restores the basic card for missing art',()=>{
 const button=element(),image=element(),a=mainGameChroma({id:'carlos-bolsonaro'}),b=mainGameChroma({id:'fernando-haddad'});
 patchGameChroma(button,image,a);button.classList.toggle('is-chroma-ready',true);
 patchGameChroma(button,image,b);
 assert.equal(button.classList.contains('is-chroma-ready'),false);assert.equal(image.getAttribute('src'),b.src);
 patchGameChroma(button,image,null);
 assert.equal(image.getAttribute('src'),null);assert.equal(image.getAttribute('srcset'),null);assert.equal(image.hidden,true);
 assert.equal(button.classList.contains('has-chroma-art'),false);
});
