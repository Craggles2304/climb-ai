import type {ChampionDetail,ChampionListEntry} from './ddragon';
import {championProfile} from './profile';
import type {LiveMatchupPlan,LivePowerSpike} from './liveMatchupPlan';

const LEVELS=[1,2,3,6,9,11,16] as const;

/**
 * Champion-only pregame plan. This is deliberately opponent-agnostic: it can be
 * shown the moment the local player locks a champion, then replaced by the
 * normal matchup plan once the lane opponent is resolved.
 */
export function buildChampionPowerPlan(input:{
  you:ChampionDetail;
  roster:Record<string,ChampionListEntry>;
  patch:string;
  role?:string|null;
}):LiveMatchupPlan{
  const {you,roster,patch}=input;
  const profile=championProfile(you,roster);
  const powerSpikes=LEVELS.map(level=>selfSpike(level,profile));
  const scaling=profile.scaling.map(read=>read.fact);
  const rangePlan=profile.lanePlan[0];
  const resourcePlan=profile.lanePlan[1];

  const winCondition=unique([
    rangePlan,
    resourcePlan,
    ...scaling,
    `Build the lane lead in stages: clean trade → HP or resource edge → wave control → better recall → item tempo. You do not need a kill for the lead to be real.`,
  ]).slice(0,4);

  const create=unique([
    rangePlan,
    resourcePlan,
    `Use your first level advantage, clean cooldown trade or range edge to make the opponent give up HP or CS before you ask for an all-in.`,
    `Treat level 6, your first ability max and later ultimate ranks as planned windows. Arrive at them with enough HP and mana/energy to actually use the spike.`,
  ]).slice(0,5);

  const convert=[
    `After a winning trade, use the HP edge to control the next wave. Do not throw the advantage away chasing a low-percentage kill.`,
    `If you force the first recall, crash or stabilise the wave before matching the reset so your gold advantage becomes an item advantage.`,
    `Spend before the next important fight. Gold in inventory is not a power spike until it becomes stats.`,
  ];

  const protect=[
    `Once ahead, protect the resource that created the lead: HP, wave position, cooldowns or item tempo.`,
    `Do not take a neutral extended fight just to prove you are stronger. Make the opponent walk into your preferred range or wave state.`,
    `If the wave is bad or your key spell is unavailable, keep the lead instead of gambling it.`,
  ];

  const safe=unique([
    profile.rangeClass==='LONG'
      ?`Start trades from the edge of your attack range and leave before the opponent can answer on equal terms.`
      :profile.rangeClass==='MELEE'
        ?`Use last-hit timings, your minion wave and missed enemy abilities to enter. A neutral walk into ranged pressure is not a safe trade.`
        :`Keep the first trade short enough that you can exit after using your range or cooldown advantage.`,
    rangePlan,
  ]).slice(0,3);

  const pressure=[
    `If you hit level 2 first, use the temporary level advantage before the opponent catches the same wave — pressure does not have to mean an all-in.`,
    `At level 6, look for a trade or fight only if you preserved enough HP/resources to use the new ultimate power.` ,
    `When a major cooldown is available and the wave gives you space to exit, turn that window into HP pressure or denied CS.`,
  ];

  const avoid=[
    `Do not force a fight simply because the level number changed. A spike only matters when your HP, resources, cooldowns and wave let you use it.`,
    `Do not convert a small poke win into a long chase after your original range, cooldown or wave advantage has disappeared.`,
    `Do not sit on a large amount of unspent gold and call yourself stronger — reset and buy first.`,
  ];

  const itemPlan={
    ahead:[
      `If you complete the first meaningful component, use it to control the next wave and deny a free equalising recall.`,
      `Spend the lead before the next planned fight; item tempo is the point of the earlier HP/wave advantage.`,
    ],
    even:[
      `At equal items, use your level breakpoints and champion identity rather than assuming the purchase alone created a fight window.`,
      `A clean recall that protects the wave is better than staying for one extra wave and entering the next fight with unspent gold.`,
    ],
    behind:[
      `If the opponent buys first, shorten the next interaction: collect safe XP/CS and wait for your next level or affordable component.`,
      `A defensive component is valuable if it prevents the second death and keeps you in XP range.`,
    ],
  };

  const states={
    ahead:[
      `Turn your lead into wave control, denied CS, plates or first move rather than making kills the only definition of success.`,
      `Make the opponent take the risky action. Your job is to preserve the conditions that make your champion strong.`,
      `Reset before a major fight if the lead is still sitting in your inventory as gold.`,
    ],
    even:[
      `Manufacture the first edge through spacing, wave timing, level timing or a cooldown trade you can exit cleanly.`,
      `Plan around the next power spike below and preserve enough HP/resources to use it.`,
      `If no clean window exists, take the guaranteed farm. Even is a valid state while you move toward a stronger breakpoint.`,
    ],
    behind:[
      `Stop contesting neutral fights. Prioritise XP, safe CS and the next affordable component.`,
      `Your first recovery objective is preventing the next death, not winning the entire deficit back in one play.`,
      `Reach the next champion breakpoint with usable HP, then reassess once OP CLIMB knows the actual matchup.`,
    ],
  };

  const rules=unique([
    powerSpikes.find(spike=>spike.level===2)?.fight,
    powerSpikes.find(spike=>spike.level===6)?.fight,
    protect[0],
  ]).slice(0,3);

  return {
    version:1,
    generatedAt:new Date().toISOString(),
    patch,
    role:normalizeRole(input.role),
    you:{name:you.name},
    them:{name:'OPPONENT TBD'},
    laneEdge:{
      edge:'EVEN',
      label:'YOUR POWER CURVE',
      summary:`${you.name} is locked. These are your own power, trade and lead windows before OP CLIMB knows the lane opponent. The screen will upgrade automatically when the matchup is resolved.`,
    },
    winCondition,
    powerSpikes,
    leadPlan:{create,convert,protect},
    trades:{safe,pressure,avoid},
    itemPlan,
    states,
    rules,
    riotTips:profile.riotAllyTips.slice(0,3),
    caveat:'Champion-only pregame plan from Riot static champion data. The opponent is not known yet, so matchup-specific advantages and danger windows are intentionally not claimed.',
  };
}

