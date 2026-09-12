import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {latestPregame,savePregameEnvelope} from '@/lib/server/pregameRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const pickSchema=z.object({cellId:z.number().int().min(-1).max(20),championId:z.number().int().nonnegative(),championName:z.string().max(80).nullable(),role:z.string().max(40).nullable(),lockedIn:z.boolean()});
const banSchema=z.object({championId:z.number().int().nonnegative(),championName:z.string().max(80).nullable()});
const contextSchema=z.object({version:z.literal(1),capturedAt:z.string().datetime(),phase:z.string().max(80).nullable(),localPlayerCellId:z.number().int().min(-1).max(20),localChampionId:z.number().int().nonnegative(),localChampionName:z.string().max(80).nullable(),localRole:z.string().max(40).nullable(),localLockedIn:z.boolean(),allies:z.array(pickSchema).max(5),enemies:z.array(pickSchema).max(5),bans:z.object({allies:z.array(banSchema).max(10),enemies:z.array(banSchema).max(10)})});
const envelopeSchema=z.object({type:z.enum(['PREGAME','PREGAME_END']),clientPregameId:z.string().min(8).max(100),startedAt:z.string().datetime(),endedAt:z.string().datetime().optional(),context:contextSchema.optional()}).superRefine((value,ctx)=>{if(value.type==='PREGAME'&&!value.context)ctx.addIssue({code:z.ZodIssueCode.custom,path:['context'],message:'Context required.'})});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-pregame'),40,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Pregame data is arriving too quickly.'},{status:429});
  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});
  let envelope:z.infer<typeof envelopeSchema>;
  try{envelope=envelopeSchema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Invalid pregame payload.'},{status:400})}
  try{const saved=await savePregameEnvelope(device,envelope);return NextResponse.json({ok:true,acceptedAt:new Date().toISOString(),...saved})}
  catch(err){console.error('[live-pregame] write failed',err);return NextResponse.json({ok:false,error:'Could not store champ-select context.'},{status:503})}
}

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to view champ-select context.'},{status:401});
  const accountId=req.nextUrl.searchParams.get('accountId')?.trim();
  if(!accountId)return NextResponse.json({ok:false,error:'accountId is required.'},{status:400});
  try{const pregame=await latestPregame(user.id,accountId);return NextResponse.json({ok:true,pregame})}
  catch(err){console.error('[live-pregame] read failed',err);return NextResponse.json({ok:false,error:'Could not load champ-select context.'},{status:503})}
}
