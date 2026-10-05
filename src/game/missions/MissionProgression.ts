import { MISSION_LIST, MissionDefinition } from './MissionManager';
import { MISSION_PACKS, MissionDef } from './MissionPacks';
import { recordStars, readBestStars } from './MissionStars';

// Re-exported so existing callers keep working.
export { recordStars };

export type MissionTier = 1 | 2 | 3;

export const TIER_NAMES: Record<MissionTier, string> = {
  1: 'Rookie',
  2: 'Driver',
  3: 'Pro',
};

export const TIER_HINTS: Record<MissionTier, string> = {
  1: 'Learn the ropes on Delhi roads',
  2: 'Complete a Rookie mission to unlock',
  3: 'Complete a Driver mission to unlock',
};

export type ListedMission = MissionDefinition & { tier: MissionTier };

const ALL: ListedMission[] = [
  ...MISSION_LIST.map((m): ListedMission => ({ ...m, tier: 1 as MissionTier })),
  ...MISSION_PACKS,
];

/** Every mission the select screen can show, originals first. */
export function allMissions(): ListedMission[] {
  return ALL;
}

/** Tier of a mission id; 0 when unknown. */
export function tierOf(missionId: string): MissionTier | 0 {
  return ALL.find((m) => m.id === missionId)?.tier ?? 0;
}

/** highScores maps missionId -> best cash; >0 means completed. */
export function isCompleted(missionId: string, highScores: Record<string, number>): boolean {
  return (highScores[missionId] ?? 0) > 0;
}

/**
 * Tier 1 is always open. Tier N unlocks when ANY tier N-1 mission completed.
 */
export function isUnlocked(missionId: string, highScores: Record<string, number>): boolean {
  const tier = tierOf(missionId);
  if (tier === 0) return false;
  if (tier === 1) return true;
  const prev = (tier - 1) as MissionTier;
  return ALL.some((m) => m.tier === prev && isCompleted(m.id, highScores));
}

// ---------------------------------------------------------------------------
// Star persistence lives in MissionStars.ts (import-cycle free); bestStars
// reads that bucket. The lead calls recordStars() on mission completion
// (res.stars is already in the completion result).
// ---------------------------------------------------------------------------

/** Best stars for a mission, or null when never rated. */
export function bestStars(missionId: string, highScores: Record<string, number>): number | null {
  void highScores;
  return readBestStars(missionId);
}

// Re-export for convenience.
export type { MissionDef };
