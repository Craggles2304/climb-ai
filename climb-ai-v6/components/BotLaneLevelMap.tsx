'use client';
import {useMemo,useState} from 'react';

type Step='AA'|'Q'|'W'|'E'|'R';
type AbilitySlot='Q'|'W'|'E'|'R';
type AccessMode='FULL'|'NO_AUTOS';
type ProtectYou='YOU_ADC'|'YOU_SUPPORT';
type ProtectThem='THEM_ADC'|'THEM_SUPPORT';
type FocusYou='THEM_ADC'|'THEM_SUPPORT';
type FocusThem='YOU_ADC'|'YOU_SUPPORT';
type WavePosition='YOUR_TOWER'|'YOUR_SIDE'|'CENTER'|'THEIR_SIDE'|'THEIR_TOWER';

export interface LevelMapSide{
  champion:string;
  level:number;
  itemIds:number[];
  healthPercent:number;
  resourcePercent:number;
  sequence:Step[];
  runeIds:number[];
  summonerIds:string[];
  activeSummonerIds:string[];
  activeChampionEffects:string[];
  ranks:Partial<Record<AbilitySlot,number>>;
  shield:number;
  accessMode:AccessMode;
  targetDistance?:number;
  missedAbilities:AbilitySlot[];
}

export interface LevelMapLaneContext{
  wavePosition:WavePosition;
  yourMinions:number;
  enemyMinions:number;
  yourCannon:boolean;
  enemyCannon:boolean;
}

interface LanePlan{
  call:'SAFE'|'FARM'|'POKE'|'SHORT_TRADE'|'EXTENDED_TRADE'|'ALL_IN';
  headline:string;
  target:'ADC'|'SUPPORT';
  targetChampion:string;
  rangeDelta:number;
  rules:string[];
}
interface Result{
  verdict:string;
  winner:'YOU'|'THEM'|null;
  teamDamage:{YOU:number;THEM:number};
  firstKill:{atSeconds:number;champion:string;team:'YOU'|'THEM'}|null;
}
interface Response{
  ok:boolean;
  error?:string;
  confidence?:string;
  lanePlan?:LanePlan;
  result?:Result;
}
interface LevelResult{level:number;response:Response}

interface SkillPlan{
  requested:string;
  ok:boolean;
  error?:string;
  champion?:string;
  mode?:'UPTIME_BASELINE'|'STANDARD_FALLBACK';
  sequence?:AbilitySlot[];
  shorthand?:string;
  basis?:string;
  unavailable?:string[];
}
interface SkillPlanResponse{
  ok:boolean;
  error?:string;
  plans?:SkillPlan[];
}

