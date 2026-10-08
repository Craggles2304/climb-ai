'use strict';
/**
 * In-game HUD contracts. All coaching copy is frozen from pre-game preparation.
 * NEVER consume live telemetry, hidden enemy knowledge or opponent scouting.
 */
const allowedFocus=new Set(['ECONOMY','TEMPO','FLEX','POSITION']);
const HUD_MODES=Object.freeze(['FOCUS','MINIMAL','EXPANDED']);
const limit=(value,max=180)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const clamp=(value,min,max,defaultValue)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):defaultValue));
function safeLayout(source={}){
  const rawMode=String(source?.mode||'FOCUS').toUpperCase();
  const mode=HUD_MODES.includes(rawMode)?rawMode:'FOCUS';
  return {
    x:clamp(source?.x,0.015,0.82,0.68),y:clamp(source?.y,0.015,0.75,0.045),
    scale:clamp(source?.scale,0.75,1.35,1),opacity:clamp(source?.opacity,0.68,1,0.96),mode,
  };
}
function nextHudMode(mode){
  const index=HUD_MODES.indexOf(String(mode||'').toUpperCase());
  return HUD_MODES[(index+1)%HUD_MODES.length];
}
function freezeLeaguePlan(state){
  const team=state?.teamPlan;
  if(!team||typeof team!=='object')return null;
  const mission=Array.isArray(team.missionTips)?team.missionTips[0]:null;
  return Object.freeze({
    champion:limit(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.draft?.localChampionName||'YOUR CHAMPION',35),
    role:limit(state?.matchup?.role||state?.matchup?.plan?.role||state?.draft?.localRole||'',18),
    winCondition:limit(team.ourWinCondition||team.roleWinCondition?.summary||team.yourJob||'Play your role within the team plan.'),
    mission:limit(mission?.cue||mission?.gameRule||mission?.title||'Play your pre-game learning mission.'),
    avoid:limit(team.biggestThrow||team.roleWinCondition?.lossCondition||'Avoid unnecessary risks.'),
  });
}
function overlayView(state,options={}){
  const tft=state?.tftRecorder||{};
  const game=state?.phase==='RECORDING'?'LOL':tft.state==='RECORDING'?'TFT':options.editing===true?'PREVIEW':null;
  const show=options.enabled===true&&Boolean(state?.paired)&&Boolean(game);
  return {
    show,editing:show&&options.editing===true,game,layout:safeLayout(options.layout),
    focus:allowedFocus.has(String(options.tftFocus||''))?String(options.tftFocus):'ECONOMY',
    status:game==='TFT'?'TFT · RECORDING':game==='LOL'?'LEAGUE · RECORDING':'PREVIEW · EDITING',
    plan:game==='LOL'?(options.frozenLeague||null):null,
    disclaimer:'FROZEN BEFORE THE GAME · REVIEW AFTER',
  };
}
module.exports={HUD_MODES,safeLayout,nextHudMode,freezeLeaguePlan,overlayView};
