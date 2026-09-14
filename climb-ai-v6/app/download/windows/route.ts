import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const COMPANION_INSTALLER='https://github.com/Craggles2304/climb-ai/releases/download/companion-beta/OP-Climb-Companion-Setup.exe';

export async function GET(){
  return NextResponse.redirect(COMPANION_INSTALLER,{status:307});
}
