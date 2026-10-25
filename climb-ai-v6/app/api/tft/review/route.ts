import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {saveTftSessionReview} from '@/lib/server/tftDevelopmentRepository';
import {tftSessionReviewSchema} from '@/lib/tft/reviewSchema';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to review a TFT game.'},{status:401});
  const input=tftSessionReviewSchema.safeParse(await req.json().catch(()=>null));
  if(!input.success)return NextResponse.json({ok:false,error:'Choose a recorded round and explain your assessment (10–500 characters).'},{status:400});
  try{await saveTftSessionReview(user.id,input.data);return NextResponse.json({ok:true,basis:'SELF_REVIEW',verifiedMastery:false})}
  catch(error){
    const message=error instanceof Error?error.message:'';
    const invalid=message==='TFT_REVIEW_UNAVAILABLE'||message==='TFT_ROUND_NOT_RECORDED';
    return NextResponse.json({ok:false,error:invalid?'That completed game or round is not available to review.':'Could not save the review.'},{status:invalid?400:503});
  }
}
