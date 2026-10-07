import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {FightReview} from '@/lib/riot/liveStrength';
import type {DecisionGraphNode} from '@/lib/decisionGraph';
import type {MatchReconstructionStory,ReconstructionEvidence} from '@/lib/matchReconstruction';
import type {ILPTask} from '@/lib/types';
import {DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionComparisonForMatch} from '@/lib/missionComparison';

type Side='GOOD'|'CRITICAL';

type Story={
  id:string;
  side:Side;
  atSeconds:number;
  clock:string;
  title:string;
  before:string;
  moment:string;
  consequence:string;
  coaching:string;
  confidence:string;
  dna:string;
  source:string;
  severity:number;
  evidence:ReconstructionEvidence[];
  dnaDomain?:MatchReconstructionStory['dnaDomain'];
};

function clock(seconds:number){
  const value=Math.max(0,Math.round(Number(seconds)||0));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
}
function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}

function storyFromReconstruction(story:MatchReconstructionStory):Story{
  return{
    id:story.id,side:story.side,atSeconds:story.atSeconds,clock:story.clock,title:story.title,
    before:story.before,moment:story.decision,consequence:story.consequence,coaching:story.coaching,
    confidence:story.confidence,dna:DNA_DOMAIN_LABELS[story.dnaDomain]+' · '+story.behaviourLabel,
    source:story.source==='MATCH_V5_TIMELINE'?'RIOT TIMELINE':'COMPANION',severity:story.severity,
    evidence:story.evidence,dnaDomain:story.dnaDomain,
  };
}

function storyFromNode(node:DecisionGraphNode):Story{
  const coaching=node.coachingResponse?.cue
    ?`Mission cue: ${node.coachingResponse.cue}`
    :node.lockedPrinciple
      ?`Coaching principle: ${node.lockedPrinciple}`
      :node.counterfactual?.alternative
        ?`Better next time: ${node.counterfactual.alternative}`
        :`DNA link: ${node.behaviourLabel}`;
  return{
    id:node.id,side:node.verdict==='GOOD'?'GOOD':'CRITICAL',atSeconds:node.atSeconds,
    clock:node.minuteLabel||clock(node.atSeconds),title:node.title||node.behaviourLabel,
    before:clean(node.situation)||'The recorded state created a measurable decision point.',
    moment:clean(node.decisionRead)||'OP CLIMB detected a measurable decision here.',
    consequence:clean(node.consequence)||'This moment changed the coaching read for the game.',
    coaching,confidence:node.confidence,dna:node.behaviourLabel,source:'DECISION GRAPH',
    severity:node.confidence==='HIGH'?60:40,
    evidence:(node.evidence??[]).map(detail=>({kind:'VERIFIED' as const,atSeconds:node.atSeconds,label:'Recorded evidence',detail})),
  };
}

function fallbackStories(fights:FightReview[]):Story[]{
  return fights.map((fight,index)=>({
    id:`fight-${fight.atSeconds}-${index}`,side:fight.category==='STRENGTH'?'GOOD':'CRITICAL',
    atSeconds:fight.atSeconds,clock:clock(fight.atSeconds),title:fight.headline,
    before:`${fight.opponentChampion||fight.opponent||'Enemy'} interaction · ${fight.verdict==='YOU_STRONGER'?'you held the stronger visible state':fight.verdict==='THEM_STRONGER'?'the enemy held the stronger visible state':'visible power was roughly even'}.`,
    moment:fight.why?.[1]||fight.summary,consequence:fight.summary,
    coaching:fight.category==='STRENGTH'?(fight.howToWin?.[0]||'Repeat the setup that created the positive outcome.'):(fight.betterDecision?.[0]||'Change the decision that allowed the negative outcome.'),
    confidence:'VISIBLE STATE',dna:fight.category==='STRENGTH'?'Positive conversion':'Decision leak',source:'COMPANION',
    severity:fight.category==='WEAKNESS'?50:40,evidence:[{kind:'VERIFIED',atSeconds:fight.atSeconds,label:fight.outcome,detail:fight.summary}],
  }));
}

function score(node:DecisionGraphNode){
  const confidence=node.confidence==='HIGH'?60:node.confidence==='MEDIUM'?35:10;
  const response=node.coachingResponse?.status==='EXECUTED'||node.coachingResponse?.status==='MISSED'?25:0;
  const counter=node.counterfactual?.priority??0;
  const evidence=Math.min(20,(node.evidence?.length??0)*5);
  return confidence+response+counter+evidence;
}

