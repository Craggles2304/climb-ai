export type GameStateRead='AHEAD'|'EVEN'|'BEHIND';
export type GameReadStatus='SUPPORTED'|'REVIEW'|'NOT_VERIFIABLE';
export type GameReadProfile='BUILDING'|'WELL_CALIBRATED'|'AGGRESSIVE_BIAS'|'CAUTIOUS_BIAS'|'MIXED';

export interface LiveReadCheckpoint{
  id?:string|null;
  checkpointMinute:number;
  gameSeconds:number;
  stateRead:GameStateRead;
  threatRead:string|null;
  priorityRead:string|null;
  createdAt?:string|null;
}

export interface GameReadCalibrationItem{
  checkpointMinute:number;
  gameSeconds:number;
  stateRead:GameStateRead;
  actualState:GameStateRead|null;
  status:GameReadStatus;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  distanceSeconds:number|null;
  threatRead:string|null;
  priorityRead:string|null;
  title:string;
  proof:string;
}

export interface GameReadCalibrationReview{
  version:1;
  active:boolean;
  totalReads:number;
  gradedReads:number;
  supportedReads:number;
  reviewReads:number;
  notVerifiable:number;
  supportRate:number|null;
  profile:GameReadProfile;
  overreadAdvantage:number;
  missedStrongWindow:number;
  underestimatedDeficit:number;
  overcautious:number;
  items:GameReadCalibrationItem[];
  headline:string;
  nextFocus:string;
  boundary:string;
}

type StrengthPoint={atSeconds?:number|null;verdict?:string|null;label?:string|null;headline?:string|null;score?:number|null};

const expected:Record<GameStateRead,string>={AHEAD:'YOU_STRONGER',EVEN:'EVEN',BEHIND:'THEM_STRONGER'};

function upper(value:unknown){return String(value??'').trim().toUpperCase()}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function stateFromVerdict(value:unknown):GameStateRead|null{
  const verdict=upper(value);
  return verdict==='YOU_STRONGER'?'AHEAD':verdict==='THEM_STRONGER'?'BEHIND':verdict==='EVEN'?'EVEN':null;
}
function nearest(points:StrengthPoint[],seconds:number){
  let best:StrengthPoint|null=null,distance=Number.POSITIVE_INFINITY;
  for(const point of points){
    const at=finite(point?.atSeconds);if(at===null)continue;
    const diff=Math.abs(at-seconds);
    if(diff<distance){best=point;distance=diff}
  }
  return best&&distance<=100?{point:best,distance}:null;
}
function proof(point:StrengthPoint,distance:number){
  const label=String(point?.headline||point?.label||point?.verdict||'visible state').trim();
  const score=finite(point?.score);
  return label+(score===null?'':' · score '+Math.round(score))+' · '+Math.round(distance)+'s from your read';
}

