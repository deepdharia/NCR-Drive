import { distance } from '../core/math';
import type { Point } from '../core/math';
export interface MissionStep { title: string; dialogue: string; target: Point; mode: 'drive' | 'foot' }
export const REGIONAL_JOURNEY: readonly MissionStep[] = [
  {title:'Collect Kabir’s dispatch at the east arcade',dialogue:'Kabir: Take this dispatch to Cyber Plaza in Gurgaon. Follow the southwest signs; stop in the marked bay.',target:{x:92,z:0},mode:'drive'},
  {title:'Deliver to Gurgaon · Cyber Plaza bay',dialogue:'Kabir: The office team is waiting at Cyber Plaza. Stop in the gold bay. After delivery, explore the Yamuna crossing and Noida neighborhoods.',target:{x:-2100,z:1910},mode:'drive'},
];
export const OPENING_CHAPTER: readonly MissionStep[] = [
  { title: 'Meet Kabir at the east arcade', dialogue: 'Kabir: My evening delivery driver never showed. Bring a car to the east arcade.', target: { x: 92, z: 0 }, mode: 'drive' },
  { title: 'Collect the market paperwork', dialogue: 'Kabir: Good. Pick up the paperwork from the south market. Keep the wheels steady.', target: { x: 46, z: 79.67 }, mode: 'drive' },
  { title: 'Hand over at Shivaji Stadium', dialogue: 'Kabir: Last stop, stadium metro. Park nearby and finish the handover on foot.', target: { x: -104, z: 0 }, mode: 'foot' },
];
/** Small data-driven chapter runner; objectives own no rendering or wallet state. */
export class StoryMission {
  state: 'available' | 'active' | 'failed' | 'completed' = 'available';
  private saveRetry = 0;
  index = 0; remaining = 240; dwell = 0;
  constructor(readonly steps = OPENING_CHAPTER, readonly duration = 240, readonly reward = 1200) {}
  get active(): boolean { return this.state === 'active'; }
  get step(): MissionStep { return this.steps[this.index]; }
  accept(): boolean {
    if (this.active) return false;
    this.saveRetry = 0; this.state = 'active'; this.index = 0; this.remaining = this.duration; this.dwell = 0; return true;
  }
  cancel(): void { this.saveRetry = 0; this.state = 'available'; this.dwell = 0; }
  update(dt: number, position: Point, driving: boolean, kmh: number, persist: () => boolean = () => true): 'step' | 'completed' | 'failed' | 'save-failed' | null {
    if (!this.active) return null;
    if (this.saveRetry > 0) { this.saveRetry = Math.max(0, this.saveRetry - dt); return null; }
    if (this.dwell < 1.5) this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining) { this.state = 'failed'; this.dwell = 0; return 'failed'; }
    if (driving !== (this.step.mode === 'drive') || kmh > 2 || distance(position, this.step.target) > 4) { this.dwell = 0; return null; }
    this.dwell += dt;
    if (this.dwell < 1.5) return null;
    if (this.index + 1 < this.steps.length) { this.dwell = 0; this.index++; return 'step'; }
    if (!persist()) { this.saveRetry = 1; return 'save-failed'; }
    this.dwell = 0;
    this.state = 'completed'; return 'completed';
  }
}

/** A 467m drive through the CP west junction, return to the marked bay, then walk. */
export const CP_SHOWCASE: readonly MissionStep[] = [
 {title:'Market Lane · collect the evening parcel',dialogue:'Kabir: Take the west junction into Market Lane. Collect at the cold-store bay, 300 metres west. Stop below 2 km/h.',target:{x:-342,z:4},mode:'drive'},
 {title:'Park in the marked public bay',dialogue:'Kabir: Parcel loaded. Return to the public parking bay beside Neem Chai. Brake, park, then press F to exit.',target:{x:-173,z:-12.5},mode:'drive'},
 {title:'Walk to Neem Chai · hand over the parcel',dialogue:'Kabir: Leave the car in the bay. Walk to Neem Chai for the handover. ₹900 is paid only after your save succeeds.',target:{x:-164,z:-12},mode:'foot'},
];
