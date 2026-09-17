import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {hasTier,normalizeTier} from '@/lib/subscription';
import {latestPatch,resolveChampionId,championDetail} from '@/lib/champions/source';
import {rankCoachingInstruction} from '@/lib/coachingLevel';
import {evaluateWinConditionPlan} from '@/lib/coachWinConditionEval';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const playerSchema=z.object({
  champion:z.string().min(1).max(48),
  role:z.string().max(24).optional().nullable(),
});
const requestSchema=z.object({
  champion:z.string().min(1).max(48),
  role:z.string().max(24).optional().nullable(),
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
const DIVERS=new Set(['Camille','Diana','Hecarim','Irelia','Jax','Jarvan IV','Kled','Nocturne','Olaf','Pantheon','Renekton','Vi','Volibear','Wukong','Xin Zhao','Yone']);
const HARD_ENGAGE=new Set(['Alistar','Amumu','Blitzcrank','Fiddlesticks','Galio','Hecarim','Jarvan IV','Leona','Malphite','Maokai','Nautilus','Nocturne','Ornn','Rakan','Rell','Sejuani','Skarner','Vi','Volibear','Wukong','Zac']);
const ZONE_CONTROL=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lux','Morgana','Nautilus','Neeko','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
const PEEL=new Set(['Alistar','Annie','Braum','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Thresh','Zilean']);
const AOE_CARRY=new Set(['Brand','Fiddlesticks','Karthus','Katarina','Kennen','Miss Fortune','Orianna','Rumble','Samira','Swain','Viktor']);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function role(value:unknown){const r=clean(value).toUpperCase();if(r==='BOTTOM')return'ADC';if(r==='UTILITY')return'SUPPORT';if(r==='MIDDLE')return'MID';return r}
function dedupe(players:Player[]){const seen=new Set<string>();return players.filter(player=>{const key=clean(player.champion).toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true}).map(player=>({champion:clean(player.champion),role:role(player.role)||null}))}
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
  const protectors=ours.filter(player=>player.champion!==champion&&(PEEL.has(player.champion)||['SUPPORT','TOP'].includes(role(player.role)))).slice(0,2).map(player=>player.champion);
  const pickTools=ours.filter(player=>PICK.has(player.champion)).map(player=>player.champion);
  const stayWith=protectors.length?protectors.join(' / '):'YOUR PEEL / FRONT LINE';

  if(userRole==='ADC'){
    if(access.length>=2){
      const accessText=threatNames.join(' / ');
      const zoneText=[...new Set([...zones,...aoe].map(player=>player.champion).filter(name=>!threatNames.includes(name)))].slice(0,2);
      return{
        headline:SCALERS.has(champion)?'SCALE WITHOUT GIVING ACCESS':'SURVIVE ENTRY → DPS',
        why:`IF ${accessText} CANNOT REACH ${champion}, YOU GET TO PLAY THE LONG FIGHT.`,
        threatLabel:'DIVE PACKAGE',
        threats:threatNames,
        threatAnswer:`KITE BACK FIRST · STAY WITH ${stayWith} · HOLD FLASH / PEEL UNTIL THEIR ENTRY IS COMMITTED`,
        laneOpponent,
        never:enemyAdc?`WALK THROUGH THEIR THREAT LINE JUST TO REACH ${enemyAdc}`:'WALK PAST YOUR FRONT LINE TO REACH A BACK-LINE TARGET',
        ifBehind:'CLEAR THE SAFEST WAVE → GROUP EARLY → MAKE THEM ENTER YOUR RANGE INSTEAD OF CHASING',
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'7+ CS/MIN → REACH YOUR FIRST 2 ITEMS CLEANLY':'FARM CLEAN → COMPLETE YOUR NEXT DAMAGE ITEM'},
          {label:'2 · POSITION',value:`PLAY BEHIND ${stayWith}`},
          {label:'3 · SURVIVE',value:`TRACK ${accessText}`},
          {label:'4 · FIGHT',value:'KITE BACK → DPS THE CLOSEST SAFE TARGET'},
          {label:'5 · CONVERT',value:zoneText.length?`ARRIVE FIRST → DO NOT WALK INTO ${zoneText.join(' / ')} SETUP → DRAGON / BARON`:'WIN FRONT-TO-BACK → DRAGON / BARON'},
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
  const profilePromise=db.from('profiles').select('rank').eq('id',device.userId).maybeSingle();
  const riotPromise=device.riotAccountId
    ?db.from('riot_accounts').select('rank_tier,rank_division').eq('id',device.riotAccountId).maybeSingle()
    :Promise.resolve({data:null,error:null});
  const taskPromise=device.riotAccountId
    ?db.from('ilp_tasks').select('payload,updated_at').eq('user_id',device.userId).eq('riot_account_id',device.riotAccountId).order('updated_at',{ascending:false}).limit(12)
    :Promise.resolve({data:[],error:null});
  const [profileResult,riotResult,taskResult]=await Promise.all([profilePromise,riotPromise,taskPromise]);
  const tier=clean(riotResult?.data?.rank_tier);
  const division=clean(riotResult?.data?.rank_division);
  const rank=tier?(tier+(division?' '+division:'')):(clean(profileResult?.data?.rank)||'Silver');
  const tasks=(taskResult?.data??[]).map((row:any)=>row?.payload??{}).filter((task:any)=>{
    const status=clean(task?.status||'ACTIVE').toUpperCase();
    return status!=='MASTERED'&&status!=='PAUSED'&&clean(task?.gameRule);
  }).sort((a:any,b:any)=>(Number(b?.priority)||50)-(Number(a?.priority)||50));
  const task=tasks[0]??null;
  return{rank,mission:task?{title:clean(task.title),gameRule:clean(task.gameRule),metric:clean(task.metric)}:null};
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
  return{...parsed,threats:threats.length?threats:fallback.threats,laneOpponent};
}


async function aiCoach(champion:string,userRole:string,ours:Player[],enemies:Player[],fallback:DraftCoach,rank:string,mission:any,kits:KitFact[]){
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
      '',
      'Return JSON only with exactly: headline, why, theirPlan, threatLabel, threats, threatAnswer, laneOpponent, lanePlan{wave,trade,respect}, fightTrigger, objectiveSetup, never, ifBehind, steps[{label,value}] (exactly five).',
    ].join('\n');

    const user=[
      'PLAYER: '+champion+' · '+(userRole||'ROLE UNKNOWN')+' · RANK '+rank,
      'OUR TEAM: '+JSON.stringify(ours),
      'ENEMY TEAM: '+JSON.stringify(enemies),
      'CURRENT DEVELOPMENT FOCUS: '+JSON.stringify(mission),
      'RIOT / DATA DRAGON KIT FACTS: '+JSON.stringify(kits),
      '',
      'The development focus may shape ONE cue where relevant, but it must not override the correct draft plan.',
      '',
      'Build the pre-game coaching plan. The deterministic fallback below is orientation only. Improve it substantially when the supplied champion interactions justify a sharper read:',
      JSON.stringify(fallback),
    ].join('\n');

    let parsed=await callCoachModel(system,user);
    if(!parsed)return null;
    parsed=completeCoach(sanitizeCoach(parsed,enemies,fallback),userRole,enemies);
    const firstQuality=evaluateWinConditionPlan({plan:parsed,ours,enemies,kits,rank,role:userRole});
    if(firstQuality.pass)return parsed;

    const rewriteUser=[
      user,
      '',
      'YOUR FIRST PLAN:',
      JSON.stringify(parsed),
      '',
      'QUALITY AUDIT FAILED: '+(firstQuality.issues.join('; ')||'insufficient specificity')+'.',
      'Named champions found: '+(firstQuality.metrics.championMentions.join(', ')||'none')+'.',
      'Named abilities found: '+(firstQuality.metrics.abilityMentions.join(', ')||'none')+'.',
      '',
      'Rewrite the whole JSON plan. Increase specificity without increasing verbosity. Replace generic advice with named champion interactions, supplied ability names/cooldowns, and explicit IF/WHEN/AFTER decision rules. Do not invent facts.',
    ].join('\n');
    const rewritten=await callCoachModel(system,rewriteUser);
    if(!rewritten)return parsed;
    const safe=completeCoach(sanitizeCoach(rewritten,enemies,fallback),userRole,enemies);
    return evaluateWinConditionPlan({plan:safe,ours,enemies,kits,rank,role:userRole}).score>=firstQuality.score?safe:parsed;
  }catch(error){
    console.warn('[draft-coach] AI fallback',error);
    return null;
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
    const ours=dedupe(input.ours);
    const enemies=dedupe(input.enemies);
    const champion=clean(input.champion);
    const userRole=role(input.role)||role(ours.find(player=>player.champion.toLowerCase()===champion.toLowerCase())?.role);
    if(ours.length<3||enemies.length<3)return NextResponse.json({ok:false,error:'Not enough of the draft is resolved yet.'},{status:202});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({ok:false,error:'Draft coach is unavailable.'},{status:503});
    const paid=await paidStrategy(db,device.userId);
    if(!paid)return NextResponse.json({ok:false,error:'PLUS or PRO is required for the full draft coach.'},{status:403});

    const fallback=completeCoach(ruleFallback(champion,userRole,ours,enemies),userRole,enemies);
    const [context,kits]=await Promise.all([
      playerContext(db,device),
      kitFacts([...ours,...enemies]),
    ]);
    const ai=ours.length>=4&&enemies.length===5?await aiCoach(champion,userRole,ours,enemies,fallback,context.rank,context.mission,kits):null;
    const coach=completeCoach(ai??fallback,userRole,enemies);
    const quality=evaluateWinConditionPlan({plan:coach,ours,enemies,kits,rank:context.rank,role:userRole});
    return NextResponse.json({
      ok:true,
      ready:true,
      source:ai?'ai':'rules',
      coach,
      coachQuality:{score:quality.score,pass:quality.pass,issues:quality.issues,groundedKits:kits.length,rank:context.rank,tier:quality.tier},
      draft:{ours:names(ours),enemies:names(enemies)},
    });
  }catch(error){
    console.error('[draft-coach] request failed',error);
    return NextResponse.json({ok:false,error:'The draft coach could not build this plan.'},{status:400});
  }
}
