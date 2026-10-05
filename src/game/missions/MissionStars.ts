/**
 * Star-rating persistence for missions.
 *
 * highScores only stores best cash, so stars get their own small
 * localStorage bucket. This module intentionally imports nothing, so both
 * MissionManager and MissionProgression can use it without import cycles.
 */

const STAR_KEY = 'ncr_drive_mission_stars';

function readStars(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STAR_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Persist the best star rating for a mission. Safe in private browsing. */
export function recordStars(missionId: string, stars: number): void {
  try {
    const s = readStars();
    s[missionId] = Math.max(s[missionId] ?? 0, Math.round(stars));
    localStorage.setItem(STAR_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Best stars for a mission, or null when never rated. */
export function readBestStars(missionId: string): number | null {
  const s = readStars()[missionId];
  return typeof s === 'number' ? s : null;
}
