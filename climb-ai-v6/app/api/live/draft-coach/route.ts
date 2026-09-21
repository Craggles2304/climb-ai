import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {hasTier,normalizeTier} from '@/lib/subscription';
import {latestPatch,resolveChampionId,championDetail} from '@/lib/champions/source';
import {rankCoachingInstruction} from '@/lib/coachingLevel';
import {evaluateWinConditionPlan} from '@/lib/coachWinConditionEval';
import {canonicalRole,resolvePlayerRole,normalizeTeamAroundPlayer,resolveEnemyRoles,laneOpponentsFor,lanePartnerFor} from '@/lib/draftRoleResolver';
import {buildRankAwareDraftPlan} from '@/lib/draftCoachEngine';
import {buildFrozenGamePlaybook} from '@/lib/frozenGamePlaybook';
import {buildDecisionTwin,buildDraftSituationContext,selectPersonalTrap,type PersonalTrap,type DraftSituationContext} from '@/lib/decisionTwin';
import {buildDecisionPremortem,type DecisionPremortem} from '@/lib/decisionPremortem';
import {buildDecisionSimulation,type DecisionSimulation} from '@/lib/decisionSimulation';
import type {HistoryAnalysisRow} from '@/lib/riot/proHistory';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const playerSchema=z.object({
  champion:z.string().min(1).max(48),
  role:z.string().max(24).optional().nullable(),
  items:z.array(z.object({itemId:z.number().optional().nullable(),displayName:z.string().max(80).optional().nullable()})).max(8).optional().nullable(),
  summonerSpells:z.array(z.string().max(80)).max(2).optional().nullable(),
});
const requestSchema=z.object({
  champion:z.string().min(1).max(48),
  role:z.string().max(24).optional().nullable(),
  gameMode:z.string().max(40).optional().nullable(),
  ours:z.array(playerSchema).min(1).max(5),
  enemies:z.array(playerSchema).min(1).max(5),
});
const stepSchema=z.object({label:z.string().min(1).max(28),value:z.string().min(1).max(110)});
const lanePlanSchema=z.object({wave:z.string().min(1).max(150),trade:z.string().min(1).max(150),respect:z.string().min(1).max(150)});
const outputSchema=z.object({
  headline:z.string().min(1).max(56),
  why:z.string().min(1).max(220),
  theirPlan:z.string().min(1).max(190).optional(),
  threatLabel:z.string().min(1).max(32),
  threats:z.array(z.string().min(1).max(48)).min(1).max(3),
  threatAnswer:z.string().min(1).max(150),
  laneOpponent:z.string().max(48).nullable().optional(),
  laneOpponents:z.array(z.string().min(1).max(48)).max(2).optional(),
  lanePartner:z.string().max(48).nullable().optional(),
  lanePlan:lanePlanSchema.optional(),
  fightTrigger:z.string().min(1).max(180).optional(),
  objectiveSetup:z.string().min(1).max(180).optional(),
  never:z.string().min(1).max(170),
  ifBehind:z.string().min(1).max(170),
  steps:z.array(stepSchema).length(5),
});
type Player=z.infer<typeof playerSchema>;
type DraftCoach=z.infer<typeof outputSchema>;
type KitFact={champion:string;tags:string[];attackRange:number|null;passive:string|null;spells:Array<{slot:string;name:string;cooldown:number|null;range:number|null;description:string|null}>;allyTips:string[];enemyTips:string[]};

const SCALERS=new Set(['Aphelios','Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir']);
const ASSASSINS=new Set(['Akali','Diana','Ekko','Evelynn','Fizz','Katarina',"Kha'Zix",'Kayn','Naafiri','Nocturne','Qiyana','Rengar','Shaco','Talon','Zed']);
const DIVERS=new Set(['Camille','Diana','Hecarim','Irelia','Jax','Jarvan IV','Kled','Nocturne','Olaf','Pantheon','Renekton','Sett','Vi','Volibear','Wukong','Xin Zhao','Yone']);
const HARD_ENGAGE=new Set(['Alistar','Amumu','Blitzcrank','Fiddlesticks','Galio','Hecarim','Jarvan IV','Leona','Malphite','Maokai','Nautilus','Nocturne','Ornn','Pantheon','Rakan','Rell','Sejuani','Sett','Skarner','Vi','Volibear','Wukong','Zac']);
const ZONE_CONTROL=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lux','Morgana','Nautilus','Neeko','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
const PEEL=new Set(['Alistar','Annie','Braum','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Taric','Thresh','Zilean']);
const FRONTLINE=new Set(['Alistar','Amumu','Braum','Cho\'Gath','Dr. Mundo','Galio','Gragas','K\'Sante','Leona','Maokai','Malphite','Nasus','Nautilus','Ornn','Poppy','Rakan','Rell','Renekton','Sejuani','Sett','Shen','Sion','Skarner','Tahm Kench','Taric','Volibear','Zac']);
const AOE_CARRY=new Set(['Brand','Fiddlesticks','Karthus','Katarina','Kennen','Miss Fortune','Orianna','Rumble','Samira','Swain','Viktor']);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function role(value:unknown){return canonicalRole(value)??''}
function dedupe(players:Player[]){
  const seen=new Set<string>();
  return players.filter(player=>{
    const key=clean(player.champion).toLowerCase();
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  }).map(player=>({...player,champion:clean(player.champion),role:role(player.role)||null}));
}
function byRole(players:Player[],wanted:string){return players.find(player=>role(player.role)===wanted)?.champion??null}
function names(players:Player[]){return players.map(player=>player.champion)}
function clip(value:unknown,max=180){const text=clean(value);return text.length<=max?text:text.slice(0,max-1).replace(/\s+\S*$/,'')+'…'}

