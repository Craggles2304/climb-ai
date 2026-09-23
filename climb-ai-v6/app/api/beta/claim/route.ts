import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {claimBetaInvite,getBetaTesterStatus} from '@/lib/server/betaCohortRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({token:z.string().min(20).max(160).regex(/^[A-Za-z0-9_-]+$/)});

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:true,signedIn:false,tester:null});
  const tester=await getBetaTesterStatus(user.id);
  return NextResponse.json({ok:true,signedIn:true,tester});
}

export async function POST(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in before claiming your beta place.'},{status:401});
  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Invalid beta invite.'},{status:400})}
  try{
    const result=await claimBetaInvite({token:input.token,userId:user.id,email:user.email??null});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not claim beta invite.'},{status:409});
  }
}
