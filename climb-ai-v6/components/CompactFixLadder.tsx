'use client';
import {useMemo,useState} from 'react';
import {useSubscription} from './SubscriptionContext';
import {PLAN_COPY} from '@/lib/subscription';
import type {FightReview} from './FightDecisionReview';
import type {ProLearningProfile,ProHistoryFix} from '@/lib/riot/proHistory';

type Severity='CRITICAL LEAK'|'MAJOR LEAK'|'ACTIVE LEAK'|'POLISH';
type FixStage='QUICK WIN'|'CONTROL'|'DISCIPLINE'|'ADVANCED'|'MASTERY';
type MatchFix={id:string;stage:FixStage;severity:Severity;title:string;oneLine:string;rule:string;mastery:string;why:string;evidence:FightReview[]};
type LadderFix={id:string;stage:FixStage;severity:string;title:string;oneLine:string;rule:string;mastery:string;why:string;evidence:FightReview[];persistent:boolean;gamesSeen?:number;occurrences?:number};
type CoachingPlan={trigger:string;routine:string[];avoid:string[];success:string;coachNote:string};

const STAGES:FixStage[]=['QUICK WIN','CONTROL','DISCIPLINE','ADVANCED','MASTERY'];

export function CompactFixLadder({fights,historyProfile}:{fights:FightReview[];historyProfile?:ProLearningProfile|null}){
  const {tier}=useSubscription();
  const [open,setOpen]=useState<string|null>(null);
  const matchFixes=useMemo(()=>buildMatchFixes(fights),[fights]);
  const current=useMemo<LadderFix[]>(()=>matchFixes.map(fix=>({...fix,persistent:false})),[matchFixes]);
  const persistent=useMemo<LadderFix[]>(()=>tier==='PRO'?(historyProfile?.fixLadder??[]).map(fromHistory):[],[historyProfile,tier]);
  const sourceFixes:LadderFix[]=persistent.length?mergeFixes(persistent,current):current;
  const depth=PLAN_COPY[tier].fixDepth;
  const visible=sourceFixes.slice(0,depth);
  const locked=sourceFixes.slice(depth);
  const active=visible[0]??null;
  const next=visible.slice(1);

  return <section className="glass card" style={{display:'grid',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:12,flexWrap:'wrap'}}>
      <div><div className="eyebrow">OP FIX LADDER</div><h2 style={{margin:'5px 0 4px'}}>Fix one leak. Prove it. Move up.</h2><p className="muted" style={{margin:0,maxWidth:680}}>OP CLIMB prioritises the simplest high-impact behaviour first. Open a fix for the exact trigger, in-game routine, mistakes to avoid and the proof required to master it.</p></div>
      <span style={tierPill}>{tier} · {depth} FIXES</span>
    </div>

    <div style={stageRail} aria-label="Fix Ladder progression">
      {STAGES.map((stage,index)=>{const stageFix=sourceFixes.find(f=>f.stage===stage);const isActive=active?.stage===stage;const available=Boolean(stageFix&&visible.includes(stageFix));return <div key={stage} style={{...stageCell,opacity:isActive?1:available?.72:.36,borderColor:isActive?'rgba(182,246,107,.55)':'rgba(255,255,255,.08)'}}><span style={{fontSize:9,fontWeight:950,letterSpacing:'.1em'}}>{String(index+1).padStart(2,'0')}</span><b style={{fontSize:10}}>{stage}</b><small style={{fontSize:9}}>{isActive?'ACTIVE':available?'READY':stageFix?'LOCKED':'LATER'}</small></div>})}
    </div>

    {active?<div style={activeShell}>
      <button type="button" onClick={()=>setOpen(open===active.id?null:active.id)} style={activeButton}>
        <div style={{display:'grid',gap:5}}>
          <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><span className="eyebrow">CURRENT PRIORITY · {active.stage}</span><span style={severityPill}>{active.severity}</span>{active.persistent&&<span style={persistentPill}>REPEATED PATTERN</span>}</div>
          <strong style={{fontSize:24,lineHeight:1.08}}>{active.title}</strong>
          <span className="muted" style={{fontSize:12}}>{active.oneLine}</span>
        </div>
        <span style={{fontSize:20,fontWeight:900}}>{open===active.id?'−':'+'}</span>
      </button>
      <div style={ruleBar}><span>YOUR NEXT-GAME RULE</span><b>{active.rule}</b></div>
      {open===active.id&&<FixDetail fix={active}/>} 
    </div>:<div style={empty}><b>No major decision leak detected in the latest evidence.</b><span className="muted">Keep recording games. OP CLIMB will promote a repeated pattern when it has enough evidence.</span></div>}

    {next.length>0&&<div style={{display:'grid',gap:7}}>
      <div className="eyebrow">NEXT IN YOUR LADDER</div>
      {next.map((fix,index)=><CompactRow key={fix.id} fix={fix} number={index+2} open={open===fix.id} onToggle={()=>setOpen(open===fix.id?null:fix.id)}/>) }
    </div>}

    {locked.length>0&&<details style={detailsShell}><summary style={summaryStyle}>{locked.length} LATER STAGE{locked.length===1?'':'S'} DETECTED · SEE WHAT THE NEXT COACHING DEPTH ADDS</summary><div style={{display:'grid',gap:6,marginTop:10}}>{locked.map((fix,index)=><div key={fix.id} style={lockedRow}><b>{String(depth+index+1).padStart(2,'0')}</b><span>{fix.stage} · {fix.title}</span><strong>🔒</strong></div>)}</div><p className="muted" style={{fontSize:10,margin:'10px 0 0'}}>Your current focus stays available. The next plan adds more depth around later fixes rather than hiding the job you are already working on.</p><a href="/pricing" className="text-link" style={{display:'inline-block',marginTop:10}}>SEE EXACTLY WHAT UNLOCKS NEXT →</a></details>}

    {tier==='PRO'&&historyProfile&&<div style={historyBar}><span><b>{historyProfile.gamesAnalyzed}</b> games learned</span><span><b>{historyProfile.fingerprint.patternRate}%</b> primary-pattern rate</span><span><b>{historyProfile.fingerprint.trend}</b> trend</span></div>}
  </section>;
}