export function BotLaneLevelMap({
  yourAdc,yourSupport,enemyAdc,enemySupport,
  yourFocus,enemyFocus,yourProtect,enemyProtect,durationSeconds,laneContext,
}:{
  yourAdc:LevelMapSide;yourSupport:LevelMapSide;enemyAdc:LevelMapSide;enemySupport:LevelMapSide;
  yourFocus:FocusYou;enemyFocus:FocusThem;yourProtect:ProtectYou;enemyProtect:ProtectThem;durationSeconds:number;
  laneContext?:LevelMapLaneContext;
}){
  const [rows,setRows]=useState<LevelResult[]>([]);
  const [skillPlans,setSkillPlans]=useState<SkillPlan[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [buildMode,setBuildMode]=useState<'CURRENT'|'NO_ITEMS'>('CURRENT');

  const run=async()=>{
    setLoading(true);setError('');
    try{
      const sides=[yourAdc,yourSupport,enemyAdc,enemySupport];
      const skillResponse=await fetch('/api/matchup/skill-order',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({champions:sides.map(side=>side.champion)}),
      });
      const skillPayload=await skillResponse.json() as SkillPlanResponse;
      if(!skillPayload.ok||!skillPayload.plans)
        throw new Error(skillPayload.error??'Could not build champion-specific skill baselines.');
      const badPlan=skillPayload.plans.find(plan=>!plan.ok);
      if(badPlan)throw new Error(badPlan.error??`Could not build a skill baseline for ${badPlan.requested}.`);
      setSkillPlans(skillPayload.plans);

      const results=await Promise.all([1,2,3,4,5,6].map(async level=>{
        const side=(value:LevelMapSide,index:number)=>{
          const plan=skillPayload.plans?.[index];
          const ranks=plan?.mode==='UPTIME_BASELINE'&&plan.sequence?.length
            ?ranksAtLevel(plan.sequence,level)
            :{};
          return {
            ...value,
            level,
            // Standard-rank champions use a champion-specific cooldown/uptime
            // sequence. Non-standard rank systems fail back to the backend's
            // legal generic ranks rather than inventing unsupported progression.
            ranks,
            itemIds:buildMode==='NO_ITEMS'?[]:value.itemIds,
          };
        };
        const response=await fetch('/api/matchup/botlane',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            yourAdc:side(yourAdc,0),yourSupport:side(yourSupport,1),
            enemyAdc:side(enemyAdc,2),enemySupport:side(enemySupport,3),
            yourFocus,enemyFocus,yourProtect,enemyProtect,durationSeconds,laneContext,
          }),
        });
        const payload=await response.json() as Response;
        return {level,response:payload};
      }));
      setRows(results);
      const failed=results.find(row=>!row.response.ok);
      if(failed)setError(failed.response.error??`Level ${failed.level} could not be simulated.`);
    }catch(err){
      setError(err instanceof Error?err.message:'Could not run the Level 1–6 lane map.');
    }finally{setLoading(false)}
  };

  const flip=useMemo(()=>laneFlip(rows),[rows]);
  const strongest=useMemo(()=>strongestLevel(rows),[rows]);
  const skillSummary=useMemo(()=>skillPlans.map(plan=>
    `${plan.champion??plan.requested}: ${plan.mode==='UPTIME_BASELINE'?(plan.shorthand??'uptime baseline'):'standard fallback'}`,
  ).join(' · '),[skillPlans]);

  return <div className="glass card" style={{marginTop:16,padding:16}}>
    <div className="section-row" style={{gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div>
        <div className="eyebrow">LEVEL 1 → 6 LANE MAP</div>
        <h2 style={{margin:'5px 0'}}>When does this lane actually change?</h2>
        <p className="muted" style={{fontSize:11,margin:0,maxWidth:760}}>Runs the same four-champion setup six times with legal level-gated ranks. Standard-rank champions use a champion-specific cooldown/uptime baseline; explicit distance and wave context are held constant across levels.</p>
      </div>
      <button type="button" className="btn" onClick={run} disabled={loading}>{loading?'RUNNING 6 FIGHTS…':'RUN LEVEL 1–6 MAP'}</button>
    </div>

    <div className="section-row" style={{marginTop:12,gap:10,flexWrap:'wrap'}}>
      <span className="muted" style={{fontSize:10}}>BUILD ASSUMPTION</span>
      <div className="tag-row">
        <button type="button" className={`tag-chip ${buildMode==='CURRENT'?'live-pill':''}`} onClick={()=>setBuildMode('CURRENT')}>HOLD CURRENT ITEMS</button>
        <button type="button" className={`tag-chip ${buildMode==='NO_ITEMS'?'live-pill':''}`} onClick={()=>setBuildMode('NO_ITEMS')}>NO ITEMS · KIT BASELINE</button>
      </div>
    </div>

    {error&&<p className="lab-floor" style={{marginTop:12}}>{error}</p>}

    {rows.length>0&&<>
      <div className="tag-row" style={{marginTop:14}}>
        {flip&&<span className="tag-chip live-pill">LANE FLIP · {flip}</span>}
        {strongest&&<span className="tag-chip">STRONGEST WINDOW · LEVEL {strongest.level} · {callLabel(strongest.call)}</span>}
        <span className="tag-chip">{buildMode==='CURRENT'?'ITEMS HELD CONSTANT':'NO ITEMS'}</span>
        <span className="tag-chip">SKILLS · CHAMPION UPTIME BASELINE</span>
        {laneContext&&<span className="tag-chip">WAVE · {laneContext.wavePosition.replaceAll('_',' ')}</span>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:10,marginTop:12}}>
        {rows.map(({level,response})=>{
          const plan=response.lanePlan;
          const result=response.result;
          return <div key={level} style={{padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)'}}>
            <div className="section-row"><div className="eyebrow">LEVEL {level}</div><span className={`tag-chip ${tone(plan?.call)}`}>{plan?callLabel(plan.call):'ERROR'}</span></div>
            {plan&&result?<>
              <b style={{display:'block',fontSize:12,marginTop:9,lineHeight:1.3}}>{plan.headline}</b>
              <p className="muted" style={{fontSize:10,lineHeight:1.45,margin:'7px 0 0'}}>Focus {plan.target.toLowerCase()} · {plan.targetChampion}</p>
              <div className="build-summary" style={{marginTop:9}}>
                <span>You <b>{result.teamDamage.YOU}</b></span><span>Them <b>{result.teamDamage.THEM}</b></span>
              </div>
              <p className="muted" style={{fontSize:9.5,lineHeight:1.4,margin:'7px 0 0'}}>{result.firstKill?`First death: ${result.firstKill.champion} @ ${result.firstKill.atSeconds}s`:'No kill in window'}</p>
              <p className="muted" style={{fontSize:9,margin:'5px 0 0'}}>Confidence: {response.confidence??'—'}</p>
            </>:<p className="lab-floor" style={{fontSize:10,marginTop:8}}>{response.error??'No result.'}</p>}
          </div>;
        })}
      </div>

      {skillSummary&&<p className="muted" style={{fontSize:9.5,lineHeight:1.45,margin:'12px 0 0'}}>Skill baselines: {skillSummary}.</p>}
      <p className="muted" style={{fontSize:9.5,lineHeight:1.45,margin:'6px 0 0'}}>The champion-specific baseline orders standard abilities by how much ranking them improves cooldown uptime. It is deterministic from Riot data, but it is not presented as a meta/damage-optimal order. Champions with non-standard rank systems use the legal generic fallback. Wave context constrains coaching only; minion/turret damage is not added to champion totals.</p>
    </>}
  </div>;
}

function ranksAtLevel(order:AbilitySlot[],level:number):Record<AbilitySlot,number>{
  const ranks:Record<AbilitySlot,number>={Q:0,W:0,E:0,R:0};
  for(const slot of order.slice(0,Math.max(1,Math.min(18,Math.round(level)))))ranks[slot]++;
  return ranks;
}

function laneFlip(rows:LevelResult[]){
  const valid=rows.filter(row=>row.response.ok&&row.response.lanePlan);
  for(let index=1;index<valid.length;index++){
    const before=valid[index-1].response.lanePlan!.call;
    const after=valid[index].response.lanePlan!.call;
    if(bucket(before)!==bucket(after))return `LV ${valid[index-1].level} ${callLabel(before)} → LV ${valid[index].level} ${callLabel(after)}`;
  }
  return valid.length?'NO MAJOR CALL CHANGE':'NO DATA';
}

function strongestLevel(rows:LevelResult[]){
  const score:Record<LanePlan['call'],number>={SAFE:0,FARM:1,SHORT_TRADE:2,POKE:3,EXTENDED_TRADE:4,ALL_IN:5};
  return rows.filter(row=>row.response.ok&&row.response.lanePlan).map(row=>({level:row.level,call:row.response.lanePlan!.call,score:score[row.response.lanePlan!.call]})).sort((a,b)=>b.score-a.score||a.level-b.level)[0]??null;
}

const bucket=(call:LanePlan['call'])=>call==='SAFE'||call==='FARM'?'DEFEND':call==='ALL_IN'||call==='EXTENDED_TRADE'?'COMMIT':'TRADE';
const callLabel=(call:LanePlan['call'])=>call.replaceAll('_',' ');
const tone=(call:LanePlan['call']|undefined)=>call==='ALL_IN'||call==='EXTENDED_TRADE'||call==='POKE'?'edge-you':call==='SAFE'||call==='FARM'?'edge-them':'edge-even';