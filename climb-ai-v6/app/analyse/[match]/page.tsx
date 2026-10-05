'use client';

import {useEffect,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {MetricCard,PageHead} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {filterHistoryForTier,historyWindowLabel,requiredTierForHistoryDate,type SubscriptionTier} from '@/lib/subscription';
import {useProMatch} from '@/components/useProMatch';
import {analyseMatch} from '@/lib/engine';
import {coachingLevelFor} from '@/lib/coachingLevel';
import type {Match} from '@/lib/types';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAIN_COLORS,dnaDomainLabel} from '@/lib/dnaDomain';
import {positiveEvidenceForMatch} from '@/lib/positiveEvidence';
import type {StrengthEvidence} from '@/lib/positiveEvidence';
import type {ProLeakSignal,ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';

const pct=(n?:number)=>n===undefined?'Unavailable':`${Math.round(n*100)}%`;
const num=(n?:number,suffix='')=>n===undefined?'Unavailable':`${n>0&&suffix==='g'?'+':''}${Number.isInteger(n)?n:n.toFixed(1)}${suffix}`;

export default function Analysis(){
  const params=useParams<{match:string}>();
  const {active,hydrated}=useAccount();
  const {tier}=useSubscription();
  const {tasks}=useLearningPlan();
  const [serverMatch,setServerMatch]=useState<Match|null>(null);
  const [serverLoading,setServerLoading]=useState(false);
  const [serverCheckedId,setServerCheckedId]=useState('');
  const [serverHistoryLock,setServerHistoryLock]=useState<SubscriptionTier|null>(null);
  const id=String(params.match||'');
  const allMatches=matchesFor(active.id);
  const matches=filterHistoryForTier(allMatches,tier);
  const cachedMatch=matches.find(m=>m.id===id);
  const cachedHistoricalMatch=!cachedMatch?allMatches.find(m=>m.id===id):undefined;
  const match=cachedMatch??serverMatch??undefined;
  const detail=coachingLevelFor(active.rank);
  const embeddedPro=match?.proAnalysis;
  const {analysis:fetchedPro,loading:fetchingPro}=useProMatch(embeddedPro?undefined:match?.id);
  const proAnalysis=embeddedPro??fetchedPro??undefined;
  const proLoading=!embeddedPro&&fetchingPro;

  useEffect(()=>{setServerMatch(null);setServerCheckedId('');setServerHistoryLock(null)},[id,active.id]);

  useEffect(()=>{
    if(!hydrated||!id||cachedMatch||cachedHistoricalMatch||serverCheckedId===id)return;
    const controller=new AbortController();
    setServerLoading(true);
    void fetch('/api/analyse',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({matchId:id}),
      signal:controller.signal,
    }).then(async response=>{
      const body=await response.json().catch(()=>null);
      if(controller.signal.aborted)return;
      if(response.ok&&body?.match&&body.match.riotAccountId===active.id)setServerMatch(body.match as Match);
      else if(response.status===403&&body?.upgradeRequired)setServerHistoryLock((body.requiredTier||'PRO') as SubscriptionTier);
    }).catch(()=>{}).finally(()=>{
      if(controller.signal.aborted)return;
      setServerCheckedId(id);
      setServerLoading(false);
    });
    return()=>controller.abort();
  },[hydrated,id,cachedMatch,cachedHistoricalMatch,serverCheckedId,active.id]);

  if(!hydrated)return <AppShell><section className="glass card"><div className="eyebrow">MATCH REVIEW</div><h2>Loading your evidence…</h2></section></AppShell>;

  if(cachedHistoricalMatch||serverHistoryLock){
    const required=serverHistoryLock??requiredTierForHistoryDate(cachedHistoricalMatch!.createdAt);
    return <AppShell><section className="glass card">
      <div className="eyebrow">HISTORY LIMIT · {tier}</div>
      <h2>This match sits outside {historyWindowLabel(tier).toLowerCase()}.</h2>
      <p className="muted">{required==='PLUS'?'PLUS unlocks match history up to 90 days.':'PRO unlocks long-term match history and persistent development context.'}</p>
      <div className="hero-actions"><Link className="btn primary" href="/pricing">SEE {required} →</Link><Link className="btn secondary" href="/analyse">BACK TO MY GAMES</Link></div>
    </section></AppShell>;
  }

  if(!cachedMatch&&(serverLoading||serverCheckedId!==id))return <AppShell><section className="glass card"><div className="eyebrow">MATCH REVIEW</div><h2>Loading the saved match…</h2><p className="muted">Opening the server copy directly so a newly completed Companion game cannot be blocked by stale browser state.</p></section></AppShell>;

  if(!match)return <AppShell><PageHead title="Match not found" subtitle="This review is not attached to the active Riot account."/><section className="glass card"><p className="muted">Switch back to the account that played this game or open a match from Analyse.</p><Link className="btn primary" href="/analyse">OPEN ANALYSE</Link></section></AppShell>;

  if(proLoading)return <AppShell><section className="glass card"><div className="eyebrow">COACHING EVIDENCE</div><h2>Reading the full game evidence…</h2><p className="muted">The review will appear once its coaching authority is resolved, so a scoreboard fallback cannot flash a different limiter first.</p></section></AppShell>;

  const matchRole=canonicalLeagueRole(match.role);
  const recent=matches.filter(m=>m.id!==match.id&&(!matchRole||canonicalLeagueRole(m.role)===matchRole));
  const report=analyseMatch({...match,proAnalysis},recent);
  const strengths=positiveEvidenceForMatch({...match,proAnalysis},active.rank);
  const missionResults=tasks.flatMap(task=>{
    const attempt=(task.missionHistory??[]).find(rep=>rep.matchId===id);
    return attempt?[{task,attempt}]:[];
  });
  const plainProblems=plainProblemCards(match,proAnalysis,report.primary.category,report.mission.dnaDomain).slice(0,2);
  const nextAction=plainNextAction(report.primary.category,match.opponent);

  return <AppShell>
    <PageHead title={`${match.champion} vs ${match.opponent||'Unknown'}`} subtitle={`${match.result} · ${match.rank} · ${detail.tier} REVIEW ${detail.depth}/10${detail.depth>=3?` · ${Math.floor(match.durationSeconds/60)}:${String(match.durationSeconds%60).padStart(2,'0')}`:''}`}/>
    {missionResults.length>0&&<section className="ar-mission-update">
      <div className="ar-mission-update-head"><div><div className="eyebrow">MISSION UPDATE</div><h2>This game counted.</h2></div><Link href={"/ilp?game="+encodeURIComponent(id)}>SEE MY PROGRESS →</Link></div>
      <div className="ar-mission-update-grid">{missionResults.map(({task,attempt})=>{
        const plain=plainLanguageFocus(task);
        const latest=(task.missionHistory??[]).at(-1)?.matchId===id;
        const mastered=task.status==='MASTERED'&&latest&&attempt.banksPass;
        const xp=attempt.banksPass?XP_PER_PROVEN_REP+(mastered?XP_PER_MISSION_MASTERY:0):0;
        return <article key={task.id}>
          <span>{attempt.banksPass?'PROVEN REP':'REVIEWED GAME'}</span>
          <b>{plain.name}</b>
          <MissionMeasurementBadge metric={task.metric} compact/>
          <strong className={attempt.banksPass?'good':'watch'}>{mastered?'MASTERED ✓':attempt.banksPass?'PASS ✓':'NOT BANKED'}</strong>
          <small>{attempt.banksPass?('+'+xp+' XP · '+(mastered?'mission completed':'rep banked')):'The metric did not clear the proof bar this game.'}</small>
        </article>;
      })}</div>
    </section>}
    <section className="ar-strengths">
      <div className="ar-strengths-head">
        <div>
          <div className="eyebrow">VERIFIED STRENGTHS · WHAT TO KEEP</div>
          <h2>Good play counts too.</h2>
          <p>These are not compliments. They are measurable decisions or outcomes that cleared a rank-relative or decision-evidence bar.</p>
        </div>
        <b>{strengths.length} VERIFIED</b>
      </div>
      {strengths.length?<div className="ar-strength-grid">
        {strengths.slice(0,4).map(item=><article key={item.id} style={({ '--strand-color':DNA_DOMAIN_COLORS[item.dnaDomain]} as CSSProperties)}>
          <span>{dnaDomainLabel(item.dnaDomain)} → {item.subskill}</span>
          <h3>{item.title}</h3>
          <div className="ar-strength-simple">
            <b>WHAT YOU DID</b>
            <p>{item.whatHappened}</p>
          </div>
          <div className="ar-strength-simple">
            <b>WHY IT MATTERED</b>
            <p>{item.whyItMattered}</p>
          </div>
          <em>REPEAT THIS</em>
          <details className="ar-strength-proof">
            <summary>SHOW THE PROOF</summary>
            <div><span>{item.technicalLabel}</span><strong>{item.value}</strong><small>Bar · {item.target} · {item.confidence} confidence</small></div>
            {item.proof.length>0&&<ul>{item.proof.map(line=><li key={line}>{line}</li>)}</ul>}
          </details>
        </article>)}
      </div>:<div className="ar-strength-empty">
        <b>No verified strength was strong enough to call yet.</b>
        <p>OP CLIMB will not invent praise. Keep collecting games until a good behaviour clears a measurable evidence bar.</p>
      </div>}
    </section>
    <div className="grid five"><MetricCard label={detail.depth<=2?'SCORELINE':'KDA'} value={`${match.kills}/${match.deaths}/${match.assists}`}/>{detail.depth>=2&&<MetricCard label="CS/MIN" value={match.metrics.csPerMin.toFixed(1)}/>} {detail.depth>=4&&<MetricCard label="GOLD/MIN" value={match.metrics.goldPerMin??'N/A'}/>} {detail.depth>=5&&<MetricCard label="KILL PARTICIPATION" value={pct(match.metrics.killParticipation)}/>} {detail.depth>=6&&<MetricCard label="DAMAGE SHARE" value={pct(match.metrics.damageShare)}/>}</div>
    {detail.depth>=3&&<div className="phase-grid" style={{marginTop:18}}><div className="glass card"><div className="eyebrow">LANE PHASE</div><div className="league-row"><span>CS @ 10</span><b>{match.metrics.csAt10??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>CS @ 15</span><b>{match.metrics.csAt15??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>Lane CS/min</span><b>{num(match.metrics.laneCsPerMin)}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Gold diff @ 15</span><b>{num(match.metrics.goldDiffAt15,'g')}</b></div>}{detail.depth>=6&&<div className="league-row"><span>XP diff @ 15</span><b>{num(match.metrics.xpDiffAt15)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Level @ 15</span><b>{match.metrics.levelAt15??'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">AFTER LANE</div><div className="league-row"><span>Post-15 CS/min</span><b>{num(match.metrics.post15CsPerMin)}</b></div>{detail.depth>=4&&<div className="league-row"><span>First item</span><b>{match.metrics.firstItemMinute?`${match.metrics.firstItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Second item</span><b>{match.metrics.secondItemMinute?`${match.metrics.secondItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Objective involvement</span><b>{pct(match.metrics.objectiveParticipation)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Items shown</span><b>{match.items?.join(' · ')||'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">DEATHS</div><div className="league-row"><span>After 20</span><b>{match.metrics.deathsPost20??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>Before 10</span><b>{match.metrics.deathsPre10??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>10–20</span><b>{match.metrics.deaths10to20??'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Solo deaths</span><b>{match.metrics.soloDeaths??'Unavailable'}</b></div>}{detail.depth>=6&&<div className="league-row"><span>Teamfight deaths</span><b>{match.metrics.teamfightDeaths??'Unavailable'}</b></div>}</div></div>}
    <section className="ar-plain-coach">
      <header className="ar-story panel">
        <div>
          <span>YOUR GAME IN PLAIN ENGLISH</span>
          <h2>{plainStoryHeadline(match,strengths.length,plainProblems.length)}</h2>
          <p>{plainStoryText(match,strengths,plainProblems[0]?.title||plainProblemTitle(report.primary.category))}</p>
        </div>
        <aside>
          <small>THE MAIN THING TO CHANGE</small>
          <b>{plainProblems[0]?.title||plainProblemTitle(report.primary.category)}</b>
        </aside>
      </header>

      <div className="ar-coach-columns">
        <section className="ar-helped">
          <div className="ar-coach-section-head">
            <div><span>WHAT HELPED YOU</span><h2>Keep doing these.</h2></div>
            <b>{Math.min(3,strengths.length)} EXAMPLE{Math.min(3,strengths.length)===1?'':'S'}</b>
          </div>
          <div className="ar-coach-card-list">
            {strengths.slice(0,3).map((item,index)=>{
              const example=plainStrengthExample(match,item);
              return <article className="ar-coach-card good" key={item.id} style={({ '--strand-color':DNA_DOMAIN_COLORS[item.dnaDomain]} as CSSProperties)}>
                <div className="ar-coach-index">{String(index+1).padStart(2,'0')}</div>
                <div className="ar-coach-body">
                  <span>THIS HELPED</span>
                  <h3>{plainStrengthTitle(item)}</h3>
                  <div className="ar-coach-explain"><b>WHAT HAPPENED</b><p>{item.whatHappened}</p></div>
                  <div className="ar-game-example"><div>{example.clock&&<strong>{example.clock}</strong>}<b>EXAMPLE FROM YOUR GAME</b></div><p>{example.text}</p></div>
                  <div className="ar-coach-explain why"><b>WHY IT HELPED</b><p>{item.whyItMattered}</p></div>
                </div>
              </article>;
            })}
            {!strengths.length&&<div className="ar-coach-empty"><b>No positive behaviour was clear enough to call yet.</b><p>OP CLIMB will wait for real evidence rather than giving you empty praise.</p></div>}
          </div>
        </section>

        <section className="ar-hurt">
          <div className="ar-coach-section-head">
            <div><span>WHAT HURT YOU</span><h2>Change these next.</h2></div>
            <b>{plainProblems.length} PATTERN{plainProblems.length===1?'':'S'}</b>
          </div>
          <div className="ar-coach-card-list">
            {plainProblems.map((item,index)=><article className="ar-coach-card bad" key={item.key} style={({ '--strand-color':DNA_DOMAIN_COLORS[item.domain]} as CSSProperties)}>
              <div className="ar-coach-index">{String(index+1).padStart(2,'0')}</div>
              <div className="ar-coach-body">
                <span>THIS COST YOU</span>
                <h3>{item.title}</h3>
                <div className="ar-coach-explain"><b>WHAT HAPPENED</b><p>{item.what}</p></div>
                <div className="ar-game-example"><div>{item.clock&&<strong>{item.clock}</strong>}<b>EXAMPLE FROM YOUR GAME</b></div><p>{item.example}</p></div>
                <div className="ar-coach-explain why"><b>WHY IT HURT</b><p>{item.why}</p></div>
              </div>
            </article>)}
          </div>
        </section>
      </div>

      <section className="ar-next-action panel" style={({ '--strand-color':DNA_DOMAIN_COLORS[report.mission.dnaDomain]} as CSSProperties)}>
        <div className="ar-next-number">01</div>
        <div className="ar-next-copy">
          <span>NEXT GAME · ONE THING ONLY</span>
          <small>{dnaDomainLabel(report.mission.dnaDomain)}</small>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.action}</p>
          <div className="ar-next-example"><b>IN A REAL GAME</b><span>{nextAction.example}</span></div>
          <details>
            <summary>SHOW THE MEASUREMENT</summary>
            <p>OP CLIMB tracks this across {report.mission.gamesRequired} relevant games. Technical pass bar: {report.mission.target} {report.mission.unit}.</p>
          </details>
        </div>
        <Link className="btn primary" href={"/ilp?game="+encodeURIComponent(id)}>SEE MY PROGRESS →</Link>
      </section>
    </section>
    <section className="glass card ar-review-finish" style={{marginTop:18}}>
      <div>
        <div className="eyebrow">REVIEW COMPLETE</div>
        <h2>Your next stop is My Climb.</h2>
        <p className="muted">The detailed review explains the game. My Climb is where the result becomes learning: strengths, proven reps, DNA growth and your next challenge.</p>
      </div>
      <Link href={"/ilp?game="+encodeURIComponent(id)} className="btn primary">SEE MY PROGRESS →</Link>
    </section>
    {detail.depth>=7&&<div className="glass card data-note" style={{marginTop:18}}><div className="eyebrow">DATA RELIABILITY</div><p className="muted">Scoreboard-only matches create a foundation grade from KDA, CS and duration. Exact recall quality, spacing, target selection and fight timing require Riot timeline, live telemetry or reviewed video evidence.</p></div>}
  </AppShell>;
}

type PlainProblemCard={key:string;title:string;what:string;example:string;why:string;clock?:string;domain:import('@/lib/types').DnaDomain};

function plainProblemCards(match:Match,proAnalysis:ProMatchAnalysis|undefined,category:import('@/lib/types').IssueCategory,domain:import('@/lib/types').DnaDomain):PlainProblemCard[]{
  const leaks=(proAnalysis?.leakSignals??[]).filter(item=>item.count>0);
  const cards=leaks.slice(0,2).map(leak=>plainLeakCard(match,leak,domain));
  if(cards.length)return cards;
  const moment=(match.moments??[]).find(item=>item.type==='DEATH'&&item.severity!=='LOW')??(match.moments??[]).find(item=>item.type==='DEATH');
  return[{key:'main',title:plainProblemTitle(category),what:plainProblemWhat(category,match.opponent),example:moment?plainMoment(moment):plainProblemExample(category),why:plainProblemWhy(category),clock:moment?.clock,domain}];
}

function plainLeakCard(match:Match,leak:ProLeakSignal,domain:import('@/lib/types').DnaDomain):PlainProblemCard{
  const seconds=leak.evidenceSeconds[0];
  const moment=typeof seconds==='number'?nearestMoment(match,seconds):null;
  const clockValue=typeof seconds==='number'?plainClock(seconds):moment?.clock;
  if(leak.key==='BANKING_LEAK')return{key:leak.key,title:'You fought before spending your gold',what:'You had already earned useful gold, but you entered a dangerous fight before turning it into items.',example:moment?plainMoment(moment):'You died while still holding enough gold for a meaningful purchase.',why:'Gold in your pocket gives you no extra damage or defence. Buying first would have made the same fight easier.',clock:clockValue,domain};
  if(leak.key==='RED_STATE')return{key:leak.key,title:'You fought when the enemy already had the advantage',what:'You committed to a fight where the visible levels or items were already better for the other side.',example:moment?plainMoment(moment):'The fight started with the enemy already stronger and ended in your death.',why:'You needed a much bigger outplay just to break even. Waiting or backing away would have protected the game.',clock:clockValue,domain};
  if(leak.key==='CHAIN_DEATH')return{key:leak.key,title:'You went back into danger too quickly',what:'After one death, you were caught again before you had properly recovered.',example:moment?plainMoment(moment):'A second death followed soon after the previous one.',why:'One mistake became two. A short reset would have stopped the first death becoming a bigger problem.',clock:clockValue,domain};
  if(leak.key==='LEAD_THROW')return{key:leak.key,title:'You gave away an advantage you had already earned',what:'You were in the stronger position, but the next fight still ended with you dying.',example:moment?plainMoment(moment):'You entered the moment with an advantage but did not get out safely.',why:'When you are ahead, staying alive keeps the opponent under pressure. Dying gives them a way back into the game.',clock:clockValue,domain};
  if(leak.key==='CARRY_DEATH')return{key:leak.key,title:'You died when your team needed you alive',what:'You were one of your team’s more valuable players, then died during an important window.',example:moment?plainMoment(moment):'Your team lost one of its strongest sources of damage or gold value.',why:'That death cost more because your team had more resources invested in you.',clock:clockValue,domain};
  return{key:leak.key,title:'The same problem happened more than once',what:'This pattern appeared repeatedly in the match.',example:moment?plainMoment(moment):plainLeakText(leak.detail),why:'A repeated mistake matters more than one isolated moment because it can keep costing you in future games.',clock:clockValue,domain};
}

function plainStrengthExample(match:Match,item:StrengthEvidence){
  if(typeof item.atSeconds==='number'){
    const moment=nearestMoment(match,item.atSeconds);
    if(moment)return{clock:plainClock(item.atSeconds),text:plainMoment(moment)};
    return{clock:plainClock(item.atSeconds),text:item.whatHappened};
  }
  return{clock:undefined,text:item.whatHappened};
}

function nearestMoment(match:Match,seconds:number){
  const moments=match.moments??[];
  if(!moments.length)return null;
  let best=moments[0],distance=Math.abs(moments[0].atMs/1000-seconds);
  for(const moment of moments.slice(1)){const next=Math.abs(moment.atMs/1000-seconds);if(next<distance){best=moment;distance=next}}
  return distance<=30?best:null;
}

function plainMoment(moment:NonNullable<Match['moments']>[number]){return moment.cost?moment.text+' '+moment.cost:moment.text}
function plainClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

function plainStrengthTitle(item:StrengthEvidence){
  const map:Record<string,string>={
    'Protected your value in fights':'You stayed alive when your team needed you',
    'Chose your fight entries well':'You picked safer fights',
    'Turned advantages into winning fights':'You used your advantages well',
    'Balanced farming and fighting well':'You farmed without missing the important fights',
    'Protected your advantage':'You kept your lead safe',
    'Stayed alive when your life mattered most':'You stayed alive in the important moments',
  };
  return map[item.title]??item.title;
}

function plainProblemTitle(category:import('@/lib/types').IssueCategory){
  const map:Record<import('@/lib/types').IssueCategory,string>={
    FARMING:'You left too much farm on the map',POSITIONING:'You stood where the enemy could punish you',DEATHS:'Too many deaths stopped you using your good moments',LANING:'Your early lane gave away too much',TRADING:'Some trades cost you more than they gave back',WAVE_MANAGEMENT:'The wave put you in awkward positions',TEMPO:'You stayed too long when it was time to leave',OBJECTIVES:'You were not ready early enough for important objectives',VISION:'You moved into areas without enough information',TEAMFIGHTING:'Some fights started on bad terms for you',TARGET_SELECTION:'You made fights harder by hitting the wrong target',RECALL_TIMING:'You stayed out too long before buying',RESOURCE_COLLECTION:'You stopped collecting enough gold after lane',MAP_AWARENESS:'Important plays happened before you reacted',CHAMPION_MASTERY:'You are still learning when your champion is strongest',ITEMISATION:'Your purchases did not fully answer this game',MATCHUPS:'The same enemy problem caught you more than once',CONSISTENCY:'A good decision was not repeated often enough'
  };return map[category];
}

function plainProblemWhat(category:import('@/lib/types').IssueCategory,opponent?:string){
  if(category==='MATCHUPS')return opponent?opponent+' kept creating the same difficult situation and you did not change the setup enough before the next interaction.':'The same enemy threat kept creating the same difficult situation.';
  if(category==='POSITIONING')return'The enemy was able to reach or punish you where a safer starting position would have helped.';
  if(category==='DEATHS')return'Several deaths removed you from the map and reduced the value of the good things you did elsewhere.';
  if(category==='FARMING'||category==='RESOURCE_COLLECTION')return'Your gold income dropped while safe resources were still available.';
  if(category==='RECALL_TIMING'||category==='TEMPO')return'You stayed on the map when leaving, buying and returning would have been safer.';
  if(category==='OBJECTIVES')return'You arrived at important map moments after the useful setup window had already started.';
  return'The same decision pattern made the game harder than it needed to be.';
}
function plainProblemWhy(category:import('@/lib/types').IssueCategory){
  if(category==='MATCHUPS')return'If the same threat works twice, the opponent can keep using it until you change your distance, timing or setup.';
  if(category==='POSITIONING')return'Good mechanics cannot help if the enemy can reach you for free.';
  if(category==='DEATHS')return'Every death removes your gold, pressure and availability for the next play.';
  if(category==='FARMING'||category==='RESOURCE_COLLECTION')return'Less farm means later items, which makes later fights harder.';
  if(category==='RECALL_TIMING'||category==='TEMPO')return'Earned gold only becomes useful after you spend it.';
  if(category==='OBJECTIVES')return'Arriving early gives you better positions and more choices.';
  return'Repeating the same costly decision matters more than one isolated mistake.';
}
function plainProblemExample(category:import('@/lib/types').IssueCategory){
  if(category==='MATCHUPS')return'The same enemy or spell created the problem again instead of the next interaction looking different.';
  if(category==='POSITIONING')return'An enemy threat reached you before you had enough space to react.';
  if(category==='FARMING'||category==='RESOURCE_COLLECTION')return'Your resource collection dropped below the level needed to keep your item timings healthy.';
  return'The match data showed this pattern more than once.';
}
function plainLeakText(detail:string){
  return detail.replace('Deaths while carrying 1200g+.','You died before spending a large amount of gold.').replace('Deaths taken from an already enemy-favoured visible state.','You died in fights where the enemy was already stronger.').replace('Second deaths inside 90 seconds.','You died again soon after the previous death.').replace('Deaths from a visibly stronger state.','You died even though you started from the stronger position.').replace('Deaths while top-two on team visible item value.','You died while holding a large share of your team’s item value.');
}
function plainNextAction(category:import('@/lib/types').IssueCategory,opponent?:string){
  if(category==='MATCHUPS')return{title:'Change the setup when the same threat catches you twice.',action:'Before the next interaction, change one thing: your distance, your timing, or whether you take the fight at all.',example:opponent?'If '+opponent+' catches you once with the same spell or pattern, do not replay the exact same setup. Stand further back, wait for it to be used, or step up only with help nearby.':'If the same spell catches you once, change the setup before you interact again.'};
  if(category==='POSITIONING')return{title:'Start fights from somewhere the enemy cannot reach for free.',action:'Before dealing damage, identify the main threat and stay outside its easy engage range.',example:'If the enemy still has their main engage, stay behind your frontline. Move forward after that threat has been used.'};
  if(category==='DEATHS')return{title:'Make one death stay one death.',action:'After dying, rebuild first: collect safe resources, check the map and avoid forcing the very next fight.',example:'Do not run straight back toward the same danger. Take the safe wave, reset your information, then choose the next play.'};
  if(category==='FARMING'||category==='RESOURCE_COLLECTION')return{title:'Take the safe farm before joining low-value fights.',action:'When nothing important is about to happen, collect the closest safe wave or camp before moving.',example:'If Dragon is not spawning soon and your team is only hovering, take the safe wave instead of standing around waiting.'};
  if(category==='RECALL_TIMING'||category==='TEMPO')return{title:'Spend your gold before the next important fight.',action:'When you can make a meaningful purchase and no objective is immediate, reset instead of staying for one more risky play.',example:'After winning a fight or clearing a wave, buy first if the next important event is still far enough away.'};
  if(category==='OBJECTIVES')return{title:'Be ready before the objective starts.',action:'Reset, buy and move early enough that you choose your position rather than arriving late.',example:'For Dragon, finish your last safe resource, buy, then move toward river before the fight begins.'};
  return{title:'Change the repeated decision, not everything at once.',action:'When the same situation appears again, make one deliberate change before repeating the old choice.',example:'Use the first mistake as information. Next time, change your position, timing or decision instead of replaying it.'};
}
function plainStoryHeadline(match:Match,goodCount:number,badCount:number){
  if(match.result==='WIN'&&goodCount&&badCount)return'You did enough good things to win — but one pattern still made it harder.';
  if(match.result==='WIN'&&goodCount)return'The win had real good habits underneath it.';
  if(match.result==='LOSS'&&goodCount)return'The result was a loss, but there were useful things worth keeping.';
  return'This game gives you one clear thing to work on next.';
}
function plainStoryText(match:Match,strengths:StrengthEvidence[],problemTitle:string){
  const positive=strengths[0]?plainStrengthTitle(strengths[0]):'';
  return positive?positive+' was one of the useful parts of this '+match.champion+' game. The main thing making the game harder was: '+problemTitle.toLowerCase()+'.':'The most useful lesson from this '+match.champion+' game is simple: '+problemTitle+'.';
}
