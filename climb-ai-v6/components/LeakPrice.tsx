'use client';
import Link from 'next/link';
import {LeakPrice as Price} from '@/lib/costOfLeak';
import {thresholdLabel} from '@/lib/metrics';
import {AnimatedBar,CountUp} from './Motion';
import {FeedbackPrompt} from './FeedbackPrompt';

/**
 * The price tag on a leak.
 *
 * The layout enforces the honesty rule rather than relying on the writer: the
 * observed counts, the derived gap and the estimate each get their own labelled
 * row, so a reader can always see which is which. Nothing here upgrades an
 * estimate into a promise.
 */

export function LeakPriceCard({price,ctaHref='/ilp',rankBand,role}:{price:Price;ctaHref?:string;rankBand?:string;role?:string}){
  if(price.status==='METRIC_UNAVAILABLE'){
    return <section className="glass leak-card">
      <div className="eyebrow">WHAT THIS IS COSTING YOU</div>
      <h2 className="leak-quiet">Not enough match detail to price this yet.</h2>
      <p className="muted leak-body">{price.fact}</p>
    </section>;
  }

  if(price.status==='INSUFFICIENT_SAMPLE'){
    const have=price.sample;
    const pct=Math.min(100,(have/(have+price.gamesNeeded))*100);
    return <section className="glass leak-card">
      <div className="eyebrow">WHAT THIS IS COSTING YOU</div>
      <h2 className="leak-quiet">
        {price.gamesNeeded} more {price.gamesNeeded===1?'game':'games'} and this leak gets a number.
      </h2>
      <p className="muted leak-body">
        Pricing a behaviour honestly needs enough games on both sides of the bar. You have {have}.
        Until then this stays blank rather than showing you noise.
      </p>
      <div className="leak-progress">
        <AnimatedBar value={pct} delay={200}/>
        <span>{have} GAMES BANKED</span>
      </div>
      <Link className="btn primary" href="/analyse">I&apos;M PLAYING NOW</Link>
    </section>;
  }

  const {cleared,missed,spec,gapPoints}=price;
  const bar=thresholdLabel(spec);
  const clearedPct=Math.round(cleared.winRate*100);
  const missedPct=Math.round(missed.winRate*100);
  const positive=(gapPoints??0)>0;

  return <section className="glass leak-card">
    <div className="leak-top">
      <div className="eyebrow">WHAT THIS IS COSTING YOU</div>
      <span className={`v7-badge ${price.confidence==='HIGH'?'engine':''}`}>
        {price.confidence} CONFIDENCE · {price.sample} GAMES
      </span>
    </div>

    <h2 className="leak-headline">
      {positive
        ? <><CountUp value={gapPoints!}/>-point win-rate gap on <span className="leak-behaviour">{spec.behaviour}</span>.</>
        : <>Your {spec.behaviour} is not what is separating your games.</>}
    </h2>

    <div className="leak-split">
      <div className="leak-side is-good">
        <span className="label">Held {bar}</span>
        <strong>{clearedPct}%</strong>
        <AnimatedBar value={clearedPct} delay={180}/>
        <small>{cleared.wins} wins from {cleared.games} games</small>
      </div>
      <div className="leak-side">
        <span className="label">Missed it</span>
        <strong>{missedPct}%</strong>
        <AnimatedBar value={missedPct} delay={280}/>
        <small>{missed.wins} wins from {missed.games} games</small>
      </div>
    </div>

    <dl className="leak-claims">
      <div><dt>Observed</dt><dd>{price.fact}</dd></div>
      {price.inference&&<div><dt>Derived</dt><dd>{price.inference}</dd></div>}
      {price.suggestion&&<div className="leak-estimate"><dt>Estimate</dt><dd>{price.suggestion}</dd></div>}
    </dl>

    <p className="leak-caveat">
      This compares your own games over one period. It shows where your wins sit, not proof that
      one causes the other.
    </p>

    {positive&&<Link className="btn primary" href={ctaHref}>OPEN THE PLAN FOR THIS</Link>}

    <FeedbackPrompt
      surface="leak_price"
      subject={price.metric}
      rankBand={rankBand}
      role={role}
      question="Does this match how your games actually go?"
    />
  </section>;
}

/** One-line version for a development track. */
export function LeakPriceInline({price}:{price:Price}){
  if(price.status!=='READY'||(price.gapPoints??0)<=0){
    return <span className="leak-inline muted">
      {price.status==='INSUFFICIENT_SAMPLE'
        ?`${price.gamesNeeded} more games to price this`
        :'Not yet priced'}
    </span>;
  }
  return <span className="leak-inline">
    <b>{price.gapPoints}-point</b> win-rate gap · {price.cleared.wins}/{price.cleared.games} above the bar
    vs {price.missed.wins}/{price.missed.games} below
  </span>;
}
