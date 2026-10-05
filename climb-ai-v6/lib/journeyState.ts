import {DNA_BASELINE_GAMES} from '@/lib/dnaGrowth';

export type JourneyState={
  phase:'CHECKING'|'CONNECT'|'RECONNECT'|'BASELINE'|'DNA_REVEAL'|'MISSION';
  status:string;
  title:string;
  body:string;
  cta:string;
  href:string;
  progress?:string;
};

export function buildJourneyState(input:{
  deviceLoaded:boolean;
  linked:boolean;
  online:boolean;
  baselineGames:number;
  dnaRevealed?:boolean;
  focusName?:string|null;
  focusJob?:string|null;
  focusConfirmed?:number|null;
  focusRequired?:number|null;
}):JourneyState{
  const games=Math.max(0,Math.min(DNA_BASELINE_GAMES,input.baselineGames||0));
  if(!input.deviceLoaded)return{
    phase:'CHECKING',
    status:'CHECKING YOUR SETUP',
    title:'Finding your Companion…',
    body:'OP CLIMB is checking your current step.',
    cta:'CHECKING…',
    href:'/live',
  };
  if(!input.linked)return{
    phase:'CONNECT',
    status:'STEP 1 OF 4 · START HERE',
    title:'Connect OP CLIMB Companion.',
    body:'Pair this PC once. OP CLIMB can then track your games automatically.',
    cta:'CONNECT COMPANION →',
    href:'/live',
  };
  if(!input.online)return{
    phase:'RECONNECT',
    status:'STEP 1 OF 4 · COMPANION OFFLINE',
    title:'Reconnect before you queue.',
    body:'This PC is paired, but OP CLIMB is not receiving a live heartbeat right now.',
    cta:'RECONNECT COMPANION →',
    href:'/live',
  };
  if(games<DNA_BASELINE_GAMES){
    const next=games+1;
    return{
      phase:'BASELINE',
      status:`STEP 2 OF 4 · BASELINE ${games}/${DNA_BASELINE_GAMES}`,
      title:games===0?`Play baseline game ${next}.`:`Baseline ${games}/${DNA_BASELINE_GAMES} complete. Play game ${next}.`,
      body:`Play normally. Permanent Game DNA missions stay locked until game ${DNA_BASELINE_GAMES}; coaching before then is provisional.`,
      cta:`PLAY BASELINE GAME ${next} →`,
      href:'/live',
      progress:`${games}/${DNA_BASELINE_GAMES}`,
    };
  }
  if(!input.dnaRevealed||!input.focusName)return{
    phase:'DNA_REVEAL',
    status:'STEP 3 OF 4 · DNA READY',
    title:'Your Game DNA is ready to reveal.',
    body:'Your three-game baseline is complete. Open My DNA to see all six strands and the priority mission OP CLIMB wants you to train first.',
    cta:'REVEAL MY DNA →',
    href:'/ilp',
    progress:'3/3',
  };
  const confirmed=Math.max(0,input.focusConfirmed??0);
  const required=Math.max(1,input.focusRequired??3);
  return{
    phase:'MISSION',
    status:'STEP 4 OF 4 · DNA ACTIVE · PRIORITY MISSION',
    title:input.focusName,
    body:input.focusJob||'Take your priority mission into the next tracked game.',
    cta:'PLAY NEXT REP →',
    href:'/live',
    progress:`${Math.min(confirmed,required)}/${required} proven`,
  };
}
