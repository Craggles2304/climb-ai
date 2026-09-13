import {notFound,redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {MetricCard,PageHead} from '@/components/UI';
import {getServerClient} from '@/lib/supabase/server';
import {getActivationFunnel} from '@/lib/server/activationFunnel';

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

  const funnel=await getActivationFunnel(30);
  const signup=funnel.steps[0]?.players||0;
  const grade=funnel.steps.find(s=>s.event==='op_grade_viewed')?.players||0;
  const ladder=funnel.steps.find(s=>s.event==='fix_ladder_viewed')?.players||0;
  const hq=funnel.steps.find(s=>s.event==='development_hq_entered')?.players||0;
  const overall=signup?Math.round(hq/signup*100):0;
  const gradeRate=signup?Math.round(grade/signup*100):0;
  const ladderRate=grade?Math.round(ladder/grade*100):0;

  return <AppShell>
    <PageHead
      title="Activation Control Room"
      subtitle={`Real first-session funnel · trailing ${funnel.windowDays} days · unique players, not page views.`}
    />

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