function threatScore(player:Player,userRole:string){
  const name=player.champion;let score=0;
  if(ASSASSINS.has(name))score+=8;
  if(HARD_ENGAGE.has(name))score+=7;
  if(DIVERS.has(name))score+=6;
  if(ZONE_CONTROL.has(name))score+=2;
  if(userRole==='ADC'&&['TOP','JUNGLE','MID','SUPPORT'].includes(role(player.role)))score+=1;
  return score;
}

function ruleFallback(champion:string,userRole:string,ours:Player[],enemies:Player[]):DraftCoach{
  const orderedThreats=[...enemies].sort((a,b)=>threatScore(b,userRole)-threatScore(a,userRole));
  const access=orderedThreats.filter(player=>threatScore(player,userRole)>=6).slice(0,3);
  const threatNames=(access.length?access:orderedThreats.slice(0,1)).map(player=>player.champion);
  const zones=enemies.filter(player=>ZONE_CONTROL.has(player.champion));
  const aoe=enemies.filter(player=>AOE_CARRY.has(player.champion));
  const enemyAdc=byRole(enemies,'ADC');
  const laneOpponent=byRole(enemies,userRole)||((userRole==='ADC'||userRole==='SUPPORT')?enemyAdc:null);
  const protectors=ours.filter(player=>player.champion!==champion&&(PEEL.has(player.champion)||FRONTLINE.has(player.champion))).slice(0,2).map(player=>player.champion);
  const pickTools=ours.filter(player=>PICK.has(player.champion)).map(player=>player.champion);
  const resetters=enemies.filter(player=>['Taric','Kayle','Kindred','Zilean','Renata Glasc'].includes(player.champion)).map(player=>player.champion);
  const stayWith=protectors.length?protectors.join(' / '):'YOUR PEEL / FRONT LINE';

  if(userRole==='ADC'){
    if(access.length>=2){
      const accessText=threatNames.join(' / ');
      const zoneText=[...new Set([...zones,...aoe].map(player=>player.champion).filter(name=>!threatNames.includes(name)))].slice(0,2);
      return{
        headline:SCALERS.has(champion)?'SURVIVE FIRST DIVE → FREE-HIT':'ABSORB ENTRY → DPS',
        why:`${accessText} MUST CROSS ${stayWith} TO REACH ${champion}. IF YOU KEEP RANGE THROUGH FIRST CONTACT, THEIR ACCESS WINDOW EXPIRES BEFORE YOUR DPS DOES.`,
        theirPlan:`${accessText} FORCE YOUR FLASH / POSITION FIRST; ${enemyAdc||'THEIR CARRY'} DAMAGES THE BROKEN FIGHT AFTERWARD${resetters.length?' WHILE '+resetters.join(' / ')+' BUY TIME':''}.`,
        threatLabel:'ACCESS PACKAGE',
        threats:threatNames,
        threatAnswer:`HOLD POSITION BEHIND ${stayWith} · DO NOT SPEND FLASH / PEEL BEFORE ${accessText} COMMIT THEIR FIRST ENTRY`,
        laneOpponent,
        fightTrigger:`${pickTools.length?pickTools.slice(0,2).join(' / ')+' START CLEANLY OR ':''}${accessText} COMMIT → HIT THE CLOSEST SAFE TARGET; MOVE FORWARD ONLY AS THEIR ACCESS DISAPPEARS${resetters.length?' · KITE THE '+resetters.join(' / ')+' PROTECTION WINDOW':''}.`,
        objectiveSetup:`ARRIVE FIRST → ${pickTools.length?pickTools.slice(0,2).join(' / ')+' CONTROL THE ENTRANCE':'HOLD A FRONT EDGE'} → KEEP ${champion} ONE LAYER BACK SO ${accessText} MUST ENTER YOUR TEAM TO REACH YOU.`,
        never:enemyAdc?`WALK THROUGH ${accessText} JUST TO REACH ${enemyAdc}; TARGET ACCESSIBILITY BEATS TARGET PRESTIGE`:'WALK PAST YOUR FRONT LINE TO REACH A BACK-LINE TARGET',
        ifBehind:`TAKE THE SAFEST WAVE → GROUP ON YOUR NEXT ITEM → MAKE ${accessText} ENTER ${stayWith} INSTEAD OF CHASING THROUGH FOG`,
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'REACH 2 ITEMS WITHOUT DONATING ACCESS KILLS':'COMPLETE YOUR NEXT DAMAGE ITEM WITHOUT FORCING ENTRY'},
          {label:'2 · POSITION',value:`PLAY BEHIND ${stayWith} · KEEP FLASH FOR THE SECOND ACCESS TOOL`},
          {label:'3 · ABSORB',value:`${accessText} COMMIT → KITE BACK / LET YOUR FRONT EDGE TAKE FIRST CONTACT`},
          {label:'4 · DPS',value:'HIT CLOSEST SAFE TARGET → ADVANCE ONLY AS THEIR ACCESS DISAPPEARS'},
          {label:'5 · CONVERT',value:zoneText.length?`WIN FRONT-TO-BACK → DENY ${zoneText.join(' / ')} RESETUP → DRAGON / BARON`:'WON FRONT-TO-BACK FIGHT → DRAGON / BARON / TOWER'},
        ],
      };
    }
    if(pickTools.length>=2){
      return{
        headline:'PICK FIRST → DPS THE 5V4',
        why:`${pickTools.slice(0,2).join(' / ')} CAN CREATE THE NUMBERS EDGE; YOU DO NOT NEED TO FORCE A FAIR 5V5.`,
        threatLabel:'MAIN ACCESS THREAT',
        threats:threatNames,
        threatAnswer:`STAY CONNECTED TO ${stayWith} · LET THE PICK HAPPEN BEFORE YOU WALK FORWARD`,
        laneOpponent,
        never:enemyAdc?`STEP PAST THE SAFE DAMAGE LINE TO REACH ${enemyAdc}`:'OPEN THE FIGHT BY WALKING INTO THEIR FRONT LINE',
        ifBehind:'CLEAR SAFE WAVES → PLAY FOG WITH YOUR TEAM → TAKE THE FIRST CLEAN PICK',
        steps:[
          {label:'1 · ECONOMY',value:'FARM YOUR ITEM WINDOW'},
          {label:'2 · LINK',value:`PLAY WITH ${pickTools.slice(0,2).join(' / ')}`},
          {label:'3 · CREATE',value:'CONTROL VISION → CATCH ONE PLAYER'},
          {label:'4 · FIGHT',value:'HIT THE CLOSEST SAFE TARGET IN THE 5V4'},
          {label:'5 · CONVERT',value:'PICK → DRAGON / BARON / TOWER'},
        ],
      };
    }
    return{
      headline:SCALERS.has(champion)?'FARM SPIKE → FRONT-TO-BACK':'PLAY CONNECTED FRONT-TO-BACK',
      why:'YOUR DAMAGE MATTERS MOST WHEN YOU STAY ALIVE THROUGH FIRST CONTACT AND KEEP HITTING WHAT IS REACHABLE.',
      threatLabel:'MAIN ACCESS THREAT',
      threats:threatNames,
      threatAnswer:`STAY WITH ${stayWith} · PRESERVE RANGE · DPS AFTER FIRST CONTACT`,
      laneOpponent,
      never:enemyAdc?`WALK PAST THE ENEMY FRONT LINE JUST TO REACH ${enemyAdc}`:'TRADE POSITION FOR A BACK-LINE TARGET',
      ifBehind:'SAFE WAVES → GROUP ON YOUR NEXT ITEM → LET THEM WALK INTO YOUR RANGE',
      steps:[
        {label:'1 · ECONOMY',value:SCALERS.has(champion)?'7+ CS/MIN → FIRST 2 ITEMS':'FARM CLEAN → NEXT ITEM'},
        {label:'2 · POSITION',value:`STAY WITH ${stayWith}`},
        {label:'3 · SURVIVE',value:`TRACK ${threatNames.join(' / ')}`},
        {label:'4 · FIGHT',value:'DPS THE CLOSEST SAFE TARGET'},
        {label:'5 · CONVERT',value:'WON FIGHT → DRAGON / BARON / TOWER'},
      ],
    };
  }

  const headline=pickTools.length>=2?'PICK FIRST → CONVERT':access.length>=2?'DENY THEIR DIVE → COUNTER':'WIN SETUP → TAKE THE FIGHT';
  return{
    headline,
    why:access.length>=2?`THEIR CLEANEST WIN IS ${threatNames.join(' / ')} REACHING YOUR CARRIES BEFORE YOUR TEAM IS SET.`:'WIN THE SPACE BEFORE THE FIGHT, THEN MAKE ONE CONNECTED CALL.',
    threatLabel:access.length>=2?'ACCESS PACKAGE':'MAIN THREAT',
    threats:threatNames,
    threatAnswer:access.length>=2?`MARK ${threatNames.join(' / ')} · DO NOT SPEND CONTROL BEFORE THEY COMMIT`:'TRACK THEIR FIRST CLEAN ENGAGE BEFORE COMMITTING',
    laneOpponent,
    never:'START A DISCONNECTED FIGHT THAT YOUR TEAM CANNOT FOLLOW',
    ifBehind:'CLEAR SAFE RESOURCES → GROUP EARLY → FIGHT ONLY FROM NUMBERS, VISION OR FIRST DAMAGE',
    steps:[
      {label:'1 · SETUP',value:'FARM / RESET CLEANLY BEFORE THE OBJECTIVE'},
      {label:'2 · LINK',value:'PLAY WITH YOUR STRONGEST ENGAGE / CARRY PAIR'},
      {label:'3 · DENY',value:`STOP ${threatNames.join(' / ')} GETTING THE FIGHT THEY WANT`},
      {label:'4 · EXECUTE',value:pickTools.length>=2?'CATCH ONE → COLLAPSE TOGETHER':'ONE FIRST-CONTACT CALL → FOCUS THE SAME FIGHT'},
      {label:'5 · CONVERT',value:'WON FIGHT / PICK → OBJECTIVE → RESET'},
    ],
  };
}

