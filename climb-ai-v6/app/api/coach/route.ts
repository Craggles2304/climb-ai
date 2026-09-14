import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';

const taskSchema=z.object({title:z.string(),category:z.string(),metric:z.string(),progress:z.number(),target:z.string(),gameRule:z.string()});
const recentSchema=z.object({games:z.number(),csPerMin:z.number().optional(),laneCsPerMin:z.number().optional(),post15CsPerMin:z.number().optional(),deaths:z.number().optional(),deathsPost20:z.number().optional(),objectiveParticipation:z.number().optional(),damageShare:z.number().optional(),killParticipation:z.number().optional(),visionScore:z.number().optional(),secondItemMinute:z.number().optional()});
const schema=z.object({
  message:z.string().min(1).max(1500),
  context:z.object({rank:z.string().optional(),role:z.string().optional(),mission:z.string().optional(),champions:z.array(z.string()).max(10).optional(),activeTasks:z.array(taskSchema).max(5).optional(),recent:recentSchema.optional()}).optional()
});

type ReviewEvent={game_time:number|string;event_type:string;opponent:string|null;confidence:string;headline:string;detail:string;evidence:Record<string,unknown>|null;created_at:string};
type CoachSuggestion={title:string;category:string;why:string;gameRule:string;metric:string;target:string;source:'COACH';priority:number};

export async function POST(req:Request){
  try{
    const {message,context}=schema.parse(await req.json());
    const user=await getCurrentUser();
    const evidence=user?await recentEvidence(user.id):[];
    const selected=selectEvidence(message,evidence);
    if(selected){
      return NextResponse.json({answer:answerFromEvidence(selected,context?.mission),grounding:'recorded-live-telemetry',factsUsed:['game_time','opponent','visible_item_value','level_delta','player_current_gold','confidence'],evidence:selected});
    }

    const coached=answerFromProfile(message,context);
    return NextResponse.json(coached);
  }catch(error){
    console.error('[coach] request failed',error);
    return NextResponse.json({error:'That Coach message could not be processed.'},{status:400});
  }
}

