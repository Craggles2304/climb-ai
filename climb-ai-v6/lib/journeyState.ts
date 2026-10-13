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
  focusSelectionSource?:'PLAYER'|'RECOMMENDED'|'UNSET';
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
  // Coaching choices are part of a player's account, not tied to the PC with
  // League installed. A player with three reviewed matches can confirm and read
  // their missions on any computer—even without a running Companion here.
  if(games>=DNA_BASELINE_GAMES&&input.focusName&&input.focusSelectionSource==='RECOMMENDED')return{
    phase:'DNA_REVEAL',
    status:'NEXT STEP · CONFIRM YOUR PLAN',
    title:'Your two suggested missions are ready.',
    body:'Read the two actions OP CLIMB recommends. Confirm them or swap one. This works on any computer—League does not need to be installed here.',
    cta:'CHOOSE MY TWO MISSIONS →',
    href:'/missions',
    progress:'2 SUGGESTED',
  };
  if(games>=DNA_BASELINE_GAMES&&input.focusName&&input.focusSelectionSource==='PLAYER'&&(!input.linked||!input.online))return{
    phase:'MISSION',
    status:'YOUR TWO MISSIONS ARE SAVED',
    title:'Know what to practise next.',
    body:'Your coaching plan is available on this PC. When you play, open the Companion on your gaming PC so the next match can be measured.',
    cta:'READ MY NEXT-GAME MISSIONS →',
    href:'/missions',
    progress:`${Math.max(0,input.focusConfirmed??0)}/${Math.max(1,input.focusRequired??3)} proven`,
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
    body:'Your three-game baseline is complete. Open My DNA to see all six strands, then choose the two DNA trees you want to keep unlocked.',
    cta:'REVEAL MY DNA →',
    href:'/ilp',
    progress:'3/3',
  };
  if(input.focusSelectionSource==='RECOMMENDED')return{
    phase:'DNA_REVEAL',
    status:'STEP 3 OF 4 · TWO COACH RECOMMENDATIONS',
    title:'Confirm your two suggested DNA trees.',
    body:'OP CLIMB has suggested two priorities. Open Missions to confirm these trees or choose different ones before treating them as your personal plan.',
    cta:'CONFIRM MY TWO MISSIONS →',
    href:'/missions',
    progress:'2 SUGGESTED',
  };
    const confirmed=Math.max(0,input.focusConfirmed??0);
  const required=Math.max(1,input.focusRequired??3);
  return{
    phase:'MISSION',
    status:'STEP 4 OF 4 · DNA ACTIVE · TWO TREES UNLOCKED',
    title:input.focusName,
    body:input.focusJob||'Take your two selected missions into the next tracked game.',
    cta:'PLAY NEXT GAME →',
    href:'/live',
    progress:`${Math.min(confirmed,required)}/${required} proven`,
  };
}