function CompactRow({fix,number,open,onToggle}:{fix:LadderFix;number:number;open:boolean;onToggle:()=>void}){return <div style={rowShell}><button type="button" onClick={onToggle} style={rowButton}><b style={{fontSize:15}}>{String(number).padStart(2,'0')}</b><div><div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><small style={{fontWeight:900}}>{fix.stage}</small><span style={miniSeverity}>{fix.severity}</span>{fix.persistent&&<span style={persistentPill}>REPEATED</span>}</div><strong style={{display:'block',marginTop:3}}>{fix.title}</strong></div><span>{open?'−':'+'}</span></button>{open&&<FixDetail fix={fix}/>}</div>}

function FixDetail({fix}:{fix:LadderFix}){
  const plan=coachingPlan(fix);
  return <div style={detailBody}>
    <div style={detailGrid}><MiniBlock label="WHY THIS MATTERS" text={fix.why}/><MiniBlock label="IN-GAME TRIGGER" text={plan.trigger}/></div>
    <div style={protocolShell}>
      <div className="eyebrow">HOW TO FIX IT · 3-STEP PROTOCOL</div>
      <div style={protocolGrid}>{plan.routine.map((step,index)=><div key={step} style={stepCard}><span style={stepNumber}>{index+1}</span><div><b>{stepHeading(index)}</b><p style={stepText}>{step}</p></div></div>)}</div>
    </div>
    <div style={detailGrid}>
      <div style={miniBlock}><div className="eyebrow">DO NOT DO THIS</div><div style={{display:'grid',gap:7,marginTop:7}}>{plan.avoid.map(item=><div key={item} style={avoidRow}><span>×</span><span>{item}</span></div>)}</div></div>
      <div style={miniBlock}><div className="eyebrow">SUCCESS CHECK</div><div style={{fontSize:12,lineHeight:1.5,marginTop:5}}>{plan.success}</div><div style={coachNote}>{plan.coachNote}</div></div>
    </div>
    <div style={masteryShell}><div><div className="eyebrow">MASTER IT WHEN</div><b style={{fontSize:13}}>{fix.mastery}</b></div>{fix.persistent&&<span style={persistentPill}>TRACKED ACROSS GAMES</span>}</div>
    {fix.persistent?<div className="muted" style={{fontSize:11,marginTop:10}}>Detected {fix.occurrences??0} time{fix.occurrences===1?'':'s'} across {fix.gamesSeen??0} tracked game{fix.gamesSeen===1?'':'s'}. OP CLIMB will keep this priority active until the pattern falls away consistently.</div>:fix.evidence.length?<EvidenceBlock evidence={fix.evidence}/>:null}
  </div>;
}

