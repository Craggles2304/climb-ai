import {NextResponse} from 'next/server';
import {z} from 'zod';

const schema=z.object({
  message:z.string().min(1).max(1500),
  context:z.object({rank:z.string().optional(),role:z.string().optional(),mission:z.string().optional()}).optional()
});

export async function POST(req:Request){
  try{
    const {message,context}=schema.parse(await req.json());
    const q=message.toLowerCase();
    let answer='I do not have enough reliable tracked data to answer that precisely. Analyse another match or ask about your active mission.';
    if(/plat|platinum|rank/.test(q)) answer=`Use one measurable leak at a time. ${context?.mission ? `Your current mission is ${context.mission}. `:''}Do not add a second coaching target until the current one has been tested across relevant games.`;
    else if(/complete|done|finished/.test(q)) answer='I will not mark a mission mastered from chat alone. Submit the next relevant match and I will evaluate the mission result against its pass condition.';
    else if(/cs|farm|resource|after lane/.test(q)) answer='The current evidence points toward post-lane resource collection. Check safe side waves after recall and use the next analysed match to verify whether CS/min improves.';
    return NextResponse.json({answer,grounding:'deterministic-demo',factsUsed:['profile','active_mission']});
  }catch{
    return NextResponse.json({error:'That Coach message could not be processed.'},{status:400});
  }
}