async function paidStrategy(db:any,userId:string){
  const [profileResult,entitlementResult,userResult]=await Promise.all([
    db.from('profiles').select('is_founder').eq('id',userId).maybeSingle(),
    db.from('product_entitlements').select('tier,status,current_period_end').eq('user_id',userId).eq('product','LOL').maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  if(profileResult?.data?.is_founder===true)return true;
  const entitlement=entitlementResult?.data as any;
  const status=String(entitlement?.status??'').toLowerCase();
  const periodEnd=entitlement?.current_period_end?new Date(entitlement.current_period_end).getTime():Number.POSITIVE_INFINITY;
  const live=['active','trialing'].includes(status)&&(!Number.isFinite(periodEnd)||periodEnd>Date.now());
  const tier=live?normalizeTier(entitlement?.tier):normalizeTier(userResult?.data?.user?.app_metadata?.subscription_tier);
  return hasTier(tier,'PLUS');
}


async function playerContext(db:any,device:{userId:string;riotAccountId:string|null}){
  const profilePromise=db.from('profiles').select('rank,role').eq('id',device.userId).maybeSingle();
  const riotPromise=device.riotAccountId
    ?db.from('riot_accounts').select('rank_tier,rank_division').eq('id',device.riotAccountId).maybeSingle()
    :Promise.resolve({data:null,error:null});
  const taskPromise=device.riotAccountId
    ?db.from('ilp_tasks').select('payload,updated_at').eq('user_id',device.userId).eq('riot_account_id',device.riotAccountId).order('updated_at',{ascending:false}).limit(12)
    :Promise.resolve({data:[],error:null});
  const learningPromise=device.riotAccountId
    ?db.from('op_player_learning_profiles').select('learning_identity').eq('user_id',device.userId).eq('riot_account_id',device.riotAccountId).maybeSingle()
    :Promise.resolve({data:null,error:null});
  const historyPromise=device.riotAccountId
    ?db.from('op_match_analysis').select('champion,role,created_at,analysis').eq('user_id',device.userId).eq('riot_account_id',device.riotAccountId).order('created_at',{ascending:true}).limit(50)
    :Promise.resolve({data:[],error:null});
  const [profileResult,riotResult,taskResult,learningResult,historyResult]=await Promise.all([profilePromise,riotPromise,taskPromise,learningPromise,historyPromise]);
  const tier=clean(riotResult?.data?.rank_tier);
  const division=clean(riotResult?.data?.rank_division);
  const rank=tier?(tier+(division?' '+division:'')):(clean(profileResult?.data?.rank)||'Silver');
  const tasks=(taskResult?.data??[]).map((row:any)=>row?.payload??{}).filter((task:any)=>{
    const status=clean(task?.status||'ACTIVE').toUpperCase();
    return status!=='MASTERED'&&status!=='PAUSED'&&clean(task?.gameRule);
  }).sort((a:any,b:any)=>(Number(b?.priority)||50)-(Number(a?.priority)||50));
  const task=tasks[0]??null;
  const storedTwin=learningResult?.data?.learning_identity;
  const rows:HistoryAnalysisRow[]=(historyResult?.data??[]).map((row:any)=>({
    champion:clean(row?.champion)||'Unknown',
    role:clean(row?.role)||null,
    createdAt:clean(row?.created_at),
    analysis:row?.analysis as ProMatchAnalysis,
  })).filter((row:any)=>row.analysis?.version===1);
  const decisionTwin=storedTwin?.version===1&&Array.isArray(storedTwin?.behaviours)?storedTwin:buildDecisionTwin(rows);
  return{rank,profileRole:clean(profileResult?.data?.role)||null,mission:task?{title:clean(task.title),gameRule:clean(task.gameRule),metric:clean(task.metric)}:null,decisionTwin};
}

async function kitFacts(players:Player[]):Promise<KitFact[]>{
  try{
    const patch=await latestPatch();
    const unique=[...new Set(players.map(player=>player.champion).filter(Boolean))];
    const ids=await Promise.all(unique.map(async champion=>({champion,id:await resolveChampionId(champion,patch)})));
    const details=await Promise.all(ids.filter((item):item is {champion:string;id:string}=>Boolean(item.id)).map(async item=>({champion:item.champion,detail:await championDetail(item.id,patch)})));
    return details.map(({champion,detail})=>({
      champion:detail.name||champion,
      tags:Array.isArray(detail.tags)?detail.tags.slice(0,3):[],
      attackRange:Number.isFinite(detail.stats?.attackrange)?detail.stats.attackrange:null,
      passive:detail.passive?clip(detail.passive.name+': '+String((detail.passive as any).description||''),180):null,
      spells:(Array.isArray(detail.spells)?detail.spells:[]).slice(0,4).map((spell:any,index:number)=>({
        slot:['Q','W','E','R'][index]||String(index+1),
        name:clean(spell?.name),
        cooldown:Array.isArray(spell?.cooldown)&&Number.isFinite(Number(spell.cooldown[0]))?Number(spell.cooldown[0]):null,
        range:Array.isArray(spell?.range)&&Number.isFinite(Number(spell.range[0]))?Number(spell.range[0]):null,
        description:clip(spell?.description||spell?.tooltip||'',160)||null,
      })),
      allyTips:(Array.isArray(detail.allytips)?detail.allytips:[]).slice(0,2).map((tip:string)=>clip(tip,180)),
      enemyTips:(Array.isArray(detail.enemytips)?detail.enemytips:[]).slice(0,2).map((tip:string)=>clip(tip,180)),
    }));
  }catch(error){
    console.warn('[draft-coach] kit facts unavailable',error);
    return[];
  }
}

function spellFor(kits:KitFact[],champion:string|undefined|null,terms:string[]){
  if(!champion)return null;
  const kit=kits.find(item=>clean(item.champion).toLowerCase()===clean(champion).toLowerCase());
  if(!kit)return null;
  return kit.spells.find(spell=>{
    const text=(clean(spell.name)+' '+clean(spell.description)).toLowerCase();
    return terms.some(term=>text.includes(term.toLowerCase()));
  })?.name??null;
}

function resolvedLanePlan(userRole:string,laneOpponents:string[],lanePartner:string|null,kits:KitFact[]){
  const adc=laneOpponents[0]??null;
  const support=(userRole==='ADC'||userRole==='SUPPORT')?(laneOpponents[1]??null):null;
  if((userRole==='ADC'||userRole==='SUPPORT')&&adc){
    const adcMobility=spellFor(kits,adc,['dash','dashes','blink','leap']);
    const supportCc=spellFor(kits,support,['stun','root','knock','charm','taunt','fear','suppress','pull']);
    const supportReset=spellFor(kits,support,['invulnerable','invulnerability','immune']);
    const partner=lanePartner||'YOUR LANE PARTNER';
    return{
      wave:'KEEP THE WAVE ON YOUR SIDE VS '+adc+(support?' + '+support:'')+'; DO NOT BLEED HP FOR ONE CS BEFORE '+partner+' CAN CONNECT.',
      trade:'TRADE AFTER '+adc+(adcMobility?' SPENDS '+adcMobility:' SPENDS A MOBILITY / DAMAGE TOOL')+(support?(supportCc?' OR '+support+' MISSES '+supportCc:' OR '+support+' CANNOT FOLLOW'):'')+'.',
      respect:(support&&supportCc?'DO NOT EXTEND THROUGH '+support+' '+supportCc+'. ':'DO NOT EXTEND THROUGH THEIR SUPPORT CC. ')+(supportReset?'KITE '+supportReset+' INSTEAD OF DUMPING YOUR FULL DAMAGE.':'PRESERVE HP FOR THE NEXT WAVE.'),
    };
  }
  const opponent=laneOpponents[0]??null;
  if(opponent){
    const key=spellFor(kits,opponent,['dash','stun','root','shield','heal','parry','counter','untargetable']);
    return{
      wave:'CONTROL THE WAVE SO '+opponent+' HAS TO SHOW BEFORE YOU COMMIT; DO NOT GIVE THEM A FREE LONG LANE.',
      trade:'PUNISH '+opponent+(key?' AFTER '+key+' IS USED':' AFTER THEIR KEY TRADE TOOL IS USED')+'; EXIT BEFORE THEIR SECOND ROTATION.',
      respect:'DO NOT FORCE INTO '+opponent+' WHEN THEY HAVE THE BETTER WAVE OR FIRST MOVE.',
    };
  }
  return fallbackLane(userRole,null);
}

function enrichRulePlan(coach:DraftCoach,userRole:string,enemies:Player[],kits:KitFact[]){
  if(userRole!=='ADC')return coach;
  const entrySpells=(coach.threats||[]).map(name=>spellFor(kits,name,['stun','dash','dashes','leap','blink','charge','knock','pull','suppress','fear','taunt'])).filter((name):name is string=>Boolean(name));
  const resetChampion=enemies.find(player=>['Taric','Kayle','Kindred','Zilean','Renata Glasc'].includes(player.champion));
  const resetSpell=resetChampion?spellFor(kits,resetChampion.champion,['invulnerable','invulnerability','immune','revive','resurrect']):null;
  if(entrySpells.length){
    coach.threatAnswer=clip(coach.threatAnswer+' · KEY ENTRY: '+[...new Set(entrySpells)].slice(0,3).join(' / '),150);
  }
  if(resetChampion&&resetSpell){
    coach.fightTrigger=clip((coach.fightTrigger||'')+' · IF '+resetChampion.champion+' '+resetSpell+' IS ACTIVE, KITE IT BEFORE RE-COMMITTING',180);
  }
  return coach;
}

function fallbackLane(userRole:string,laneOpponent:string|null){
  if(!laneOpponent)return{
    wave:'KEEP THE WAVE PLAYABLE UNTIL THE LANE ROLE IS FULLY RESOLVED',
    trade:'ONLY TRADE WHEN YOUR LANE PARTNER CAN CONNECT OR A KEY SPELL IS DOWN',
    respect:'DO NOT FORCE A FULL-HP ALL-IN FROM AN EVEN WAVE',
  };
  if(userRole==='ADC')return{
    wave:'KEEP FARM STABLE VS '+laneOpponent+' · DO NOT SACRIFICE HP FOR ONE CS',
    trade:'TRADE AFTER '+laneOpponent+' SPENDS A KEY SPELL OR STEPS UP WITHOUT SUPPORT COVER',
    respect:'DO NOT EXTEND PAST THE WAVE JUST TO HIT '+laneOpponent,
  };
  return{
    wave:'CONTROL THE WAVE SO '+laneOpponent+' HAS TO SHOW BEFORE YOU COMMIT',
    trade:'PUNISH '+laneOpponent+' AFTER A KEY COOLDOWN OR MISPOSITION',
    respect:'DO NOT FORCE THE MATCHUP WHEN '+laneOpponent+' HAS THE BETTER WAVE / FIRST MOVE',
  };
}

function completeCoach(coach:DraftCoach,userRole:string,enemies:Player[]):DraftCoach{
  const laneOpponent=coach.laneOpponent||byRole(enemies,userRole)||((userRole==='ADC'||userRole==='SUPPORT')?byRole(enemies,'ADC'):null);
  return{
    ...coach,
    laneOpponent,
    theirPlan:coach.theirPlan||'THEY WANT TO BREAK YOUR FORMATION BEFORE YOUR DAMAGE OR ENGAGE CAN SET.',
    lanePlan:coach.lanePlan||fallbackLane(userRole,laneOpponent),
    fightTrigger:coach.fightTrigger||'COMMIT ONLY AFTER THEIR FIRST ACCESS TOOL IS SHOWN OR YOUR TEAM CREATES FIRST CONTACT.',
    objectiveSetup:coach.objectiveSetup||'ARRIVE FIRST → CONTROL THE ENTRY → MAKE THEM WALK INTO YOUR FORMATION.',
  };
}



async function callCoachModel(system:string,user:string){
  if(!process.env.OPENAI_API_KEY)return null;
  const primaryModel=process.env.OPENAI_DRAFT_COACH_MODEL||'gpt-5.6-terra';
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+process.env.OPENAI_API_KEY},
      body:JSON.stringify({
        model:primaryModel,
        instructions:system,
        input:user,
        reasoning:{effort:'medium'},
        max_output_tokens:2200,
      }),
    });
    if(response.ok){
      const body=await response.json();
      const text=clean(body?.output_text)||clean((Array.isArray(body?.output)?body.output:[]).flatMap((item:any)=>Array.isArray(item?.content)?item.content:[]).find((part:any)=>part?.type==='output_text')?.text);
      if(text)return outputSchema.parse(JSON.parse(text));
    }
  }catch(error){
    console.warn('[draft-coach] responses model fallback',error);
  }

  const fallbackModel=process.env.OPENAI_COACH_MODEL||'gpt-4o-mini';
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+process.env.OPENAI_API_KEY},
    body:JSON.stringify({
      model:fallbackModel,
      temperature:.12,
      response_format:{type:'json_object'},
      messages:[{role:'system',content:system},{role:'user',content:user}],
    }),
  });
  if(!response.ok)return null;
  const body=await response.json();
  return outputSchema.parse(JSON.parse(body?.choices?.[0]?.message?.content||'{}'));
}