function EvidenceBlock({evidence}:{evidence:FightReview[]}){return <div style={{marginTop:12}}><div className="eyebrow">YOUR MATCH EVIDENCE</div><div style={{display:'grid',gap:7,marginTop:7}}>{evidence.slice(0,6).map((fight,index)=><div key={`${fight.atSeconds}-${index}`} style={evidenceRow}><b>{clock(fight.atSeconds)}</b><span>{fight.opponentChampion||fight.opponent||'Enemy'} · {fight.outcome}</span><span className="muted">{evidenceSummary(fight)}</span></div>)}</div></div>}

function evidenceSummary(fight:FightReview){
  const bits:string[]=[];
  const levelDelta=fight.evidence.levelDelta;
  const itemDelta=fight.evidence.itemGoldDelta;
  const pocket=fight.evidence.currentGold;
  if(typeof levelDelta==='number'&&levelDelta!==0)bits.push(`${levelDelta>0?'+':''}${levelDelta} lvl`);
  if(typeof itemDelta==='number'&&itemDelta!==0)bits.push(`${itemDelta>0?'+':''}${Math.round(itemDelta)}g items`);
  if(typeof pocket==='number'&&pocket>=500)bits.push(`${Math.round(pocket)}g pocket`);
  if(typeof fight.evidence.healthPct==='number')bits.push(`${Math.round(fight.evidence.healthPct*100)}% HP`);
  if(typeof fight.evidence.manaPct==='number')bits.push(`${Math.round(fight.evidence.manaPct*100)}% resource`);
  return bits.join(' · ')||fight.verdict;
}

function MiniBlock({label,text}:{label:string;text:string}){return <div style={miniBlock}><div className="eyebrow">{label}</div><div style={{fontSize:12,lineHeight:1.45,marginTop:5}}>{text}</div></div>}
function stepHeading(index:number){return index===0?'CHECK':index===1?'CREATE THE EDGE':'COMMIT OR LEAVE'}