function answerFromProfile(message:string,context:z.infer<typeof schema>['context']){
  const q=message.toLowerCase();
  const recent=context?.recent;
  const tasks=context?.activeTasks||[];
  const primary=tasks[0];
  const role=String(context?.role||'PLAYER').toUpperCase();
  const champions=context?.champions||[];
  const facts:string[]=[];
  const stat=(label:string,value:number|undefined,suffix='')=>{if(typeof value==='number'){facts.push(`${label} ${value.toFixed(suffix==='%'?0:1)}${suffix}`);return value}return undefined};

  if(/learning plan|ilp|my plan|missions|tasks/.test(q)){
    const plan=tasks.length?tasks.map((t,i)=>`${i+1}. ${t.title} — ${t.progress}% · ${t.target}`).join('\n'):'No active missions are loaded yet.';
    return{answer:`Your active development ladder is:\n${plan}\n\nThe plan is capped at five. Match evidence can master a task and promote a replacement; a Coach recommendation can revise an existing behaviour or replace the lowest-priority active track.`,grounding:'ilp-and-profile',factsUsed:['active_ilp_tasks']};
  }

  if(/cs|farm|wave|after lane|economy/.test(q)){
    const lane=stat('lane CS/min',recent?.laneCsPerMin);const post=stat('post-15 CS/min',recent?.post15CsPerMin);const total=stat('CS/min',recent?.csPerMin);
    const detail=typeof lane==='number'&&typeof post==='number'?`Your recent lane rate is ${lane.toFixed(1)} CS/min and your post-15 rate is ${post.toFixed(1)}. ${post+0.6<lane?'The bigger leak is the hand-off after lane, not basic last-hitting.':'The farm drop after lane is not clearly larger than your lane baseline, so protect the whole economy rather than forcing a post-lane diagnosis.'}`:typeof total==='number'?`Your recent total farm is ${total.toFixed(1)} CS/min. I do not have enough split-lane evidence to pretend I know exactly where it falls away.`:'I do not have enough farm telemetry yet to diagnose the exact phase.';
    const suggestion:CoachSuggestion={title:'Decide the final wave before objective setup',category:'TEMPO',why:'Farm only helps if it does not make you late to the next high-value play.',gameRule:'At 90 seconds before Dragon/Baron, choose your final wave, recall/spend if needed, then route to setup.',metric:'objectivePreparation',target:'3 correct reviewed setup decisions',source:'COACH',priority:88};
    return{answer:`${detail}\n\nFor your next game use one decision rule: objective timer → final safe wave → spend → move. Do not decide whether to rotate when the objective is already spawning.${primary?` This should support your current #1 mission, “${primary.title}”, rather than compete with it unless the evidence keeps pointing elsewhere.`:''}`,suggestion,grounding:recent?.games?'recent-match-summary+ilp':'profile+ilp',factsUsed:facts.length?facts:['active_ilp_tasks']};
  }

  if(/death|position|teamfight|spacing|fight/.test(q)){
    const deaths=stat('deaths/game',recent?.deaths);const late=stat('post-20 deaths',recent?.deathsPost20);
    const detail=typeof late==='number'?`You are averaging ${late.toFixed(1)} deaths after 20 minutes${typeof deaths==='number'?` inside ${deaths.toFixed(1)} total deaths/game`:''}. That is enough to treat late-fight survival as a real development signal, but not enough to claim every death was a spacing error.`:typeof deaths==='number'?`You are averaging ${deaths.toFixed(1)} deaths/game. I do not have the late-death split, so I will not pretend all of those are teamfight positioning mistakes.`:'I do not have enough death timing evidence yet.';
    const suggestion:CoachSuggestion={title:'Survive the first threat cycle',category:'TEAMFIGHTING',why:'Your damage window starts after the first reliable engage/assassin threat is committed, blocked or covered.',gameRule:'Before sustained DPS range, name the first threat that can reach you. Wait for it to commit, get blocked, or become covered by peel before stepping forward.',metric:'deathsPost20',target:'≤2 post-20 deaths in 3 of 5 games',source:'COACH',priority:94};
    return{answer:`${detail}\n\nNext-game cue: “What kills me first?” If you cannot answer that before the fight, you are not ready to enter. Once that threat is spent, convert the safety into continuous damage on the closest safe target.`,suggestion,grounding:recent?.games?'recent-match-summary+ilp':'profile+ilp',factsUsed:facts.length?facts:['role','active_ilp_tasks']};
  }

  if(/objective|dragon|baron|tempo|rotate|rotation/.test(q)){
    const obj=stat('objective involvement',typeof recent?.objectiveParticipation==='number'?recent.objectiveParticipation*100:undefined,'%');
    const suggestion:CoachSuggestion=role==='JUNGLE'?{title:'Arrive set before neutral objectives',category:'OBJECTIVES',why:'Objective control is created before the monster is started.',gameRule:'Recall, spend and move to the correct side before the final setup window. Do not arrive with unspent gold or uncleared access routes.',metric:'objectiveParticipation',target:'70%+ objective involvement across 3 games',source:'COACH',priority:95}:{title:'Decide the final wave before objective setup',category:'TEMPO',why:'Most late rotations begin with a wave decision made too late.',gameRule:'At 90 seconds before Dragon/Baron, decide your final wave and route. If the wave makes setup late, leave it.',metric:'objectivePreparation',target:'3 correct reviewed setup decisions',source:'COACH',priority:90};
    return{answer:`${typeof obj==='number'?`Recent objective involvement is ${Math.round(obj)}%. `:''}The correction is earlier than the objective fight itself. Make the recall/wave/route decision before the map becomes urgent. ${role==='JUNGLE'?'Your route should finish on the side of the next neutral objective, not wherever the last low-probability play happened.':'Your last wave is part of objective setup; it is not a separate job.'}`,suggestion,grounding:recent?.games?'recent-match-summary+ilp':'profile+ilp',factsUsed:facts.length?facts:['role','active_ilp_tasks']};
  }

  if(/vision|ward|support/.test(q)&&role==='SUPPORT'){
    const vision=stat('vision score',recent?.visionScore);
    const suggestion:CoachSuggestion={title:'Own the next objective vision cycle',category:'VISION',why:'Vision matters when it changes how safely the enemy can enter the next objective area.',gameRule:'Reset early enough to ward the next objective, then leave dark space before you become the pick.',metric:'visionScore',target:'40+ vision score in 3 of 5 games',source:'COACH',priority:94};
    return{answer:`${typeof vision==='number'?`Your recent vision score is ${vision.toFixed(0)} per game. `:''}Do not treat “ward more” as the goal. The goal is to create the next objective information cycle without donating your own life to place it.`,suggestion,grounding:recent?.games?'recent-match-summary+ilp':'profile+ilp',factsUsed:facts.length?facts:['role']};
  }

  if(/item|recall|spike|power spike|build/.test(q)){
    const item=stat('second item minute',recent?.secondItemMinute);
    const suggestion:CoachSuggestion={title:'Protect your second-item timing',category:'RECALL_TIMING',why:'Build strength only matters if your recalls, deaths and wave decisions let you reach the breakpoint on time.',gameRule:'Before every recall, identify the purchase you are completing and the next wave you can safely collect.',metric:'secondItemMinute',target:'Second item by 23:00 in 3 of 5 relevant games',source:'COACH',priority:82};
    return{answer:`${typeof item==='number'?`Your recent second-item timing is ${item.toFixed(1)} minutes. `:''}Do not separate “what item should I buy?” from “did I reach the item on time?” OP CLIMB should coach the breakpoint and the path that created it.`,suggestion,grounding:recent?.games?'recent-match-summary+ilp':'profile+ilp',factsUsed:facts.length?facts:['role','rank']};
  }

  if(/plat|platinum|emerald|diamond|climb|rank|next rank/.test(q)){
    const weakest=tasks.length?[...tasks].sort((a,b)=>a.progress-b.progress)[0]:undefined;
    return{answer:`For ${context?.rank||'your current rank'} ${role}, the next rank is not one new trick. It is making your highest-cost repeated decision boringly reliable.${weakest?` Your least-complete active track is “${weakest.title}” at ${weakest.progress}%. Start there: ${weakest.gameRule}`:primary?` Your current priority is “${primary.title}”: ${primary.gameRule}`:' Play tracked games first so the plan can stop guessing.'}\n\nDo not add another concept until that behaviour has real match evidence.`,grounding:'ilp-and-profile',factsUsed:['rank','role','active_ilp_tasks']};
  }

  const champion=champions.find(c=>q.includes(c.toLowerCase()));
  if(champion){
    return{answer:`For ${champion}, I want the champion advice tied to your development plan rather than a generic guide. ${primary?`Your #1 behaviour is “${primary.title}”. In your next ${champion} game, use this cue: ${primary.gameRule}`:'Track a game first so I can connect the champion to an actual leak.'}\n\nAsk me about lane, farm, teamfights, objective setup, recalls or a specific timestamp and I will narrow it to a measurable decision.`,grounding:'champion+ilp',factsUsed:['champion_pool','active_ilp_tasks']};
  }

  return{answer:`I am coaching ${role} from your current development plan, not answering League trivia in isolation. ${primary?`Your #1 track is “${primary.title}” at ${primary.progress}%. Next-game cue: ${primary.gameRule}`:'I need tracked match evidence to build the first priority.'}\n\nAsk about a death, farm drop, objective setup, recall/item timing, teamfight, champion, or a recorded timestamp.`,grounding:'profile+ilp',factsUsed:['role','rank','active_ilp_tasks']};
}

async function recentEvidence(userId:string):Promise<ReviewEvent[]>{
  const db=getSupabaseAdmin();if(!db)return [];
  const {data,error}=await db.from('live_review_events').select('game_time,event_type,opponent,confidence,headline,detail,evidence,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(40);
  if(error){console.error('[coach] evidence read failed',error);return []}
  return(data??[]) as ReviewEvent[];
}

function selectEvidence(message:string,events:ReviewEvent[]):ReviewEvent|null{
  if(!events.length)return null;
  const q=message.toLowerCase();const requested=requestedSeconds(q);const opponentMatches=events.filter(event=>event.opponent&&q.includes(event.opponent.toLowerCase()));let candidates=opponentMatches.length?opponentMatches:events;
  if(/kill|all.?in|fight|strong|power|item|gold|could/.test(q)){const fight=candidates.filter(event=>['ALL_IN_CANDIDATE','PRESSURE_WINDOW','CAUTION_WINDOW'].includes(event.event_type));if(fight.length)candidates=fight}
  if(requested!==null)return candidates.reduce((best,current)=>Math.abs(Number(current.game_time)-requested)<Math.abs(Number(best.game_time)-requested)?current:best);
  if(opponentMatches.length)return candidates[0]??null;
  if(/latest|last|recent|fight|kill|all.?in|strong|power|item|gold|could/.test(q))return candidates[0]??null;
  return null;
}

function answerFromEvidence(event:ReviewEvent,mission?:string){
  const e=event.evidence??{};const level=numberOf(e.levelDelta);const items=numberOf(e.itemGoldDelta);const pocket=numberOf(e.currentGold);const limitation=typeof e.limitation==='string'?e.limitation:'The tracker does not know exact enemy pocket gold, exact proximity or hidden cooldowns.';const facts:string[]=[];
  if(level!==null&&level!==0)facts.push(`${level>0?'+':''}${level} level${Math.abs(level)===1?'':'s'}`);if(items!==null)facts.push(`${items>0?'+':''}${Math.round(items)}g in visible item value`);if(pocket!==null)facts.push(`${Math.round(pocket)}g in your pocket`);
  const clock=formatClock(Number(event.game_time));const opponent=event.opponent||'the enemy';const verdict=event.event_type==='ALL_IN_CANDIDATE'?`At ${clock}, OVERPOWERED flagged a possible all-in window against ${opponent}.`:event.event_type==='PRESSURE_WINDOW'?`At ${clock}, you had a visible power advantage against ${opponent}.`:`At ${clock}, the visible state favoured ${opponent}, so forcing the fight was high risk.`;const missionLine=mission?` For your ILP, compare this with your current mission: ${mission}.`:'';
  return`${verdict}${facts.length?` The recorded evidence was ${facts.join(', ')}.`:''} ${event.detail} Confidence: ${event.confidence}. ${limitation}${missionLine}`;
}

function requestedSeconds(text:string){const clock=/\b(\d{1,2}):([0-5]\d)\b/.exec(text);if(clock)return Number(clock[1])*60+Number(clock[2]);const minute=/\b(\d{1,2})(?:\s*min(?:ute)?s?)\b/.exec(text);return minute?Number(minute[1])*60:null}
function numberOf(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
