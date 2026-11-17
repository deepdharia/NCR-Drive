/**
 * Phase 5 — procedural music loop: pure pattern data for the generative
 * Delhi-evening drive loop in StreetAudio. No audio binaries, no network,
 * no randomness: the same 64-step loop every time, so it is testable in
 * node and deterministic in the game.
 *
 * Feel: slow (76 BPM), warm A-minor — Am → F → C → G, one bar each.
 * A soft kick on the beat, a quiet hat off-beat, a low triangle bass,
 * slow pad chords and a sparse pentatonic pluck. Meant to sit under the
 * engine, not over it.
 */

export const MUSIC_BPM = 76;
/** Eighth-note steps per bar. */
export const MUSIC_STEPS_PER_BAR = 16;
export const MUSIC_BARS = 4;
export const MUSIC_LOOP_STEPS = MUSIC_STEPS_PER_BAR * MUSIC_BARS;

/** Chords as MIDI numbers: bass root + pad triad. */
export const MUSIC_CHORDS: { name: string; root: number; pad: number[] }[] = [
  { name: 'Am', root: 45, pad: [57, 60, 64] }, // A2 · A3 C4 E4
  { name: 'F', root: 41, pad: [53, 57, 60] }, // F2 · F3 A3 C4
  { name: 'C', root: 48, pad: [55, 60, 64] }, // C3 · G3 C4 E4
  { name: 'G', root: 43, pad: [55, 59, 62] }, // G2 · G3 B3 D4
];

/** A-minor pentatonic pluck, one note per listed loop step (deterministic). */
const PLUCK_STEPS: Record<number, number> = {
  3: 69, 11: 72, 19: 76, 27: 74, 35: 72, 43: 76, 51: 79, 59: 76,
};

export type MusicVoice = 'bass' | 'pad' | 'pluck' | 'kick' | 'hat';
export interface MusicEvent {
  voice: MusicVoice;
  /** MIDI note for bass/pad/pluck; undefined for kick/hat. */
  midi?: number;
  /** Peak gain of the voice (before the music-volume control). */
  gain: number;
  /** Note length in steps. */
  durSteps: number;
}

/** Seconds per eighth-note step. */
export function stepDurationSec(bpm: number = MUSIC_BPM): number {
  return 60 / bpm / 2;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Chord sounding at a loop step (0..63, wraps). */
export function chordAtStep(step: number): { name: string; root: number; pad: number[] } {
  const s = ((step % MUSIC_LOOP_STEPS) + MUSIC_LOOP_STEPS) % MUSIC_LOOP_STEPS;
  return MUSIC_CHORDS[Math.floor(s / MUSIC_STEPS_PER_BAR)];
}

/** All voices sounding on one loop step. Empty array on a silent step. */
export function eventsForStep(step: number): MusicEvent[] {
  const s = ((step % MUSIC_LOOP_STEPS) + MUSIC_LOOP_STEPS) % MUSIC_LOOP_STEPS;
  const barStep = s % MUSIC_STEPS_PER_BAR;
  const chord = chordAtStep(s);
  const events: MusicEvent[] = [];
  if (barStep === 0) for (const midi of chord.pad) events.push({ voice: 'pad', midi, gain: 0.045, durSteps: 16 });
  if (barStep === 0 || barStep === 8) events.push({ voice: 'bass', midi: chord.root, gain: 0.16, durSteps: 6 });
  if (barStep % 4 === 0) events.push({ voice: 'kick', gain: 0.5, durSteps: 1 });
  if (barStep % 4 === 2) events.push({ voice: 'hat', gain: 0.05, durSteps: 1 });
  const pluck = PLUCK_STEPS[s];
  if (pluck !== undefined) events.push({ voice: 'pluck', midi: pluck, gain: 0.09, durSteps: 2 });
  return events;
}