function coachingPlan(fix:LadderFix):CoachingPlan{
  const key=normalize(`${fix.id} ${fix.title}`);
  if(key.includes('red state')||key.includes('history red_state')||key.includes('match red'))return{
    trigger:'Before every voluntary fight, run four checks: LEVEL, PURCHASED ITEMS, HP/RESOURCE and NUMBERS. If two or more are against you, treat the state as RED.',
    routine:['Pause the engage for one second. Compare your level and completed/major item power with the main enemy threat. Then check your HP/resource and whether both teams have equal numbers.','If the state is red, change one condition before fighting: add a teammate, force enemy HP down first, wait for ally CC, make the enemy walk into you, or disengage and spend gold.','Only re-enter when you have created a real edge. If the state is still red after 5–10 seconds, give the space/objective and take the next resource instead of gambling the fight.'],
    avoid:['Following a teammate into a bad fight just because they started it.','Using a kill from a disadvantaged fight as proof that the decision was good.','Re-entering after escaping when the level/item/HP disadvantage has not changed.'],
    success:'The goal is not “never fight while behind”. The goal is to stop taking clean, equal-number fights when the visible state already favours the enemy. A good game is one where every red-state fight had a reason: numbers, first damage, terrain, CC or a forced objective defence.',
    coachNote:'COACH CUE: RED = CHANGE THE FIGHT BEFORE YOU TAKE THE FIGHT.'
  };
  if(key.includes('spend')||key.includes('bank'))return{
    trigger:'Any time you are holding roughly 900g+ after a wave, camp, kill or objective, ask: “What meaningful component can I buy, and is there a safe reset now?”',
    routine:['Identify the purchase before you continue moving on the map. If the gold completes a strong component or full item, treat the reset as part of the play—not downtime.','Create the reset: crash/clear the safe wave, finish the camp, move out of enemy threat and recall. Do not add a low-value side fight while the purchase is sitting in your pocket.','Return to the map with the new item and look for the next fight from the upgraded state. Judge the sequence as FARM/KILL → SPEND → FIGHT, not FARM/KILL → FIGHT → MAYBE SPEND.'],
    avoid:['Staying because “one more wave” is available when you already have a major purchase.','Walking to an objective with 1200–1800g unspent unless the objective is genuinely unavoidable.','Counting banked gold as if it makes you stronger before it is converted into items.'],
    success:'You should increasingly arrive to voluntary fights with your earned gold already converted. The strongest signal is fewer deaths with a large bank and more fights immediately after meaningful purchases.',
    coachNote:'COACH CUE: GOLD IN THE BANK IS NOT POWER. BUY IT, THEN USE IT.'
  };
  if(key.includes('second death')||key.includes('chain'))return{
    trigger:'The moment you respawn after a death, the next 90 seconds become a RECOVERY WINDOW. Your job is to stabilise before you contest again.',
    routine:['On respawn, choose one safe resource first: a catchable wave, nearby camp or protected route. Do not path straight back toward the place you just died.','Rebuild information. Check which enemies are missing, where the next objective is, and whether your team actually has numbers before crossing into contested space.','Only re-enter a fight after you have recovered resources or the enemy gives you a clear favourable setup. If not, trade the fight for farm, plates, camps or opposite-side pressure.'],
    avoid:['Revenge pathing toward the player who killed you.','Running through unverified fog because teammates are already fighting.','Trying to “win back” the previous death immediately with another 50/50 play.'],
    success:'A clean recovery means the first death stays one death. Even if your team loses the next skirmish, you should not compound it by donating another kill before your economy and information recover.',
    coachNote:'COACH CUE: AFTER A DEATH, YOUR FIRST WIN IS NOT DYING AGAIN.'
  };
  if(key.includes('protect')||key.includes('lead')||key.includes('advantage'))return{
    trigger:'Whenever OP CLIMB shows you are clearly stronger in level/items, switch from “find a kill” to “convert the lead safely”.',
    routine:['Spend first if needed, then identify what the lead should buy you: safer farm, tower pressure, objective setup, vision control or forcing the enemy to answer a wave.','Make the enemy enter your threat. Hold the stronger area, play with teammates and attack the nearest safe target instead of chasing through uncontrolled space.','After winning a trade/fight, convert and reset. Take the guaranteed objective/resource, then leave before the enemy respawns or your HP/resources turn the winning state into an even one.'],
    avoid:['Chasing low-value targets deep into fog because you are fed.','Taking isolated stat-checks when your lead could create a guaranteed team advantage.','Staying on the map after a win until your HP, mana or unspent gold removes the advantage.'],
    success:'The lead should survive multiple minutes and create another advantage. Track whether your next death occurs while still ahead; those are the deaths this fix is designed to remove.',
    coachNote:'COACH CUE: A LEAD IS AN ASSET. CONVERT IT—DON’T GAMBLE IT.'
  };
  if(key.includes('empty')||key.includes('resource'))return{
    trigger:'Before committing, check your usable fight resources. Under ~55% HP or ~30% mana/resource is a warning unless the play is forced or immediately winning.',
    routine:['Decide whether you have enough HP/resource to survive the enemy’s first threat cycle and still contribute afterward. If not, your margin for error is already too small.','Shorten the play: poke from range, clear the wave, hold a safe angle, take the objective from distance, or reset. Let teammates with healthier states take first contact.','Commit only when the enemy is lower, a key threat is already spent, your team has numbers, or the reward is worth the forced risk.'],
    avoid:['Starting the fight because your cooldowns are ready while your HP/resource is not.','Treating 40% HP as “fine” because you are ahead in items.','Using flash/ultimate to enter a fight that you were too depleted to take normally.'],
    success:'You should see fewer deaths that begin from a depleted state. When you do fight low, there should be a clear forced reason rather than habit or impatience.',
    coachNote:'COACH CUE: LOW RESOURCE = LOW ERROR BUDGET.'
  };
  if(key.includes('setup')||key.includes('even'))return{
    trigger:'When level and item power are close, assume raw stats will not decide the fight. Your job is to WIN THE SETUP first.',
    routine:['Identify the fight-winning edge before engaging: numbers, first damage, vision denial, choke/terrain, ally CC, enemy cooldown usage or safer access to the nearest target.','Create that edge deliberately. Hold a bush, wait for the enemy to walk into range, let frontline draw a cooldown, poke first, or delay until a teammate arrives.','Once the edge appears, commit quickly and play the simple target you can hit safely. If no edge appears, do not force the even fight—reset the setup.'],
    avoid:['Coin-flipping front-to-back fights with no first advantage.','Crossing enemy threat range just to reach a higher-priority target.','Starting because both teams are present; presence is not setup.'],
    success:'Across several games, your even-state fights should become positive because you are manufacturing the advantage before damage starts, not trying to outplay after the fight is already neutral.',
    coachNote:'COACH CUE: IF THE STATS ARE EVEN, THE SETUP MUST NOT BE.'
  };
  if(key.includes('carry')||key.includes('uptime'))return{
    trigger:'When you are one of your team’s top two visible carries, every fight starts with one question: “What can reach me if I step forward?”',
    routine:['List the enemy access threats mentally: hard engage, assassin gap-close, hook, flank or long-range CC. Keep enough distance that at least one teammate/terrain layer sits between you and that threat.','Hit the nearest safe target until the major access tool is used. Do not cross an uncontrolled threat line just to reach the enemy carry; your damage only matters while you are alive.','After the first threat cycle is spent, step forward and increase damage. Preserve Flash/defensive tools for the threat that actually kills you, not for extra damage on a target already dying.'],
    avoid:['Being the first high-value champion visible to enemy engage.','Walking past frontline to hit a lower-health target.','Chasing after a won fight when your death would remove Baron/Dragon/tower pressure.'],
    success:'You are still alive after the enemy’s first engage cycle and remain available for the second half of the fight/objective. Fewer high-value deaths before objectives is the key trend.',
    coachNote:'COACH CUE: YOUR JOB IS NOT TO HIT THE BEST TARGET. IT IS TO HIT THE BEST TARGET YOU CAN REACH SAFELY.'
  };
  return{
    trigger:'Watch for the same game state that produced this repeated pattern. Pause before committing and ask what condition needs to change.',
    routine:['Identify the exact trigger from the evidence timestamp.','Choose one simple decision rule that removes the trigger before acting.','Repeat the rule for three games and judge the trend, not one isolated result.'],
    avoid:['Changing several behaviours at once.','Judging the decision only by whether the play happened to work.','Ignoring the pattern because one game looked cleaner.'],
    success:'The pattern should become less frequent across completed games and eventually stop being the highest-priority leak.',
    coachNote:'COACH CUE: FIX THE REPEATABLE DECISION, NOT THE SCORELINE.'
  };
}

