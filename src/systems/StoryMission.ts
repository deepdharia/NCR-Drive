import { distance } from '../core/math';
import type { Point } from '../core/math';
export interface DialogueLine { speaker: string; text: string }
export interface ChoiceOption { id: string; label: string; detail: string; cost?: number; rewardDelta?: number }
export interface MissionStep { title: string; dialogue: string; target: Point; mode: 'drive' | 'foot'; parking?: {width:number;depth:number}; lines?: readonly DialogueLine[]; linesByBranch?: Readonly<Record<string, readonly DialogueLine[]>>; choice?: { options: readonly ChoiceOption[] } }
export const REGIONAL_JOURNEY: readonly MissionStep[] = [
  {title:'Collect Kabir’s dispatch at the east arcade',dialogue:'Kabir: Take this dispatch to Cyber Plaza in Gurgaon. Follow the southwest signs; stop in the marked bay.',target:{x:92,z:0},mode:'drive'},
  {title:'Deliver to Gurgaon · Cyber Plaza bay',dialogue:'Kabir: The office team is waiting at Cyber Plaza. Stop in the gold bay. After delivery, explore the Yamuna crossing and Noida neighborhoods.',target:{x:-2100,z:1910},mode:'drive'},
];
export const OPENING_CHAPTER: readonly MissionStep[] = [
  { title: 'Meet Kabir at the east arcade', dialogue: 'Kabir: My evening delivery driver never showed. Bring a car to the east arcade.', target: { x: 92, z: 0 }, mode: 'drive' },
  { title: 'Collect the market paperwork', dialogue: 'Kabir: Good. Pick up the paperwork from the south market. Keep the wheels steady.', target: { x: 46, z: 79.67 }, mode: 'drive' },
  { title: 'Hand over at Shivaji Stadium', dialogue: 'Kabir: Last stop, stadium metro. Park nearby and finish the handover on foot.', target: { x: -104, z: 0 }, mode: 'foot' },
];
export function parkedInBay(position:Point, target:Point, bay:{width:number;depth:number}, car:{yaw:number;width:number;length:number}):boolean {
 const c=Math.abs(Math.cos(car.yaw)),s=Math.abs(Math.sin(car.yaw));
 return Math.abs(position.x-target.x)+(c*car.width+s*car.length)/2<=bay.width/2
  && Math.abs(position.z-target.z)+(s*car.width+c*car.length)/2<=bay.depth/2;
}
/** Small data-driven chapter runner; objectives own no rendering or wallet state.
 *  Steps may carry authored dialogue (`lines`, optionally per choice branch)
 *  and one choice. Dialogue/choice phases freeze the mission timer and are
 *  resolved by the presentation layer calling dialogueDone()/choose(). */
export class StoryMission {
  state: 'available' | 'active' | 'failed' | 'completed' = 'available';
  private saveRetry = 0;
  private readonly baseReward: number;
  phase: 'travel' | 'dialogue' | 'choice' = 'travel';
  branch: string | undefined = undefined;
  private linesPlayedFor = -1;
  index = 0; remaining = 240; dwell = 0; reward: number;
  constructor(readonly steps = OPENING_CHAPTER, readonly duration = 240, reward = 1200) { this.baseReward = reward; this.reward = reward; }
  get active(): boolean { return this.state === 'active'; }
  get step(): MissionStep { return this.steps[this.index]; }
  /** Dialogue for the current step, honouring the branch chosen earlier. */
  currentLines(): readonly DialogueLine[] {
    const step = this.step;
    return (this.branch ? step.linesByBranch?.[this.branch] : undefined) ?? step.lines ?? [];
  }
  accept(): boolean {
    if (this.active) return false;
    this.saveRetry = 0; this.state = 'active'; this.index = 0; this.remaining = this.duration; this.dwell = 0;
    this.phase = 'travel'; this.branch = undefined; this.reward = this.baseReward; this.linesPlayedFor = -1; return true;
  }
  cancel(): void { this.saveRetry = 0; this.state = 'available'; this.dwell = 0; this.phase = 'travel'; this.branch = undefined; this.reward = this.baseReward; this.linesPlayedFor = -1; }
  /** Presentation finished the current step's dialogue. Returns 'choice' when
   *  a decision follows; otherwise the step completes through update(). */
  dialogueDone(): 'choice' | null {
    if (this.phase !== 'dialogue') return null;
    if (this.step.choice) { this.phase = 'choice'; return 'choice'; }
    this.phase = 'travel'; return null;
  }
  /** Apply a choice option. A cash cost is charged through the caller's atomic
   *  persist callback; when that fails nothing is charged and the choice stays
   *  open so the player can retry. */
  choose(optionIndex: number, pay: (amount: number) => boolean): 'chosen' | 'save-failed' | null {
    if (this.phase !== 'choice' || !this.step.choice) return null;
    const option = this.step.choice.options[optionIndex];
    if (!option) return null;
    if (option.cost && !pay(option.cost)) return 'save-failed';
    if (option.rewardDelta) this.reward += option.rewardDelta;
    this.branch = option.id; this.phase = 'travel'; return 'chosen';
  }
  update(dt: number, position: Point, driving: boolean, kmh: number, persist: () => boolean = () => true, car?:{yaw:number;width:number;length:number}): 'step' | 'completed' | 'failed' | 'save-failed' | 'dialogue' | null {
    if (!this.active) return null;
    if (this.phase !== 'travel') return null;
    if (this.saveRetry > 0) { this.saveRetry = Math.max(0, this.saveRetry - dt); return null; }
    if (this.dwell < 1.5) this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining) { this.state = 'failed'; this.dwell = 0; return 'failed'; }
    if (driving !== (this.step.mode === 'drive') || kmh > 2 || distance(position, this.step.target) > 4) { this.dwell = 0; return null; }
    if (this.step.parking && (!car || !parkedInBay(position,this.step.target,this.step.parking,car))) { this.dwell=0; return null; }
    this.dwell += dt;
    if (this.linesPlayedFor !== this.index && (this.step.lines?.length || this.step.linesByBranch)) {
      if (this.dwell >= 0.35) { this.phase = 'dialogue'; this.linesPlayedFor = this.index; this.dwell = 1.5; return 'dialogue'; }
      return null;
    }
    if (this.dwell < 1.5) return null;
    if (this.index + 1 < this.steps.length) { this.dwell = 0; this.index++; return 'step'; }
    if (!persist()) { this.saveRetry = 1; return 'save-failed'; }
    this.dwell = 0;
    this.state = 'completed'; return 'completed';
  }
}

