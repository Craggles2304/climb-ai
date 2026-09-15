import type {ChampionDetail,ChampionListEntry} from './ddragon';
import {matchupRead,type Edge,type MatchupRead} from './matchup';
import {championProfile} from './profile';

export type LivePlanEdge='YOU'|'THEM'|'EVEN';

export interface LivePowerSpike{
  level:number;
  edge:LivePlanEdge;
  label:string;
  fight:string;
  createLead:string;
  avoid:string;
  facts:string[];
}

export interface LaneDuelPlan{
  headline:string;
  advantage:string;
  yourPattern:string;
  theirPattern:string;
  killWindow:string;
  wave:string;
  never:string;
}

export interface LiveMatchupPlan{
  version:1;
  generatedAt:string;
  patch:string;
  role:string|null;
  you:{name:string};
  them:{name:string};
  laneEdge:{edge:LivePlanEdge;label:string;summary:string};
  laneDuel:LaneDuelPlan;
  winCondition:string[];
  powerSpikes:LivePowerSpike[];
  leadPlan:{create:string[];convert:string[];protect:string[]};
  trades:{safe:string[];pressure:string[];avoid:string[]};
  itemPlan:{ahead:string[];even:string[];behind:string[]};
  states:{ahead:string[];even:string[];behind:string[]};
  rules:string[];
  riotTips:string[];
  caveat:string;
}

const LEVELS=[1,2,3,6,9,11,16] as const;

