import {notFound,redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {MetricCard,PageHead} from '@/components/UI';
import {getServerClient} from '@/lib/supabase/server';
import {getActivationFunnel} from '@/lib/server/activationFunnel';
import {getFoundingBetaValidation} from '@/lib/server/foundingBetaValidation';
import {getBetaOperationsSnapshot} from '@/lib/server/betaOperations';
import {betaMetricValue,getBetaExperiments} from '@/lib/server/betaExperimentRepository';
import {BetaExperimentConsole} from '@/components/BetaExperimentConsole';
import {getBetaCohortAdminSnapshot} from '@/lib/server/betaCohortRepository';
import {BetaCohortConsole} from '@/components/BetaCohortConsole';

export const dynamic='force-dynamic';

const time=(seconds:number|null)=>{
  if(seconds===null)return 'NO DATA';
  if(seconds<60)return `${seconds}s`;
  const m=Math.floor(seconds/60),s=seconds%60;
  return `${m}m ${String(s).padStart(2,'0')}s`;
};

export default async function Admin(){
  const supabase=await getServerClient();
  if(!supabase)redirect('/account');
  const {data:userData}=await supabase.auth.getUser();
  const user=userData.user;
  if(!user)redirect('/account');

  const {data:profile}=await supabase.from('profiles')
    .select('is_founder')
    .eq('id',user.id)
    .maybeSingle();
  if(!profile?.is_founder)notFound();

  const [funnel,beta,ops,experiments,cohort]=await Promise.all([getActivationFunnel(30),getFoundingBetaValidation(45),getBetaOperationsSnapshot(45),getBetaExperiments(8),getBetaCohortAdminSnapshot()]);
  const signup=funnel.steps[0]?.players||0;
  const grade=funnel.steps.find(s=>s.event==='op_grade_viewed')?.players||0;
  const ladder=funnel.steps.find(s=>s.event==='fix_ladder_viewed')?.players||0;
  const hq=funnel.steps.find(s=>s.event==='development_hq_entered')?.players||0;
  const overall=signup?Math.round(hq/signup*100):0;
  const gradeRate=signup?Math.round(grade/signup*100):0;
  const ladderRate=grade?Math.round(ladder/grade*100):0;
  const activeExperimentCurrent=experiments.active?betaMetricValue(beta,experiments.active.metricKey):null;
  const recommendedBaseline=ops.recommendedExperiment?betaMetricValue(beta,ops.recommendedExperiment.metricKey):null;

  return <AppShell>
    <PageHead
      title="Beta Operations Control Room"
      subtitle={`Stage 6 · rescue the real player journey, run one measurable release experiment at a time, then scale only what works.`}
    />



  <BetaCohortConsole snapshot={cohort}/>

  <section className="glass card" style={{marginBottom:18,border:'1px solid rgba(214,255,47,.24)'}}>
    <div className="eyebrow">STAGE 6 · FOUNDING BETA OPERATIONS</div>
    <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div><h2 style={{margin:'8px 0'}}>Stop guessing what to fix next.</h2><p className="muted" style={{maxWidth:860}}>Every beta profile is mapped to the first broken point in the real coaching loop. The queue below prioritises rescue work; the experiment ledger freezes the baseline and build before a product change is judged.</p></div>
      <span className="op-tier op-tier-pro">{ops.blockedPlayers} NEED RESCUE</span>
    </div>
  </section>

  {ops.error&&<section className="glass card" style={{marginBottom:18}}><div className="eyebrow">BETA OPS WARNING</div><p className="muted">{ops.error}</p></section>}

  <div className="grid four" style={{marginBottom:16}}>
    <MetricCard label="BETA PROFILES" value={ops.participants.length}/>
    <MetricCard label="RESCUE QUEUE" value={ops.blockedPlayers} detail="First broken point per player"/>
    <MetricCard label="HEALTHY LOOP" value={ops.healthyPlayers} detail="Core loop complete + active"/>
    <MetricCard label="LATEST BUILD" value={ops.buildCoverage.latestBuild||'LEGACY'} detail={`${ops.buildCoverage.stampedEvents} stamped · ${ops.buildCoverage.unstampedEvents} legacy events`}/>
  </div>

  <section className="glass card" style={{marginBottom:18}}>
    <div className="eyebrow">HIGHEST-IMPACT BLOCKER</div>
    {ops.topBlocker?<><h2 style={{margin:'8px 0'}}>{ops.topBlocker.surface}</h2><p className="muted">{ops.topBlocker.players} player{ops.topBlocker.players===1?'':'s'} currently sit at <b>{ops.topBlocker.state.replaceAll('_',' ')}</b>. This is the highest weighted rescue state in the current cohort.</p></>:<><h2>No active blocker.</h2><p className="muted">The measured beta loop is currently healthy.</p></>}
  </section>

  <BetaExperimentConsole
    active={experiments.active}
    history={experiments.history}
    recommendation={ops.recommendedExperiment}
    currentValue={activeExperimentCurrent}
    recommendedBaseline={recommendedBaseline}
  />

  <section className="glass card" style={{marginBottom:18}}>
    <div className="eyebrow">PLAYER RESCUE QUEUE</div>
    <h2>Who is stuck, where, and what to investigate first.</h2>
    <p className="muted">The state is evidence-based. A player moves only when the corresponding milestone is actually observed.</p>
    <div style={{overflowX:'auto',marginTop:16}}><table className="table"><thead><tr><th>Player</th><th>State</th><th>Surface</th><th>Last activity</th><th>Build</th><th>Next action</th></tr></thead><tbody>{ops.rescueQueue.length?ops.rescueQueue.map(player=><tr key={player.id}><td><b>{player.label}</b></td><td>{player.state.replaceAll('_',' ')}</td><td>{player.surface}</td><td>{player.hoursSinceActivity===null?'NO EVENT':`${player.hoursSinceActivity}h ago`}</td><td>{player.latestBuild||'LEGACY'}</td><td style={{minWidth:320}}>{player.nextAction}</td></tr>):<tr><td colSpan={6}>No player currently needs rescue.</td></tr>}</tbody></table></div>
  </section>

  <section className="glass card" style={{marginBottom:18,border:'1px solid rgba(214,255,47,.18)'}}>
    <div className="eyebrow">STAGE 5 · FOUNDING BETA VALIDATION</div>
    <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div><h2 style={{margin:'8px 0'}}>Is the whole coaching loop working for real players?</h2><p className="muted" style={{maxWidth:820}}>This scorecard only uses observed beta behaviour: first value, Companion adoption, tracked games, deliberate sessions, Career usage, usefulness feedback and eligible retention cohorts.</p></div>
      <span className="op-tier op-tier-pro">{beta.gateStatus.replaceAll('_',' ')}</span>
    </div>
  </section>

  {beta.error&&<section className="glass card" style={{marginBottom:18}}><div className="eyebrow">BETA TELEMETRY WARNING</div><p className="muted">{beta.error}</p></section>}

  <div className="grid four" style={{marginBottom:16}}>
    <MetricCard label="ACTIVATED FOUNDERS" value={beta.activatedPlayers}/>
    <MetricCard label="FIRST COACHING VALUE" value={beta.activatedPlayers?`${beta.activationToGradePct}%`:'NO DATA'} detail="Signup → first OP Grade"/>
    <MetricCard label="COMPANION ADOPTION" value={beta.activatedPlayers?`${beta.companionAdoptionPct}%`:'NO DATA'} detail="Activated → connected"/>
    <MetricCard label="SESSION COMPLETION" value={beta.milestones.find(x=>x.event==='climb_session_started')?.players?`${beta.sessionCompletionPct}%`:'NO DATA'} detail="Started → banked 3-game block"/>
  </div>

  <div className="grid four" style={{marginBottom:18}}>
    <MetricCard label="COACHING USEFUL" value={beta.usefulFeedback.rate===null?'NO DATA':`${beta.usefulFeedback.rate}%`} detail={`${beta.usefulFeedback.responses} rated focus${beta.usefulFeedback.responses===1?'':'es'}`}/>
    <MetricCard label="DAY-1 RETURN" value={beta.day1.rate===null?'NO DATA':`${beta.day1.rate}%`} detail={`${beta.day1.eligible} eligible founders`}/>
    <MetricCard label="DAY-7 RETURN" value={beta.day7.rate===null?'NO DATA':`${beta.day7.rate}%`} detail={`${beta.day7.eligible} eligible founders`}/>
    <MetricCard label="CAREER ADOPTION" value={beta.milestones.find(x=>x.event==='op_grade_viewed')?.players?`${beta.careerAdoptionPct}%`:'NO DATA'} detail="Graded → Development Career"/>
  </div>

  <section className="glass card" style={{marginBottom:18}}>
    <div className="eyebrow">BETA JOURNEY</div>
    <h2>Where the real product loop breaks.</h2>
    <p className="muted">Unlike the signup funnel below, these milestones are allowed to branch. Companion connection and Career exploration do not have to happen in one rigid page order.</p>
    <div style={{overflowX:'auto',marginTop:16}}><table className="table"><thead><tr><th>Milestone</th><th>Players</th><th>From parent</th><th>From activated</th><th>Drop-off</th></tr></thead><tbody>{beta.milestones.map(step=><tr key={step.event}><td><b>{step.label}</b></td><td>{step.players}</td><td>{step.fromParent}%</td><td>{step.fromActivated}%</td><td>{step.dropOff||'—'}</td></tr>)}</tbody></table></div>
    {beta.largestLeak&&<p className="muted" style={{marginBottom:0}}>Largest observed conversion leak: <b>{beta.largestLeak.label}</b> · {beta.largestLeak.fromParent}% from its parent milestone · {beta.largestLeak.dropOff} player{beta.largestLeak.dropOff===1?'':'s'} lost.</p>}
  </section>

  <section className="glass card" style={{marginBottom:18}}>
    <div className="eyebrow">FOUNDING BETA EXIT GATES</div>
    <h2>Do not scale because the demo looks good.</h2>
    <p className="muted">A gate is only PASS when there is enough eligible evidence. WAIT means the cohort is still too small or too young to judge.</p>
    <div style={{overflowX:'auto',marginTop:16}}><table className="table"><thead><tr><th>Gate</th><th>Actual</th><th>Target</th><th>Status</th></tr></thead><tbody>{beta.gates.map(g=><tr key={g.key}><td><b>{g.label}</b></td><td>{g.actual}</td><td>{g.target}</td><td><b className={g.met===true?'success':g.met===false?'danger':'muted'}>{g.met===true?'PASS':g.met===false?'MISS':'WAIT'}</b></td></tr>)}</tbody></table></div>
  </section>
    {funnel.error&&<section className="glass card" style={{marginBottom:18}}>
      <div className="eyebrow">ANALYTICS WARNING</div>
      <h2>Activation data is unavailable.</h2>
      <p className="muted">{funnel.error}</p>
    </section>}

    <div className="grid four">
      <MetricCard label="SIGNUPS" value={signup}/>
      <MetricCard label="FIRST OP GRADE" value={`${gradeRate}%`} detail={`${grade}/${signup||0} signups`}/>
      <MetricCard label="MEDIAN TIME TO VALUE" value={time(funnel.medianTimeToGradeSeconds)} detail="Signup → first OP Grade"/>
      <MetricCard label="UNDER 60 SECONDS" value={funnel.under60Seconds===null?'NO DATA':`${funnel.under60Seconds}%`} detail="Activation target"/>
    </div>

    <div className="grid four" style={{marginTop:16}}>
      <MetricCard label="FIX LADDER REACH" value={`${ladderRate}%`} detail={`${ladder}/${grade||0} graded players`}/>
      <MetricCard label="HQ ACTIVATION" value={`${overall}%`} detail={`${hq}/${signup||0} signups`}/>
      <MetricCard label="MANUAL FIRST MATCH" value={funnel.manualFirstMatches}/>
      <MetricCard label="RIOT FIRST MATCH" value={funnel.riotFirstMatches}/>
    </div>

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">ACTIVATION FUNNEL</div>
      <h2>Where a new player stops getting value.</h2>
      <p className="muted">Each stage only counts a player when the earlier milestones happened first. Repeated refreshes do not inflate the player count.</p>
      <div style={{overflowX:'auto',marginTop:16}}>
        <table className="table">
          <thead><tr><th>Stage</th><th>Players</th><th>From previous</th><th>From signup</th><th>Drop-off</th></tr></thead>
          <tbody>{funnel.steps.map((step,index)=><tr key={step.event}>
            <td><b>{index+1}. {step.label}</b></td>
            <td>{step.players}</td>
            <td>{step.fromPrevious}%</td>
            <td>{step.fromSignup}%</td>
            <td>{step.dropOff||'—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">TIME TO FIRST VALUE</div>
      <h2>{time(funnel.medianTimeToGradeSeconds)} median · {time(funnel.p75TimeToGradeSeconds)} at P75.</h2>
      <p className="muted">The operating target is a useful OP Grade inside 60 seconds of signup. P75 matters because a fast median can hide a painful tail of players who get stuck.</p>
      <p className="muted" style={{fontSize:12}}>Latest activation event: {funnel.latestEventAt?new Date(funnel.latestEventAt).toLocaleString('en-GB'):'No events stored yet.'}</p>
    </section>
  </AppShell>;
}
