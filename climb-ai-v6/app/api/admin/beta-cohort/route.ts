import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getServerClient} from '@/lib/supabase/server';
import {
  createBetaInvite,
  getBetaCohortAdminSnapshot,
  revokeBetaInvite,
  updateBetaReport,
} from '@/lib/server/betaCohortRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function founder(){
  const supabase=await getServerClient();
  if(!supabase)return null;
  const {data:userData}=await supabase.auth.getUser();
  const user=userData.user;
  if(!user)return null;
  const {data:profile}=await supabase.from('profiles').select('is_founder').eq('id',user.id).maybeSingle();
  return profile?.is_founder?user:null;
}

export async function GET(){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  const snapshot=await getBetaCohortAdminSnapshot();
  return NextResponse.json({ok:true,...snapshot});
}

const createSchema=z.object({
  action:z.literal('CREATE_INVITE'),
  email:z.string().email().optional().or(z.literal('')),
  cohort:z.number().int().min(1).max(999).default(1),
  expiresDays:z.number().int().min(1).max(30).default(7),
});
const revokeSchema=z.object({
  action:z.literal('REVOKE_INVITE'),
  id:z.string().uuid(),
});
const reportSchema=z.object({
  action:z.literal('UPDATE_REPORT'),
  id:z.string().uuid(),
  status:z.enum(['OPEN','REVIEWING','RESOLVED','WONT_FIX']),
  resolutionNote:z.string().max(2000).optional().default(''),
});

export async function POST(req:NextRequest){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  let raw:any;
  try{raw=await req.json()}catch{return NextResponse.json({ok:false,error:'Malformed request.'},{status:400})}
  const parsed=createSchema.safeParse(raw);
  if(!parsed.success)return NextResponse.json({ok:false,error:'Invalid invite request.'},{status:400});
  try{
    const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||req.nextUrl.origin;
    const result=await createBetaInvite({
      email:parsed.data.email||null,
      cohort:parsed.data.cohort,
      expiresDays:parsed.data.expiresDays,
      createdBy:user.id,
      siteUrl,
    });
    return NextResponse.json({ok:true,...result});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not create beta invite.'},{status:409});
  }
}

export async function PATCH(req:NextRequest){
  const user=await founder();
  if(!user)return NextResponse.json({ok:false,error:'Not found.'},{status:404});
  let raw:any;
  try{raw=await req.json()}catch{return NextResponse.json({ok:false,error:'Malformed request.'},{status:400})}

  const revoke=revokeSchema.safeParse(raw);
  if(revoke.success){
    try{return NextResponse.json({ok:true,result:await revokeBetaInvite(revoke.data.id)})}
    catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not revoke invite.'},{status:409})}
  }

  const report=reportSchema.safeParse(raw);
  if(report.success){
    try{return NextResponse.json({ok:true,result:await updateBetaReport({id:report.data.id,status:report.data.status,resolutionNote:report.data.resolutionNote,actorId:user.id})})}
    catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not update beta report.'},{status:409})}
  }

  return NextResponse.json({ok:false,error:'Unsupported beta admin action.'},{status:400});
}
