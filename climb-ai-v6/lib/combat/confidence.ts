/**
 * Confidence ratings for a simulation.
 *
 * Every number the engine produces arrives with a list of things it could not
 * model. This turns that list into a rating and a sentence a player can read,
 * so a figure is never shown without its own caveat attached.
 *
 * The ratings are deliberately asymmetric. A missing champion-specific mechanic
 * is worse than a missing generic one, because the player knows their champion
 * has it and a total that quietly omits it is actively misleading — they will
 * trust the number and lose the fight. An approximation in timing is mild by
 * comparison: it makes a duration slightly wrong, not a kill threshold wrong.
 *
 * WHY REASONS ARE MATCHED ON THEIR TEXT
 * The producers — formula.ts, damage.ts, combos.ts — emit human sentences
 * rather than codes, because those sentences are shown to players and a code
 * would need translating back anyway. That couples this file to their wording,
 * which is a real cost, so `classify` is exhaustively tested against every
 * phrasing the engine can emit and an unrecognised reason is never silently
 * treated as harmless.
 */

export type ConfidenceLevel='HIGH'|'MEDIUM'|'LOW'|'PARTIAL';

export type ConfidenceCategory=
  /** Needs live game state: stacks, buffs, timers. Not fixable from files. */
  |'LIVE_STATE'
  /** A gap in this engine: an unmapped stat or an unimplemented part type. */
  |'ENGINE_GAP'
  /** The source files did not carry a value the formula referenced. */
  |'MISSING_DATA'
  /** A simplification made knowingly, such as the timing floor. */
  |'APPROXIMATION'
  /** A step that could not be performed at all. */
  |'BLOCKED'
  /** Recognised as a reason but not as any of the above. */
  |'UNCLASSIFIED';

export interface ConfidenceCause{
  category:ConfidenceCategory;
  reason:string;
}

export interface ConfidenceReport{
  level:ConfidenceLevel;
  /** One sentence naming the rating and why it is not HIGH. */
  summary:string;
  causes:ConfidenceCause[];
  /**
   * True when a displayed total omits something, so it is a lower bound. The UI
   * must not print such a figure as though it were the whole amount.
   */
  totalIsFloor:boolean;
}

export interface ConfidenceInput{
  /** Reasons from evaluation and mitigation. */
  unmodelled?:string[];
  /** Reasons a combo step could not be performed. */
  blocked?:string[];
  /** Simplifications the caller knows it made. */
  approximations?:string[];
}

/**
 * Patterns matched against the reasons the engine emits. Each is paired with
 * the module that produces it so the two stay findable together.
 */
