export interface Progress { version: 1; cash: number; rides: number; courierCompleted: boolean }
const KEY = 'ncr-drive-career-v1';
export function readProgress(storage: Pick<Storage, 'getItem'>): Progress {
  const fresh: Progress = { version: 1, cash: 15000, rides: 0, courierCompleted: false };
  try {
    const data: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (!data || typeof data !== 'object') return fresh;
    const p = data as Progress;
    if (p.version !== 1 || !Number.isSafeInteger(p.cash) || p.cash < 15000 || p.cash > 1e9 ||
      !Number.isSafeInteger(p.rides) || p.rides < 0 || p.rides > 1e6 || typeof p.courierCompleted !== 'boolean') return fresh;
    return { version: 1, cash: p.cash, rides: p.rides, courierCompleted: p.courierCompleted };
  } catch { return fresh; }
}
export function writeProgress(storage: Pick<Storage, 'setItem'>, progress: Progress): boolean {
  try { storage.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
