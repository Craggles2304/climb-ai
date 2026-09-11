import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';

const schema=z.object({
  message:z.string().min(1).max(1500),
  context:z.object({rank:z.string().optional(),role:z.string().optional(),mission:z.string().optional()}).optional()
});

type ReviewEvent={
  game_time:number|string;
  event_type:string;
  opponent:string|null;
  confidence:string;
  headline:string;
  detail:string;
  evidence:Record<string,unknown>|null;
  created_at:string;
};

export async function POST(req:Request){
  try{
    const {message,context}=schema.parse(await req.json());
    const user=await getCurrentUser();
    const evidence=user?await recentEvidence(user.id):[];
    const selected=selectEvidence(message,evidence);
    if(selected){
      return NextResponse.json({
        answer:answerFromEvidence(selected,context?.mission),
        grounding:'recorded-live-telemetry',
        factsUsed:['game_time','opponent','visible_item_value','level_delta','player_current_gold','confidence'],
        evidence:selected,
      });
    }

    const q=message.toLowerCase();
    let answer=evidence.length
      ?'I have recorded match evidence, but none of the saved power windows match that question closely enough. Ask about a timestamp, opponent, or the latest fight window.'
      :'I do not have enough reliable tracked data to answer that precisely. Record a match with the Live Tracker first.';
    if(/plat|platinum|rank/.test(q)) answer=`Use one measurable leak at a time. ${context?.mission?`Your current mission is ${context.mission}. `:''}Do not add a second coaching target until the current one has been tested across relevant games.`;
    else if(/complete|done|finished/.test(q)) answer='I will not mark a mission mastered from chat alone. Record the next relevant match and I will evaluate the evidence against its pass condition.';
    else if(/cs|farm|resource|after lane/.test(q)) answer='Use the tracked match evidence to identify where your resource collection changes after lane. The next step is to compare that behaviour across multiple recorded games rather than guess from one result.';
    return NextResponse.json({answer,grounding:evidence.length?'tracked-history-no-direct-match':'profile-only',factsUsed:evidence.length?['recent_live_review_events']:['profile','active_mission']});
  }catch{
    return NextResponse.json({error:'That Coach message could not be processed.'},{status:400});
  }
}

async function recentEvidence(userId:string):Promise<ReviewEvent[]>{
  const db=getSupabaseAdmin();
  if(!db)return [];
  const {data,error}=await db.from('live_review_events')
    .select('game_time,event_type,opponent,confidence,headline,detail,evidence,created_at')
    .eq('user_id',userId).order('created_at',{ascending:false}).limit(40);
  if(error){console.error('[coach] evidence read failed',error);return []}
  return (data??[]) as ReviewEvent[];
}

function selectEvidence(message:string,events:ReviewEvent[]):ReviewEvent|null{
  if(!events.length)return null;
  const q=message.toLowerCase();
  const requested=requestedSeconds(q);
  const opponentMatches=events.filter(event=>event.opponent&&q.includes(event.opponent.toLowerCase()));
  let candidates=opponentMatches.length?opponentMatches:events;
  if(/kill|all.?in|fight|strong|power|item|gold|could/.test(q)){
    const fight=candidates.filter(event=>['ALL_IN_CANDIDATE','PRESSURE_WINDOW','CAUTION_WINDOW'].includes(event.event_type));
    if(fight.length)candidates=fight;
  }
  if(requested!==null){
    return candidates.reduce((best,current)=>Math.abs(Number(current.game_time)-requested)<Math.abs(Number(best.game_time)-requested)?current:best);
  }
  if(opponentMatches.length)return candidates[0]??null;
  if(/latest|last|recent|fight|kill|all.?in|strong|power|item|gold|could/.test(q))return candidates[0]??null;
  return null;
}

function answerFromEvidence(event:ReviewEvent,mission?:string){
  const e=event.evidence??{};
  const level=numberOf(e.levelDelta);
  const items=numberOf(e.itemGoldDelta);
  const pocket=numberOf(e.currentGold);
  const limitation=typeof e.limitation==='string'?e.limitation:'The tracker does not know exact enemy pocket gold, exact proximity or hidden cooldowns.';
  const facts:string[]=[];
  if(level!==null&&level!==0)facts.push(`${level>0?'+':''}${level} level${Math.abs(level)===1?'':'s'}`);
  if(items!==null)facts.push(`${items>0?'+':''}${Math.round(items)}g in visible item value`);
  if(pocket!==null)facts.push(`${Math.round(pocket)}g in your pocket`);
  const clock=formatClock(Number(event.game_time));
  const opponent=event.opponent||'the enemy';
  const verdict=event.event_type==='ALL_IN_CANDIDATE'
    ?`At ${clock}, OVERPOWERED flagged a possible all-in window against ${opponent}.`
    :event.event_type==='PRESSURE_WINDOW'
      ?`At ${clock}, you had a visible power advantage against ${opponent}.`
      :`At ${clock}, the visible state favoured ${opponent}, so forcing the fight was high risk.`;
  const missionLine=mission?` For your ILP, compare this with your current mission: ${mission}.`:'';
  return `${verdict}${facts.length?` The recorded evidence was ${facts.join(', ')}.`:''} ${event.detail} Confidence: ${event.confidence}. ${limitation}${missionLine}`;
}

function requestedSeconds(text:string){
  const clock=/\b(\d{1,2}):([0-5]\d)\b/.exec(text);
  if(clock)return Number(clock[1])*60+Number(clock[2]);
  const minute=/\b(\d{1,2})(?:\s*min(?:ute)?s?)\b/.exec(text);
  return minute?Number(minute[1])*60:null;
}
function numberOf(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
