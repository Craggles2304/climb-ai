export type CoachingTier='IRON'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'EMERALD'|'DIAMOND'|'MASTER'|'GRANDMASTER'|'CHALLENGER';

export interface CoachingLevel{
  tier:CoachingTier;
  depth:number;
  answerWords:number;
  visiblePoints:number;
  reviewPoints:number;
  summary:string;
  instruction:string;
  language:string;
}

const LEVELS:Record<CoachingTier,Omit<CoachingLevel,'tier'>>={
  IRON:{depth:1,answerWords:55,visiblePoints:1,reviewPoints:1,summary:'One problem. One reason. One thing to do.',instruction:'Use extremely simple language. Give one problem, one short reason, and one action for the next game. Avoid jargon, branches, theory dumps and extra alternatives.',language:'Use everyday words and basic game words only. Say damage, important spell, teammates in front, move back, safe target, minion wave, recall, dragon or tower. Do not use access, tempo, priority, rotation, resource, trade-off, opportunity cost, threshold, sequencing, front edge, first contact or information state.'},
  BRONZE:{depth:2,answerWords:75,visiblePoints:2,reviewPoints:1,summary:'Simple correction with a clear why.',instruction:'Keep it simple. Explain the main mistake, why it matters, and one next-game correction. Use at most two coaching points.',language:'Use short sentences and familiar League words. Cooldown and engage are okay if obvious from context, but prefer spell down and go in. Avoid abstract coaching terms such as access, tempo, priority, resource trade-off, opportunity cost, threshold and information state.'},
  SILVER:{depth:3,answerWords:95,visiblePoints:3,reviewPoints:2,summary:'Core coaching with a little more context.',instruction:'Give the mistake, cause, useful timing or example, and the next-game cue. Introduce basic League terminology only when it helps.',language:'Basic League terms are fine: cooldown, engage, peel, kite, wave, recall and objective. Explain less common terms in plain English. Do not use tempo, opportunity cost, decision threshold, resource trade-off or information state.'},
  GOLD:{depth:4,answerWords:120,visiblePoints:3,reviewPoints:2,summary:'Patterns and basic macro without overload.',instruction:'Add repeat patterns and basic macro context such as waves, recalls, rotations and objective setup, but keep the answer focused on one decision.',language:'Use normal ranked League language: wave, recall, rotation, objective setup, flank, engage and priority. Keep sentences direct. Avoid elite abstraction such as opportunity cost, decision threshold, resource trade-off, option value and information state.'},
  PLATINUM:{depth:5,answerWords:145,visiblePoints:3,reviewPoints:2,summary:'Tempo, waves and decision sequences.',instruction:'Use intermediate detail: tempo, wave state, objective timing, positioning and short decision sequences. Explain what should happen before the visible mistake.',language:'Standard coaching vocabulary is fine: tempo, wave state, priority, spacing, positioning and sequencing. Prefer concrete instructions over theory language.'},
  EMERALD:{depth:6,answerWords:170,visiblePoints:4,reviewPoints:3,summary:'Advanced patterns and trade-offs.',instruction:'Use advanced but practical analysis: multi-game patterns, matchup states, trade-offs and opportunity cost. Keep a clear priority and do not drown the player in possibilities.',language:'Advanced practical vocabulary is fine, including opportunity cost, trade-offs, matchup state and tempo. Define an unusual concept through the game action rather than sounding academic.'},
  DIAMOND:{depth:7,answerWords:210,visiblePoints:4,reviewPoints:3,summary:'Detailed sequencing and situational alternatives.',instruction:'Use detailed macro/micro interaction, thresholds, sequencing and situational alternatives. Separate the root decision from the mechanical outcome.',language:'Use precise high-level League terminology: thresholds, sequencing, access, resource use, priority and situational alternatives. Stay concise rather than academic.'},
  MASTER:{depth:8,answerWords:250,visiblePoints:5,reviewPoints:3,summary:'Fine margins and role-specific optimisation.',instruction:'Coach fine margins: sequencing, tempo windows, role-specific optimisation, resource trade-offs and repeatable decision rules. Be precise.',language:'Full high-Elo coaching vocabulary is appropriate. Use terms such as tempo window, access chain, resource trade-off and decision threshold when they make the decision more precise.'},
  GRANDMASTER:{depth:9,answerWords:290,visiblePoints:5,reviewPoints:3,summary:'Elite game-state branches and team interactions.',instruction:'Use elite-level analysis with game-state branches, opponent and team interactions, map trades and alternative lines. Still finish with one clear priority.',language:'Use elite shorthand naturally: map trade, second access, resource exchange, conditional line and information advantage. Do not explain standard high-Elo terminology unless asked.'},
  CHALLENGER:{depth:10,answerWords:330,visiblePoints:5,reviewPoints:3,summary:'Maximum depth and nuanced optimisation.',instruction:'Use maximum useful depth: nuanced alternatives, edge cases, high-level optimisation, information states, tempo and team interactions. Do not add complexity unless the supplied evidence supports it.',language:'Use concise elite/pro-level vocabulary where useful: information state, option value, tempo, access layers, map trade, resource exchange and edge-case branches. Precision matters more than explaining basic terminology.'},
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
  return`The player is ${String(rank||level.tier)}. Present this as ${level.tier} COACH depth ${level.depth}/10. ${level.instruction} LANGUAGE LEVEL: ${level.language} Keep the answer to roughly ${level.answerWords} words or fewer unless the player explicitly asks for more detail.`;
}

export function clampCoachText(text:string,rank?:string|null){
  const level=coachingLevelFor(rank);
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return clean;
  const words=clean.split(' ');
  if(words.length<=level.answerWords)return clean;
  return`${words.slice(0,level.answerWords).join(' ').replace(/[,:;]$/,'')}…`;
}