export function buildMatchStories(analysis?:ProMatchAnalysis|null,fights:FightReview[]=[]){
  const reconstructed=analysis?.reconstruction?.stories??[];
  let source:Story[];
  if(reconstructed.length){
    source=reconstructed.map(storyFromReconstruction);
  }else{
    const nodes=(analysis?.decisionGraph?.nodes??[])
      .filter(node=>node.verdict==='GOOD'||node.verdict==='IMPROVE')
      .sort((a,b)=>score(b)-score(a)||a.atSeconds-b.atSeconds);
    source=nodes.length?nodes.map(storyFromNode):fallbackStories(fights);
  }
  const dedupe=(stories:Story[])=>{
    const seen=new Set<string>();
    return [...stories].sort((a,b)=>b.severity-a.severity||a.atSeconds-b.atSeconds).filter(story=>{
      const key=(story.side+'|'+story.dna+'|'+Math.round(story.atSeconds/20)).toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  };
  return{
    good:dedupe(source.filter(story=>story.side==='GOOD')).slice(0,3),
    critical:dedupe(source.filter(story=>story.side==='CRITICAL')).slice(0,3),
    reconstruction:Boolean(reconstructed.length),
  };
}

export function MatchStorySides({
  analysis,fights=[],compact=false,title='WHAT OP CLIMB SAW',tasks=[],matchId,
}:{analysis?:ProMatchAnalysis|null;fights?:FightReview[];compact?:boolean;title?:string;tasks?:ILPTask[];matchId?:string|null}){
  const stories=buildMatchStories(analysis,fights);
  return <section className={`match-story-review ${compact?'compact':''} ${stories.reconstruction?'v2':''}`}>
    <div className="match-story-head">
      <div>
        <div className="eyebrow">MATCH RECONSTRUCTION · 30–90 SECOND SEQUENCES</div>
        <h2>{title}</h2>
        <p>{stories.reconstruction?'OP CLIMB rebuilt the moments around the event — what the game state showed before it, what happened, and what the next recorded events became.':'This game is using the best available fallback evidence while richer reconstruction is still building.'}</p>
      </div>
      <span>VERIFIED → CONNECTED → COACHING INFERENCE</span>
    </div>

    <div className="match-story-sides">
      <StoryColumn side="GOOD" stories={stories.good} tasks={tasks} matchId={matchId}/>
      <StoryColumn side="CRITICAL" stories={stories.critical} tasks={tasks} matchId={matchId}/>
    </div>
    {analysis?.reconstruction?.boundary&&<p className="match-story-boundary">{analysis.reconstruction.boundary}</p>}
  </section>;
}

function StoryColumn({side,stories,tasks,matchId}:{side:Side;stories:Story[];tasks:ILPTask[];matchId?:string|null}){
  const good=side==='GOOD';
  return <section className={`match-story-side ${good?'good':'critical'}`}>
    <header>
      <div><span>{good?'GOOD':'CRITICAL'}</span><h3>{good?'What worked in this game':'What actually hurt you'}</h3></div>
      <b>{stories.length} SEQUENCE{stories.length===1?'':'S'}</b>
    </header>
    <div className="match-story-list">
      {stories.length?stories.map(story=>{
        const mission=story.dnaDomain?tasks.find(task=>task.dnaDomain===story.dnaDomain&&(matchId?(task.missionHistory??[]).some(rep=>rep.matchId===matchId):task.dnaFocusUnlocked===true)):undefined;
        const missionPlain=mission?plainLanguageFocus(mission):null;
        const missionResult=mission&&matchId?missionComparisonForMatch(mission,matchId):null;
        return <article className="match-story-card" key={story.id}>
          <div className="match-story-card-top">
            <strong>{story.clock}</strong>
            <div><small>{story.dna.toUpperCase()}</small><h4>{story.title}</h4></div>
            <span>{story.source} · {story.confidence}</span>
          </div>
          <div className="match-story-chain">
            <StoryStep label="BEFORE" text={story.before}/>
            <StoryStep label={good?'GOOD DECISION':'CRITICAL MOMENT'} text={story.moment}/>
            <StoryStep label="WHAT HAPPENED NEXT" text={story.consequence}/>
          </div>
          <div className="match-story-proof">
            {story.evidence.slice(0,6).map((event,index)=><EvidenceRow event={event} key={index}/>)}
          </div>
          <div className="match-story-coaching"><small>{good?'REPEAT THIS':'COACHING LINK'}</small><p>{story.coaching}</p></div>
          {mission&&<div className="match-story-mission">
            <span>YOUR UNLOCKED MISSION</span>
            <b>{missionPlain?.name??mission.title}</b>
            <small>{missionResult?`${missionResult.result} · ${missionResult.detail}`:'This DNA tree is one of your two active development paths.'}</small>
          </div>}
        </article>
      }):<div className="match-story-empty">
        <b>{good?'No good sequence is strong enough to verify yet.':'No critical sequence is strong enough to verify yet.'}</b>
        <p>OP CLIMB leaves the side empty rather than manufacturing a story from weak evidence.</p>
      </div>}
    </div>
  </section>;
}

function StoryStep({label,text}:{label:string;text:string}){
  return <div><span>{label}</span><p>{text}</p></div>;
}
function EvidenceRow({event}:{event:ReconstructionEvidence}){
  return <div className={`match-story-evidence ${event.kind.toLowerCase()}`}>
    <b>{event.atSeconds!==undefined?clock(event.atSeconds):event.kind.replace('_',' ')}</b>
    <div><span>{event.kind.replace('_',' ')}</span><strong>{event.label}</strong><small>{event.detail}</small></div>
  </div>;
}
