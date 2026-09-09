/**
 * Human error copy.
 *
 * Spec section 42, which was written and never built:
 *
 *   BAD:  Error 500.
 *   GOOD: We couldn't retrieve your latest matches. Your account is safe.
 *         Try again shortly or upload your match manually.
 *
 * Three rules every message here follows:
 *  1. Say what failed, in the player's terms, not the system's.
 *  2. Say what is still true — almost always "your account and your plan are safe".
 *  3. Offer the next move. An error with no way forward is a dead end.
 *
 * Never surface a raw exception message: it is written for a developer, and on a
 * bad day it contains a URL, a token or a stack frame.
 */

export interface HumanError{
  title:string;
  body:string;
  /** Whether retrying the same action could plausibly work. */
  retryable:boolean;
  /** Optional escape hatch when retrying will not help. */
  action?:{label:string;href:string};
}

const SAFE='Your account and your plan are safe.';

const GENERIC:HumanError={
  title:'Something went wrong on our side.',
  body:`${SAFE} This is not something you did — try again, and if it keeps happening the plan is still waiting for you on the dashboard.`,
  retryable:true,
};

/** Matched against the raw message, most specific first. */
const PATTERNS:{test:RegExp;error:HumanError}[]=[
  {
    test:/riot|match-?v5|timeline/i,
    error:{
      title:'We could not reach Riot for your matches.',
      body:`${SAFE} Riot's API drops out from time to time. Try again shortly, or upload the match yourself and nothing is lost.`,
      retryable:true,
      action:{label:'UPLOAD A MATCH',href:'/uploads'},
    },
  },
  {
    test:/rate limit|429|too many/i,
    error:{
      title:'We are asking Riot for too much at once.',
      body:`${SAFE} Give it a minute and the next sync will go through.`,
      retryable:true,
    },
  },
  {
    test:/supabase|database|pgrst|relation .* does not exist/i,
    error:{
      title:'We could not load your saved data.',
      body:`${SAFE} Nothing has been deleted — this is a problem reading it, not storing it.`,
      retryable:true,
    },
  },
  {
    test:/auth|session|jwt|not signed in|401/i,
    error:{
      title:'Your session has expired.',
      body:'Sign in again and you will land back where you were. Nothing has been lost.',
      retryable:false,
      action:{label:'LOG IN',href:'/login'},
    },
  },
  {
    test:/network|fetch failed|offline|econnrefused/i,
    error:{
      title:'We cannot reach the server.',
      body:`${SAFE} This usually means the connection dropped. Check it and try again.`,
      retryable:true,
    },
  },
  {
    test:/not found|404|no such/i,
    error:{
      title:'That is not here.',
      body:'The page or match you were looking for does not exist, or it belongs to a different account.',
      retryable:false,
      action:{label:'BACK TO DEVELOPMENT HQ',href:'/dashboard'},
    },
  },
];

export function humanError(error:unknown):HumanError{
  const raw=error instanceof Error?`${error.name} ${error.message}`
    :typeof error==='string'?error:'';
  if(!raw)return GENERIC;
  for(const {test,error:mapped} of PATTERNS){
    if(test.test(raw))return mapped;
  }
  return GENERIC;
}

/**
 * A short, non-identifying label for analytics. The raw message is deliberately
 * not sent — it can carry URLs, ids or tokens.
 */
export function errorKind(error:unknown):string{
  const raw=error instanceof Error?`${error.name} ${error.message}`
    :typeof error==='string'?error:'';
  for(const {test} of PATTERNS){
    if(test.test(raw))return test.source.split('|')[0].replace(/[^a-z0-9]/gi,'')||'matched';
  }
  return 'unknown';
}