function sanitizeCoach(parsed:DraftCoach,enemies:Player[],fallback:DraftCoach){
  const enemyMap=new Map(enemies.map(player=>[player.champion.toLowerCase(),player.champion]));
  const threats=parsed.threats.map(name=>enemyMap.get(name.toLowerCase())).filter((name):name is string=>Boolean(name));
  const laneOpponent=parsed.laneOpponent?enemyMap.get(parsed.laneOpponent.toLowerCase())??fallback.laneOpponent:fallback.laneOpponent;
  return{...parsed,threats:threats.length?threats:fallback.threats,laneOpponent,laneOpponents:fallback.laneOpponents,lanePartner:fallback.lanePartner};
}


async function aiCoach(champion:string,userRole:string,ours:Player[],enemies:Player[],fallback:DraftCoach,rank:string,mission:any,personalTrap:PersonalTrap,decisionPremortem:DecisionPremortem,kits:KitFact[]){
  if(!process.env.OPENAI_API_KEY)return null;
  try{
    const system=[
      'You are OP CLIMB Draft Coach. Your standard is a paid one-to-one League of Legends coach preparing a player before queue, not a generic assistant and not a champion-tag lookup.',
      'Analyse ONLY the static draft and supplied Riot/Data Dragon kit facts. Never provide reactive live shotcalling.',
      rankCoachingInstruction(rank),
      '',
      'COACHING STANDARD:',
      '- Explain the interaction BETWEEN the ten champions, not isolated champion labels.',
      '- Identify their actual win condition first, then the player answer to it.',
      '- Separate threat ACCESS from damage. A diver, engage champion, zone controller and follow-up carry can form one threat package.',
      '- Every important instruction must answer WHO, WHAT, WHEN and WHY.',
      '- Use named abilities/cooldowns from the supplied kit facts when they materially change the decision. Never invent an ability name or mechanic.',
      '- Lane advice must name the actual lane opponent and give a concrete wave/trade/respect rule. "Farm clean", "play safe" or "trade when a key spell misses" is insufficient by itself.',
      '- Fight advice must specify the trigger for entering or committing, the safe target rule, and what enemy cooldown/access condition changes that rule.',
      '- Objective advice must explain whether to arrive first, force them to face-check, avoid a prepared zone, or hold a flank/entry. Name the champions creating that geometry.',
      '- For ADCs, target accessibility beats target prestige: default to the closest safe target and never tell the player to walk through a threat line just to hit the enemy ADC.',
      '- If several enemies combine to reach the player, name a multi-champion threat PACKAGE.',
      '- The five steps must form one causal win path, not five unrelated tips.',
      '- Do not say PLAY MID GAME, PLAY CLEAN, STAY CONNECTED, FARM CLEAN or similar unless the sentence also names the champion/ability/condition that makes it correct.',
      '- The output must be useful enough that the player could repeat the plan back in champion select.',
      '- If PERSONAL TRAP EVIDENCE has status READY, weave exactly one short personal cue into the strategically correct plan. It is historical evidence, not permission to distort the draft read.',
      '- If PERSONAL TRAP EVIDENCE is MASTERED, do not re-teach it as an active weakness. Preserve the learned behaviour and coach the next real draft requirement.',
      '- If PERSONAL TRAP EVIDENCE is BUILDING or NONE, do not invent a personal weakness or claim a repeated tendency.',
      '- DECISION PRE-MORTEM is an evidence-bounded map of the player\'s highest-risk decision windows for THIS static draft. Use it to sharpen triggers and prevention rules, not to claim certainty or probability.',
      '- If DECISION PRE-MORTEM is READY, the root win-condition plan should naturally protect against its highest-priority risks without turning the response into a list of warnings.',
      '- If DECISION PRE-MORTEM is BUILDING or NONE, do not invent predicted mistakes.',
      '- This root plan will be frozen before the game and expanded into prewritten AHEAD / EVEN / BEHIND branches. Make the strategy stable enough to remain correct across those states without using live gold, kills, items, cooldown tracking or objective timers.',
      '- Do not assume the app will detect whether the player is ahead, even or behind. The PLAYER will choose the matching prewritten branch during the game.',
      '',
      'For ADC/SUPPORT, treat the lane as a DUO matchup: both enemy ADC and enemy support matter. Never reduce bot lane to the top-lane opponent.',
      'Return JSON only with exactly: headline, why, theirPlan, threatLabel, threats, threatAnswer, laneOpponent, laneOpponents, lanePartner, lanePlan{wave,trade,respect}, fightTrigger, objectiveSetup, never, ifBehind, steps[{label,value}] (exactly five).',
    ].join('\n');

    const user=[
      'PLAYER: '+champion+' · '+(userRole||'ROLE UNKNOWN')+' · RANK '+rank,
      'OUR TEAM: '+JSON.stringify(ours),
      'ENEMY TEAM: '+JSON.stringify(enemies),
      'CURRENT DEVELOPMENT FOCUS: '+JSON.stringify(mission),
      'PERSONAL TRAP EVIDENCE: '+JSON.stringify(personalTrap),
      'DECISION PRE-MORTEM: '+JSON.stringify(decisionPremortem),
      'RIOT / DATA DRAGON KIT FACTS: '+JSON.stringify(kits),
      '',
      'The development focus may shape ONE cue where relevant, but it must not override the correct draft plan.',
      'The personal trap may shape ONE cue only when status is READY. MASTERED is proof of learning, not an active weakness; do not re-teach it. Never turn BUILDING/NONE evidence into a claim about the player.',
      'The Decision Pre-Mortem may shape trigger/prevention wording only when status is READY. It ranks evidence-backed risk windows; it does not predict that a mistake will occur.',
      '',
      'Build the pre-game coaching plan that will become the immutable root of a frozen in-game playbook. The deterministic fallback below is orientation only. Improve it substantially when the supplied champion interactions justify a sharper read:',
      JSON.stringify(fallback),
    ].join('\n');

    let parsed=await callCoachModel(system,user);
    if(!parsed)return null;
    let best=completeCoach(sanitizeCoach(parsed,enemies,fallback),userRole,enemies);
    let bestQuality=evaluateWinConditionPlan({plan:best,ours,enemies,kits,rank,role:userRole});
    if(bestQuality.pass)return best;

    for(let attempt=1;attempt<=2;attempt++){
      const rewriteUser=[
        user,
        '',
        'CURRENT PLAN:',
        JSON.stringify(best),
        '',
        'RANK-SPECIFIC QUALITY AUDIT FAILED FOR '+bestQuality.tier+': '+(bestQuality.issues.join('; ')||'insufficient specificity')+'.',
        'Score: '+bestQuality.score+'/'+bestQuality.rubric.passScore+'.',
        'Named champions found: '+(bestQuality.metrics.championMentions.join(', ')||'none')+'.',
        'Named abilities found: '+(bestQuality.metrics.abilityMentions.join(', ')||'none')+'.',
        'Conditional decision rules: '+bestQuality.metrics.conditionalRules+'.',
        '',
        'Rewrite the whole JSON plan. Fix EVERY failed rubric item while preserving the correct strategic read. Increase specificity without unnecessary verbosity. Use named champion interactions, supplied ability names/cooldowns, explicit IF/WHEN/AFTER decisions, a concrete fight trigger and objective geometry. Do not invent facts.',
      ].join('\n');
      const rewritten=await callCoachModel(system,rewriteUser);
      if(!rewritten)break;
      const candidate=completeCoach(sanitizeCoach(rewritten,enemies,fallback),userRole,enemies);
      const candidateQuality=evaluateWinConditionPlan({plan:candidate,ours,enemies,kits,rank,role:userRole});
      if(candidateQuality.score>bestQuality.score){
        best=candidate;
        bestQuality=candidateQuality;
      }
      if(candidateQuality.pass)return candidate;
    }
    console.warn('[draft-coach] paid coach failed rank quality gate',{rank,tier:bestQuality.tier,score:bestQuality.score,required:bestQuality.rubric.passScore,issues:bestQuality.issues});
    return null;
  }catch(error){
    console.warn('[draft-coach] AI fallback',error);
    return null;
  }
}