function fromHistory(fix:ProHistoryFix):LadderFix{return{id:`history-${fix.key}`,stage:fix.stage,severity:fix.severity,title:fix.title,oneLine:`Repeated in ${fix.gamesSeen} tracked game${fix.gamesSeen===1?'':'s'}.`,rule:fix.rule,mastery:fix.mastery,why:fix.why,evidence:[],persistent:true,gamesSeen:fix.gamesSeen,occurrences:fix.occurrences}}
function mergeFixes(history:LadderFix[],current:LadderFix[]):LadderFix[]{const seen=new Set<string>();const out:LadderFix[]=[];for(const fix of history){out.push(fix);seen.add(normalize(fix.title))}for(const fix of current){if(!seen.has(normalize(fix.title)))out.push(fix)}return out.slice(0,7)}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

function buildMatchFixes(fights:FightReview[]):MatchFix[]{
  const deaths=fights.filter(f=>f.outcome==='DEATH'),rows:MatchFix[]=[];
  const high=deaths.filter(f=>(f.evidence.currentGold??0)>=900),red=deaths.filter(f=>f.verdict==='THEM_STRONGER'),chain=deaths.filter((f,i)=>i>0&&f.atSeconds-deaths[i-1].atSeconds<=90),thrown=deaths.filter(f=>f.verdict==='YOU_STRONGER'),low=deaths.filter(f=>(f.evidence.healthPct??1)<.55||(f.evidence.manaPct??1)<.3),even=deaths.filter(f=>f.verdict==='EVEN');
  const add=(id:string,stage:FixStage,evidence:FightReview[],title:string,oneLine:string,rule:string,mastery:string,why:string)=>{if(evidence.length)rows.push({id:`match-${id}`,stage,severity:severity(evidence.length),title,oneLine,rule,mastery,why,evidence})};
  add('bank','QUICK WIN',high,'Spend before you fight','You died with meaningful gold still unspent.','If a safe reset buys meaningful power, bank before the next voluntary fight.','3 completed games with no reviewed death while carrying 900g+.','Unspent gold gives you no combat stats until it is converted into items.');
  add('red','CONTROL',red,'Stop accepting red-state fights','You died after visible power had already moved against you.','If level/item state is red, add numbers, setup or first damage before committing.','3 games with zero deaths from clearly enemy-favoured visible states.','The leak starts with fight selection, before mechanics can save the play.');
  add('chain','CONTROL',chain,'Break the second death','Another death followed within 90 seconds.','After dying: collect safe resources, rebuild information, then re-enter.','3 games with no second death inside 90 seconds.','The second death compounds the first loss and removes your recovery window.');
  add('throw','DISCIPLINE',thrown,'Protect your advantage','You created a stronger visible state and still gave it back.','When ahead, force the enemy to enter your threat instead of turning the lead into an uncontrolled chase.','3 games with zero reviewed deaths from a clearly stronger state.','A lead only matters when it survives long enough to convert into the next advantage.');
  add('resource','DISCIPLINE',low,'Stop fighting on empty','Low HP or resource reduced your margin for error.','Check HP/resource before committing; shorten the play or leave when the state is red.','3 games with no reviewed death beginning below the danger threshold.','Low resources make otherwise recoverable execution errors lethal.');
  add('even','ADVANCED',even,'Win the setup before the fight','Visible combat power was close, so setup mattered more.','Earn numbers, first damage, terrain, ally CC or safer target access before committing.','Across 3 games, convert more even-state reviewed fights than you lose.','When raw stats are close, setup quality becomes the deciding advantage.');
  return rows.slice(0,5);
}
function severity(n:number):Severity{return n>=4?'CRITICAL LEAK':n>=3?'MAJOR LEAK':n>=2?'ACTIVE LEAK':'POLISH'}
function clock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}

