export const TFT_AUGMENT_SET=18;
export const TFT_AUGMENT_PATCH='18.2';
export const TFT_AUGMENT_AS_OF='2026-09-14';

export type TftAugmentStage='2-1'|'3-2'|'4-2';
export type TftBoardPower='WEAK'|'EVEN'|'STRONG';
export type TftPlanDirection='FLEX'|'AD'|'AP'|'REROLL'|'FAST_8'|'FAST_9';
export type TftAugmentCategory='ECONOMY'|'COMBAT'|'ITEM'|'TRAIT'|'REROLL'|'XP'|'UTILITY';

export interface TftAugmentEntry{id:string;name:string;tier:number|string|null;description:string;image?:string|null}
export interface TftAugmentContext{stage:TftAugmentStage;hp:number;gold:number;level:number;boardPower:TftBoardPower;direction:TftPlanDirection;carry?:string;traits:string[];items:string[]}
export interface TftAugmentRead{augment:TftAugmentEntry;category:TftAugmentCategory;total:number;confidence:number;verdict:'BEST FIT'|'STRONG'|'CONTEXTUAL'|'RISKY';immediatePower:number;scaling:number;flexibility:number;economyTempo:number;synergy:number;commitmentRisk:number;reasons:string[];risks:string[];patchNote?:string}

const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,Math.round(n)));
const text=(a:TftAugmentEntry)=>`${a.name} ${a.description}`.toLowerCase();
const has=(value:string,words:string[])=>words.some(word=>value.includes(word));
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const COMBAT=['damage amp','attack speed','attack damage','ability power','omnivamp','shield','health','armor','magic resist','durability','critical','healing','takedown','combat start'];
const ECON=['gold','interest','income','loot','orb','cashout'];
const ITEMS=['item component','component','item anvil','completed item','radiant item','artifact','item'];
const REROLL=['reroll','re-roll','shop refresh','shop reroll','refreshes','refresh'];
const XP=['experience','xp','level up','leveling','level 8','level 9','level 10'];
const TRAIT=['emblem','trait','coven','flora fatalis','elderwood','vanguard','primal','sprykin','riftbeast','rapidfire','spellweaver','juggernaut','brawler','defender','invoker','ravager','blackthorn','inferno'];

function detectCategory(a:TftAugmentEntry):TftAugmentCategory{const t=text(a);if(has(t,TRAIT))return'TRAIT';if(has(t,REROLL))return'REROLL';if(has(t,XP))return'XP';if(has(t,ECON))return'ECONOMY';if(has(t,ITEMS))return'ITEM';if(has(t,COMBAT))return'COMBAT';return'UTILITY'}
function matchingTraits(a:TftAugmentEntry,traits:string[]){const t=text(a);return traits.filter(trait=>trait.length>2&&t.includes(trait.toLowerCase()))}
function directionFit(a:TftAugmentEntry,direction:TftPlanDirection){const t=text(a);if(direction==='FLEX')return 0;if(direction==='AD'&&has(t,['attack damage','attack speed','critical']))return 16;if(direction==='AP'&&has(t,['ability power','mana','spell','magic damage']))return 16;if(direction==='REROLL'&&has(t,[...REROLL,'duplicator','copy of','1-cost','2-cost','3-cost']))return 20;if((direction==='FAST_8'||direction==='FAST_9')&&has(t,[...XP,'gold','interest','economy']))return direction==='FAST_9'?20:16;return 0}
function patchModifier(name:string){const key=normalize(name);if(key===normalize("Baron's Lair"))return{immediate:-4,scaling:-2,risk:0,note:'Patch 18.2 reduced its repeating team stats from 5% to 4%.'};if(key===normalize('Capital Gains II'))return{immediate:2,scaling:4,risk:-2,note:'Patch 18.2 increased its starting gold from 2 to 3.'};if(key===normalize('Cursed Crown'))return{immediate:-5,scaling:-2,risk:5,note:'Patch 18.2 removed the 4% Durability bonus.'};if(key===normalize('Consuming Flora'))return{immediate:-3,scaling:-4,risk:5,note:'Patch 18.2 reduced Emblem trait effectiveness from 200% to 150% and made the augment exclusive to one player per lobby.'};if(key===normalize('Dark Ritual'))return{immediate:3,scaling:10,risk:-2,note:'Patch 18.2 significantly buffed Dark Ritual cashout AP.'};if(key===normalize('Prismatic Destiny+'))return{immediate:-2,scaling:-1,risk:2,note:'Patch 18.2 reduced its bonus gold to 7.'};return null}

