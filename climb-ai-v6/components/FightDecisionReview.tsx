'use client';
import {useMemo,useState} from 'react';

export type FightReview={
  atSeconds:number;
  category:'STRENGTH'|'WEAKNESS';
  outcome:'KILL'|'DEATH'|'ASSIST';
  opponent:string|null;
  opponentChampion:string|null;
  score:number;
  verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
  headline:string;
  summary:string;
  evidence:{
    youLevel:number;themLevel:number|null;levelDelta:number|null;
    youItemGold:number;themItemGold:number|null;itemGoldDelta:number|null;
    currentGold:number;healthPct:number|null;manaPct:number|null;
  };
  why:string[];
  howToWin:string[];
  howYouLose:string[];
  betterDecision:string[];
  limitation:string;
};

type GradeBand='BROKEN'|'EXPOSED'|'STABLE'|'SHARP'|'OVERPOWERED';
type Severity='CRITICAL LEAK'|'MAJOR LEAK'|'ACTIVE LEAK'|'POLISH';
type FixStage='QUICK WIN'|'CONTROL'|'DISCIPLINE'|'ADVANCED'|'MASTERY';
type Fix={
  id:string;stage:FixStage;difficulty:number;severity:Severity;title:string;oneLine:string;
  evidence:FightReview[];rule:string;mastery:string;why:string;
};

