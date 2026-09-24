import type {ChampionDetail} from './champions/ddragon';
import {damageType} from './champions/ddragon';
import type {DataDragonItemFull} from './champions/source';
import {parseItemStats} from './champions/dps';
import {bestBuild,toBuildItems} from './champions/build';
import {isCompletedItem} from './riot/items';

export type AdaptiveBuildRole='TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT'|'UNKNOWN';

export interface AdaptiveBuildPlayer{
  champion:string;
  role?:string|null;
  detail:ChampionDetail;
}
export interface AdaptiveBuildItem{
  id:number;
  name:string;
  gold:number;
  slot:'CORE'|'DRAFT'|'FINISH'|'BOOTS'|'SWAP';
  score:number;
  why:string;
  flags:string[];
}
export interface AdaptiveEnemyProfile{
  physical:number;magic:number;mixed:number;tanks:number;divers:number;assassins:number;
  hardCc:number;healing:number;shielding:number;poke:number;ranged:number;
}
export interface AdaptiveBuildPlan{
  version:1;patch:string;champion:string;role:AdaptiveBuildRole;confidence:'HIGH'|'MEDIUM';
  enemyProfile:AdaptiveEnemyProfile;read:string;core:AdaptiveBuildItem[];
  draftItem:AdaptiveBuildItem|null;finish:AdaptiveBuildItem|null;boots:AdaptiveBuildItem|null;
  swaps:AdaptiveBuildItem[];order:AdaptiveBuildItem[];rule:string;boundary:string;
}

const CC=/\b(stun|root|snare|knock(?:back|up)?|suppress|fear|taunt|charm|silence|sleep|immobiliz|pull|airborne)\b/i;
const HEAL=/\b(heal|healing|restore(?:s|d)? health|regenerat|health restoration|drain)\b/i;
const SHIELD=/\b(shield|shielding)\b/i;
const DASH=/\b(dash|blink|leap|charge|dives?|jump|teleport)\b/i;
const POKE=/\b(long range|long-range|poke|artillery|from range)\b/i;

