import type {DecisionBehaviourKey} from './decisionTwin';
import type {CurriculumPhase} from './climbCurriculum';

export type ClimbRepLevel=1|2|3|4|5;
export type ClimbRepStage='RECOGNISE'|'EXECUTE'|'STABILISE'|'ADAPT'|'TRANSFER';

export interface ClimbRepLadder{
  version:1;
  level:ClimbRepLevel;
  maxLevel:5;
  stage:ClimbRepStage;
  label:string;
  objective:string;
  difficultyRule:string;
  promotionGate:string;
  demotionRule:string;
  reason:string;
  evidence:string;
}

export interface ClimbRepEvidence{
  behaviourKey:DecisionBehaviourKey;
  phase:CurriculumPhase;
  comparableGames:number;
  cleanStreak:number;
  memoryStrength:number|null;
  transferGames:number;
  transferCleanStreak:number;
  transferStrength:number|null;
}

const STAGES:Record<ClimbRepLevel,{stage:ClimbRepStage;label:string;objective:string;difficultyRule:string;promotionGate:string}>={
  1:{
    stage:'RECOGNISE',
    label:'Recognise the decision',
    objective:'Identify the trigger early enough to choose deliberately instead of reacting after the mistake has started.',
    difficultyRule:'ONE CLEAR TRIGGER · ONE CLEAN BRANCH · NO EXTRA COMPLEXITY.',
    promotionGate:'At least 3 comparable verified games and evidence that the correct branch has started to appear.',
  },
  2:{
    stage:'EXECUTE',
    label:'Execute the branch',
    objective:'Make the correct decision when the familiar trigger appears, without needing the game to become obvious first.',
    difficultyRule:'EXECUTE THE TARGET BRANCH ON THE FIRST VERIFIED COMPARABLE WINDOW.',
    promotionGate:'At least 2 consecutive clean comparable decisions with stable memory evidence.',
  },
  3:{
    stage:'STABILISE',
    label:'Stabilise under repetition',
    objective:'Repeat the correct branch across multiple comparable windows so the behaviour survives pressure and repetition.',
    difficultyRule:'THE FIRST CLEAN REP IS NOT ENOUGH · HOLD THE BRANCH ACROSS EVERY COMPARABLE WINDOW.',
    promotionGate:'Local mastery: 3+ clean comparable decisions, 80%+ recent execution and a mastered Scenario Memory.',
  },
  4:{
    stage:'ADAPT',
    label:'Adapt when the cue changes',
    objective:'Keep the principle while the enemy angle, timing, composition cue or game state changes.',
    difficultyRule:'THE SURFACE CUE MAY CHANGE · PRESERVE THE PRINCIPLE AND CHANGE THE EXECUTION.',
    promotionGate:'Repeated clean novel tests with meaningful transfer evidence; one novel success cannot advance the ladder.',
  },
  5:{
    stage:'TRANSFER',
    label:'Transfer the principle',
    objective:'Execute the learned principle in genuinely novel champion or context conditions without depending on the original cue.',
    difficultyRule:'SOLVE THE PRINCIPLE, NOT THE MEMORISED SCENARIO.',
    promotionGate:'Repeated novel evidence across breadth until Decision Transfer reaches principle-owned status.',
  },
};

const BOUNDARY='CLIMB Rep Ladder changes difficulty only from repeated verified evidence. One clean game cannot raise the difficulty, an unobserved mission cannot raise or lower it, and verified regression can deliberately reduce difficulty before complexity is added again.';

function levelFor(input:ClimbRepEvidence):ClimbRepLevel{
  if(input.phase==='GRADUATED')return 5;
  if(input.phase==='REOPEN')return 2;
  if(input.phase==='TRANSFER'){
    if(input.transferGames>=2&&(input.transferStrength??0)>=65&&input.transferCleanStreak>=1)return 5;
    return 4;
  }
  if(input.phase==='STABILISE')return 3;
  if(input.phase==='PRACTISE'){
    if(input.comparableGames>=3&&input.cleanStreak>=2&&(input.memoryStrength??0)>=60)return 3;
    if(input.comparableGames>=3&&input.cleanStreak>=1)return 2;
    return 1;
  }
  return 1;
}

export function buildClimbRepLadder(input:ClimbRepEvidence):ClimbRepLadder{
  const level=levelFor(input);
  const stage=STAGES[level];
  const reason=input.phase==='REOPEN'
    ?'Verified comparable mistakes returned after prior progress, so OP CLIMB has reduced the difficulty to rebuild clean execution before adding complexity again.'
    :level===1
      ?'The decision is not yet supported by enough repeated clean evidence to add execution complexity.'
      :level===2
        ?'The trigger is now recognised in repeated evidence; the next job is reliably executing the correct branch.'
        :level===3
          ?'Clean execution has started to repeat, so OP CLIMB is testing whether the branch stays stable across multiple comparable windows.'
          :level===4
            ?'Local execution is mastered. OP CLIMB can now change the cue and test whether the player adapts without losing the principle.'
            :'Transfer evidence is strong enough to make the task genuinely novel; the player must now solve the principle beyond the original cue.';
  const evidence=[
    String(input.comparableGames)+' comparable games',
    String(input.cleanStreak)+' clean local streak',
    input.memoryStrength===null?'memory building':String(input.memoryStrength)+'/100 memory',
    input.transferGames?String(input.transferGames)+' transfer games':'no transfer games yet',
    input.transferStrength===null?'transfer not active':String(input.transferStrength)+'/100 transfer',
  ].join(' · ');
  return{
    version:1,
    level,
    maxLevel:5,
    stage:stage.stage,
    label:stage.label,
    objective:stage.objective,
    difficultyRule:stage.difficultyRule,
    promotionGate:stage.promotionGate,
    demotionRule:'If repeated comparable IMPROVE evidence returns, reduce difficulty to the last stable layer before asking for harder transfer.',
    reason,
    evidence,
  };
}

export const CLIMB_REP_LADDER_BOUNDARY=BOUNDARY;
