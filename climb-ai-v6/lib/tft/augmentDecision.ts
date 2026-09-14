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
