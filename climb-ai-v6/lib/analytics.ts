/**
 * Analytics.
 *
 * The previous version pushed events into localStorage and nothing ever read
 * them, which meant the product's own north-star metric — completed Hunts per
 * week — was unmeasurable. Events now leave the browser.
 *
 * Design:
 *  - localStorage is a *buffer*, not a destination. If a POST fails the batch
 *    stays queued and goes out with the next flush, so a flaky connection does
 *    not silently lose a founder tester's whole session.
 *  - Identity is a random UUID generated in the browser. No email, no Riot ID,
 *    nothing derived from the person. It exists only to group one browser's
 *    events into a funnel.
 *  - Flushes on an interval and on pagehide via sendBeacon, because the most
 *    interesting event in a retention product is usually the last one before
 *    someone leaves.
 */

export type AnalyticsEvent=
  |'landing_view'|'signup_started'|'signup_completed'|'riot_profile_added'
  |'match_uploaded'|'match_synced'|'analysis_started'|'analysis_completed'
  |'mission_started'|'mission_completed'|'coach_message_sent'|'pricing_viewed'
  |'checkout_started'|'subscription_started'|'subscription_cancelled'
  |'week_1_return'|'week_4_return'|'first_mission_generated'
  // Added for the Hunt loop and the cost-of-leak card.
  |'dashboard_view'|'ilp_view'|'leak_priced'|'leak_insufficient_sample'
  |'hunt_loop_completed'|'feedback_given'|'app_error';

export interface QueuedEvent{
  event:AnalyticsEvent;
  props:Record<string,unknown>;
  occurredAt:string;
}

const QUEUE_KEY='op_event_queue';
const ANON_KEY='op_anon_id';
const SESSION_KEY='op_session_id';
/** Keep the buffer bounded so a long offline stretch cannot fill storage. */
export const MAX_QUEUE=200;
const FLUSH_AT=10;
const FLUSH_EVERY_MS=15_000;

/** Pure: append and trim oldest-first. Exported for tests. */
export function nextQueue(queue:QueuedEvent[],event:QueuedEvent,max=MAX_QUEUE):QueuedEvent[]{
  const next=[...queue,event];
  return next.length>max?next.slice(next.length-max):next;
}

const canUseStorage=()=>{
  try{
    if(typeof window==='undefined')return false;
    window.localStorage.getItem('__probe');
    return true;
  }catch{return false}
};

function readQueue():QueuedEvent[]{
  if(!canUseStorage())return [];
  try{return JSON.parse(window.localStorage.getItem(QUEUE_KEY)||'[]')}catch{return []}
}

function writeQueue(q:QueuedEvent[]){
  if(!canUseStorage())return;
  try{window.localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}catch{/* quota — drop silently */}
}

function id(key:string,store:'local'|'session'):string{
  if(typeof window==='undefined')return 'server';
  const s=store==='local'?window.localStorage:window.sessionStorage;
  try{
    let v=s.getItem(key);
    if(!v){v=crypto.randomUUID();s.setItem(key,v)}
    return v;
  }catch{return 'anonymous'}
}

export const anonId=()=>id(ANON_KEY,'local');
export const sessionId=()=>id(SESSION_KEY,'session');

let timer:ReturnType<typeof setInterval>|null=null;
let listenersBound=false;

export function track(event:AnalyticsEvent,props:Record<string,unknown>={}){
  if(typeof window==='undefined')return;
  const queued:QueuedEvent={event,props,occurredAt:new Date().toISOString()};
  const q=nextQueue(readQueue(),queued);
  writeQueue(q);
  bind();
  if(q.length>=FLUSH_AT)void flush();
}

function bind(){
  if(listenersBound||typeof window==='undefined')return;
  listenersBound=true;
  timer=setInterval(()=>{void flush()},FLUSH_EVERY_MS);
  // pagehide fires on tab close and bfcache navigation, where unload does not.
  window.addEventListener('pagehide',()=>flush(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')flush(true);
  });
}

export async function flush(useBeacon=false):Promise<void>{
  if(typeof window==='undefined')return;
  const queue=readQueue();
  if(!queue.length)return;

  const body=JSON.stringify({anonId:anonId(),sessionId:sessionId(),events:queue});

  // Clear optimistically so a flush during another flush cannot double-send,
  // and restore on failure so nothing is lost.
  writeQueue([]);

  if(useBeacon&&typeof navigator!=='undefined'&&navigator.sendBeacon){
    const ok=navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));
    if(!ok)writeQueue(queue);
    return;
  }

  try{
    const res=await fetch('/api/events',{
      method:'POST',headers:{'content-type':'application/json'},body,keepalive:true,
    });
    if(!res.ok)restore(queue);
  }catch{
    restore(queue);
  }
}

/** Put a failed batch back in front of anything tracked while it was in flight. */
export function restoreBatch(batch:QueuedEvent[],since:QueuedEvent[],max=MAX_QUEUE):QueuedEvent[]{
  return [...batch,...since].slice(-max);
}

function restore(batch:QueuedEvent[]){
  writeQueue(restoreBatch(batch,readQueue()));
}

/** Stops the interval. Used by tests and hot-reload teardown. */
export function stopAnalytics(){
  if(timer)clearInterval(timer);
  timer=null;listenersBound=false;
}
