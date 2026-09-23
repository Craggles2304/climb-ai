import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getBetaTesterStatus,submitBetaReport} from '@/lib/server/betaCohortRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  kind:z.enum(['BUG','FRICTION','COACHING']),
  severity:z.enum(['BLOCKER','HIGH','MEDIUM','LOW']),
  surface:z.string().min(1).max(80),
  summary:z.string().min(3).max(240),
  details:z.string().max(4000).optional().default(''),
});

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:true,tester:null});
  const tester=await getBetaTesterStatus(user.id);
  return NextResponse.json({ok:true,tester});
}

export async function POST(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in required.'},{status:401});
  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Invalid beta report.'},{status:400})}
  try{
    const result=await submitBetaReport({userId:user.id,...input});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not submit beta report.'},{status:409});
  }
}
