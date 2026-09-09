/**
 * Single source of truth for product naming.
 *
 * The original brief required the name to be globally replaceable. It was not —
 * it was hard-coded in 48 places across 28 files. Everything user-visible now
 * reads from here, so the next rename is this file plus the two colour tokens
 * at the top of globals.css.
 *
 * Deliberately NOT renamed, and why:
 *  - localStorage keys (`climb_active_account`, `climb_ilp_v6`, `climb_events`)
 *    Renaming them silently discards every existing player's saved plan. They
 *    are invisible to users; a migration can happen later if it ever matters.
 *  - CSS class names (`.climb-card-*`, `.climb-cockpit`) — internal selectors.
 *  - `climbScore()` in lib/engine.ts — internal function name.
 */

export const BRAND={
  /** Full wordmark, as it appears in the logo. */
  name:'OVERPOWERED',
  /** Monogram — the two angular eyes of the mark read as OP. */
  short:'OP',
  tagline:"HUNT WHAT'S NEXT.",
  /** Proprietary improvement metric, 0–100. */
  score:'OP Score',
  scoreCaps:'OP SCORE',
  /** The core product loop. */
  loop:'The Hunt',
  loopCaps:'THE HUNT',
  description:'Play. Analyse. Hunt the leak. Prove improvement.',
  /** The real logo, in public/brand. Use these, never a text substitute. */
  logo:{lockup:'/brand/overpowered-lockup.png',crest:'/brand/overpowered-crest.png'},
} as const;

/** Loop stages, used on the landing page and anywhere the loop is explained. */
export const HUNT_STAGES=[
  {step:'01',name:'PLAY',detail:'Create evidence'},
  {step:'02',name:'ANALYSE',detail:'Rank recurring leaks'},
  {step:'03',name:'HUNT THE LEAK',detail:'Carry one cue'},
  {step:'04',name:'PLAY AGAIN',detail:'Use it next game'},
  {step:'05',name:'PROVE IT',detail:'Pass or fail the mission'},
] as const;

export const appName=()=>process.env.NEXT_PUBLIC_APP_NAME||BRAND.name;
