import type {ProMatchAnalysis} from './riot/proAnalysis';

export async function loadProMatchAnalysis(matchId:string,signal?:AbortSignal):Promise<ProMatchAnalysis|null>{
  try{
    const response=await fetch(`/api/analyse/pro/${encodeURIComponent(matchId)}`,{cache:'no-store',signal});
    if(!response.ok)return null;
    const body=await response.json() as {analysis?:ProMatchAnalysis|null};
    return body.analysis??null;
  }catch(error){
    if((error as {name?:string})?.name!=='AbortError')console.error('[pro-match] evidence load failed',error);
    return null;
  }
}
