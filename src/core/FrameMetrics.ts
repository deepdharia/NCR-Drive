import type { QualityPreset } from '../rendering/QualityProfile';

/** Bounded rolling samples, excluding menu time. Not a hardware benchmark. */
export class FrameMetrics {
 private samples:number[]=[];
 add(milliseconds:number):void {if(Number.isFinite(milliseconds)&&milliseconds>0){this.samples.push(milliseconds);if(this.samples.length>300)this.samples.shift();}}
 get percentiles():{p50:number;p95:number}{const sorted=[...this.samples].sort((a,b)=>a-b);return {p50:sorted[Math.floor(sorted.length*0.5)]??0,p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))]??0};}
}

/**
 * AutoQuality thresholds — tuned against what Phases 0–7 add, from code
 * analysis only. No measured FPS numbers exist yet (no phone run has been
 * done), so these are estimates to be re-tuned after the first measurement
 * in docs/PERF_BUDGET.md. They are deliberately conservative: a wrong
 * step-down costs a little sharpness, a missed step-down costs the drive.
 *
 * Why p95, not p50 or average: p50 can look fine while 1 frame in 20 hitches.
 * p95 is what the player feels as stutter, and it is the same number already
 * shown on screen by Game.renderStats, so the thresholds and the phone
 * protocol read the same value.
 *
 * Cost model behind the numbers (see docs/PERF_BUDGET.md for the per-phase
 * breakdown): Phases 0–7 add no fullscreen pass and no per-frame allocation
 * churn — night adds 2 pooled headlight spotlights, vegetation is instanced
 * and culled, effects are pooled sprites, Phase 7 is tone mapping + a CSS
 * overlay. The big costs stay the ones the tiers already control: pixel
 * ratio (fragment load), shadow-map size (a second scene pass), and scenery
 * distance (how much is drawn). So the thresholds are set against the
 * 16.7 ms 60 fps budget with room for those three, not against any one phase.
 */
export const AUTO_QUALITY = {
  /** 60 fps frame budget. */
  FRAME_BUDGET_MS: 16.7,
  /** Step down when the worst 5% of frames sit 20% over budget, sustained.
   *  20 ms p95 = regular vsync misses on a phone; waiting for worse leaves
   *  the game feeling broken while the evaluator watches. */
  STEP_DOWN_P95_MS: 20,
  /** Unplayable worst case (worst 5% below 30 fps): step down after a single
   *  window instead of making the player wait out the dwell. */
  SEVERE_P95_MS: 33,
  /** Step up only with ~22% headroom under budget. A tier up costs far more
   *  than the headroom it needs (balanced is ~2.8x low's fragments, high is
   *  1.44x balanced plus 4x the shadow texels), so a quiet highway stretch
   *  must not trigger a tier the next junction can't hold. */
  STEP_UP_P95_MS: 13,
  /** One evaluation per 5 s of driving — matches the 300-sample window at
   *  60 fps, so each decision reads a full fresh window. */
  EVALUATION_INTERVAL_MS: 5000,
  /** Sustained-breach windows before stepping down (10 s of bad frames). */
  STEP_DOWN_WINDOWS: 2,
  /** Sustained-headroom windows before stepping up (15 s — stepping up is
   *  the riskier direction, so it needs the longer proof). */
  STEP_UP_WINDOWS: 3,
  /** Quiet time after any step, so one change is measured before the next. */
  COOLDOWN_MS: 5000,
} as const;

export type AutoQualityAction = 'hold' | 'step-down' | 'step-up';

/** Cheapest first. AutoQuality only ever moves one tier per decision. */
export const TIER_ORDER: readonly QualityPreset[] = ['low', 'balanced', 'high'] as const;

/**
 * Pure evaluator: recommends a tier move from a p95 reading, nothing else.
 * It never touches gameplay, audio, missions, or save data — it only returns
 * an action. Wiring (one call per stats tick in Game, applying the result
 * through the existing quality action) is an integration step, deliberately
 * left out of this phase so no file outside Phase 8 ownership changes.
 *
 * Rules:
 * - The player's manually chosen tier is the ceiling: AutoQuality steps down
 *   from it under load and can climb back to it, but never above it. A manual
 *   pick is never overridden upward.
 * - Never below 'low'; never more than one tier per step.
 * - Dwell + cooldown stop flapping: a single hitch, a shader-compile spike,
 *   or a traffic-spawn burst cannot move the tier on its own.
 * - `nowMs` is a monotonic clock (performance.now() / rAF timestamp).
 */
export class AutoQuality {
  private lastEvaluationMs = -Infinity;
  private lastStepMs = -Infinity;
  private downStreak = 0;
  private upStreak = 0;

  evaluate(p95Ms: number, current: QualityPreset, ceiling: QualityPreset, nowMs: number): AutoQualityAction {
    if (!Number.isFinite(p95Ms) || p95Ms <= 0) return 'hold';
    if (nowMs - this.lastEvaluationMs < AUTO_QUALITY.EVALUATION_INTERVAL_MS) return 'hold';
    this.lastEvaluationMs = nowMs;
    if (nowMs - this.lastStepMs < AUTO_QUALITY.COOLDOWN_MS) { this.downStreak = 0; this.upStreak = 0; return 'hold'; }

    const tierIndex = TIER_ORDER.indexOf(current);
    const ceilingIndex = TIER_ORDER.indexOf(ceiling);

    if (p95Ms > AUTO_QUALITY.STEP_DOWN_P95_MS && tierIndex > 0) {
      this.upStreak = 0;
      this.downStreak += 1;
      if (p95Ms > AUTO_QUALITY.SEVERE_P95_MS || this.downStreak >= AUTO_QUALITY.STEP_DOWN_WINDOWS) {
        this.step(nowMs);
        return 'step-down';
      }
      return 'hold';
    }

    if (p95Ms < AUTO_QUALITY.STEP_UP_P95_MS && tierIndex < ceilingIndex) {
      this.downStreak = 0;
      this.upStreak += 1;
      if (this.upStreak >= AUTO_QUALITY.STEP_UP_WINDOWS) {
        this.step(nowMs);
        return 'step-up';
      }
      return 'hold';
    }

    this.downStreak = 0;
    this.upStreak = 0;
    return 'hold';
  }

  /** Streaks, for the stats line / debugging. Not part of the decision. */
  get status(): { downStreak: number; upStreak: number } {
    return { downStreak: this.downStreak, upStreak: this.upStreak };
  }

  reset(): void {
    this.lastEvaluationMs = -Infinity;
    this.lastStepMs = -Infinity;
    this.downStreak = 0;
    this.upStreak = 0;
  }

  private step(nowMs: number): void {
    this.lastStepMs = nowMs;
    this.downStreak = 0;
    this.upStreak = 0;
  }
}
