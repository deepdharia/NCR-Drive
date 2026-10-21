/** Cargo condition for "Make the Surprise" goods runs.
 *
 * Pure logic, sampled once per fixed simulation step with the step's dt.
 * Every drain is a per-second rate multiplied by dt, and impacts are
 * discrete events, so the result is frame-rate independent: the same
 * driving produces the same condition at 30, 60 or 120 steps per second.
 *
 * What counts is deliberately narrow and explainable:
 *  - impacts (the vehicle's own fresh-collision flag),
 *  - hard braking below −6.5 m/s²,
 *  - harsh acceleration above +4.5 m/s²,
 *  - hard cornering (lateral acceleration above 5.5 m/s², using the same
 *    bicycle-model relation as VehicleController: v² · tan(steer) / 2.4).
 * Ordinary turns, gentle braking and normal pull-aways drain nothing.
 * Condition never falls below the floor, so a delivery is always
 * completable; care only scales the bonus. */

export interface CargoSample { acceleration: number; speed: number; steering: number; impact: boolean }
export interface CargoEvent { kind: 'impact' | 'brake' | 'accel' | 'corner'; message: string }

export const CARGO_FLOOR = 35;
export const CARGO_IMPACT_COST = 9;
export const CARGO_BRAKE_RATE = 3.5;   // per second while braking harder than the threshold
export const CARGO_ACCEL_RATE = 2;     // per second above the acceleration threshold
export const CARGO_CORNER_RATE = 2.5;  // per second above the lateral threshold
export const CARGO_BRAKE_THRESHOLD = -6.5;
export const CARGO_ACCEL_THRESHOLD = 4.5;
export const CARGO_LATERAL_THRESHOLD = 5.5;
/** Care bonus: ₹0 at 60, scaling linearly to ₹100 at a perfect 100. */
export function careBonus(condition: number): number {
  return condition >= 60 ? Math.round((condition - 60) / 40 * 100) : 0;
}
export function careTitle(condition: number): string {
  return condition >= 95 ? 'Feather-Foot Chauffeur' : condition >= 85 ? 'Silk-Road Smooth' : condition >= 70 ? 'Careful Carrier' : condition >= 50 ? 'Steady Hand' : 'Battle-Tested Delivery';
}
export function careExplanation(condition: number, events: { impact: number; brake: number; accel: number; corner: number }): string {
  const parts: string[] = [];
  if (!events.impact && !events.brake && !events.accel && !events.corner) return 'Care score ' + Math.round(condition) + '/100 — a flawless run: no impacts, no harsh braking, no hard corners.';
  if (events.impact) parts.push(events.impact + (events.impact === 1 ? ' impact' : ' impacts'));
  if (events.brake) parts.push('hard braking ×' + events.brake);
  if (events.corner) parts.push('hard cornering ×' + events.corner);
  if (events.accel) parts.push('harsh pull-aways ×' + events.accel);
  return 'Care score ' + Math.round(condition) + '/100 — docked for ' + parts.join(', ') + '. Gentle braking and wider, slower corners keep the cargo perfect.';
}

export class CargoCare {
  condition = 100;
  readonly events = { impact: 0, brake: 0, accel: 0, corner: 0 };
  private inBrake = false; private inAccel = false; private inCorner = false;
  private queue: CargoEvent[] = [];
  reset(): void {
    this.condition = 100; this.events.impact = 0; this.events.brake = 0; this.events.accel = 0; this.events.corner = 0;
    this.inBrake = this.inAccel = this.inCorner = false; this.queue = [];
  }
  /** Sample one fixed step. Returns nothing; read `events`/`condition`. */
  sample(dt: number, s: CargoSample): void {
    if (!(dt > 0) || dt > 0.25) return;
    if (s.impact) {
      this.condition = Math.max(CARGO_FLOOR, this.condition - CARGO_IMPACT_COST);
      this.events.impact++;
      this.queue.push({ kind: 'impact', message: 'Cargo: that knock shifted the load. Care ' + Math.round(this.condition) + '/100.' });
    }
    const braking = s.acceleration < CARGO_BRAKE_THRESHOLD;
    if (braking) {
      this.condition = Math.max(CARGO_FLOOR, this.condition - CARGO_BRAKE_RATE * dt);
      if (!this.inBrake) { this.events.brake++; this.queue.push({ kind: 'brake', message: 'Cargo: ease off the brakes — the boxes are sliding. Care ' + Math.round(this.condition) + '/100.' }); }
    }
    this.inBrake = braking;
    const surging = s.acceleration > CARGO_ACCEL_THRESHOLD;
    if (surging) {
      this.condition = Math.max(CARGO_FLOOR, this.condition - CARGO_ACCEL_RATE * dt);
      if (!this.inAccel) { this.events.accel++; this.queue.push({ kind: 'accel', message: 'Cargo: gentle pull-aways keep it pristine. Care ' + Math.round(this.condition) + '/100.' }); }
    }
    this.inAccel = surging;
    const lateral = Math.abs(s.speed * s.speed * Math.tan(s.steering) / 2.4);
    const cornering = lateral > CARGO_LATERAL_THRESHOLD && Math.abs(s.speed) > 3;
    if (cornering) {
      this.condition = Math.max(CARGO_FLOOR, this.condition - CARGO_CORNER_RATE * dt);
      if (!this.inCorner) { this.events.corner++; this.queue.push({ kind: 'corner', message: 'Cargo: that corner was hard — wider and slower keeps it perfect. Care ' + Math.round(this.condition) + '/100.' }); }
    }
    this.inCorner = cornering;
  }
  /** Drain queued player-facing events (Game toasts them, throttled). */
  drainEvents(): CargoEvent[] { const out = this.queue; this.queue = []; return out; }
  get bonus(): number { return careBonus(this.condition); }
  get title(): string { return careTitle(this.condition); }
  get explanation(): string { return careExplanation(this.condition, this.events); }
}
