import { isQualityPreset } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
export interface Settings {
  performanceMode: boolean;
  graphicsQuality?: QualityPreset;
  steeringSensitivity: number;
  cameraSensitivity: number;
  muted?: boolean; volume?: number;
}
import { freshNeighborhood } from './Neighborhood';
import type { NeighborhoodSave } from './Neighborhood';
export interface Progress { version: 3; cash: number; courierCompleted: boolean; settings: Settings; neighborhood: NeighborhoodSave }
export const PROGRESS_KEY = 'ncr-drive-career-v1'; // Stable key; schema version lives in the payload.
export const BACKUP_KEY = `${PROGRESS_KEY}-backup`;
export const defaultSettings = (): Settings => ({ performanceMode: false, steeringSensitivity: 1, cameraSensitivity: 1, muted:false, volume:0.35 });
const freshProgress = (): Progress => ({ version: 3, cash: 15000, neighborhood: freshNeighborhood(), courierCompleted: false, settings: defaultSettings() });
type Reader = Pick<Storage, 'getItem'>;
export interface LoadedProgress { progress: Progress; writable: boolean; source: 'current' | 'legacy' | 'backup' | 'fresh' | 'unavailable' | 'invalid' | 'unsupported' }

function parse(value: string | null): Progress | null {
  try {
    const p = JSON.parse(value ?? 'null');
    if (!p || (p.version !== 1 && p.version !== 2 && p.version !== 3) || !Number.isSafeInteger(p.cash) || p.cash < 0 || p.cash > 1e9 ||
      typeof p.courierCompleted !== 'boolean') return null;
    const sensitivity = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) && n >= 0.5 && n <= 1.5 ? n : 1;
    const n = p.version === 3 ? p.neighborhood : freshNeighborhood();
    if (!n || !['chai','juice','relationship'].every(k=>Number.isSafeInteger(n[k]) && n[k]>=0 && n[k] <= (k==='relationship'?100:9)) || typeof n.completed!=='boolean') return null;
    return { version: 3, cash: p.cash, neighborhood: {chai:n.chai,juice:n.juice,relationship:n.relationship,completed:n.completed}, courierCompleted: p.courierCompleted, settings: {
      muted: p.settings?.muted === true, volume: typeof p.settings?.volume === 'number' && p.settings.volume>=0 && p.settings.volume<=1 ? p.settings.volume : 0.35,
      performanceMode: p.version >= 2 && p.settings?.performanceMode === true,
      ...(p.version >= 2 && isQualityPreset(p.settings?.graphicsQuality) ? { graphicsQuality: p.settings.graphicsQuality, performanceMode: p.settings.graphicsQuality === 'low' } : {}),
      steeringSensitivity: sensitivity(p.version >= 2 ? p.settings?.steeringSensitivity : undefined),
      cameraSensitivity: sensitivity(p.version >= 2 ? p.settings?.cameraSensitivity : undefined),
    } };
  } catch { return null; }
}
function unsupported(value: string | null): boolean {
  try { const p = JSON.parse(value ?? 'null'); return p && typeof p.version === 'number' && p.version !== 1 && p.version !== 2 && p.version !== 3; }
  catch { return false; }
}
export function loadProgress(storage: Reader): LoadedProgress {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (unsupported(raw)) return { progress: freshProgress(), writable: false, source: 'unsupported' };
    const primary = parse(raw);
    if (primary) return { progress: primary, writable: true, source: JSON.parse(raw!).version === 1 ? 'legacy' : 'current' };
    const backup = parse(storage.getItem(BACKUP_KEY));
    if (backup) return { progress: backup, writable: true, source: 'backup' };
    return { progress: freshProgress(), writable: raw === null, source: raw === null ? 'fresh' : 'invalid' };
  } catch { return { progress: freshProgress(), writable: false, source: 'unavailable' }; }
}
export function readProgress(storage: Reader): Progress { return loadProgress(storage).progress; }
export function writeProgress(storage: Reader & Pick<Storage, 'setItem'>, progress: Progress): boolean {
  try {
    const next = parse(JSON.stringify(progress));
    if (!next || progress.version !== 3) return false;
    const previous = storage.getItem(PROGRESS_KEY);
    if (unsupported(previous)) return false;
    // Back up only validated data, so a damaged primary never replaces a good backup.
    if (parse(previous)) storage.setItem(BACKUP_KEY, previous!);
    storage.setItem(PROGRESS_KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}
