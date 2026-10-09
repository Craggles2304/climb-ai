import type {HabitId} from './library';

/**
 * One colour per habit — the "bases" of the Career DNA strand. Used on the helix,
 * the habit cards and the weekly report so a habit reads the same everywhere.
 *
 * Spread round the colour wheel and kept clear of the app's volt accent, which
 * already means "win" across the UI.
 */
export const HABIT_COLOURS:Record<HabitId,string>={
  deathWithGold:'#ffd43b',
  hoardingGold:'#ff922b',
  deathBeforeObjective:'#ff6b6b',
  backToBackDeaths:'#f783ac',
  deepDeath:'#da77f2',
  soloDeath:'#4dabf7',
  earlyDeaths:'#3bc9db',
  noControlWard:'#9775fa',
  lateFarmDrop:'#69db7c',
};
