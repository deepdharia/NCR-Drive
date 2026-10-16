import { distance } from '../core/math';
import type { Point } from '../core/math';
export interface MissionStep { title: string; dialogue: string; target: Point; mode: 'drive' | 'foot' }
export const OPENING_CHAPTER: readonly MissionStep[] = [
  { title: 'Meet Kabir at the east arcade', dialogue: 'Kabir: My evening delivery driver never showed. Bring a car to the east arcade.', target: { x: 92, z: 0 }, mode: 'drive' },
  { title: 'Collect the market paperwork', dialogue: 'Kabir: Good. Pick up the paperwork from the south market. Keep the wheels steady.', target: { x: 46, z: 79.67 }, mode: 'drive' },
  { title: 'Hand over at Shivaji Stadium', dialogue: 'Kabir: Last stop, stadium metro. Park nearby and finish the handover on foot.', target: { x: -104, z: 0 }, mode: 'foot' },
];
/** Small data-driven chapter runner; objectives own no rendering or wallet state. */
export class StoryMission {
  state: 'available' | 'active' | 'failed' | 'completed' = 'available';
  index = 0; remaining = 240; dwell = 0;
  readonly reward = 1200;
  constructor(readonly steps = OPENING_CHAPTER) {}
  get active(): boolean { return this.state === 'active'; }
  get step(): MissionStep { return this.steps[this.index]; }
  accept(): boolean {
    if (this.active) return false;
    this.state = 'active'; this.index = 0; this.remaining = 240; this.dwell = 0; return true;
  }
  cancel(): void { this.state = 'available'; this.dwell = 0; }
  update(dt: number, position: Point, driving: boolean, kmh: number): 'step' | 'completed' | 'failed' | null {
    if (!this.active) return null;
    this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining) { this.state = 'failed'; this.dwell = 0; return 'failed'; }
    if (driving !== (this.step.mode === 'drive') || kmh > 2 || distance(position, this.step.target) > 4) { this.dwell = 0; return null; }
    this.dwell += dt;
    if (this.dwell < 1.5) return null;
    this.dwell = 0;
    if (this.index + 1 < this.steps.length) { this.index++; return 'step'; }
    this.state = 'completed'; return 'completed';
  }
}