function selfSpike(level:number,profile:ReturnType<typeof championProfile>):LivePowerSpike{
  const exact=profile.spikes.filter(spike=>spike.level===level);
  const stats=profile.atLevel(level);
  const facts=unique([
    ...exact.flatMap(spike=>[`${spike.title}: ${spike.fact}`,spike.inference]),
    `Level ${level} base profile: ${Math.round(stats.hp)} HP, ${Math.round(stats.attackDamage)} attack damage, ${Math.round(stats.armor)} armour, ${Math.round(stats.magicResist)} magic resist.`,
  ]).slice(0,5);

  if(level===1){
    return {
      level,edge:'EVEN',label:'LANE SETUP',
      fight:profile.rangeClass==='LONG'
        ?`Use your natural range to build the first HP or CS edge. Do not turn free poke into a neutral extended fight.`
        :profile.rangeClass==='MELEE'
          ?`Protect HP while you establish the wave. Take level-1 fights only when the opponent has already given you an entry through the wave, range or a missed ability.`
          :`Establish your spacing and resource plan first. Look for a short trade you can exit cleanly rather than a blind all-in.`,
      createLead:`Your first lead is information and lane position: learn what space the opponent gives you, secure the first wave cleanly and make them pay for unsafe CS.`,
      avoid:`Avoid losing a large chunk of HP before the first level timing; that can make every later spike unusable.`,facts,
    };
  }
  if(level===2){
    return {
      level,edge:'EVEN',label:'FIRST TEMPO WINDOW',
      fight:`If you reach level 2 first, use the temporary level advantage immediately for pressure — a clean trade, denied CS or wave control — before the opponent reaches level 2 as well.`,
      createLead:`Prepare the wave so your level-up happens while you are close enough and healthy enough to act. Convert the timing into HP or tempo, not a forced kill.`,
      avoid:`Avoid walking through a bad wave or burning everything after the opponent has already matched level 2.`,facts,
    };
  }
  if(level===3){
    return {
      level,edge:'EVEN',label:'BASIC-KIT WINDOW',
      fight:`By level 3 you can normally access your basic-kit trade pattern. Look for the repeatable sequence you can enter and exit safely rather than improvising an extended fight.`,
      createLead:`Use the extra spell access to win one controlled exchange, then turn the resulting HP edge into wave control and the cleaner recall.`,
      avoid:`Skill order can vary by champion and game, so do not assume level 3 is automatically an all-in spike.`,facts,
    };
  }

  const spikeText=exact[0];
  const isUlt=level===6||level===11||level===16;
  return {
    level,edge:'EVEN',label:isUlt?'ULTIMATE POWER':'ABILITY POWER',
    fight:spikeText?.inference
      ?`${spikeText.inference} Treat this as a planned fight window only when your HP, resources and wave are usable.`
      :`This is a planned champion breakpoint. Create HP, cooldown, wave or item advantage first, then use the extra power.`,
    createLead:isUlt
      ?`Arrive at level ${level} without donating HP beforehand. Use the new ultimate rank to pressure the next wave or fight from a prepared state.`
      :`Use this breakpoint to win the next one or two waves, then convert the pressure into a cleaner recall or denied farm.`,
    avoid:`Avoid forcing immediately on the level-up if the wave, HP or resources are already against you. The breakpoint does not erase a bad state.`,facts,
  };
}

function normalizeRole(value?:string|null){
  const role=(value??'').trim().toUpperCase();
  if(!role||role==='NONE')return null;
  if(role==='BOTTOM'||role==='ADC')return 'ADC';
  if(role==='UTILITY'||role==='SUPPORT')return 'SUPPORT';
  if(role==='MIDDLE')return 'MID';
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