async function persistLockedCoachForPregame(db:any,device:any,input:{champion:string;role:string|null;source:string;coach:DraftCoach;personalTrap:PersonalTrap;decisionPremortem:DecisionPremortem;decisionSimulation:DecisionSimulation;situationContext:DraftSituationContext;quality:any;playbook:any}){
  try{
    const {data,error}=await db.from('live_pregame_contexts')
      .select('id,context,last_seen_at,started_at')
      .eq('device_id',device.id)
      .eq('user_id',device.userId)
      .order('started_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error||!data?.id)return;
    const seenAt=Date.parse(String(data.last_seen_at||data.started_at||''));
    if(!Number.isFinite(seenAt)||Date.now()-seenAt>35*60_000)return;
    const deepCoach={
      version:1,
      capturedAt:new Date().toISOString(),
      champion:input.champion,
      role:input.role,
      source:input.source,
      headline:input.coach.headline,
      why:input.coach.why,
      theirPlan:input.coach.theirPlan??null,
      threatAnswer:input.coach.threatAnswer,
      fightTrigger:input.coach.fightTrigger??null,
      objectiveSetup:input.coach.objectiveSetup??null,
      never:input.coach.never,
      ifBehind:input.coach.ifBehind,
      personalTrap:input.personalTrap,
      decisionPremortem:input.decisionPremortem,
      decisionSimulation:input.decisionSimulation,
      situationContext:input.situationContext,
      quality:input.quality,
      draftFingerprint:input.playbook?.draftFingerprint??null,
      playbook:input.playbook??null,
    };
    const context={...((data.context&&typeof data.context==='object')?data.context:{}),deepCoach};
    const {error:updateError}=await db.from('live_pregame_contexts').update({context}).eq('id',data.id);
    if(updateError)throw new Error(updateError.message);
    const {data:deviceRow}=await db.from('live_tracker_devices').select('pregame_context').eq('id',device.id).maybeSingle();
    if(deviceRow?.pregame_context&&typeof deviceRow.pregame_context==='object'){
      await db.from('live_tracker_devices').update({pregame_context:{...deviceRow.pregame_context,deepCoach},pregame_updated_at:new Date().toISOString()}).eq('id',device.id);
    }
  }catch(error){
    console.warn('[draft-coach] could not persist locked coach for Decision Graph',error);
  }
}

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-draft-coach'),12,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many draft-coach requests. Wait a moment.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  try{
    const input=requestSchema.parse(await req.json());
    const champion=clean(input.champion);
    const oursRaw=dedupe(input.ours);
    const enemiesRaw=dedupe(input.enemies);
    if(oursRaw.length<3||enemiesRaw.length<3)return NextResponse.json({ok:false,error:'Not enough of the draft is resolved yet.'},{status:202});

    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({ok:false,error:'Draft coach is unavailable.'},{status:503});
    const [paid,context]=await Promise.all([paidStrategy(db,device.userId),playerContext(db,device)]);
    if(!paid)return NextResponse.json({ok:false,error:'PLUS or PRO is required for the full draft coach.'},{status:403});

    const roleResolution=resolvePlayerRole({
      champion,
      requestRole:input.role,
      ours:oursRaw,
      profileRole:context.profileRole,
      gameMode:input.gameMode,
    });
    const ours=normalizeTeamAroundPlayer(oursRaw,champion,roleResolution) as Player[];
    const enemies=resolveEnemyRoles(enemiesRaw) as Player[];
    const userRole=roleResolution.role??'';
    const laneOpponents=laneOpponentsFor(roleResolution.role,enemies);
    const lanePartner=lanePartnerFor(roleResolution.role,ours,champion);
    const situationContext=buildDraftSituationContext({champion,role:roleResolution.role,enemies});
    const personalTrap=selectPersonalTrap(context.decisionTwin,{
      champion,
      role:roleResolution.role,
      ours,
      enemies,
    });
    const decisionPremortem=buildDecisionPremortem(context.decisionTwin,{
      champion,
      role:roleResolution.role,
      ours,
      enemies,
    });

    const kits=await kitFacts([...ours,...enemies]);
    const fallback=completeCoach(buildRankAwareDraftPlan({
      champion,
      role:roleResolution.role,
      ours,
      enemies,
      rank:context.rank,
    }) as DraftCoach,userRole,enemies);
    fallback.laneOpponents=laneOpponents;
    fallback.lanePartner=lanePartner;
    if(laneOpponents.length)fallback.laneOpponent=laneOpponents[0];
    fallback.lanePlan=resolvedLanePlan(userRole,laneOpponents,lanePartner,kits);
    enrichRulePlan(fallback,userRole,enemies,kits);

    const fullDraft=ours.length>=4&&enemies.length===5;
    const ai=fullDraft?await aiCoach(champion,userRole,ours,enemies,fallback,context.rank,context.mission,personalTrap,decisionPremortem,kits):null;
    if(fullDraft&&process.env.OPENAI_API_KEY&&!ai){
      const fallbackQuality=evaluateWinConditionPlan({plan:fallback,ours,enemies,kits,rank:context.rank,role:userRole});
      return NextResponse.json({
        ok:false,
        error:'Premium draft analysis did not clear the '+fallbackQuality.tier+' coaching quality gate. Keep the local safe plan and retry next draft.',
        player:{role:userRole||null,roleSource:roleResolution.source,roleConfidence:roleResolution.confidence,laneOpponents,lanePartner},
        personalTrap,
        decisionPremortem,
        coachQuality:{score:fallbackQuality.score,pass:false,issues:fallbackQuality.issues,groundedKits:kits.length,rank:context.rank,tier:fallbackQuality.tier},
      },{status:503});
    }
    const coach=completeCoach(ai??fallback,userRole,enemies);
    coach.laneOpponents=laneOpponents;
    coach.lanePartner=lanePartner;
    if(laneOpponents.length)coach.laneOpponent=laneOpponents[0];
    if(!ai)coach.lanePlan=resolvedLanePlan(userRole,laneOpponents,lanePartner,kits);
    const quality=evaluateWinConditionPlan({plan:coach,ours,enemies,kits,rank:context.rank,role:userRole});
    const decisionSimulation=buildDecisionSimulation({
      twin:context.decisionTwin,
      premortem:decisionPremortem,
      situationContext,
      champion,
      role:roleResolution.role,
      coach,
    });
    const playbook=buildFrozenGamePlaybook({
      champion,
      role:roleResolution.role,
      rank:context.rank,
      ours,
      enemies,
      plan:coach as any,
      decisionPremortem,
    });
    await persistLockedCoachForPregame(db,device,{
      champion,
      role:roleResolution.role,
      source:ai?'ai':'rules',
      coach,
      personalTrap,
      decisionPremortem,
      decisionSimulation,
      situationContext,
      quality:{score:quality.score,pass:quality.pass,issues:quality.issues,groundedKits:kits.length,rank:context.rank,tier:quality.tier},
      playbook,
    });
    return NextResponse.json({
      ok:true,
      ready:true,
      source:ai?'ai':'rules',
      player:{role:userRole||null,roleSource:roleResolution.source,roleConfidence:roleResolution.confidence,laneOpponents,lanePartner},
      coach,
      personalTrap,
      decisionPremortem,
      decisionSimulation,
      playbook,
      playbookPolicy:{
        frozenFromPregame:true,
        usesLiveTelemetry:false,
        playerSelectsBranch:true,
        branches:['AHEAD','EVEN','BEHIND'],
        checkpoints:[5,10,15],
      },
      coachQuality:{score:quality.score,pass:quality.pass,issues:quality.issues,groundedKits:kits.length,rank:context.rank,tier:quality.tier},
      draft:{ours:names(ours),enemies:names(enemies)},
      resolvedDraft:{
        ours:ours.map(player=>({champion:player.champion,role:role(player.role)||null})),
        enemies:enemies.map(player=>({champion:player.champion,role:role(player.role)||null})),
      },
    });
  }catch(error){
    console.error('[draft-coach] request failed',error);
    return NextResponse.json({ok:false,error:'The draft coach could not build this plan.'},{status:400});
  }
}

