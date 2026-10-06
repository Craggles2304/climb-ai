'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {summarizeTft,tftCoachingRead,type TftDecisionReview,type TftGamePlan,type TftMatch} from '@/lib/tft/types';
import {buildTacticianProfile} from '@/lib/tft/advancedCoach';

function map(row:any):TftMatch{
  const raw=row.raw&&typeof row.raw==='object'?row.raw:{};
  return{id:row.external_match_id,riotAccountId:row.riot_account_id,playedAt:row.game_datetime,gameLengthSeconds:Number(row.game_length_seconds||0),gameVersion:row.game_version||'',placement:Number(row.placement),level:row.level??undefined,lastRound:row.last_round??undefined,playersEliminated:row.players_eliminated??undefined,totalDamageToPlayers:row.total_damage_to_players??undefined,goldLeft:row.gold_left??undefined,augments:Array.isArray(row.augments)?row.augments:[],traits:Array.isArray(row.traits)?row.traits:[],units:Array.isArray(row.units)?row.units:[],compSignature:row.comp_signature||'UNRESOLVED COMP',note:typeof raw.note==='string'?raw.note:undefined,decisionReview:raw.decisionReview as TftDecisionReview|undefined,planSnapshot:raw.planSnapshot as TftGamePlan|undefined};
}

function scoreTone(score:number|null){if(score===null)return 'UNKNOWN';if(score>=85)return 'ELITE';if(score>=72)return 'STRONG';if(score>=60)return 'STABLE';if(score>=45)return 'LEAK';return 'CRITICAL';}

