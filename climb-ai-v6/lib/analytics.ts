/**
 * Analytics.
 *
 * The previous version pushed events into localStorage and nothing ever read
 * them, which meant the product's own north-star metric — completed Hunts per
 * week — was unmeasurable. Events now leave the browser.
 */

export type AnalyticsEvent=
  |'landing_view'|'landing_scroll_depth'|'landing_cta_clicked'|'landing_glossary_opened'|'landing_faq_opened'
  |'public_demo_started'|'public_demo_completed'|'public_demo_failed'
  |'signup_started'|'signup_completed'|'riot_profile_added'
  |'activation_started'|'first_match_added'|'op_grade_viewed'|'fix_ladder_viewed'
  |'activation_completed'|'development_hq_entered'
  |'match_uploaded'|'match_synced'|'analysis_started'|'analysis_completed'
  |'mission_started'|'mission_completed'|'coach_message_sent'|'pricing_viewed'
  |'checkout_started'|'subscription_started'|'subscription_cancelled'
  |'week_1_return'|'week_4_return'|'first_mission_generated'
  |'dashboard_view'|'ilp_view'|'leak_priced'|'leak_insufficient_sample'
  |'hunt_loop_completed'|'feedback_given'|'app_error'
  |'companion_pair_started'|'companion_connected'|'companion_recording_started'|'companion_game_completed'
  |'climb_session_started'|'climb_session_completed'|'career_viewed'
  |'tft_section_view'|'tft_sync_started'|'tft_match_synced'|'tft_coach_view'|'tft_pricing_viewed'
  |'tft_manual_game_added'|'tft_set_lab_viewed';

export interface QueuedEvent{event:AnalyticsEvent;props:Record<string,unknown>;occurredAt:string}

const QUEUE_KEY='op_event_queue';
const ANON_KEY='op_anon_id';
const SESSION_KEY='op_session_id';
export const MAX_QUEUE=200;
const FLUSH_AT=10;
const FLUSH_EVERY_MS=15_000;

export function nextQueue(queue:QueuedEvent[],event:QueuedEvent,max=MAX_QUEUE):QueuedEvent[]{
  const next=[...queue,event];
  return next.length>max?next.slice(next.length-max):next;
}

const canUseStorage=()=>{
  try{if(typeof window==='undefined')return false;window.localStorage.getItem('__probe');return true}catch{return false}
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
  try{let v=s.getItem(key);if(!v){v=crypto.randomUUID();s.setItem(key,v)}return v}catch{return'anonymous'}
}

export const anonId=()=>id(ANON_KEY,'local');
export const sessionId=()=>id(SESSION_KEY,'session');
let timer:ReturnType<typeof setInterval>|null=null;
let listenersBound=false;

export function track(event:AnalyticsEvent,props:Record<string,unknown>={}){
  if(typeof window==='undefined')return;
  const queued:QueuedEvent={event,props,occurredAt:new Date().toISOString()};
  const q=nextQueue(readQueue(),queued);writeQueue(q);bind();if(q.length>=FLUSH_AT)void flush();
}
function bind(){
  if(listenersBound||typeof window==='undefined')return;
  listenersBound=true;timer=setInterval(()=>{void flush()},FLUSH_EVERY_MS);
  window.addEventListener('pagehide',()=>flush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush(true)});
}
export async function flush(useBeacon=false):Promise<void>{
  if(typeof window==='undefined')return;
  const queue=readQueue();if(!queue.length)return;
  const body=JSON.stringify({anonId:anonId(),sessionId:sessionId(),events:queue});writeQueue([]);
  if(useBeacon&&typeof navigator!=='undefined'&&navigator.sendBeacon){const ok=navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));if(!ok)writeQueue(queue);return}
  try{const res=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true});if(!res.ok)restore(queue)}catch{restore(queue)}
}
export function restoreBatch(batch:QueuedEvent[],since:QueuedEvent[],max=MAX_QUEUE):QueuedEvent[]{return[...batch,...since].slice(-max)}
function restore(batch:QueuedEvent[]){writeQueue(restoreBatch(batch,readQueue()))}
export function stopAnalytics(){if(timer)clearInterval(timer);timer=null;listenersBound=false}