export function buildLiveMatchupPlan(input:{
  you:ChampionDetail;
  them:ChampionDetail;
  roster:Record<string,ChampionListEntry>;
  patch:string;
  role?:string|null;
}):LiveMatchupPlan{
  const {you,them,roster,patch}=input;
  const mine=championProfile(you,roster);
  const theirs=championProfile(them,roster);
  const reads=LEVELS.map(level=>matchupRead(you,them,{level,roster}));
  const levelSix=reads.find(read=>read.level===6)??reads[0];
  const laneEdge=edgeFromRead(levelSix);
  const rangeFact=levelSix.facts.find(f=>f.key==='attackRange');
  const durabilityFact=levelSix.facts.find(f=>f.key==='effectiveHp');
  const scalingLine=levelSix.howToPlayIt.find(line=>/strongest|surviving|mid-game|later/i.test(line));
  const enemyUlt=levelSix.facts.find(f=>f.key==='ultimate');
  const rangeDelta=Math.round(you.stats.attackrange-them.stats.attackrange);
  const yourUlt=you.spells?.[3]?.name||'your ultimate';
  const enemyTip=theirs.riotEnemyTips[0]?.trim();

  const winCondition=unique([
    rangeFact?.edge==='YOU'
      ?`Turn your range advantage into an HP lead first. Do not spend the advantage by walking into ${them.name}'s preferred range.`
      :rangeFact?.edge==='THEM'
        ?`Do not donate HP trying to trade from ${them.name}'s range. Create your opening with wave cover, a missed ability or a cooldown window.`
        :`This lane is not decided by free auto range. Create the first advantage through wave position, cooldowns and cleaner trade exits.`,
    scalingLine,
    laneEdge==='YOU'
      ?`Your static level-6 profile has more favourable tools. Convert that into wave control and the first clean recall rather than gambling it on a kill.`
      :laneEdge==='THEM'
        ?`${them.name}'s static level-6 profile is more favourable. Your win condition is to arrive at your own spikes with HP and farm intact, then fight from a created advantage.`
        :`The measured level-6 tools are close. The player who creates HP, wave or item tempo first should control the next interaction.`,
  ]).slice(0,4);

  const powerSpikes=reads.map(read=>powerSpike(read,mine.spikes,theirs.spikes));

  const create=unique([
    rangeFact?.note,
    ...levelSix.howToPlayIt.slice(0,3),
    `Think of the lead as a chain: favourable trade → HP advantage → wave control → cleaner recall → item tempo. You do not need a kill for the lane to be won.`,
  ]).slice(0,5);

  const convert=unique([
    `If ${them.name} has to recall first, finish the wave cleanly before you leave. The objective is to return with a better purchase and keep the next wave playable for you.`,
    `When you gain HP or item tempo, make ${them.name} pay for touching the wave. Take guaranteed farm denial and plates before a low-percentage chase.`,
    `After a successful trade, reset your spacing. A lead only matters if you keep enough health to use it on the next wave.`,
  ]);

  const protect=unique([
    `Once ahead, stop offering the exact all-in ${them.name} wants. Force them to cross your preferred range or wave state to reach you.`,
    enemyUlt?.note,
    `If your wave is bad or your key spell is unavailable, protect the lead instead of proving you are ahead in every fight.`,
  ]);

  const safeTrades=unique([
    rangeDelta>=25
      ?`You have about ${rangeDelta} more basic-attack range. Hit ${them.name} as they step up for a last hit, then leave before the trade becomes extended.`
      :rangeDelta<=-25
        ?`${them.name} has about ${Math.abs(rangeDelta)} more basic-attack range. Use their last-hit animation, a missed ability or your minion wave as the trigger instead of walking into free damage.`
        :`Keep the trade short unless you have already created an HP, cooldown or wave advantage.`,
    mine.lanePlan[0],
  ]).slice(0,3);

  const pressureTrades=unique([
    ...levelSix.howToPlayIt.slice(0,3),
    enemyUlt?.note,
  ]).slice(0,4);

  const avoidTrades=unique([
    rangeFact?.edge==='THEM'?rangeFact.note:null,
    durabilityFact?.edge==='THEM'?durabilityFact.note:null,
    enemyTip,
    `Do not turn a small poke win into an extended fight just because ${them.name} is lower HP. Re-check wave, cooldowns and escape space first.`,
  ]).slice(0,4);

  const laneDuel:LaneDuelPlan={
    headline:`HOW TO BEAT ${them.name.toUpperCase()}`,
    advantage:rangeDelta>=25
      ?`${you.name}: +${rangeDelta} AA range. Make ${them.name} pay HP for last-hitting.`
      :rangeDelta<=-25
        ?`${them.name}: +${Math.abs(rangeDelta)} AA range. Do not start the lane by trading autos on their terms.`
        :`Auto ranges are close. The lane is decided by who creates the first HP, cooldown or wave edge.`,
    yourPattern:rangeDelta>=25
      ?`LAST-HIT PUNISH → STEP OUT → REPEAT. Use your extra range for one clean hit, then reset before ${them.name} gets the extended trade.`
      :`WAIT FOR A TRIGGER → SHORT TRADE → RESET. Use a missed spell, last-hit animation or wave cover to start; do not neutral-walk into ${them.name}.`,
    theirPattern:enemyTip
      ?`${them.name}'s lane wants you to give them their preferred interaction. Key warning: ${enemyTip}`
      :`${them.name} wants you to stay in the trade after your first advantage disappears. Their best lane is an extended fight from an even state.`,
    killWindow:`CREATE HP FIRST → THEN COMMIT. Your clean kill attempt is after ${them.name} is already lower, has spent a key spell, or is trapped by the wave; at level 6, ${yourUlt} makes that created advantage much easier to convert.`,
    wave:rangeDelta>=25
      ?`Keep the wave playable enough that ${them.name} must step into your attack range for CS. Do not auto-shove every wave and remove the space you need to punish last hits.`
      :rangeDelta<=-25
        ?`Keep the wave closer to your side when possible so ${them.name} cannot use the longer lane to chase after a range poke. Use minions as cover before you trade.`
        :`Use wave position to create the long retreat for ${them.name}. A good wave makes your short trade safe and their return trade awkward.`,
    never:avoidTrades[0]||`Never begin a full-health extended fight from an even wave just because ${them.name} is in range. Create one advantage first.`,
  };

  const itemPlan={
    ahead:[
      `When your first meaningful component is completed before ${them.name}'s, use the purchase to control the next wave and deny a free equalising recall.`,
      `Spend before the next planned fight. Gold in inventory is not a power spike until it becomes stats.`,
    ],
    even:[
      `At equal items, follow the level and range plan rather than assuming the purchase alone changed the matchup.`,
      `A clean recall that preserves the wave is more valuable than staying for one extra wave and entering the next fight with unspent gold.`,
    ],
    behind:[
      `If ${them.name} completes a major purchase first, shorten the lane: collect safe CS, avoid neutral all-ins and wait for your next level/item breakpoint.`,
      `A defensive component is successful if it prevents the second death and keeps you in XP range; it does not have to maximise damage immediately.`,
    ],
  };

  const states={
    ahead:[
      `Make the lane smaller for ${them.name}: keep the wave in a place where they must expose themselves to farm.`,
      `Convert HP pressure into farm denial, plates or the first move. Do not make a kill the only definition of success.`,
      `Your biggest throw condition is giving ${them.name} a clean engage while you are overextended or sitting on unspent gold.`,
    ],
    even:[
      `Manufacture the first edge through spacing, wave timing and a cooldown advantage.`,
      `Choose the level spike below where your measured tools improve, then preserve HP so that spike is actually usable.`,
      `If nothing is available, take the guaranteed CS and keep the lane even. Even is a valid state when your later profile improves.`,
    ],
    behind:[
      `Stop contesting neutral fights. Make ${them.name} spend time or cooldowns to reach you before you trade back.`,
      `Prioritise XP and the next affordable component. One stable reset is often worth more than trying to win the deficit back in one fight.`,
      `Your recovery objective is to prevent the next death, reach the next spike and make the opponent prove they can convert their lead.`,
    ],
  };

  const rules=unique([
    laneDuel.yourPattern,
    powerSpikes.find(spike=>spike.level===6)?.fight,
    protect[0],
    ...levelSix.howToPlayIt,
  ]).slice(0,3);

  return{
    version:1,
    generatedAt:new Date().toISOString(),
    patch,
    role:normalizeRole(input.role),
    you:{name:you.name},
    them:{name:them.name},
    laneEdge:{edge:laneEdge,label:edgeLabel(laneEdge),summary:edgeSummary(laneEdge,you.name,them.name,rangeFact?.note)},
    laneDuel,
    winCondition,
    powerSpikes,
    leadPlan:{create,convert,protect},
    trades:{safe:safeTrades,pressure:pressureTrades,avoid:avoidTrades},
    itemPlan,
    states,
    rules,
    riotTips:theirs.riotEnemyTips.slice(0,3),
    caveat:'This is a precomputed matchup plan from Riot static champion data. It does not react to hidden cooldowns, enemy pocket gold, exact positioning or other live information, and it is not a win-rate claim.',
  };
}