export default function TftCoach(){
  const {active}=useAccount();const {tftTier}=useSubscription();const [matches,setMatches]=useState<TftMatch[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{void (async()=>{setLoading(true);const client=await getBrowserClient();if(!client){setLoading(false);return;}const {data:userData}=await client.auth.getUser();if(!userData.user){setLoading(false);return;}const {data}=await client.from('tft_matches').select('*').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('game_datetime',{ascending:false}).limit(20);setMatches((data||[]).map(map));setLoading(false);})()},[active.id]);
  const summary=useMemo(()=>summarizeTft(matches),[matches]);
  const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const profile=useMemo(()=>buildTacticianProfile(matches),[matches]);
  const spread=matches.length?Math.max(...matches.map(m=>m.placement))-Math.min(...matches.map(m=>m.placement)):0;
  const nextAction=profile.primaryLeak?profile.ilp.find(task=>task.skill===profile.primaryLeak?.key)?.target||read.target:read.target;
  const dna=[
    {name:'Economy',skill:profile.skills.find(s=>s.key==='ECONOMY')},
    {name:'Tempo',skill:profile.skills.find(s=>s.key==='TEMPO')},
    {name:'Board Building',skill:null},
    {name:'Flexibility',skill:profile.skills.find(s=>s.key==='FLEXIBILITY')},
    {name:'Items & Augments',skill:null},
    {name:'Endgame Decisions',skill:profile.skills.find(s=>s.key==='CONVERSION')},
  ];
  const reviewed=matches.filter(m=>m.decisionReview);
  const recurring=[
    {name:'Late stabilisation',count:reviewed.filter(m=>m.decisionReview?.rollTiming==='LATE').length},
    {name:'Forced contested line',count:reviewed.filter(m=>m.decisionReview?.pivotQuality==='FORCED_CONTESTED').length},
    {name:'Held components',count:reviewed.filter(m=>m.decisionReview?.itemChoice==='GREEDY_COMPONENTS').length},
  ].filter(x=>x.count>=2);

  return <TftShell><main className="tft-page">
    <section className="tft-hero">
      <div className="tft-hero-copy">
        <div className="eyebrow">MY TFT DNA · YOUR TACTICIAN IDENTITY</div>
        <h1>THIS IS THE PLAYER YOUR DECISIONS ARE BUILDING.</h1>
        <p>Like League My DNA, TFT is organised around six strands, one priority mission and proof over future games. The point is not to memorise comps — it is to build decision habits that transfer.</p>
        <div className="tft-hero-actions">
          <Link className="btn primary" href="/tft/timeline">REVIEW LAST GAME →</Link>
          <Link className="btn secondary" href="/tft/game-plan">SET NEXT GAME PLAN</Link>
        </div>
      </div>
      <div className="tft-hero-side">
        <div className="tft-hero-signal primary"><span>TACTICIAN GRADE</span><strong>{profile.grade??'—'}</strong></div>
        <div className="tft-hero-signal"><span>PRIMARY LEAK</span><strong>{profile.primaryLeak?.label||read.title}</strong></div>
        <div className="tft-hero-signal"><span>DECISION REVIEWS</span><strong>{loading?'…':reviewed.length}</strong></div>
      </div>
    </section>

    <section className="tft-dna-stage" aria-label="TFT Game DNA">
      <div className="tft-dna-stage-head">
        <div><span>LIVE TFT GAME DNA</span><strong>Your six-strand decision profile</strong></div>
        <small>Each strand is evidence-backed. When the Companion cannot prove a decision, it stays NOT OBSERVED.</small>
      </div>
      <div className="tft-dna-grid">
        {dna.map(d=><article className="tft-dna-card" key={d.name}>
          <small>{d.name.toUpperCase()}</small>
          <h3>{d.name}</h3>
          <span className="tft-dna-score">{d.skill?.score??'—'}</span>
          <div className="tft-dna-meter"><i style={{width:(d.skill?.score??0)+'%'}}/></div>
          <p>{d.skill?.score!=null?d.skill.confidence+'% confidence · '+d.skill.evidenceCount+' evidence hits':'NOT OBSERVED · more local decision evidence needed'}</p>
        </article>)}
      </div>
    </section>

    <section className="tft-focus-grid">
      <article className="tft-focus">
        <span>PRIORITY TFT MISSION</span>
        <h2>{profile.primaryLeak?.label||read.title}</h2>
        <p>{profile.primaryLeak?.rationale||read.detail}</p>
        <div className="tft-focus-rule"><small>YOUR JOB NEXT GAME</small><b>{nextAction}</b></div>
      </article>
      <aside className="tft-grade">
        <span>TACTICIAN GRADE</span>
        <strong>{profile.grade??'—'}</strong>
        <small>{profile.confidence}% confidence<br/>not Riot MMR · not a hidden-rank guess</small>
      </aside>
    </section>

    <section className="tft-mission-board">
      <div className="tft-mission-board-head">
        <div><div className="eyebrow">YOUR ACTIVE DEVELOPMENT</div><h2>5 TFT MISSIONS</h2></div>
        <Link href="/tft/decision-lab" className="btn secondary">OPEN DECISION LAB</Link>
      </div>
      <div className="tft-mission-list">
        {profile.ilp.map(task=><article className="tft-mission" key={task.id}>
          <div className="eyebrow">#{task.priority} · {task.skill}</div>
          <strong>{task.title}</strong>
          <p>{task.target}</p>
          <div className="tft-mission-meta"><span>PROGRESS</span><b>{task.progress}/{task.goal}</b></div>
        </article>)}
      </div>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">DECISION TWIN · COACH MEMORY</div><h2>WHAT KEEPS REPEATING?</h2><p>Repeated mistakes become patterns. Patterns become missions. Missions only graduate when the behaviour transfers into a different context.</p></div>
    </div>
    <section className="tft-review-grid">
      <article className="tft-review-card fix">
        <div className="eyebrow">RECURRING PATTERNS</div>
        <h3>{recurring.length?recurring[0].name:'NOT OBSERVED YET'}</h3>
        {recurring.length?recurring.map(x=><p key={x.name}><b>{x.name}</b> · observed in {x.count} reviewed games</p>):<p>At least two explicit reviews are needed before Decision Twin calls something a recurring pattern.</p>}
        <Link href="/tft/timeline" className="text-link">OPEN POST-GAME PROOF →</Link>
      </article>
      <article className="tft-review-card good">
        <div className="eyebrow">TRANSFER TEST · PRINCIPLE OWNED</div>
        <h3>PROVE THE RULE IN A NEW GAME.</h3>
        <p>Apply the same decision principle in a different comp, economy state or lobby. One familiar success is local mastery; repeated success across new contexts is principle ownership.</p>
        <Link href="/tft/decision-lab" className="text-link">OPEN TRANSFER PRACTICE →</Link>
      </article>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">SUPPORTING CONTEXT</div><h2>RESULTS WITHOUT CONFUSING THEM FOR SKILL.</h2><p>Placement is context. Decision evidence is what drives the coaching model.</p></div>
    </div>
    <section className="tft-stat-strip">
      <div className="tft-stat"><span>CONSISTENCY</span><b>{matches.length?spread+' places':'—'}</b><small>placement spread</small></div>
      <div className="tft-stat"><span>RECENT FORM</span><b>{summary.games?summary.recentForm.toFixed(2):'—'}</b><small>latest five average</small></div>
      <div className="tft-stat"><span>TOP-4 RATE</span><b>{summary.games?Math.round(summary.top4Rate*100)+'%':'—'}</b><small>outcome context</small></div>
      <div className="tft-stat"><span>DECISION DEPTH</span><b>{loading?'…':reviewed.length}</b><small>structured reviews</small></div>
      <div className="tft-stat"><span>PATTERNS</span><b>{recurring.length}</b><small>repeated leaks found</small></div>
      <div className="tft-stat"><span>ACCESS</span><b>{tftTier}</b><small>League + TFT</small></div>
    </section>
  </main></TftShell>;
}
