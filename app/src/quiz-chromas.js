import SPECIALS from './cover-chromas.json' with {type:'json'};
import {presidentialChroma} from './political-chromas.js';
const identities={lula:{id:'lula',personId:1},flavio:{id:'flavio-bolsonaro',personId:2},
  janja:{id:'janja',personId:47},nikolas:{id:'nikolas-ferreira',personId:39}};
export function quizChroma(person){
  const identity=identities[person?.id];
  if(!identity||person.personId!==identity.personId)return null;
  return SPECIALS.find(art=>art.id===identity.id)||presidentialChroma(identity.id);
}
