import type { DialogueLine } from './StoryMission';

/** "Make the Surprise" presentation data: payoff dialogue and the finish
 * record. The money lives in Neighborhood/CargoCare; this module only
 * words and remembers (locally) what already happened. */

export interface FinishRecord {
  jobId: string; jobName: string; routeLabel: string;
  extra: boolean; extraLabel: string;
  condition: number; title: string; explanation: string;
  base: number; extraReward: number; care: number; total: number; replay: boolean;
}

/** Short payoff at the handover counter, played AFTER the atomic commit
 * succeeded — a line never promises anything that was not just paid or
 * delivered. Branches: extra carried, care quality. */
export function payoffLines(record: { jobId: string; extra: boolean; condition: number }): readonly DialogueLine[] {
  const careful = record.condition >= 85, rough = record.condition < 55;
  if (record.jobId === 'flower-order') {
    const counter: DialogueLine[] = [record.extra
      ? { speaker: 'FNP · Counter', text: 'Flowers — and the Halwai sweets too? Whoever this celebration is, you just made their evening.' }
      : { speaker: 'FNP · Counter', text: 'Bouquet received. Let me check the stems…' }];
    if (careful) counter.push({ speaker: 'FNP · Counter', text: 'Not a petal bruised. Kabir said you drive careful — he undersold it. The care bonus is yours, I saw it on the receipt.' });
    else if (rough) counter.push({ speaker: 'FNP · Counter', text: 'A few petals have seen things. It still counts as a bouquet — mostly. Gentler brakes next run, the bonus is real money.' });
    else counter.push({ speaker: 'FNP · Counter', text: 'Good shape. A little gentler on the brakes and the full care bonus is yours next time.' });
    counter.push({ speaker: 'You', text: 'Garden Stop to Gurgaon, one celebration delivered.' });
    return counter;
  }
  const halwai: DialogueLine[] = [record.extra
    ? { speaker: 'Halwai Corner', text: 'The Noida cake — and a sweets tray riding along? Full celebration, delivered by one careful driver.' }
    : { speaker: 'Halwai Corner', text: 'Cake received. Checking the box…' }];
  if (careful) halwai.push({ speaker: 'Halwai Corner', text: 'Icing perfect, not a smudge. In my trade we call that respect. Care bonus is on your receipt.' });
  else if (rough) halwai.push({ speaker: 'Halwai Corner', text: 'The cake leaned a little in its box. Still a cake! Slower corners, friend — the bonus rewards it.' });
  else halwai.push({ speaker: 'Halwai Corner', text: 'Clean enough. Ease into the corners and the full care bonus is yours next run.' });
  halwai.push({ speaker: 'You', text: 'Noida to Garden Stop — the celebration is complete.' });
  return halwai;
}

export const BESTS_KEY = 'ncr-drive-bests-v1';
export interface LocalBest { condition: number; title: string }
export type LocalBests = Record<string, LocalBest>;
/** Local personal bests — this device only, always labelled LOCAL in UI.
 * Not a leaderboard; nothing leaves the browser. */
export function loadBests(storage: Pick<Storage, 'getItem'>): LocalBests {
  try {
    const raw = JSON.parse(storage.getItem(BESTS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return {};
    const out: LocalBests = {};
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      const b = v as Partial<LocalBest>;
      if (typeof b?.condition === 'number' && b.condition >= 0 && b.condition <= 100 && typeof b?.title === 'string') out[id] = { condition: b.condition, title: b.title };
    }
    return out;
  } catch { return {}; }
}
export function recordBest(storage: Pick<Storage, 'getItem' | 'setItem'>, jobId: string, condition: number, title: string): LocalBests {
  const bests = loadBests(storage);
  if (!bests[jobId] || condition > bests[jobId].condition) bests[jobId] = { condition: Math.round(condition), title };
  try { storage.setItem(BESTS_KEY, JSON.stringify(bests)); } catch { /* storage unavailable: bests are a bonus, never a blocker */ }
  return bests;
}
