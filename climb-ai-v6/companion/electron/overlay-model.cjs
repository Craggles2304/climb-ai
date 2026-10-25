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
    show,editing:show&&options.editing===true,assistantOpen:show&&options.assistantOpen===true,buildsOpen:show&&options.buildsOpen===true,game,layout:safeLayout(options.layout),
    buildGuide:game==='TFT'&&options.tftBuilds?{
      game:'TFT',patch:limit(options.tftBuilds.patch,20),asOf:limit(options.tftBuilds.asOf,30),
      selectedId:limit(options.tftBuilds.selectedId,80),
      builds:(Array.isArray(options.tftBuilds.builds)?options.tftBuilds.builds:[]).slice(0,5).map(row=>({
        id:limit(row.id,80),title:limit(row.title,100),tier:limit(row.tier,10),tempo:limit(row.tempo,55),
        primary:limit(row.primary,50),secondary:limit(row.secondary,50),
        items:Array.isArray(row.items)?row.items.slice(0,3).map(item=>limit(item,70)):[],
        secondaryItems:Array.isArray(row.secondaryItems)?row.secondaryItems.slice(0,3).map(item=>limit(item,70)):[],
        rationale:limit(row.rationale,230),source:limit(row.source,100),
      })),
    }:game==='LOL'&&options.leagueBuild?{
      game:'LOL',patch:limit(options.leagueBuild.patch,20),source:limit(options.leagueBuild.source,60),
      champion:limit(options.leagueBuild.champion,40),role:limit(options.leagueBuild.role,20),
      items:Array.isArray(options.leagueBuild.items)?options.leagueBuild.items.slice(0,6).map(item=>limit(item,70)):[],
      runes:Array.isArray(options.leagueBuild.runes)?options.leagueBuild.runes.slice(0,6).map(item=>limit(item,70)):[],
      skillOrder:Array.isArray(options.leagueBuild.skillOrder)?options.leagueBuild.skillOrder.slice(0,4).map(item=>limit(item,20)):[],
      summoners:Array.isArray(options.leagueBuild.summoners)?options.leagueBuild.summoners.slice(0,2).map(item=>limit(item,60)):[],
      note:limit(options.leagueBuild.note,220),
    }:null,
    focus:allowedFocus.has(String(options.tftFocus||''))?String(options.tftFocus):'ECONOMY',
    tftMission:game==='TFT'&&options.tftMission?{
      id:limit(options.tftMission.id,80),status:limit(options.tftMission.status,20),domain:limit(options.tftMission.domain,30),
      title:limit(options.tftMission.title,130),nextGame:limit(options.tftMission.nextGame,400),
      cues:Array.isArray(options.tftMission.cues)?options.tftMission.cues.slice(0,2).map(item=>limit(item,160)):[],
      progress:Math.max(0,Number(options.tftMission.progress)||0),goal:Math.max(0,Number(options.tftMission.goal)||0),
    }:null,
    status:game==='TFT'?'TFT · RECORDING':game==='LOL'?'LEAGUE · RECORDING':'PREVIEW · EDITING',
    plan:game==='LOL'?(options.frozenLeague||null):null,
    disclaimer:'FROZEN BEFORE THE GAME · REVIEW AFTER',
  };
}
module.exports={HUD_MODES,safeLayout,nextHudMode,freezeLeaguePlan,overlayView};
