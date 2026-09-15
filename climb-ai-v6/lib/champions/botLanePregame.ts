import type {ChampionDetail,ChampionListEntry,RangeClass} from './ddragon';
import {championProfile} from './profile';

export interface BotLaneSimulationContext{
  yourAdc:string;
  yourSupport:string;
  enemyAdc:string;
  enemySupport:string;
}

export interface PregameBotLanePlan{
  version:1;
  confidence:'HIGH'|'MEDIUM';
  yourAdc:string;
  yourSupport:string;
  enemyAdc:string;
  enemySupport:string;
  ourIdentity:string;
  theirIdentity:string;
  rangeDelta:number;
  laneCall:{label:string;summary:string};
  level2:{label:string;summary:string};
  trade:{label:string;summary:string};
  wave:{label:string;summary:string};
  allIn:{label:string;summary:string};
  danger:{label:string;summary:string};
  supportRoam:string;
  focus:string;
  simulation:BotLaneSimulationContext;
  note:string;
}

type SupportStyle='HOOK'|'ENGAGE'|'ENCHANT'|'POKE'|'PEEL';
type Read={
  name:string;
  role:string|null;
  tags:string[];
  range:RangeClass;
  attackRange:number;
  spellText:string;
  controlSpell:string|null;
  allyTips:string[];
  enemyTips:string[];
};

type RolePick={champion:Read;inferred:boolean};

export function buildPregameBotLanePlan(input:{
  localChampion:string;
  localRole?:string|null;
  allies:{name:string;role?:string|null;lockedIn?:boolean}[];
  enemies:{name:string;role?:string|null;lockedIn?:boolean}[];
  details:Map<string,ChampionDetail>;
  roster:Record<string,ChampionListEntry>;
}):PregameBotLanePlan|null{
  const localRole=role(input.localRole);
  if(localRole!=='ADC'&&localRole!=='SUPPORT')return null;

  const allies=input.allies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const enemies=input.enemies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const me=allies.find(p=>same(p.name,input.localChampion))??read({name:input.localChampion,role:localRole},input.details,input.roster);

  const yourAdc:RolePick|null=localRole==='ADC'?{champion:me,inferred:false}:pickAdc(allies,me.name);
  const yourSupport:RolePick|null=localRole==='SUPPORT'?{champion:me,inferred:false}:pickSupport(allies,yourAdc?.champion.name??me.name);
  const enemyAdc=pickAdc(enemies);
  const enemySupport=pickSupport(enemies,enemyAdc?.champion.name);
  if(!yourAdc||!yourSupport||!enemyAdc||!enemySupport)return null;

  const ya=yourAdc.champion,ys=yourSupport.champion,ea=enemyAdc.champion,es=enemySupport.champion;
  if(new Set([ya.name,ys.name,ea.name,es.name].map(key)).size<4)return null;

  const ourStyle=supportStyle(ys),theirStyle=supportStyle(es);
  const rangeDelta=Math.round(ya.attackRange-ea.attackRange);
  const enemyControl=es.controlSpell;
  const ourControl=ys.controlSpell;
  const confidence=[yourAdc,yourSupport,enemyAdc,enemySupport].some(p=>p.inferred)?'MEDIUM':'HIGH';

  const laneCall=laneCallFor(ya,ys,ea,es,ourStyle,theirStyle,rangeDelta);
  const level2=levelTwoFor(ya,ys,ea,es,ourStyle,theirStyle);
  const trade=tradeFor(ya,ys,ea,es,ourStyle,theirStyle,rangeDelta);
  const wave=waveFor(ya,ys,ea,es,ourStyle,theirStyle,rangeDelta);
  const allIn=allInFor(ya,ys,ea,es,ourStyle,ourControl);
  const danger=dangerFor(ya,ys,ea,es,theirStyle,enemyControl);
  const focus=focusFor(ya,ys,ea,es,ourStyle);
  const supportRoam=localRole==='ADC'
    ?`If ${ys.name} leaves lane, stop playing the same 2v2 plan. Keep XP, take only safe CS and concede a contested wave rather than giving ${ea.name} + ${es.name} a 2v1 kill.`
    :`If you roam on ${ys.name}, leave only when ${ya.name} can collect safely or the wave is not trapping them under enemy pressure. A successful roam should not cost your ADC a death.`;

  return{
    version:1,
    confidence,
    yourAdc:ya.name,
    yourSupport:ys.name,
    enemyAdc:ea.name,
    enemySupport:es.name,
    ourIdentity:duoIdentity(ya,ys,ourStyle),
    theirIdentity:duoIdentity(ea,es,theirStyle),
    rangeDelta,
    laneCall,
    level2,
    trade,
    wave,
    allIn,
    danger,
    supportRoam,
    focus,
    simulation:{yourAdc:ya.name,yourSupport:ys.name,enemyAdc:ea.name,enemySupport:es.name},
    note:confidence==='HIGH'
      ?'Bot-lane roles came from champ-select role data.'
      :'One or more bot-lane roles were inferred from champion kit/role signals because Riot did not expose every enemy assigned position in champ select.',
  };
}

function laneCallFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle,theirs:SupportStyle,rangeDelta:number){
  if(ours==='HOOK')return{label:'CREATE THE CATCH',summary:`${ys.name} should create first contact. ${ya.name} follows the caught target with damage; do not walk into ${ea.name} + ${es.name} first just to start a trade.`};
  if(theirs==='HOOK')return{label:'MINION BUFFER FIRST',summary:`Keep minions or spacing between you and ${es.name}'s catch tool. Pressure only when the hook line is blocked, missed or on cooldown.`};
  if((ours==='POKE')&&(theirs==='ENGAGE'||theirs==='PEEL'))return{label:'CHIP BEFORE COMMIT',summary:`Use ${ya.name} + ${ys.name}'s range to remove HP before the real fight. A full-health neutral all-in gives ${es.name} the kind of lane they want.`};
  if((ours==='ENGAGE')&&(theirs==='ENCHANT'||theirs==='POKE'))return{label:'MAKE ACCESS, THEN BURST',summary:`Let ${ys.name} create a clean engage on one target, then layer ${ya.name}'s damage immediately. Do not split damage between ${ea.name} and ${es.name}.`};
  if(rangeDelta>=25)return{label:'RANGE → HP LEAD',summary:`${ya.name} has about ${rangeDelta} more basic-attack range than ${ea.name}. Use last-hit windows to take the first hit, then leave before their duo can turn it into an extended 2v2.`};
  if(rangeDelta<=-25)return{label:'SUPPORT ACCESS FIRST',summary:`${ea.name} has about ${Math.abs(rangeDelta)} more basic-attack range. ${ya.name} should not start with a raw auto trade; let ${ys.name} create access or punish a missed enemy spell first.`};
  return{label:'SHORT TRADE → RESET',summary:`Neither ADC owns a large free range edge. Let support cooldowns and wave position decide the opener, take the clean hit, then reset before the enemy duo gets a second action.`};
}

function levelTwoFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle,theirs:SupportStyle){
  if(ours==='HOOK'||ours==='ENGAGE')return{label:'CONTEST THE FIRST LV2',summary:`If ${ya.name} + ${ys.name} reach level 2 first with usable HP, ${ys.name} can threaten first contact while ${ya.name} is ready to follow. If they hit level 2 first, give space immediately.`};
  if(theirs==='HOOK'||theirs==='ENGAGE')return{label:'DO NOT LOSE LV2 FOR FREE',summary:`${es.name} gains much more threat when a second spell comes online. Track the level-up race and back away before ${ea.name} + ${es.name} can use two spells into your level-1 lane.`};
  return{label:'USE LV2 FOR TEMPO',summary:`Use the first level-2 window to win HP or wave control, not to force a coin-flip kill. A clean trade that makes ${ea.name} farm from lower HP is already a lane win.`};
}

function tradeFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle,theirs:SupportStyle,rangeDelta:number){
  if(ours==='HOOK')return{label:'CATCH → BURST → OUT',summary:`${ys.name} threatens the catch; ${ya.name} follows instantly. If the catch misses, do not continue walking forward into ${ea.name} + ${es.name} while your main access tool is unavailable.`};
  if(ours==='ENGAGE')return{label:'CC → FOCUS ONE → EXIT',summary:`Let ${ys.name} commit first, focus the same target, then decide whether the enemy duo can answer. The worst trade is ${ys.name} on one target while ${ya.name} hits the other.`};
  if(ours==='ENCHANT')return{label:'TRADE INSIDE YOUR PROTECTION',summary:`Use ${ys.name}'s shield/heal/peel window to let ${ya.name} take a short trade, then disengage before ${ea.name} + ${es.name} can extend after your protection expires.`};
  if(ours==='POKE')return{label:'POKE → STEP OUT',summary:`Layer one ranged hit at a time and keep enough space that ${es.name} cannot turn your poke into an engage. Repeatable 60/40 trades are better than one neutral 100/100 all-in.`};
  return{label:rangeDelta>=25?'FIRST HIT → LEAVE':'SUPPORT SPELL → ADC FOLLOWS',summary:`Take the first clean advantage, then reset spacing. Do not stay simply because the enemy ADC is lower; re-check ${es.name}'s access before extending.`};
}

function waveFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle,theirs:SupportStyle,rangeDelta:number){
  if(theirs==='HOOK')return{label:'KEEP A MINION BUFFER',summary:`Do not clear every minion if that opens a free line for ${es.name}. Farm and pressure from behind the wave, then punish when the hook misses.`};
  if(ours==='HOOK')return{label:'THIN FOR CATCH ANGLES',summary:`Remove enough enemy minions to give ${ys.name} clean catch lanes, but do not mindlessly shove so far forward that a missed engage leaves both of you exposed.`};
  if(ours==='POKE')return{label:'STACK → PRESSURE → CRASH',summary:`A larger allied wave gives ${ya.name} + ${ys.name} safer space to poke. Build the wave, take HP, then finish the crash instead of lingering for a low-percentage dive.`};
  if(theirs==='ENGAGE'&&ours==='ENCHANT')return{label:'LET THE WAVE PROTECT YOU',summary:`Keep the lane in a position where ${es.name} has to cross space or minions to engage. Do not create a long lane behind you while their all-in tools are available.`};
  return{label:rangeDelta>=25?'CONTROL, DON’T AUTO-SHOVE':'KEEP THE LANE PLAYABLE',summary:`Use wave position to make ${ea.name} step into your preferred trade range. Push only when the crash/reset is the reward; otherwise keep enough lane behind you to disengage.`};
}

function allInFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle,controlSpell:string|null){
  if(ours==='HOOK'||ours==='ENGAGE')return{label:'YOUR ALL-IN TRIGGER',summary:`${controlSpell?`${ys.name} lands ${controlSpell}`:`${ys.name} lands first control`} while both you and ${ya.name} can immediately hit the same target. If only one of you has access, it is not the clean all-in.`};
  if(ours==='POKE')return{label:'ALL-IN AFTER HP ADVANTAGE',summary:`Do not begin at equal HP. Use poke to lower ${ea.name} or ${es.name}, then commit when they can no longer absorb the first rotation and return an equal fight.`};
  if(ours==='ENCHANT')return{label:'TURN THEIR ENGAGE',summary:`Your cleanest all-in can start when ${es.name} commits and fails to finish the first target. Absorb the opener, then use ${ys.name}'s protection to win the longer return trade.`};
  return{label:'CREATE ONE EDGE FIRST',summary:`Enter the 2v2 after an HP, cooldown or wave advantage exists. The lane should not be decided by a neutral coin flip between four full-health champions.`};
}

function dangerFor(ya:Read,ys:Read,ea:Read,es:Read,theirs:SupportStyle,controlSpell:string|null){
  const supportTrigger=controlSpell?`${es.name}'s ${controlSpell}`:`${es.name}'s first control spell`;
  const adcTip=ea.enemyTips[0]?.trim();
  if(theirs==='HOOK')return{label:`DENY ${es.name.toUpperCase()} ACCESS`,summary:`${supportTrigger} is the lane trigger. Keep the line blocked; when it misses, that is your cleanest pressure window.${adcTip?` ${adcTip}`:''}`};
  if(theirs==='ENGAGE')return{label:'DO NOT GIVE THE CLEAN ENTRY',summary:`${supportTrigger} is what turns ${ea.name}'s damage on. Space so ${es.name} has to overextend or use the engage without both enemies in range.${adcTip?` ${adcTip}`:''}`};
  if(theirs==='POKE')return{label:'DON’T ARRIVE TO THE ALL-IN LOW',summary:`${ea.name} + ${es.name} want free HP before the real fight. Protect health behind the wave and do not trade your whole bar for a few CS.${adcTip?` ${adcTip}`:''}`};
  if(theirs==='ENCHANT')return{label:'DON’T WASTE DAMAGE INTO PROTECTION',summary:`Force ${es.name}'s protection first, reset, then re-enter while it is unavailable rather than pouring the whole trade into a shield/heal window.${adcTip?` ${adcTip}`:''}`};
  return{label:'DENY THEIR FIRST CLEAN ACTION',summary:`Make ${ea.name} + ${es.name} spend a cooldown or cross your wave before the fight becomes extended.${adcTip?` ${adcTip}`:''}`};
}

function focusFor(ya:Read,ys:Read,ea:Read,es:Read,ours:SupportStyle){
  if(ours==='HOOK'||ours==='ENGAGE')return`Default: hit whoever ${ys.name} cleanly catches if both allies can reach them. Do not ignore a free ${es.name} just to tunnel on ${ea.name}.`;
  return`Prefer ${ea.name} when they are safely reachable, but never cross ${es.name}'s control range just to force ADC focus. The nearest safe target is the correct target when access is unequal.`;
}

function duoIdentity(adc:Read,support:Read,style:SupportStyle){
  const adcRead=adc.attackRange>=575?'RANGE':adc.tags.includes('Marksman')?'DPS':'CARRY';
  if(style==='HOOK')return`CATCH + ${adcRead}`;
  if(style==='ENGAGE')return`ALL-IN + ${adcRead}`;
  if(style==='ENCHANT')return`PROTECT + ${adcRead}`;
  if(style==='POKE')return`POKE + ${adcRead}`;
  return`PEEL + ${adcRead}`;
}