export function scoreTftAugment(augment:TftAugmentEntry,ctx:TftAugmentContext):TftAugmentRead{
  const category=detectCategory(augment),t=text(augment),reasons:string[]=[],risks:string[]=[];
  let immediate=50,scaling=50,flexibility=55,economyTempo=50,synergy=50,risk=24;
  if(category==='COMBAT'){immediate+=18;scaling+=7;flexibility+=5;reasons.push('Direct combat power converts immediately into board strength.')}
  if(category==='ECONOMY'){economyTempo+=23;scaling+=14;flexibility+=12;immediate-=9;reasons.push('Economy value preserves future options instead of locking one board direction.')}
  if(category==='ITEM'){immediate+=9;flexibility+=18;synergy+=6;reasons.push('Item access can add immediate strength while keeping multiple carry paths open.')}
  if(category==='REROLL'){economyTempo+=13;scaling+=9;flexibility-=4;reasons.push('Shop access is strongest when your plan actually needs repeated copies.')}
  if(category==='XP'){economyTempo+=15;scaling+=18;immediate-=4;reasons.push('Leveling value is mainly a tempo and cap investment rather than raw immediate stats.')}
  if(category==='TRAIT'){scaling+=11;flexibility-=17;risk+=15;reasons.push('Trait augments can be efficient but carry a higher commitment cost.')}

  const matchedTraits=matchingTraits(augment,ctx.traits);
  if(matchedTraits.length){synergy+=Math.min(32,18+matchedTraits.length*7);risk-=10;reasons.push(`Directly matches your entered board trait${matchedTraits.length===1?'':'s'}: ${matchedTraits.slice(0,3).join(', ')}.`)}
  else if(category==='TRAIT'){synergy-=17;risk+=11;risks.push('No matching trait was found on the entered board, so this requires a pivot or future commitment.')}

  const planFit=directionFit(augment,ctx.direction);
  if(planFit){synergy+=planFit;reasons.push(`Its effect aligns with your ${ctx.direction.replace('_',' ')} plan.`)}
  else if(ctx.direction!=='FLEX'&&category==='TRAIT')risks.push(`Your ${ctx.direction.replace('_',' ')} plan does not obviously convert this trait-specific choice.`);

  const early=ctx.stage==='2-1',mid=ctx.stage==='3-2',late=ctx.stage==='4-2';
  if(early){scaling+=8;flexibility+=5;if(category==='ECONOMY'||category==='XP')economyTempo+=8}
  if(mid&&['ITEM','COMBAT'].includes(category))immediate+=5;
  if(late){immediate+=8;scaling-=5;flexibility-=3;if(category==='ECONOMY')economyTempo-=10;if(category==='COMBAT'||category==='ITEM')immediate+=5}

  if(ctx.boardPower==='WEAK'){if(category==='COMBAT'||category==='ITEM')immediate+=13;if(category==='ECONOMY'||category==='XP')immediate-=8;reasons.push('A weak board increases the value of power that stabilises immediately.')}
  if(ctx.boardPower==='STRONG'){scaling+=7;flexibility+=5;if(category==='ECONOMY'||category==='XP')economyTempo+=10;reasons.push('A strong board can convert stability into economy, levels or a higher cap.')}
  if(ctx.hp<=35){if(category==='COMBAT'||category==='ITEM')immediate+=12;if(category==='ECONOMY'||category==='XP')economyTempo-=8;risks.push('Low HP reduces the time available for delayed value to pay back.')}
  else if(ctx.hp>=70){scaling+=5;flexibility+=4}
  if(ctx.gold>=50&&(category==='XP'||category==='ECONOMY'))economyTempo+=6;
  if(ctx.gold<15&&category==='ECONOMY')economyTempo+=5;
  if(ctx.level>=8&&category==='XP'&&late)scaling-=5;
  if(has(t,['random','pandora'])){flexibility+=8;risk+=3}
  if(has(t,['team size','tactician crown','tactician\'s crown'])){immediate+=8;scaling+=12;flexibility+=7}

  const patch=patchModifier(augment.name);
  if(patch){immediate+=patch.immediate;scaling+=patch.scaling;risk+=patch.risk;reasons.push('This score includes its current Patch 18.2 balance adjustment.')}

  immediate=clamp(immediate);scaling=clamp(scaling);flexibility=clamp(flexibility);economyTempo=clamp(economyTempo);synergy=clamp(synergy);risk=clamp(risk);
  const w=early?{i:.20,s:.24,f:.18,e:.20,y:.18}:mid?{i:.25,s:.20,f:.16,e:.18,y:.21}:{i:.33,s:.14,f:.12,e:.16,y:.25};
  const total=clamp(immediate*w.i+scaling*w.s+flexibility*w.f+economyTempo*w.e+synergy*w.y-risk*.18);
  const contextEvidence=(ctx.traits.length?1:0)+(ctx.items.length?1:0)+(ctx.carry?1:0)+(ctx.direction!=='FLEX'?1:0)+(ctx.boardPower!=='EVEN'?1:0);
  const confidence=clamp(52+contextEvidence*7+(augment.description.length>20?10:0)+(patch?6:0),0,94);
  const verdict:TftAugmentRead['verdict']=total>=78?'BEST FIT':total>=68?'STRONG':total>=56?'CONTEXTUAL':'RISKY';
  if(risk>=48)risks.push('This choice has meaningful commitment risk if your board direction changes.');
  if(flexibility<45)risks.push('This choice narrows future pivots more than a generic option.');
  if(!augment.description)risks.push('Static-data description is missing, reducing evidence quality.');
  return{augment,category,total,confidence,verdict,immediatePower:immediate,scaling,flexibility,economyTempo,synergy,commitmentRisk:risk,reasons:reasons.slice(0,5),risks:[...new Set(risks)].slice(0,4),patchNote:patch?.note};
}

export function compareTftAugments(augments:TftAugmentEntry[],ctx:TftAugmentContext){
  const reads=augments.filter(Boolean).map(a=>scoreTftAugment(a,ctx)).sort((a,b)=>b.total-a.total||b.confidence-a.confidence);
  if(reads[0])reads[0]={...reads[0],verdict:'BEST FIT'};
  return reads;
}
