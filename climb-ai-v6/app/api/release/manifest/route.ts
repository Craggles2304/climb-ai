import {NextResponse} from 'next/server';
import {RELEASE_MANIFEST} from '@/lib/releaseManifest';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    ...RELEASE_MANIFEST,
    build:{
      commit:(process.env.VERCEL_GIT_COMMIT_SHA||'local').slice(0,12),
      environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'local',
    },
  },{headers:{'Cache-Control':'no-store'}});
}