export function buildGameReadCalibration(input:{reads?:LiveReadCheckpoint[]|null;points?:StrengthPoint[]|null}):GameReadCalibrationReview{
  const reads=(input.reads??[]).filter(read=>['AHEAD','EVEN','BEHIND'].includes(upper(read.stateRead))).slice(-12);
  const points=input.points??[];
  const items:GameReadCalibrationItem[]=reads.map(read=>{
    const state=upper(read.stateRead) as GameStateRead;
    const match=nearest(points,Number(read.gameSeconds)||Number(read.checkpointMinute)*60);
    if(!match){
      return{
        checkpointMinute:Number(read.checkpointMinute),gameSeconds:Number(read.gameSeconds),stateRead:state,actualState:null,status:'NOT_VERIFIABLE',
        confidence:'LOW',distanceSeconds:null,threatRead:read.threatRead??null,priorityRead:read.priorityRead??null,
        title:state+' READ RECORDED · NOT GRADED',
        proof:'No close-enough recorded visible-state comparison was available. OP CLIMB keeps the read without inventing a verdict.',
      };
    }
    const actual=stateFromVerdict(match.point?.verdict);
    if(!actual){
      return{
        checkpointMinute:Number(read.checkpointMinute),gameSeconds:Number(read.gameSeconds),stateRead:state,actualState:null,status:'NOT_VERIFIABLE',
        confidence:'LOW',distanceSeconds:match.distance,threatRead:read.threatRead??null,priorityRead:read.priorityRead??null,
        title:state+' READ RECORDED · NOT GRADED',proof:'The closest recorded point did not contain a gradeable visible-state verdict.',
      };
    }
    const supported=expected[state]===upper(match.point?.verdict);
    return{
      checkpointMinute:Number(read.checkpointMinute),gameSeconds:Number(read.gameSeconds),stateRead:state,actualState:actual,
      status:supported?'SUPPORTED':'REVIEW',confidence:match.distance<=45?'HIGH':'MEDIUM',distanceSeconds:match.distance,
      threatRead:read.threatRead??null,priorityRead:read.priorityRead??null,
      title:supported?state+' READ SUPPORTED':state+' READ NEEDS REVIEW',
      proof:proof(match.point,match.distance),
    };
  });

  const graded=items.filter(item=>item.status!=='NOT_VERIFIABLE');
  const supported=graded.filter(item=>item.status==='SUPPORTED').length;
  let overreadAdvantage=0,missedStrongWindow=0,underestimatedDeficit=0,overcautious=0;
  for(const item of graded.filter(item=>item.status==='REVIEW')){
    if(item.stateRead==='AHEAD'&&(item.actualState==='EVEN'||item.actualState==='BEHIND'))overreadAdvantage+=1;
    if((item.stateRead==='EVEN'||item.stateRead==='BEHIND')&&item.actualState==='AHEAD')missedStrongWindow+=1;
    if((item.stateRead==='AHEAD'||item.stateRead==='EVEN')&&item.actualState==='BEHIND')underestimatedDeficit+=1;
    if(item.stateRead==='BEHIND'&&item.actualState==='EVEN')overcautious+=1;
  }
  const supportRate=graded.length?Math.round(supported/graded.length*100):null;
  const aggressive=overreadAdvantage+underestimatedDeficit;
  const cautious=missedStrongWindow+overcautious;
  const profile:GameReadProfile=
    graded.length<2?'BUILDING':
    supportRate!==null&&supportRate>=67?'WELL_CALIBRATED':
    aggressive>cautious?'AGGRESSIVE_BIAS':
    cautious>aggressive?'CAUTIOUS_BIAS':'MIXED';

  const nextFocus=
    profile==='WELL_CALIBRATED'?'KEEP MAKING THE READ BEFORE THE PLAN. THE NEXT TEST SHOULD INCREASE DIFFICULTY OR FADE SUPPORT.':
    profile==='AGGRESSIVE_BIAS'?'SLOW THE STATE READ DOWN: VERIFY WHETHER YOUR ADVANTAGE IS REAL BEFORE USING THE AHEAD BRANCH.':
    profile==='CAUTIOUS_BIAS'?'LOOK FOR YOUR STRONGER WINDOW EARLIER: DO NOT DEFAULT TO EVEN/BEHIND WHEN THE VISIBLE STATE FAVOURS YOU.':
    profile==='MIXED'?'KEEP THE 5/10/15 READ CHECKS. THE ERROR DIRECTION IS NOT STABLE ENOUGH TO LABEL YET.':
    'BUILD MORE VERIFIED CHECKPOINTS BEFORE OP CLIMB LABELS A GAME-READ PATTERN.';

  return{
    version:1,active:items.length>0,totalReads:items.length,gradedReads:graded.length,supportedReads:supported,
    reviewReads:graded.length-supported,notVerifiable:items.length-graded.length,supportRate,profile,
    overreadAdvantage,missedStrongWindow,underestimatedDeficit,overcautious,items,
    headline:graded.length?String(supported)+'/'+String(graded.length)+' GAME-STATE READS SUPPORTED':String(items.length)+' GAME-STATE READ'+(items.length===1?'':'S')+' RECORDED · NONE GRADED',
    nextFocus,
    boundary:'READ CALIBRATION USES ONLY PLAYER-FROZEN CHECKPOINTS AND THE CLOSEST RECORDED VISIBLE-STATE EVIDENCE. THREAT AND PRIORITY ANSWERS ARE PRESERVED AS REFLECTION DATA UNLESS A FUTURE EVIDENCE MODEL CAN VERIFY THEM.',
  };
}
