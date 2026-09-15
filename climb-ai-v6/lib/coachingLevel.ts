export type CoachingTier='IRON'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'EMERALD'|'DIAMOND'|'MASTER'|'GRANDMASTER'|'CHALLENGER';

export interface CoachingLevel{
  tier:CoachingTier;
  depth:number;
  answerWords:number;
  visiblePoints:number;
  reviewPoints:number;
  summary:string;
  instruction:string;
}

const LEVELS:Record<CoachingTier,Omit<CoachingLevel,'tier'>>={
  IRON:{depth:1,answerWords:55,visiblePoints:1,reviewPoints:1,summary:'One problem. One reason. One thing to do.',instruction:'Use extremely simple language. Give one problem, one short reason, and one action for the next game. Avoid jargon, branches, theory dumps and extra alternatives.'},
  BRONZE:{depth:2,answerWords:75,visiblePoints:2,reviewPoints:1,summary:'Simple correction with a clear why.',instruction:'Keep it simple. Explain the main mistake, why it matters, and one next-game correction. Use at most two coaching points.'},
  SILVER:{depth:3,answerWords:95,visiblePoints:3,reviewPoints:2,summary:'Core coaching with a little more context.',instruction:'Give the mistake, cause, useful timing or example, and the next-game cue. Introduce basic League terminology only when it helps.'},
  GOLD:{depth:4,answerWords:120,visiblePoints:3,reviewPoints:2,summary:'Patterns and basic macro without overload.',instruction:'Add repeat patterns and basic macro context such as waves, recalls, rotations and objective setup, but keep the answer focused on one decision.'},
  PLATINUM:{depth:5,answerWords:145,visiblePoints:3,reviewPoints:2,summary:'Tempo, waves and decision sequences.',instruction:'Use intermediate detail: tempo, wave state, objective timing, positioning and short decision sequences. Explain what should happen before the visible mistake.'},
  EMERALD:{depth:6,answerWords:170,visiblePoints:4,reviewPoints:3,summary:'Advanced patterns and trade-offs.',instruction:'Use advanced but practical analysis: multi-game patterns, matchup states, trade-offs and opportunity cost. Keep a clear priority and do not drown the player in possibilities.'},
  DIAMOND:{depth:7,answerWords:210,visiblePoints:4,reviewPoints:3,summary:'Detailed sequencing and situational alternatives.',instruction:'Use detailed macro/micro interaction, thresholds, sequencing and situational alternatives. Separate the root decision from the mechanical outcome.'},
  MASTER:{depth:8,answerWords:250,visiblePoints:5,reviewPoints:3,summary:'Fine margins and role-specific optimisation.',instruction:'Coach fine margins: sequencing, tempo windows, role-specific optimisation, resource trade-offs and repeatable decision rules. Be precise.'},
  GRANDMASTER:{depth:9,answerWords:290,visiblePoints:5,reviewPoints:3,summary:'Elite game-state branches and team interactions.',instruction:'Use elite-level analysis with game-state branches, opponent and team interactions, map trades and alternative lines. Still finish with one clear priority.'},
  CHALLENGER:{depth:10,answerWords:330,visiblePoints:5,reviewPoints:3,summary:'Maximum depth and nuanced optimisation.',instruction:'Use maximum useful depth: nuanced alternatives, edge cases, high-level optimisation, information states, tempo and team interactions. Do not add complexity unless the supplied evidence supports it.'},
};

export function coachingTierFor(rank?:string|null):CoachingTier{
  const value=String(rank||'').trim().toUpperCase();
  if(value.includes('CHALLENGER'))return'CHALLENGER';
  if(value.includes('GRANDMASTER'))return'GRANDMASTER';
  if(value.includes('MASTER'))return'MASTER';
  if(value.includes('DIAMOND'))return'DIAMOND';
  if(value.includes('EMERALD'))return'EMERALD';
  if(value.includes('PLATINUM'))return'PLATINUM';
  if(value.includes('GOLD'))return'GOLD';
  if(value.includes('SILVER'))return'SILVER';
  if(value.includes('BRONZE'))return'BRONZE';
  if(value.includes('IRON'))return'IRON';
  return'SILVER';
}

export function coachingLevelFor(rank?:string|null):CoachingLevel{
  const tier=coachingTierFor(rank);
  return{tier,...LEVELS[tier]};
}

export function rankCoachingInstruction(rank?:string|null){
  const level=coachingLevelFor(rank);
  return`The player is ${String(rank||level.tier)}. Present this as ${level.tier} COACH depth ${level.depth}/10. ${level.instruction} Keep the answer to roughly ${level.answerWords} words or fewer unless the player explicitly asks for more detail.`;
}

export function clampCoachText(text:string,rank?:string|null){
  const level=coachingLevelFor(rank);
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return clean;
  const words=clean.split(' ');
  if(words.length<=level.answerWords)return clean;
  return`${words.slice(0,level.answerWords).join(' ').replace(/[,:;]$/,'')}…`;
}
