import type {DecisionBehaviourKey} from './decisionTwin';
import {METRIC_SPECS} from './metrics';
import {missionMeasurementSource} from './missionGrading';

/**
 * Plain-English "how is this judged?" copy for the Climb Plan skills and the
 * Missions page. Each entry mirrors the real scoring code so the player sees
 * exactly what OP CLIMB checks:
 * - skills: lib/decisionGraph.ts (fight + metric verdicts, 75+ GOOD / <60 IMPROVE)
 *   and lib/scenarioMemory.ts (one verdict per game; any IMPROVE moment wins)
 * - missions: lib/missionGrading.ts (stat vs target, or 0-100 decision score vs target)
 * Keep these in step with that code when the scoring changes.
 */
export type HowJudged={
  /** What OP CLIMB looks at during the game. */
  watches:string;
  /** What makes a game count as clean. */
  clean:string;
  /** What makes a game count as needs work. */
  miss:string;
  /** When a game does not count either way. */
  skipped:string;
};

export const SKILL_JUDGING:Record<DecisionBehaviourKey,HowJudged>={
  FIGHT_SELECTION:{
    watches:'Every fight you are in, and who had the stronger levels and items when it started.',
    clean:'You do not die in any fight where the enemy was already stronger.',
    miss:'You die in a fight you took while behind on levels or items.',
    skipped:'You were not in any fights that could be judged.',
  },
  DEATH_RECOVERY:{
    watches:'What you do in the 90 seconds after each death.',
    clean:'No second death within 90 seconds, and you collect farm before fighting again.',
    miss:'You die again within 90 seconds of a previous death.',
    skipped:'You did not die, so there was nothing to recover from.',
  },
  LEAD_PROTECTION:{
    watches:'Fights where you were the stronger side on levels or items.',
    clean:'You do not die in fights where you were ahead.',
    miss:'You die in a fight where you were the stronger side.',
    skipped:'You were never clearly ahead going into a fight.',
  },
  RESET_DISCIPLINE:{
    watches:'How much unspent gold you carry into fights.',
    clean:'You recall and spend first: no deaths while holding 1,200+ gold.',
    miss:'You die holding 1,200+ gold that has not been turned into items.',
    skipped:'Almost every game counts for this one.',
  },
  OBJECTIVE_READINESS:{
    watches:'The moments around Dragon, Baron, Herald and towers.',
    clean:'You are alive, healthy and have spent your gold when those objectives are taken.',
    miss:'You die just before an objective, or arrive still holding a lot of unspent gold.',
    skipped:'No major objective was taken during the game.',
  },
  FARM_VS_SETUP:{
    watches:'How much farm you collect in fight-heavy minutes compared with quiet minutes.',
    clean:'You connect to fights without your farm collapsing around them.',
    miss:'Your farm drops sharply whenever fights happen, or you arrive late to them.',
    skipped:'Needs Riot\'s match timeline. If it is not available, the game does not count.',
  },
  THREAT_ADAPTATION:{
    watches:'The enemy who kills you most, and every fight against them after the first time they kill you.',
    clean:'You survive at least 3 in 4 of those later fights (score 75+).',
    miss:'You keep dying to the same enemy (score under 60).',
    skipped:'No enemy killed you twice, or there were not enough fights against them after the first death.',
  },
  CARRY_PRESERVATION:{
    watches:'Your deaths while you are one of your team\'s two richest players by items.',
    clean:'You stay alive in fights while you are carrying your team\'s gold.',
    miss:'You die while you are one of your team\'s top two in item value.',
    skipped:'Almost every game counts for this one.',
  },
  POWER_SPIKE_CONVERSION:{
    watches:'The 2 minutes after you finish a big item or reach a key level.',
    clean:'You turn the spike into a good fight (a kill, assist or objective) within 2 minutes.',
    miss:'The spike passes with no good fight, or you die during it.',
    skipped:'You did not complete a major item or level spike.',
  },
  SURVIVAL_VALUE:{
    watches:'Deaths that cost your team the most: holding a big bank, while you are a carry, or just before an objective.',
    clean:'You avoid those costly deaths.',
    miss:'You die at one of those costly moments.',
    skipped:'Almost every game counts for this one.',
  },
};