export function FightDecisionReview({fights}:{fights:FightReview[]}){
  const [tab,setTab]=useState<'STRENGTH'|'WEAKNESS'>('STRENGTH');
  const [openKey,setOpenKey]=useState<string|null>(null);
  const [openFix,setOpenFix]=useState<string|null>(null);
  const strengths=useMemo(()=>fights.filter(fight=>fight.category==='STRENGTH'),[fights]);
  const weaknesses=useMemo(()=>fights.filter(fight=>fight.category==='WEAKNESS'),[fights]);
  const visible=tab==='STRENGTH'?strengths:weaknesses;
  const grade=useMemo(()=>buildGrade(fights),[fights]);
  const fixes=useMemo(()=>buildFixes(fights),[fights]);

  if(!fights.length)return <div className="glass card"><div className="eyebrow">OP CLIMB GRADE</div><h3>Not enough fight evidence to grade this match</h3><p className="muted">OP CLIMB still has the power-state timeline, but Riot&apos;s recorded event feed did not expose enough player-involved kill/death evidence for a reliable decision grade.</p></div>;

  return <div style={{display:'grid',gap:16}}>
    <div className="glass card">
      <div className="eyebrow">OP CLIMB MATCH GRADE</div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(150px,.7fr) minmax(0,1.7fr)',gap:18,alignItems:'center',marginTop:10}}>
        <div>
          <div style={{fontSize:54,fontWeight:950,lineHeight:.95,letterSpacing:'-.05em'}}>{grade.overall}</div>
          <div style={{fontSize:17,fontWeight:900,letterSpacing:'.12em',marginTop:8}}>{grade.band}</div>
          <div className="muted" style={{fontSize:12,marginTop:5}}>OP DECISION SCORE / 100</div>
        </div>
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:8}}>
            {grade.parts.map(part=><GradePart key={part.label} label={part.label} score={part.score}/>) }
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:12}}>
            {(['BROKEN','EXPOSED','STABLE','SHARP','OVERPOWERED'] as GradeBand[]).map(band=><span key={band} style={{...scalePill,opacity:grade.band===band?1:.38,fontWeight:grade.band===band?900:700}}>{band}</span>)}
          </div>
        </div>
      </div>
      <p className="muted" style={{fontSize:12,marginBottom:0,marginTop:14}}>This grade scores the decision evidence OP CLIMB actually recorded: fight selection, death control, resource conversion, power-state conversion and execution evidence. It does not pretend to grade mechanics or positioning that Riot telemetry does not expose.</p>
    </div>

    <div className="glass card">
      <div className="eyebrow">OP FIX LADDER</div>
      <h2 style={{marginBottom:5}}>Start with the easy fix. Earn the harder ones.</h2>
      <p className="muted" style={{marginTop:0}}>Only open what you are working on. OP CLIMB orders the fixes from easiest behavioural change to the harder game-reading habits.</p>
      <div style={{display:'grid',gap:9,marginTop:16}}>
        {fixes.length?fixes.map((fix,index)=><FixCard key={fix.id} fix={fix} index={index} open={openFix===fix.id} onToggle={()=>setOpenFix(openFix===fix.id?null:fix.id)}/>):<div style={emptyStyle}><b>No serious decision leak detected from the recorded fights.</b><div className="muted" style={{fontSize:12,marginTop:4}}>Use the strengths section below to identify what should be repeated.</div></div>}
      </div>
    </div>

    <div className="glass card">
      <div className="eyebrow">COACHING DECISION REVIEW</div>
      <h2 style={{marginBottom:6}}>Strengths or weaknesses → choose the time → open the coaching</h2>
      <p className="muted" style={{marginTop:0}}>The detail stays closed until you want it. Pick a category, then a timestamp.</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:18}}>
        <button type="button" onClick={()=>{setTab('STRENGTH');setOpenKey(null)}} style={tabButtonStyle(tab==='STRENGTH','strength')}>
          <span style={{fontSize:11,letterSpacing:'.13em',fontWeight:900}}>STRENGTHS</span>
          <strong style={{fontSize:24}}>{strengths.length}</strong>
          <small style={{opacity:.72}}>positive fight conversions</small>
        </button>
        <button type="button" onClick={()=>{setTab('WEAKNESS');setOpenKey(null)}} style={tabButtonStyle(tab==='WEAKNESS','weakness')}>
          <span style={{fontSize:11,letterSpacing:'.13em',fontWeight:900}}>WEAKNESSES</span>
          <strong style={{fontSize:24}}>{weaknesses.length}</strong>
          <small style={{opacity:.72}}>deaths / lost fight states</small>
        </button>
      </div>

      <div style={{display:'grid',gap:9,marginTop:18}}>
        {visible.length?visible.map((fight,index)=>{
          const key=`${fight.category}-${fight.atSeconds}-${fight.outcome}-${index}`;
          const open=openKey===key;
          return <div key={key} style={{border:'1px solid rgba(255,255,255,.1)',borderRadius:16,overflow:'hidden',background:'rgba(255,255,255,.025)'}}>
            <button type="button" onClick={()=>setOpenKey(open?null:key)} style={{width:'100%',display:'grid',gridTemplateColumns:'82px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'14px 16px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
              <strong style={{fontSize:18}}>{formatClock(fight.atSeconds)}</strong>
              <div><b>{fight.headline}</b><div className="muted" style={{fontSize:12,marginTop:2}}>{verdictLabel(fight.verdict)} · power score {signed(fight.score)}</div></div>
              <span style={{fontSize:20,opacity:.75}}>{open?'−':'+'}</span>
            </button>
            {open&&<FightDetail fight={fight}/>} 
          </div>;
        }):<div className="glass card"><p className="muted" style={{margin:0}}>No {tab==='STRENGTH'?'strength':'weakness'} fight events were captured in this game.</p></div>}
      </div>
    </div>
  </div>;
}

function FixCard({fix,index,open,onToggle}:{fix:Fix;index:number;open:boolean;onToggle:()=>void}){
  return <div style={{border:'1px solid rgba(255,255,255,.1)',borderRadius:17,overflow:'hidden',background:'rgba(255,255,255,.025)'}}>
    <button type="button" onClick={onToggle} style={{width:'100%',display:'grid',gridTemplateColumns:'48px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'14px 16px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
      <div style={{fontSize:20,fontWeight:950,opacity:.5}}>{String(index+1).padStart(2,'0')}</div>
      <div>
        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><span style={{fontSize:10,fontWeight:900,letterSpacing:'.12em'}}>{fix.stage}</span><SeverityPill severity={fix.severity}/></div>
        <b style={{display:'block',fontSize:16,marginTop:5}}>{fix.title}</b>
        <div className="muted" style={{fontSize:12,marginTop:3}}>{fix.oneLine} · {fix.evidence.length} evidence point{fix.evidence.length===1?'':'s'}</div>
      </div>
      <span style={{fontSize:20,opacity:.75}}>{open?'−':'+'}</span>
    </button>
    {open&&<div style={{padding:'0 16px 17px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:9,marginTop:14}}>
        <MiniBlock label="WHY IT MATTERS" text={fix.why}/>
        <MiniBlock label="NEXT GAME RULE" text={fix.rule}/>
        <MiniBlock label="MASTER IT WHEN" text={fix.mastery}/>
      </div>
      <div style={{marginTop:14}}><div className="eyebrow">EVIDENCE</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{fix.evidence.slice(0,6).map((fight,i)=><span key={`${fight.atSeconds}-${i}`} style={timePill}>{formatClock(fight.atSeconds)} · {fight.outcome}</span>)}</div></div>
    </div>}
  </div>;
}

function MiniBlock({label,text}:{label:string;text:string}){return <div style={{padding:'12px 13px',border:'1px solid rgba(255,255,255,.08)',borderRadius:13,background:'rgba(255,255,255,.025)'}}><div className="eyebrow">{label}</div><div style={{fontSize:13,lineHeight:1.5,marginTop:6}}>{text}</div></div>}
function SeverityPill({severity}:{severity:Severity}){const alpha=severity==='CRITICAL LEAK'?'.2':severity==='MAJOR LEAK'?'.16':severity==='ACTIVE LEAK'?'.12':'.08';return <span style={{padding:'4px 7px',borderRadius:999,fontSize:9,fontWeight:900,letterSpacing:'.08em',border:'1px solid rgba(255,120,120,.25)',background:`rgba(255,105,105,${alpha})`}}>{severity}</span>}
function GradePart({label,score}:{label:string;score:number}){return <div style={{padding:'10px 11px',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,background:'rgba(255,255,255,.025)'}}><div className="muted" style={{fontSize:9,fontWeight:900,letterSpacing:'.1em'}}>{label}</div><strong style={{display:'block',fontSize:18,marginTop:3}}>{score}</strong></div>}

function FightDetail({fight}:{fight:FightReview}){
  const e=fight.evidence;
  return <div style={{padding:'0 16px 18px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
    <div style={{paddingTop:16}}><div className="eyebrow">WHAT HAPPENED</div><p style={{fontSize:14,lineHeight:1.6,marginBottom:0}}>{fight.summary}</p></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:9,marginTop:14}}>
      <Evidence label="LEVEL" value={e.themLevel===null?`You L${e.youLevel}`:`L${e.youLevel} vs L${e.themLevel}`}/>
      <Evidence label="ITEM VALUE" value={e.itemGoldDelta===null?`${Math.round(e.youItemGold)}g`:`${signedGold(e.itemGoldDelta)}`}/>
      <Evidence label="YOUR HP" value={pct(e.healthPct)}/><Evidence label="RESOURCE" value={pct(e.manaPct)}/><Evidence label="POCKET GOLD" value={`${Math.round(e.currentGold)}g`}/>
    </div>
    <details style={detailsStyle}><summary style={summaryStyle}>{fight.category==='STRENGTH'?'WHY IT WORKED':'WHY IT FAILED'}</summary><CoachLines lines={fight.why}/></details>
    <details style={detailsStyle}><summary style={summaryStyle}>HOW YOU WIN IT</summary><CoachLines lines={fight.howToWin}/></details>
    <details style={detailsStyle}><summary style={summaryStyle}>HOW YOU LOSE IT</summary><CoachLines lines={fight.howYouLose}/></details>
    <details style={detailsStyle}><summary style={summaryStyle}>BETTER / REPEATABLE DECISION</summary><CoachLines lines={fight.betterDecision}/></details>
    <small className="muted" style={{display:'block',marginTop:14,lineHeight:1.45}}>{fight.limitation}</small>
  </div>;
}

function CoachLines({lines}:{lines:string[]}){return <div style={{display:'grid',gap:7,marginTop:9}}>{lines.map((line,index)=><div key={index} style={{display:'grid',gridTemplateColumns:'16px minmax(0,1fr)',gap:7,fontSize:13,lineHeight:1.5}}><span style={{opacity:.5}}>•</span><span>{line}</span></div>)}</div>}
function Evidence({label,value}:{label:string;value:string}){return <div style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,background:'rgba(255,255,255,.035)'}}><span className="muted" style={{fontSize:10,fontWeight:800,letterSpacing:'.11em'}}>{label}</span><strong style={{display:'block',fontSize:15,marginTop:3}}>{value}</strong></div>}

function buildGrade(fights:FightReview[]){
  const deaths=fights.filter(f=>f.outcome==='DEATH');
  const positives=fights.filter(f=>f.outcome!=='DEATH');
  const redDeaths=deaths.filter(f=>f.verdict==='THEM_STRONGER').length;
  const thrown=deaths.filter(f=>f.verdict==='YOU_STRONGER').length;
  const evenDeaths=deaths.filter(f=>f.verdict==='EVEN').length;
  const highGold=fights.filter(f=>f.evidence.currentGold>=900).length;
  const hugeGoldDeaths=deaths.filter(f=>f.evidence.currentGold>=1200).length;
  const convertedAhead=positives.filter(f=>f.verdict==='YOU_STRONGER').length;
  const underdog=positives.filter(f=>f.verdict==='THEM_STRONGER').length;
  const selection=clamp(88-redDeaths*18-evenDeaths*8-thrown*4+underdog*3,0,100);
  const deathControl=clamp(92-deaths.length*9-thrown*14,0,100);
  const resources=clamp(94-highGold*8-hugeGoldDeaths*14,0,100);
  const powerUse=clamp(62+convertedAhead*9+underdog*5-thrown*16,0,100);
  const execution=clamp(64+positives.length*5+underdog*6-evenDeaths*8-thrown*12,0,100);
  const overall=Math.round(selection*.28+deathControl*.24+resources*.18+powerUse*.18+execution*.12);
  return {overall,band:gradeBand(overall),parts:[{label:'FIGHT SELECTION',score:selection},{label:'DEATH CONTROL',score:deathControl},{label:'RESOURCE USE',score:resources},{label:'POWER CONVERSION',score:powerUse},{label:'EXECUTION EVIDENCE',score:execution}]};
}

function buildFixes(fights:FightReview[]):Fix[]{
  const deaths=fights.filter(f=>f.outcome==='DEATH');
  const fixes:Fix[]=[];
  const highGold=fights.filter(f=>f.evidence.currentGold>=900);
  const redDeaths=deaths.filter(f=>f.verdict==='THEM_STRONGER');
  const chainDeaths=deaths.filter((fight,index)=>index>0&&fight.atSeconds-deaths[index-1].atSeconds<=90);
  const thrown=deaths.filter(f=>f.verdict==='YOU_STRONGER');
  const lowResource=deaths.filter(f=>(f.evidence.healthPct!==null&&f.evidence.healthPct<.55)||(f.evidence.manaPct!==null&&f.evidence.manaPct<.3));
  const evenDeaths=deaths.filter(f=>f.verdict==='EVEN');

  if(highGold.length)fixes.push(makeFix('bank','QUICK WIN',1,highGold,'SPEND BEFORE YOU FIGHT','You took reviewed fights while carrying meaningful unspent gold.','If you can reset safely before the next voluntary fight, bank the gold first.','3 completed games with no reviewed death while carrying 900g+.','Unspent gold gives you zero combat stats. This is one of the quickest leaks to remove because the solution is behavioural, not mechanical.'));
  if(redDeaths.length)fixes.push(makeFix('red-state','CONTROL',2,redDeaths,'STOP ACCEPTING RED-STATE FIGHTS','You died when the enemy already held the stronger visible combat state.','If OP state is red, do not take the clean equal-numbers fight. Add numbers, setup, damage first, or leave.','3 games with no death in a clearly enemy-favoured visible state.','This is fight selection before mechanics. You are asking execution to overcome a disadvantage that did not need to be accepted.'));
  if(chainDeaths.length)fixes.push(makeFix('chain','CONTROL',2,chainDeaths,'BREAK THE CHAIN DEATH','You died again within 90 seconds of a previous death.','After a death: collect the safe wave/resource, rebuild map information, then re-enter. No instant revenge fight.','3 games with zero deaths within 90 seconds of the previous death.','The second death is often more damaging than the first because it removes your recovery window and compounds lost tempo.'));
  if(thrown.length)fixes.push(makeFix('throw','DISCIPLINE',3,thrown,'PROTECT YOUR ADVANTAGE','You died from a state where OP CLIMB had you visibly stronger.','When ahead, make the enemy enter your threat range. Do not turn the advantage into an uncontrolled chase or isolated stat-check.','3 games with zero reviewed deaths from a clearly stronger visible state.','A lead only matters if it is converted. Dying while stronger is a higher-value coaching point than simply dying while already behind.'));
  if(lowResource.length)fixes.push(makeFix('resource','DISCIPLINE',3,lowResource,'STOP FIGHTING ON EMPTY','Some deaths began with low HP or low resource.','Before committing, check HP and resource. If one is red, shorten the trade or disengage unless the kill is forced and immediate.','3 games with no reviewed death starting below the HP/resource danger threshold.','Low resources remove your margin for error and make otherwise reasonable fights collapse after one enemy rotation.'));
  if(evenDeaths.length)fixes.push(makeFix('even','ADVANCED',4,evenDeaths,'WIN THE SETUP BEFORE THE FIGHT','You died in states where raw visible power was approximately even.','In even fights, earn an edge first: numbers, first damage, terrain, ally CC, enemy cooldown commitment or safer target access.','Across 3 games, convert more even-state reviewed fights than you lose.','When stats are close, the fight is decided by setup. This is where positioning, timing and target access matter most.'));

  const severityRank:Record<Severity,number>={'CRITICAL LEAK':4,'MAJOR LEAK':3,'ACTIVE LEAK':2,'POLISH':1};
  return fixes.sort((a,b)=>a.difficulty-b.difficulty||severityRank[b.severity]-severityRank[a.severity]).slice(0,5);
}
function makeFix(id:string,stage:FixStage,difficulty:number,evidence:FightReview[],title:string,oneLine:string,rule:string,mastery:string,why:string):Fix{return{id,stage,difficulty,severity:severityFor(evidence.length),title,oneLine,evidence,rule,mastery,why}}
function severityFor(count:number):Severity{return count>=4?'CRITICAL LEAK':count>=3?'MAJOR LEAK':count>=2?'ACTIVE LEAK':'POLISH'}
function gradeBand(score:number):GradeBand{return score<40?'BROKEN':score<55?'EXPOSED':score<70?'STABLE':score<85?'SHARP':'OVERPOWERED'}
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,Math.round(n)))}