function powerSpike(read:MatchupRead,mySpikes:{level:number;title:string;fact:string;inference?:string}[],theirSpikes:{level:number;title:string;fact:string;inference?:string}[]):LivePowerSpike{
  const edge=edgeFromRead(read);
  const mine=mySpikes.filter(spike=>spike.level===read.level);
  const theirs=theirSpikes.filter(spike=>spike.level===read.level);
  const keyFacts=read.facts
    .filter(fact=>fact.edge!=='EVEN'||['attackRange','ultimate'].includes(fact.key))
    .slice(0,3)
    .map(fact=>fact.note?`${fact.label}: ${fact.note}`:`${fact.label}: ${fact.you} vs ${fact.them}.`);
  const facts=unique([
    ...mine.map(spike=>`${spike.title}: ${spike.fact}${spike.inference?` ${spike.inference}`:''}`),
    ...theirs.map(spike=>`${read.them.name} spike — ${spike.title}: ${spike.fact}`),
    ...keyFacts,
  ]).slice(0,5);

  const fight=edge==='YOU'
    ?`This is a pressure level. Fight only after you have usable HP and wave space, then use the measured edge to take a short favourable trade before extending.`
    :edge==='THEM'
      ?`This is not a neutral all-in level for you. Make ${read.them.name} spend an ability, walk through your wave or lose HP before you commit.`
      :`This level is close on static tools. Create the advantage first — HP, cooldown, wave or item tempo — then take the fight.`;

  const createLead=edge==='YOU'
    ?`Use the level to win the next 1–2 waves: trade, force them off CS, then convert the pressure into the cleaner recall.`
    :edge==='THEM'
      ?`Your lead comes from denying their expected advantage: preserve HP, collect XP and punish the first overcommit instead of forcing the opener.`
      :`Build the lead through one repeatable edge: better spacing, first move on the wave, or a cooldown trade you can exit cleanly.`;

  const avoid=edge==='THEM'
    ?`Avoid matching ${read.them.name}'s preferred extended fight from an even state.`
    :`Avoid chasing past the point where your original advantage — range, wave or cooldown — still exists.`;

  return{level:read.level,edge,label:edgeLabel(edge),fight,createLead,avoid,facts};
}

function edgeFromRead(read:MatchupRead):Edge{
  let score=0;
  for(const fact of read.facts){
    const weight=fact.key==='attackRange'?2:fact.key==='effectiveHp'?1.25:fact.key==='ultimate'?1.15:1;
    if(fact.edge==='YOU')score+=weight;
    else if(fact.edge==='THEM')score-=weight;
  }
  if(score>=1.5)return'YOU';
  if(score<=-1.5)return'THEM';
  return'EVEN';
}

function edgeLabel(edge:Edge){
  if(edge==='YOU')return'YOUR TOOLS FAVOURABLE';
  if(edge==='THEM')return'THEIR TOOLS FAVOURABLE';
  return'CONTESTED / EVEN';
}

function edgeSummary(edge:Edge,you:string,them:string,rangeNote?:string){
  if(edge==='YOU')return`${you} has the more favourable measured static tools around level 6. ${rangeNote??'Convert the edge through clean trades and tempo rather than forcing a kill.'}`;
  if(edge==='THEM')return`${them} has the more favourable measured static tools around level 6. ${rangeNote??'Create a wave, cooldown or HP advantage before committing.'}`;
  return`Neither champion owns a large measured static edge around level 6. The first real HP, wave, cooldown or item advantage should decide who gets to pressure.`;
}

function normalizeRole(value?:string|null){
  const role=(value??'').trim().toUpperCase();
  if(!role||role==='NONE')return null;
  if(role==='BOTTOM'||role==='ADC')return'ADC';
  if(role==='UTILITY'||role==='SUPPORT')return'SUPPORT';
  if(role==='MIDDLE')return'MID';
  return role;
}

function unique(values:(string|null|undefined)[]){
  const seen=new Set<string>();
  const out:string[]=[];
  for(const value of values){
    const clean=(value??'').trim();
    if(!clean||seen.has(clean))continue;
    seen.add(clean);out.push(clean);
  }
  return out;
}
