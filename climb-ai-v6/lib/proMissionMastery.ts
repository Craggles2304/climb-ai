import type { ILPTask, Match } from '@/lib/types';
import type { CoachingMetricKey } from '@/lib/subscription';

const PRO_META = new Set<CoachingMetricKey>([
  'op_score',
  'decision_fingerprint',
  'champion_identity',
  'historical_leak_rate',
]);

export function missionTargetNumber(target: string, fallback = 85) {
  const match = target.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

export function isActionableProMission(task: ILPTask, matches: Match[]) {
  if (PRO_META.has(task.metric as CoachingMetricKey)) return false;
  return matches.some((match) => {
    const metric = match.proAnalysis?.metrics?.[task.metric as CoachingMetricKey];
    return Boolean(
      metric &&
        metric.status !== 'UNAVAILABLE' &&
        metric.status !== 'BUILDING' &&
        typeof metric.score === 'number',
    );
  });
}

export function masteryMetricThreshold(task: ILPTask, matches: Match[]) {
  return isActionableProMission(task, matches)
    ? missionTargetNumber(task.target)
    : 85;
}