function clean(value:unknown){return String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function normRole(value?:string|null):AdaptiveBuildRole{
  const valueRole=clean(value).toUpperCase();
  if(valueRole==='BOTTOM'||valueRole==='ADC')return'ADC';
  if(valueRole==='UTILITY'||valueRole==='SUPPORT')return'SUPPORT';
  if(valueRole==='MIDDLE'||valueRole==='MID')return'MID';
  if(valueRole==='TOP'||valueRole==='JUNGLE')return valueRole;
  return'UNKNOWN';
}
function detailText(detail:ChampionDetail){
  return[
    detail.passive?.name,(detail.passive as any)?.description,
    ...(detail.spells??[]).flatMap((spell:any)=>[spell?.name,spell?.description,spell?.tooltip]),
    ...(detail.allytips??[]),...(detail.enemytips??[]),
  ].map(clean).filter(Boolean).join(' ');
}
function itemText(item:DataDragonItemFull){
  return[item.name,(item as any).description,(item as any).plaintext,...(item.tags??[])].map(clean).filter(Boolean).join(' ').toLowerCase();
}
function finalBoot(item:DataDragonItemFull){
  return(item.tags??[]).includes('Boots')&&(!item.into||item.into.length===0)&&(item.gold?.total??0)>=800;
}
function eligible(item:DataDragonItemFull){return isCompletedItem(item)||finalBoot(item)}
function has(text:string,...terms:string[]){return terms.some(term=>text.includes(term))}
function round(n:number){return Math.round(n*10)/10}

function enemyProfile(enemies:AdaptiveBuildPlayer[]):AdaptiveEnemyProfile{
  const out:AdaptiveEnemyProfile={physical:0,magic:0,mixed:0,tanks:0,divers:0,assassins:0,hardCc:0,healing:0,shielding:0,poke:0,ranged:0};
  for(const enemy of enemies){
    const detail=enemy.detail;
    const type=damageType(detail.info);
    if(type==='PHYSICAL')out.physical++;else if(type==='MAGIC')out.magic++;else out.mixed++;
    const tags=detail.tags??[];
    const text=detailText(detail);
    const range=Number(detail.stats?.attackrange??0);
    if(tags.includes('Tank'))out.tanks++;
    if(tags.includes('Assassin'))out.assassins++;
    if(tags.includes('Assassin')||(tags.includes('Fighter')&&range<400)||DASH.test(text))out.divers++;
    if(CC.test(text))out.hardCc++;
    if(HEAL.test(text))out.healing++;
    if(SHIELD.test(text))out.shielding++;
    if(range>=500)out.ranged++;
    if(range>=575||(tags.includes('Mage')&&POKE.test(text)))out.poke++;
  }
  return out;
}
function frontlineCount(players:AdaptiveBuildPlayer[]){
  return players.filter(player=>{
    const tags=player.detail.tags??[];
    return tags.includes('Tank')||(tags.includes('Fighter')&&Number(player.detail.stats?.attackrange??0)<350);
  }).length;
}
interface ItemRead{
  id:number;item:DataDragonItemFull;text:string;flags:string[];
  ad:number;ap:number;as:number;crit:number;hp:number;armor:number;mr:number;lifesteal:number;ms:number;
  isBoots:boolean;offense:number;defense:number;utility:number;context:number;score:number;
}
function flagsFor(text:string){
  const flags:string[]=[];
  const add=(flag:string,condition:boolean)=>{if(condition)flags.push(flag)};
  add('ANTI_TANK',has(text,'armor penetration','bonus armor','maximum health','max health','current health','percent health','health damage','shred'));
  add('MAGIC_PEN',has(text,'magic penetration','magic resist reduction','magic resistance reduction'));
  add('ANTI_HEAL',has(text,'grievous wounds'));
  add('ANTI_SHIELD',has(text,'shield reaver','reduce shields','reduces shields','damage to shields'));
  add('CLEANSE',has(text,'quicksilver','remove all crowd control','removes all crowd control','cleanse'));
  add('TENACITY',has(text,'tenacity'));
  add('SPELL_SHIELD',has(text,'spell shield','blocks the next enemy ability'));
  add('STASIS',has(text,'stasis'));
  add('REVIVE',has(text,'revive','resurrect'));
  add('LIFELINE',has(text,'lifeline'));
  add('SUSTAIN',has(text,'omnivamp','life steal','lifesteal','heal for','healing from damage'));
  add('ON_HIT',has(text,'on-hit','on hit'));
  add('HEAL_SHIELD_POWER',has(text,'heal and shield power','healing and shielding'));
  return flags;
}
function reasonFor(read:ItemRead,profile:AdaptiveEnemyProfile,role:AdaptiveBuildRole,you:ChampionDetail,allyFrontline:number){
  const flags=new Set(read.flags);
  if(flags.has('CLEANSE')&&profile.hardCc>=2)return String(profile.hardCc)+' enemy CC kits: gives you a way out when one catch would end your fight.';
  if(flags.has('ANTI_HEAL')&&profile.healing>=2)return String(profile.healing)+' enemy kits have meaningful healing: this is the anti-heal slot.';
  if(flags.has('ANTI_SHIELD')&&profile.shielding>=2)return String(profile.shielding)+' enemy kits create shields: this helps your damage reach health instead.';
  if(flags.has('ANTI_TANK')&&profile.tanks>=2)return String(profile.tanks)+' enemy frontliners/tanks: prioritises damage that keeps working into high durability.';
  if(flags.has('MAGIC_PEN')&&profile.tanks>=2)return String(profile.tanks)+' durable enemies: magic penetration becomes more valuable as fights extend.';
  if((flags.has('STASIS')||flags.has('REVIVE')||flags.has('LIFELINE')||flags.has('SPELL_SHIELD'))&&(profile.divers+profile.assassins)>=2)return String(profile.divers)+' dive threats: protects your uptime when their win condition is reaching you.';
  if(read.mr>0&&profile.magic>profile.physical)return'Enemy damage leans magic ('+String(profile.magic)+' magic vs '+String(profile.physical)+' physical): adds magic durability.';
  if(read.armor>0&&profile.physical>profile.magic)return'Enemy damage leans physical ('+String(profile.physical)+' physical vs '+String(profile.magic)+' magic): adds physical durability.';
  if(flags.has('SUSTAIN')&&profile.poke>=2)return String(profile.poke)+' ranged/poke threats: sustain helps you arrive at fights with usable health.';
  if((role==='TOP'||role==='JUNGLE'||role==='SUPPORT')&&allyFrontline===0&&(read.hp>0||read.armor>0||read.mr>0))return'Your team has no other clear frontliner: this helps your role absorb first contact.';
  const style=(you.tags??[]).includes('Marksman')?'marksman':(you.tags??[]).includes('Mage')?'magic':(you.tags??[]).includes('Tank')?'frontline':'champion';
  return'Strong '+style+' stat fit for '+you.name+' in the '+role+' role, with this draft included in the score.';
}

export function buildAdaptiveItemPlan(input:{
  patch:string;you:ChampionDetail;role?:string|null;allies:AdaptiveBuildPlayer[];enemies:AdaptiveBuildPlayer[];
  items:Record<string,DataDragonItemFull>;
}):AdaptiveBuildPlan{
  const role=normRole(input.role);
  const you=input.you;
  const profile=enemyProfile(input.enemies);
  const allyFrontline=frontlineCount(input.allies.filter(player=>player.detail.name!==you.name));
  const attack=Math.max(1,Number(you.info?.attack??1));
  const magic=Math.max(1,Number(you.info?.magic??1));
  const attackBias=attack/(attack+magic);
  const magicBias=magic/(attack+magic);
  const tags=you.tags??[];
  const marksman=role==='ADC'||tags.includes('Marksman');
  const tank=tags.includes('Tank')&&(role==='TOP'||role==='JUNGLE'||role==='SUPPORT');
  const support=role==='SUPPORT';
  const mage=tags.includes('Mage')||magicBias>.58;
  const melee=Number(you.stats?.attackrange??0)<350;

  const completed:Record<string,DataDragonItemFull>={};
  for(const [id,item] of Object.entries(input.items))if(isCompletedItem(item))completed[id]=item;
  const damageSeed=new Set<number>();
  if(attackBias>=.5){
    try{bestBuild(you.stats,11,toBuildItems(completed),4,140).items.forEach(item=>damageSeed.add(item.id))}catch{}
  }

  const reads:ItemRead[]=[];
  for(const [idRaw,item] of Object.entries(input.items)){
    if(!eligible(item))continue;
    const id=Number(idRaw);if(!Number.isFinite(id))continue;
    const stats=parseItemStats(item.stats);
    const text=itemText(item);
    const flags=flagsFor(text);
    const isBoots=finalBoot(item);
    const ad=stats.attackDamage,ap=stats.abilityPower,as=stats.attackSpeedRatio,crit=stats.critChance,hp=stats.health,armor=stats.armor,mr=stats.magicResist,lifesteal=stats.lifestealRatio,ms=stats.flatMoveSpeed+stats.percentMoveSpeed*100;
    let offense=0,defense=0,utility=0,context=0;

    if(marksman){
      offense+=ad*1.35+as*95+crit*115+lifesteal*70+ap*magicBias*.25;
      if(flags.includes('ON_HIT'))offense+=12;
    }else if(mage){
      offense+=ap*1.25+ad*attackBias*.35+as*attackBias*25;
    }else{
      offense+=ad*(1.05+attackBias*.45)+ap*(.8+magicBias*.45)+as*attackBias*45+crit*attackBias*55+lifesteal*45;
    }

    const durabilityNeed=tank?1.25:support?.85:melee?.5:.22;
    defense+=hp*.035*durabilityNeed+armor*.8*durabilityNeed+mr*.9*durabilityNeed;
    if(support&&flags.includes('HEAL_SHIELD_POWER'))utility+=28;
    if(support&&has(text,'ally','team','heal','shield','aura'))utility+=10;
    if(role==='JUNGLE'&&has(text,'monster','jungle'))utility+=8;
    if(ms>0)utility+=Math.min(10,ms*.12);
    if(damageSeed.has(id))offense+=15;

    if(profile.tanks>=2&&(flags.includes('ANTI_TANK')||flags.includes('MAGIC_PEN')))context+=30+profile.tanks*5;
    if(profile.healing>=2&&flags.includes('ANTI_HEAL'))context+=34+profile.healing*5;
    if(profile.shielding>=2&&flags.includes('ANTI_SHIELD'))context+=28+profile.shielding*4;
    if(profile.hardCc>=2&&flags.includes('CLEANSE'))context+=42+profile.hardCc*4;
    if(profile.hardCc>=2&&flags.includes('TENACITY'))context+=20+profile.hardCc*3;
    if((profile.divers+profile.assassins)>=2&&(flags.includes('STASIS')||flags.includes('REVIVE')||flags.includes('LIFELINE')||flags.includes('SPELL_SHIELD')))context+=32+(profile.divers+profile.assassins)*3;
    if(profile.poke>=2&&(flags.includes('SUSTAIN')||lifesteal>0))context+=18+profile.poke*3;
    if(profile.physical>=3&&armor>0)context+=armor*((tank||support)?.7:.32);
    if(profile.magic>=3&&mr>0)context+=mr*((tank||support)?.78:.36);
    if((role==='TOP'||role==='JUNGLE'||role==='SUPPORT')&&allyFrontline===0&&(hp>0||armor>0||mr>0))context+=20;
    if(isBoots){
      if(profile.physical>=3&&armor>0)context+=28;
      if(profile.magic>=2&&mr>0)context+=22;
      if(profile.hardCc>=2&&flags.includes('TENACITY'))context+=35;
      if(marksman&&as>0&&profile.hardCc<2&&(profile.divers+profile.assassins)<2)context+=20;
    }

    let score=offense+defense+utility+context;
    if((item.gold?.total??0)>0)score+=Math.min(12,3000/(item.gold?.total??3000)*4);
    reads.push({id,item,text,flags,ad,ap,as,crit,hp,armor,mr,lifesteal,ms,isBoots,offense,defense,utility,context,score});
  }

  const nonBoots=reads.filter(item=>!item.isBoots);
  const coreEligible=nonBoots.filter(item=>{
    if(marksman)return item.ad>0||item.as>0||item.crit>0||item.flags.includes('ON_HIT');
    if(tank)return item.hp>0||item.armor>0||item.mr>0;
    if(support&&!tank)return item.ap>0||item.hp>0||item.flags.includes('HEAL_SHIELD_POWER')||item.utility>=10;
    if(mage)return item.ap>0||item.flags.includes('MAGIC_PEN');
    return item.ad>0||item.ap>0||item.hp>0;
  });
  const coreRanked=[...coreEligible].sort((a,b)=>(b.offense+b.defense+b.utility+b.context*.35)-(a.offense+a.defense+a.utility+a.context*.35)||b.score-a.score);
  const chosen=new Set<number>();
  const coreReads:ItemRead[]=[];
  for(const read of coreRanked){
    if(chosen.has(read.id))continue;
    coreReads.push(read);chosen.add(read.id);
    if(coreReads.length===2)break;
  }

  const techRanked=nonBoots.filter(item=>!chosen.has(item.id)).sort((a,b)=>(b.context+b.score*.35)-(a.context+a.score*.35));
  const draftRead=techRanked.find(item=>item.context>=22)??techRanked[0]??null;
  if(draftRead)chosen.add(draftRead.id);
  const finishRead=nonBoots.filter(item=>!chosen.has(item.id)).sort((a,b)=>b.score-a.score)[0]??null;
  if(finishRead)chosen.add(finishRead.id);
  const bootRead=reads.filter(item=>item.isBoots).sort((a,b)=>b.score-a.score)[0]??null;

  const itemOut=(read:ItemRead|null,slot:AdaptiveBuildItem['slot']):AdaptiveBuildItem|null=>read?{
    id:read.id,name:read.item.name,gold:read.item.gold?.total??0,slot,score:round(read.score),
    why:reasonFor(read,profile,role,you,allyFrontline),flags:read.flags,
  }:null;
  const core=coreReads.map(read=>itemOut(read,'CORE')!).filter(Boolean);
  const draftItem=itemOut(draftRead,'DRAFT');
  const finish=itemOut(finishRead,'FINISH');
  const boots=itemOut(bootRead,'BOOTS');
  const swaps=techRanked.filter(item=>!chosen.has(item.id)).slice(0,3).map(read=>itemOut(read,'SWAP')!).filter(Boolean);
  const order=[...core,...(draftItem?[draftItem]:[]),...(finish?[finish]:[])];

  const readParts=[
    profile.tanks>=2?String(profile.tanks)+' durable frontliners':null,
    profile.divers>=2?String(profile.divers)+' dive threats':null,
    profile.hardCc>=2?String(profile.hardCc)+' CC-heavy kits':null,
    profile.healing>=2?String(profile.healing)+' healing kits':null,
    profile.magic>profile.physical?'magic-leaning damage':profile.physical>profile.magic?'physical-leaning damage':'mixed damage',
  ].filter(Boolean);

  return{
    version:1,patch:input.patch,champion:you.name,role,
    confidence:input.enemies.length>=5?'HIGH':'MEDIUM',
    enemyProfile:profile,
    read:readParts.join(' · ')||'Draft still forming',
    core,draftItem,finish,boots,swaps,order,
    rule:'CORE ITEMS FIT YOUR CHAMPION + ROLE. DRAFT ITEM AND BOOTS CHANGE WITH THE ENEMY COMP. SWAPS ARE CONDITIONS, NOT A SECOND GENERIC BUILD.',
    boundary:'DRAFT-FIT RECOMMENDATION FROM CURRENT-PATCH RIOT STATIC ITEM/CHAMPION DATA. IT DOES NOT CLAIM ITEM WIN RATE OR KNOW FUTURE ENEMY PURCHASES. RE-CHECK THE TECH SLOT IF THE ACTUAL GAME DEVELOPS DIFFERENTLY.',
  };
}