const PATTERNS:{test:RegExp;category:ConfidenceCategory}[]=[
  // formula.ts — live game state
  {test:/buff stacks/i,category:'LIVE_STATE'},
  {test:/buff condition/i,category:'LIVE_STATE'},
  {test:/how long a buff has been running/i,category:'LIVE_STATE'},

  // formula.ts — gaps in this engine
  {test:/scales with stat #\d+/i,category:'ENGINE_GAP'},
  {test:/is not modelled yet/i,category:'ENGINE_GAP'},
  {test:/no type Riot published a name for/i,category:'ENGINE_GAP'},
  {test:/references a stat in a form/i,category:'ENGINE_GAP'},
  {test:/nested too deeply/i,category:'ENGINE_GAP'},

  // formula.ts — data the files did not carry
  // Matches both 'is missing' and 'are missing' — the endpoint reason uses the
  // plural and slipped through a stricter pattern, which is precisely the
  // failure the exhaustive test in confidence.test.ts exists to catch.
  {test:/missing from this spell/i,category:'MISSING_DATA'},
  {test:/was not found on this spell/i,category:'MISSING_DATA'},
  {test:/does not cover this level/i,category:'MISSING_DATA'},
  {test:/has no formula parts/i,category:'MISSING_DATA'},
  {test:/did not expose two endpoints/i,category:'MISSING_DATA'},
  {test:/missing its start or end value/i,category:'MISSING_DATA'},
  {test:/breakpoints could not be read/i,category:'MISSING_DATA'},
  {test:/were not supplied to the evaluator/i,category:'MISSING_DATA'},
  {test:/has no index/i,category:'MISSING_DATA'},

  // damage.ts
  {test:/No damage figure was available/i,category:'MISSING_DATA'},

  // combos.ts — blocked steps
  {test:/on cooldown/i,category:'BLOCKED'},
  {test:/costs \d/i,category:'BLOCKED'},
  {test:/not available at this level or rank/i,category:'BLOCKED'},
];

export function classify(reason:string):ConfidenceCategory{
  for(const {test,category} of PATTERNS)if(test.test(reason))return category;
  // Unrecognised reasons are NOT treated as harmless. An engine change that adds
  // a new reason should show up as reduced confidence, not vanish.
  return 'UNCLASSIFIED';
}

/** How much each category pulls the rating down. Highest wins. */
const SEVERITY:Record<ConfidenceCategory,number>={
  APPROXIMATION:1,
  BLOCKED:2,
  MISSING_DATA:3,
  ENGINE_GAP:3,
  UNCLASSIFIED:3,
  LIVE_STATE:4,
};

const LEVEL_FOR_SEVERITY:Record<number,ConfidenceLevel>={
  0:'HIGH',1:'MEDIUM',2:'MEDIUM',3:'LOW',4:'PARTIAL',
};

export function assessConfidence(input:ConfidenceInput):ConfidenceReport{
  const causes:ConfidenceCause[]=[];

  for(const reason of dedupe(input.unmodelled??[]))
    causes.push({category:classify(reason),reason});
  for(const reason of dedupe(input.blocked??[]))
    causes.push({category:'BLOCKED',reason});
  for(const reason of dedupe(input.approximations??[]))
    causes.push({category:'APPROXIMATION',reason});

  const severity=causes.reduce((worst,c)=>Math.max(worst,SEVERITY[c.category]),0);
  const level=LEVEL_FOR_SEVERITY[severity]??'LOW';

  // Only a missing damage figure makes a total a floor. A blocked step is a
  // correct answer about a combo that cannot happen, and an approximation in
  // timing does not touch the damage total at all.
  const totalIsFloor=causes.some(c=>
    c.category==='LIVE_STATE'||c.category==='ENGINE_GAP'
    ||c.category==='MISSING_DATA'||c.category==='UNCLASSIFIED');

  return {level,summary:summarise(level,causes),causes,totalIsFloor};
}

/** Merges several assessments, keeping the worst rating and every cause. */
export function combineConfidence(reports:ConfidenceReport[]):ConfidenceReport{
  if(!reports.length)return assessConfidence({});
  const causes:ConfidenceCause[]=[];
  const seen=new Set<string>();
  for(const report of reports)
    for(const cause of report.causes){
      const key=`${cause.category}:${cause.reason}`;
      if(seen.has(key))continue;
      seen.add(key);
      causes.push(cause);
    }

  const severity=causes.reduce((worst,c)=>Math.max(worst,SEVERITY[c.category]),0);
  const level=LEVEL_FOR_SEVERITY[severity]??'LOW';
  return {
    level,
    summary:summarise(level,causes),
    causes,
    totalIsFloor:reports.some(r=>r.totalIsFloor),
  };
}

const DESCRIPTION:Record<ConfidenceCategory,string>={
  LIVE_STATE:'depends on live game state',
  ENGINE_GAP:'is not modelled by this engine yet',
  MISSING_DATA:'is missing from the game files',
  APPROXIMATION:'is approximated',
  BLOCKED:'could not be performed',
  UNCLASSIFIED:'could not be categorised',
};

function summarise(level:ConfidenceLevel,causes:ConfidenceCause[]):string{
  if(!causes.length)
    return 'HIGH — every mechanic in this calculation was modelled from Riot\'s own data.';

  // The worst category is what set the rating, so it is what gets named.
  const worst=causes.reduce((a,b)=>SEVERITY[b.category]>SEVERITY[a.category]?b:a);
  const sameCategory=causes.filter(c=>c.category===worst.category);
  const others=causes.length-sameCategory.length;

  const head=`${level} — ${sameCategory.length} ${sameCategory.length===1?'mechanic':'mechanics'} ${DESCRIPTION[worst.category]}`;
  const tail=others>0?`, plus ${others} further ${others===1?'caveat':'caveats'}`:'';
  const first=sameCategory[0].reason;

  return `${head}${tail}. ${first}`;
}

const dedupe=(reasons:string[])=>[...new Set(reasons.filter(r=>typeof r==='string'&&r.trim()))];