/** Kabir's phone call when the chapter is accepted from DelhiOS. */
export const CP_SHOWCASE_INTRO: readonly DialogueLine[] = [
 { speaker: 'Kabir · Phone', text: 'Neem Chai opens tonight, and Meera has a problem only you can fix.' },
 { speaker: 'Kabir · Phone', text: 'Her tea is ready. Her cups are still at Salim’s cold store, west end of Market Lane.' },
 { speaker: 'You', text: 'A chai opening with no cups. Strong start.' },
 { speaker: 'Kabir · Phone', text: 'Exactly why I called you. Drive careful — those cups are her whole evening.' },
];

/** Chapter 01 — Cups Before Customers. A 467m drive through the CP west
 *  junction to Salim's cold store, a real choice about the wrong cups,
 *  whole-car parking, then the handover to Meera on foot. */
export const CP_SHOWCASE: readonly MissionStep[] = [
 {title:'Collect Meera’s cups · Salim’s cold store',dialogue:'Kabir: Salim’s cold store, west end of Market Lane. Stop below 2 km/h — he is expecting you.',target:{x:-342,z:4},mode:'drive',
  lines:[
   {speaker:'Salim',text:'Kabir’s crate? Ready. But listen — half of it is paper cups. The kulhad box never arrived.'},
   {speaker:'Salim',text:'Paper will do the job. Kulhad makes it an opening. Your call.'},
  ],
  choice:{options:[
   {id:'kulhad',label:'Add the kulhad crate · ₹120',detail:'Pay Salim now from your Delhi Wallet. Meera’s opening gets the real thing, and she pays a premium at the handover.',cost:120,rewardDelta:150},
   {id:'paper',label:'Take the crate as it is',detail:'Paper cups pour fine. No cost, standard handover.'},
  ]}},
 {title:'Park in the marked public bay',dialogue:'Kabir: Cups loaded. Return to the public parking bay beside Neem Chai. Brake, park, then press F to exit.',target:{x:-173,z:-12.5},mode:'drive',parking:{width:3.2,depth:6}},
 {title:'Walk to Meera · Neem Chai handover',dialogue:'Kabir: Leave the car in the bay. Meera is waiting at Neem Chai.',target:{x:-164,z:-12},mode:'foot',
  lines:[
   {speaker:'Meera',text:'Paper cups on opening night…'},
   {speaker:'You',text:'The kulhad box never reached Salim. These will pour fine.'},
   {speaker:'Meera',text:'They will. Thank you for getting them here in time.'},
  ],
  linesByBranch:{kulhad:[
   {speaker:'Meera',text:'Kulhads! Salim said the box was lost.'},
   {speaker:'You',text:'It was. I covered the difference — opening night deserves the real thing.'},
   {speaker:'Meera',text:'Then the first chai is on me. You saved opening night.'},
  ]}},
];
