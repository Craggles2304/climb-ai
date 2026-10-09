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
/** Up to three pre-game actions: the role win path if the plan has one, else the lane rules. */
function frozenActions(team,plan){
  const steps=Array.isArray(team?.roleWinCondition?.steps)?team.roleWinCondition.steps:[];
  if(steps.length===5){
    const join=(...values)=>values.map(step=>limit(step?.value,70)).filter(Boolean).join(' → ');
    return [join(steps[0]),join(steps[1],steps[2]),join(steps[3],steps[4])].filter(Boolean);
  }
  const rules=Array.isArray(plan?.rules)&&plan.rules.length?plan.rules:Array.isArray(plan?.winCondition)?plan.winCondition:[];
  return rules.map(rule=>limit(rule,120)).filter(Boolean).slice(0,3);
}
/** Snapshot of the plan locked in champion select. Missing fields stay empty
 *  so the HUD hides them rather than showing generic advice. */
function freezeLeaguePlan(state){
  const team=state?.teamPlan;
  if(!team||typeof team!=='object')return null;
  const mission=Array.isArray(team.missionTips)?team.missionTips[0]:null;
  const baseline=team.dnaBaseline&&team.dnaBaseline.ready===false
    ?Object.freeze({games:clamp(team.dnaBaseline.games,0,9,0),required:clamp(team.dnaBaseline.required,1,9,3)}):null;
  return Object.freeze({
    champion:limit(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.draft?.localChampionName||'',35),
    role:limit(state?.matchup?.role||state?.matchup?.plan?.role||state?.draft?.localRole||'',18),
    winCondition:limit(team.ourWinCondition||team.roleWinCondition?.summary||''),
    job:limit(team.yourJob||''),
    mission:baseline?'':limit(mission?.cue||mission?.gameRule||mission?.title||''),
    avoid:limit(team.biggestThrow||team.roleWinCondition?.lossCondition||''),
    threat:limit(team.theirWinCondition||''),
    actions:Object.freeze(frozenActions(team,state?.matchup?.plan)),
    baseline,
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
