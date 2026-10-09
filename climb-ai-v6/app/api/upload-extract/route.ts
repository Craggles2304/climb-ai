import {NextResponse} from 'next/server';

/**
 * Screenshot/clip extraction is not built. This used to return the same
 * invented Kog'Maw game for every file; it now says plainly that it is not
 * available, so nothing downstream can mistake a placeholder for real data.
 */
export async function POST(){
  return NextResponse.json(
    {ok:false,code:'NOT_AVAILABLE',error:'Upload extraction is not available yet. Sync your ranked games from Riot instead.'},
    {status:501},
  );
}
