import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {FightReview} from '@/lib/riot/liveStrength';
import type {DecisionGraphNode} from '@/lib/decisionGraph';

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
};

function clock(seconds:number){
  const value=Math.max(0,Math.round(Number(seconds)||0));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
}

function clean(value:unknown){
  return String(value??'').replace(/\s+/g,' ').trim();
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
    id:node.id,
    side:node.verdict==='GOOD'?'GOOD':'CRITICAL',
    atSeconds:node.atSeconds,
    clock:node.minuteLabel||clock(node.atSeconds),
    title:node.title||node.behaviourLabel,
    before:clean(node.situation)||'The recorded state created a measurable decision point.',
    moment:clean(node.decisionRead)||'OP CLIMB detected a measurable decision here.',
    consequence:clean(node.consequence)||'This moment changed the coaching read for the game.',
    coaching,
    confidence:node.confidence,
    dna:node.behaviourLabel,
  };
}

function fallbackStories(fights:FightReview[]):Story[]{
  return fights.map((fight,index)=>({
    id:`fight-${fight.atSeconds}-${index}`,
    side:fight.category==='STRENGTH'?'GOOD':'CRITICAL',
    atSeconds:fight.atSeconds,
    clock:clock(fight.atSeconds),
    title:fight.headline,
    before:`${fight.opponentChampion||fight.opponent||'Enemy'} interaction · ${fight.verdict==='YOU_STRONGER'?'you held the stronger visible state':fight.verdict==='THEM_STRONGER'?'the enemy held the stronger visible state':'visible power was roughly even'}.`,
    moment:fight.why?.[1]||fight.summary,
    consequence:fight.summary,
    coaching:fight.category==='STRENGTH'
      ?(fight.howToWin?.[0]||'Repeat the setup that created the positive outcome.')
      :(fight.betterDecision?.[0]||'Change the decision that allowed the negative outcome.'),
    confidence:'VISIBLE STATE',
    dna:fight.category==='STRENGTH'?'Positive conversion':'Decision leak',
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
  const nodes=(analysis?.decisionGraph?.nodes??[])
    .filter(node=>node.verdict==='GOOD'||node.verdict==='IMPROVE')
    .sort((a,b)=>score(b)-score(a)||a.atSeconds-b.atSeconds);
  const source=nodes.length?nodes.map(storyFromNode):fallbackStories(fights);
  const dedupe=(stories:Story[])=>{
    const seen=new Set<string>();
    return stories.filter(story=>{
      const key=(story.dna+'|'+story.title.replace(/\d+:\d+/g,'TIME')).toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  };
  return{
    good:dedupe(source.filter(story=>story.side==='GOOD')).slice(0,3),
    critical:dedupe(source.filter(story=>story.side==='CRITICAL')).slice(0,3),
  };
}

export function MatchStorySides({
  analysis,
  fights=[],
  compact=false,
  title='WHAT OP CLIMB SAW',
}:{analysis?:ProMatchAnalysis|null;fights?:FightReview[];compact?:boolean;title?:string}){
  const stories=buildMatchStories(analysis,fights);
  return <section className={`match-story-review ${compact?'compact':''}`}>
    <div className="match-story-head">
      <div><div className="eyebrow">MATCH RECONSTRUCTION</div><h2>{title}</h2><p>Not just the stat. OP CLIMB links the state before the moment, the decision it could verify, and what happened next.</p></div>
      <span>VERIFIED → CONNECTED → COACHING INFERENCE</span>
    </div>

    <div className="match-story-sides">
      <StoryColumn side="GOOD" stories={stories.good}/>
      <StoryColumn side="CRITICAL" stories={stories.critical}/>
    </div>
  </section>;
}

function StoryColumn({side,stories}:{side:Side;stories:Story[]}){
  const good=side==='GOOD';
  return <section className={`match-story-side ${good?'good':'critical'}`}>
    <header>
      <div><span>{good?'GOOD':'CRITICAL'}</span><h3>{good?'What worked in this game':'What hurt you in this game'}</h3></div>
      <b>{stories.length} VERIFIED</b>
    </header>
    <div className="match-story-list">
      {stories.length?stories.map((story,index)=><article className="match-story-card" key={story.id}>
        <div className="match-story-card-top">
          <strong>{story.clock}</strong>
          <div><small>{story.dna.toUpperCase()}</small><h4>{story.title}</h4></div>
          <span>{story.confidence}</span>
        </div>
        <div className="match-story-chain">
          <StoryStep label="BEFORE" text={story.before}/>
          <StoryStep label={good?'GOOD DECISION':'CRITICAL MOMENT'} text={story.moment}/>
          <StoryStep label="WHAT HAPPENED NEXT" text={story.consequence}/>
        </div>
        <div className="match-story-coaching"><small>{good?'REPEAT THIS':'COACHING LINK'}</small><p>{story.coaching}</p></div>
      </article>):<div className="match-story-empty">
        <b>{good?'No good sequence is strong enough to verify yet.':'No critical sequence is strong enough to verify yet.'}</b>
        <p>OP CLIMB leaves the side empty rather than manufacturing a story from weak evidence.</p>
      </div>}
    </div>
  </section>;
}

function StoryStep({label,text}:{label:string;text:string}){
  return <div><span>{label}</span><p>{text}</p></div>;
}
