import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Reactive in-match coaching is deliberately disabled.
 *
 * OP CLIMB may prepare a player's coaching focus before the match, record
 * permitted telemetry silently, and explain the evidence after the match. It
 * must not turn current game state into decision-by-decision tactical calls.
 * Keeping this endpoint as a retired authenticated route prevents older
 * Companion builds from receiving reactive tips while they roll forward.
 */
export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-coaching-tips'),20,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many requests. Wait a moment.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});

  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  return NextResponse.json({
    ok:false,
    retired:true,
    error:'Reactive in-match coaching is disabled. Use the pre-game focus; OP CLIMB will analyse the match after it ends.',
  },{status:410});
}