const tierPill:React.CSSProperties={padding:'7px 10px',borderRadius:999,border:'1px solid rgba(182,246,107,.3)',fontSize:10,fontWeight:950,letterSpacing:'.08em'};
const stageRail:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:6};
const stageCell:React.CSSProperties={display:'grid',gap:3,padding:'9px 8px',border:'1px solid rgba(255,255,255,.08)',borderRadius:11,minWidth:0};
const activeShell:React.CSSProperties={border:'1px solid rgba(182,246,107,.28)',borderRadius:16,overflow:'hidden',background:'rgba(182,246,107,.025)'};
const activeButton:React.CSSProperties={width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:14,alignItems:'center',padding:'16px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'};
const ruleBar:React.CSSProperties={display:'grid',gap:4,padding:'11px 16px',borderTop:'1px solid rgba(182,246,107,.15)',background:'rgba(182,246,107,.035)',fontSize:12};
const severityPill:React.CSSProperties={padding:'4px 7px',borderRadius:999,border:'1px solid rgba(255,120,120,.3)',fontSize:8,fontWeight:950,letterSpacing:'.07em'};
const persistentPill:React.CSSProperties={padding:'4px 7px',borderRadius:999,border:'1px solid rgba(182,246,107,.22)',fontSize:8,fontWeight:900,letterSpacing:'.06em'};
const rowShell:React.CSSProperties={border:'1px solid rgba(255,255,255,.08)',borderRadius:13,overflow:'hidden',background:'rgba(255,255,255,.018)'};
const rowButton:React.CSSProperties={width:'100%',display:'grid',gridTemplateColumns:'38px minmax(0,1fr) auto',gap:10,alignItems:'center',padding:'11px 13px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'};
const miniSeverity:React.CSSProperties={padding:'3px 6px',borderRadius:999,border:'1px solid rgba(255,255,255,.1)',fontSize:8,fontWeight:800};
const detailBody:React.CSSProperties={padding:'14px',borderTop:'1px solid rgba(255,255,255,.07)',display:'grid',gap:10};
const detailGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:8};
const miniBlock:React.CSSProperties={padding:'12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:11,background:'rgba(255,255,255,.012)'};
const protocolShell:React.CSSProperties={padding:'12px',border:'1px solid rgba(182,246,107,.14)',borderRadius:12,background:'rgba(182,246,107,.018)'};
const protocolGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8,marginTop:9};
const stepCard:React.CSSProperties={display:'grid',gridTemplateColumns:'28px minmax(0,1fr)',gap:9,padding:'10px',border:'1px solid rgba(255,255,255,.07)',borderRadius:10};
const stepNumber:React.CSSProperties={display:'grid',placeItems:'center',width:26,height:26,borderRadius:999,border:'1px solid rgba(182,246,107,.3)',fontWeight:950,fontSize:11};
const stepText:React.CSSProperties={fontSize:11,lineHeight:1.5,margin:'4px 0 0',opacity:.82};
const avoidRow:React.CSSProperties={display:'grid',gridTemplateColumns:'16px minmax(0,1fr)',gap:7,fontSize:11,lineHeight:1.4};
const coachNote:React.CSSProperties={marginTop:9,padding:'8px 9px',borderLeft:'2px solid rgba(182,246,107,.55)',fontSize:10,fontWeight:900,lineHeight:1.4};
const masteryShell:React.CSSProperties={display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'11px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:11};
const evidenceRow:React.CSSProperties={display:'grid',gridTemplateColumns:'52px minmax(110px,.6fr) minmax(180px,1.4fr)',gap:9,alignItems:'center',padding:'8px 9px',border:'1px solid rgba(255,255,255,.065)',borderRadius:9,fontSize:10};
const detailsShell:React.CSSProperties={padding:'10px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:12};
const summaryStyle:React.CSSProperties={cursor:'pointer',fontSize:10,fontWeight:900,letterSpacing:'.07em'};
const lockedRow:React.CSSProperties={display:'grid',gridTemplateColumns:'34px minmax(0,1fr) auto',gap:8,alignItems:'center',fontSize:11,opacity:.6};
const historyBar:React.CSSProperties={display:'flex',gap:14,flexWrap:'wrap',paddingTop:3,fontSize:10,opacity:.72};
const empty:React.CSSProperties={display:'grid',gap:4,padding:14,border:'1px solid rgba(255,255,255,.08)',borderRadius:13};
