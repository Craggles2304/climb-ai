import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {answerClimbIntentProbe,publicClimbIntentProbe,type ClimbIntentProbe} from '@/lib/climbIntentGap';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  probeId:z.string().min(1).max(320),
  optionId:z.string().min(1).max(8),
});

function recentEnough(value:unknown){
  const at=Date.parse(String(value??''));
  return Number.isFinite(at)&&Date.now()-at<=35*60_000;
}

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-intent-probe'),20,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many intent-probe requests.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  try{
    const input=schema.parse(await req.json());
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({ok:false,error:'Intent Gap is unavailable.'},{status:503});

    const {data,error}=await db.from('live_pregame_contexts')
      .select('id,context,last_seen_at,started_at')
      .eq('device_id',device.id)
      .eq('user_id',device.userId)
      .order('started_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error||!data?.id||!recentEnough(data.last_seen_at||data.started_at)){
      return NextResponse.json({ok:false,error:'No active frozen pre-game context was found.'},{status:409});
    }

    const context=(data.context&&typeof data.context==='object')?data.context as any:{};
    const deepCoach=(context.deepCoach&&typeof context.deepCoach==='object')?context.deepCoach as any:null;
    const probe=deepCoach?.intentProbe as ClimbIntentProbe|undefined;
    if(!probe||probe.version!==1||probe.id!==input.probeId){
      return NextResponse.json({ok:false,error:'This Intent Gap probe is no longer the active frozen probe.'},{status:409});
    }

    const answered=probe.response
      ?probe
      :answerClimbIntentProbe(probe,input.optionId,new Date().toISOString());
    if(probe.response&&probe.response.selectedOptionId!==input.optionId.toUpperCase()){
      return NextResponse.json({ok:false,error:'Intent Gap answer is already frozen and cannot be changed.'},{status:409});
    }

    const nextDeepCoach={...deepCoach,intentProbe:answered};
    const nextContext={...context,deepCoach:nextDeepCoach};
    const {error:updateError}=await db.from('live_pregame_contexts').update({context:nextContext}).eq('id',data.id);
    if(updateError)throw new Error(updateError.message);

    const {data:deviceRow}=await db.from('live_tracker_devices').select('pregame_context').eq('id',device.id).maybeSingle();
    if(deviceRow?.pregame_context&&typeof deviceRow.pregame_context==='object'){
      const deviceContext=deviceRow.pregame_context as any;
      const deviceDeep=(deviceContext.deepCoach&&typeof deviceContext.deepCoach==='object')?deviceContext.deepCoach:{};
      await db.from('live_tracker_devices').update({
        pregame_context:{...deviceContext,deepCoach:{...deviceDeep,intentProbe:answered}},
        pregame_updated_at:new Date().toISOString(),
      }).eq('id',device.id);
    }

    return NextResponse.json({
      ok:true,
      frozen:true,
      probe:publicClimbIntentProbe(answered),
      intentCorrect:answered.response?.correct??null,
    });
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({ok:false,error:'Invalid Intent Gap answer.'},{status:400});
    console.error('[intent-probe] could not freeze answer',error);
    return NextResponse.json({ok:false,error:'Intent Gap answer could not be frozen.'},{status:500});
  }
}