export const SKILL_JUDGING_FOOTER='One result per game: clean, needs work, or did not count. If the same game has both good and bad moments for this skill, it counts as needs work. Games that did not count never move your progress.';

export function skillJudging(behaviourKey:string|null|undefined):HowJudged|null{
  const key=String(behaviourKey||'').toUpperCase() as DecisionBehaviourKey;
  return SKILL_JUDGING[key]??null;
}

/** What each decision-score mission metric (0-100) is built from. */
const DECISION_METRIC_MEANING:Record<string,string>={
  fight_selection:'how often you avoided dying in fights where the enemy was already stronger',
  death_control:'your deaths, weighted more heavily for thrown leads and repeat deaths',
  cs_curve:'how steady your farm is at 5, 10 and 15 minutes, not just the final CS/min',
  unspent_gold:'fights and deaths while holding 1,200+ unspent gold',
  red_state_fights:'deaths taken while the enemy already had stronger levels or items',
  chain_deaths:'second deaths within 90 seconds of a previous death',
  thrown_advantage:'deaths in fights where you were the stronger side',
  underdog_conversion:'good results from fights where you started weaker',
  fight_conversion:'how often being stronger turned into a kill or objective instead of a death',
  resource_conversion:'whether you spent your gold on items before fights',
  lead_protection:'whether you kept your advantages instead of dying while ahead',
  power_spike_conversion:'whether a big item or level spike led to a good fight within 2 minutes',
  reset_quality:'whether you recalled and spent before fighting with a big bank',
  objective_readiness:'whether you were alive, healthy and had spent your gold when objectives were taken',
  farm_fight_tradeoff:'how much farm you lose in fight-heavy minutes compared with quiet ones',
  repeat_threat:'whether one enemy killed you over and over',
  opponent_adaptation:'how often you survived fights against the enemy who had already killed you',
  item_timing_diff:'how your item timings compare with your lane opponent',
  build_response:'whether your items answered the enemy who was killing you',
  damage_efficiency:'your damage per minute, share of team damage and damage per gold',
  survival_value:'whether you avoided the deaths that cost your team most',
  carry_preservation:'deaths while you were one of your team\'s two richest players',
};

export type MissionJudging={measures:string;pass:string;doesNotCount:string};

export function missionJudging(task:{metric:string;target:string;masteryRequired?:number},plainSuccess?:string|null):MissionJudging{
  const metric=String(task.metric||'');
  const required=Math.max(1,Number(task.masteryRequired)||3);
  const source=missionMeasurementSource(metric);
  const spec=(METRIC_SPECS as Record<string,{label:string}|undefined>)[metric];
  const pass=(plainSuccess||task.target||'').trim().replace(/\s*·\s*\d+\s+proven games?$/i,'');
  const measures=spec
    ?`Your ${spec.label} in each tracked game.`
    :DECISION_METRIC_MEANING[metric]
      ?`A 0–100 score after each tracked game, based on ${DECISION_METRIC_MEANING[metric]}.`
      :'A 0–100 score after each tracked game, from the fights and moments the Companion recorded.';
  const doesNotCount=source==='RIOT_POST_GAME'
    ?'Needs Riot\'s official match data after the game. If it is not available yet, the game does not count.'
    :source==='LIVE_MEASURABLE'
      ?'Measured by the Companion during your game. Games it did not record do not count.'
      :'If the situation never came up in a game, that game does not count either way.';
  return{
    measures,
    pass:pass?`${pass}. You need ${required} passing game${required===1?'':'s'} to complete it.`:`Hit the target in ${required} tracked game${required===1?'':'s'}.`,
    doesNotCount,
  };
}
