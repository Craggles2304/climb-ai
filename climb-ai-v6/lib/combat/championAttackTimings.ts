export interface ChampionAttackTiming {
  championId: string;
  patch: string;
  windupPercent: number;
}

const WINDUP_16_18: Record<string, number> = {
  aphelios: 0.15333,
  ashe: 0.2193,
  ezreal: 0.188387,
  galio: 0.20625,
  hecarim: 0.25,
  jinx: 0.16875,
  kogmaw: 0.16622,
  shen: 0.17361,
  vayne: 0.17544,
  viego: 0.16447,
};

export function championAttackTiming(championId: string, patch: string): ChampionAttackTiming | null {
  if (!validatedTimingPatch(patch)) return null;
  const key = normaliseChampionId(championId);
  const windupPercent = WINDUP_16_18[key];
  if (!Number.isFinite(windupPercent) || windupPercent <= 0) return null;
  return { championId: key, patch, windupPercent };
}

export function validatedTimingPatch(patch: string): boolean {
  const match = /^(\d+)\.(\d+)(?:\.|$)/.exec(String(patch).trim());
  return Boolean(match && Number(match[1]) === 16 && Number(match[2]) === 18);
}

export function normaliseChampionId(value: string): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}
