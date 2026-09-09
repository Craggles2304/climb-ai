import {ILPTask,Match} from './types';
import {priceLeak,LeakPrice} from './costOfLeak';
import {rankTasks} from './ilpEngine';

/**
 * Plan ordering.
 *
 * The plan used to be ordered by a hardcoded `priority` field — and every task
 * shipped at 50, so the order was effectively arbitrary. That meant the product
 * could lead a player with a 48-point leak while a 60-point one sat third.
 *
 * Ordering is now: measured cost first, guesses after.
 *
 * Two tiers, deliberately not a blended score. Blending a measured win-rate gap
 * with an invented priority number would produce a figure that looks precise and
 * means nothing, which is the exact failure this product exists to avoid.
 *
 *   Tier 1 — behaviours with a priced, meaningful gap, ordered by that gap.
 *   Tier 2 — everything else, ordered by the priority the engine assigned.
 *
 * A behaviour that cannot be priced is not penalised for it. Some behaviours
 * (clip review, objective setup) have no match metric at all and never will;
 * they keep their place on priority rather than sinking to the bottom.
 */

/** Below this, a gap is noise and must not outrank a considered priority. */
export const MIN_MEANINGFUL_GAP=5;

export type OrderBasis='MEASURED_COST'|'PRIORITY';

export interface OrderedTask{
  task:ILPTask;
  /** Null when the metric has no spec at all. */
  price:LeakPrice|null;
  basis:OrderBasis;
}

export function orderTasks(tasks:ILPTask[],matches:Match[]):OrderedTask[]{
  const priced=tasks.map(task=>{
    const price=matches.length?priceLeak(matches,task.metric):null;
    const measured=
      price?.status==='READY'&&
      (price.gapPoints??0)>=MIN_MEANINGFUL_GAP;
    return {task,price:price&&price.status!=='METRIC_UNAVAILABLE'?price:null,
      basis:(measured?'MEASURED_COST':'PRIORITY') as OrderBasis,gap:price?.gapPoints??null};
  });

  const measured=priced
    .filter(p=>p.basis==='MEASURED_COST')
    .sort((a,b)=>(b.gap??0)-(a.gap??0));

  // rankTasks is the engine's existing priority sort — reused so the fallback
  // behaviour is identical to what shipped before, not a second implementation.
  const unmeasuredTasks=rankTasks(priced.filter(p=>p.basis==='PRIORITY').map(p=>p.task));
  const byId=new Map(priced.map(p=>[p.task.id,p]));
  const unmeasured=unmeasuredTasks.map(t=>byId.get(t.id)!).filter(Boolean);

  return [...measured,...unmeasured].map(({task,price,basis})=>({task,price,basis}));
}

/** Convenience for callers that only need the ordered tasks. */
export const orderedTaskList=(tasks:ILPTask[],matches:Match[]):ILPTask[]=>
  orderTasks(tasks,matches).map(o=>o.task);

/** One line explaining why the plan is in the order it is. */
export function orderingNote(ordered:OrderedTask[]):string{
  const measured=ordered.filter(o=>o.basis==='MEASURED_COST').length;
  if(!measured)return 'Ordered by priority — not enough games yet to price these against each other.';
  if(measured===ordered.length)return 'Ordered by what each behaviour is costing you, measured across your own games.';
  return `Top ${measured} ordered by measured cost. The rest are ordered by priority until there are enough games to price them.`;
}
