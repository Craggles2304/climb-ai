/**
 * Single source of truth for product naming.
 *
 * User-visible naming is centralised here. Internal storage keys and CSS
 * selectors deliberately keep their historic CLIMB names so existing player
 * data is not invalidated by a branding change.
 */

export const BRAND={
  /** Full public product name. */
  name:'OVERPOWERED CLIMB AI',
  /** Short form used where space is tight. */
  short:'OP CLIMB',
  tagline:"HUNT WHAT'S NEXT.",
  /** Proprietary improvement metric, 0–100. */
  score:'OP Score',
  scoreCaps:'OP SCORE',
  /** The core product loop. */
  loop:'The Hunt',
  loopCaps:'THE HUNT',
  description:'League of Legends improvement powered by saved match evidence, adaptive learning plans and post-game coaching.',
  /** Existing OVERPOWERED logo assets remain the visual mark. */
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