function tabButtonStyle(active:boolean,type:'strength'|'weakness'):React.CSSProperties{return {display:'grid',gap:4,padding:'16px',borderRadius:16,border:active?`1px solid ${type==='strength'?'rgba(92,255,160,.55)':'rgba(255,112,112,.55)'}`:'1px solid rgba(255,255,255,.1)',background:active?(type==='strength'?'rgba(92,255,160,.09)':'rgba(255,112,112,.09)'):'rgba(255,255,255,.025)',color:'inherit',textAlign:'left',cursor:'pointer'}};
const scalePill:React.CSSProperties={padding:'5px 8px',borderRadius:999,border:'1px solid rgba(255,255,255,.1)',fontSize:9,letterSpacing:'.08em'};
const timePill:React.CSSProperties={padding:'6px 8px',borderRadius:999,border:'1px solid rgba(255,255,255,.1)',fontSize:11,background:'rgba(255,255,255,.035)'};
const emptyStyle:React.CSSProperties={padding:'14px 15px',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,background:'rgba(255,255,255,.025)'};
const detailsStyle:React.CSSProperties={marginTop:10,padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,background:'rgba(255,255,255,.025)'};
const summaryStyle:React.CSSProperties={cursor:'pointer',fontSize:11,fontWeight:900,letterSpacing:'.1em'};
function verdictLabel(value:FightReview['verdict']){return value==='YOU_STRONGER'?'YOU WERE VISIBLY STRONGER':value==='THEM_STRONGER'?'THEY WERE VISIBLY STRONGER':'VISIBLE POWER WAS CLOSE'}
function pct(value:number|null){return value===null?'Not exposed':`${Math.round(value*100)}%`}
function signedGold(value:number){return`${value>0?'+':''}${Math.round(value)}g`}
function signed(value:number){return`${value>0?'+':''}${Math.round(value*10)/10}`}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
