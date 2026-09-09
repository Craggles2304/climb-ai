import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
const schema=z.object({accountId:z.string().min(1),gameTime:z.number().nonnegative(),championName:z.string().optional(),level:z.number().optional(),currentGold:z.number().optional(),cs:z.number().optional(),kills:z.number().optional(),deaths:z.number().optional(),assists:z.number().optional(),events:z.array(z.object({name:z.string(),time:z.number()})).optional(),receivedAt:z.string()});
export async function POST(req:NextRequest){try{const data=schema.parse(await req.json());return NextResponse.json({ok:true,acceptedAt:new Date().toISOString(),accountId:data.accountId});}catch{return NextResponse.json({ok:false,error:'Invalid telemetry payload.'},{status:400})}}