function supportStyle(p:Read):SupportStyle{
  const hook=/\bhook\b|rocket grab|death sentence|dredge line|pulls? (?:an |the )?enemy|drags? (?:an |the )?enemy|toward (?:him|her|them|itself)/i.test(p.spellText);
  const hard=/stun|knock(?:ed)? ?up|airborne|root|snare|charm|taunt|suppression|pulled|knockback/i.test(p.spellText);
  const protect=/shield|heal|heals|healing|protects? an ally|ally gains/i.test(p.spellText);
  if(hook)return'HOOK';
  if(hard&&(p.tags.includes('Tank')||p.tags.includes('Support')||p.range==='MELEE'))return'ENGAGE';
  if(protect&&(p.tags.includes('Support')||!hard))return'ENCHANT';
  if((p.tags.includes('Mage')||p.range==='LONG'||p.range==='RANGED')&&!p.tags.includes('Tank'))return'POKE';
  return'PEEL';
}

function pickAdc(team:Read[],exclude?:string):RolePick|null{
  const pool=team.filter(p=>!exclude||!same(p.name,exclude));
  const explicit=pool.find(p=>p.role==='ADC');if(explicit)return{champion:explicit,inferred:false};
  const ranked=pool.map(champion=>({champion,score:adcScore(champion)})).sort((a,b)=>b.score-a.score);
  if(!ranked[0]||ranked[0].score<7)return null;
  return{champion:ranked[0].champion,inferred:true};
}

function pickSupport(team:Read[],exclude?:string):RolePick|null{
  const pool=team.filter(p=>!exclude||!same(p.name,exclude));
  const explicit=pool.find(p=>p.role==='SUPPORT');if(explicit)return{champion:explicit,inferred:false};
  const ranked=pool.map(champion=>({champion,score:supportScore(champion)})).sort((a,b)=>b.score-a.score);
  if(!ranked[0]||ranked[0].score<5)return null;
  if(ranked[1]&&ranked[0].score-ranked[1].score<1)return null;
  return{champion:ranked[0].champion,inferred:true};
}

function adcScore(p:Read){
  let score=0;
  if(p.tags.includes('Marksman'))score+=8;
  if(p.attackRange>=500)score+=2;
  if(p.tags.includes('Support'))score-=5;
  if(p.tags.includes('Tank'))score-=4;
  if(p.tags.includes('Assassin'))score-=2;
  return score;
}

function supportScore(p:Read){
  let score=0;
  if(p.tags.includes('Support'))score+=8;
  if(p.tags.includes('Tank'))score+=2;
  if(p.tags.includes('Mage'))score+=1;
  if(/stun|knock(?:ed)? ?up|airborne|root|snare|charm|taunt|suppression|pull|hook/i.test(p.spellText))score+=3;
  if(/shield|heal|heals|healing|ally/i.test(p.spellText))score+=3;
  if(p.tags.includes('Marksman'))score-=5;
  if(p.tags.includes('Assassin'))score-=2;
  return score;
}

function read(p:{name:string;role?:string|null},details:Map<string,ChampionDetail>,roster:Record<string,ChampionListEntry>):Read{
  const detail=details.get(key(p.name));
  if(!detail)return{name:p.name,role:role(p.role),tags:[],range:'RANGED',attackRange:0,spellText:'',controlSpell:null,allyTips:[],enemyTips:[]};
  const profile=championProfile(detail,roster);
  const spells=(detail.spells??[]).map(spell=>({name:spell.name,text:`${spell.name} ${(spell as any).description??''} ${(spell as any).tooltip??''}`}));
  const spellText=spells.map(spell=>spell.text).join(' ');
  const control=spells.find(spell=>/stun|knock(?:ed)? ?up|airborne|root|snare|charm|taunt|suppression|pull|hook/i.test(spell.text));
  return{
    name:detail.name,
    role:role(p.role),
    tags:detail.tags??[],
    range:profile.rangeClass,
    attackRange:detail.stats.attackrange,
    spellText,
    controlSpell:control?.name??null,
    allyTips:detail.allytips??[],
    enemyTips:detail.enemytips??[],
  };
}

function role(value?:string|null){
  const r=(value??'').trim().toUpperCase();
  if(r==='BOTTOM'||r==='ADC')return'ADC';
  if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';
  if(r==='MIDDLE'||r==='MID')return'MID';
  if(r==='TOP')return'TOP';
  if(r==='JUNGLE')return'JUNGLE';
  return r||null;
}
function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
function same(a:string,b:string){return key(a)===key(b)}
