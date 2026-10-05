export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Engine sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Tyre squeal nodes
  private squealSource: AudioBufferSourceNode | null = null;
  private squealGain: GainNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;

  // Ambient wind/city
  private ambientGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  private isInitialized: boolean = false;

  constructor() {
    // Lazy initialized on first user gesture
  }

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSynth();
      this.setupSquealSynth();
      this.setupAmbientBed();
      this.isInitialized = true;
    } catch {
      // Audio not supported or autoplay blocked
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    // Osc 1 (Main fundamental)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Osc 2 (Harmonic growl)
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupSquealSynth() {
    if (!this.ctx || !this.masterGain) return;

    // Procedural white noise buffer for tyre squeal
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.squealFilter = this.ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.setValueAtTime(1850, this.ctx.currentTime);
    this.squealFilter.Q.setValueAtTime(4.5, this.ctx.currentTime);

    this.squealGain = this.ctx.createGain();
    this.squealGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.squealFilter);
    this.squealFilter.connect(this.squealGain);
    this.squealGain.connect(this.masterGain);

    whiteNoise.start();
    this.squealSource = whiteNoise;
  }

  private setupAmbientBed() {
    if (!this.ctx || !this.masterGain) return;

    // Rain / Wind noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const rainNoise = this.ctx.createBufferSource();
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

    rainNoise.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    rainNoise.start();
  }

  public updateEngine(rpm: number, throttle: number, speedKmh: number, isDrifting: boolean, isDiesel: boolean = false) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    // Pitch engine based on RPM (850 to 6500)
    const baseFreq = isDiesel ? 38 : 46;
    const freq = baseFreq + (rpm / 6500) * (isDiesel ? 160 : 210);

    const now = this.ctx.currentTime;
    if (this.engineOsc1) {
      this.engineOsc1.frequency.setTargetAtTime(freq, now, 0.04);
    }
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(freq * 1.5, now, 0.04);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(280 + throttle * 650 + (rpm / 6500) * 800, now, 0.05);
    }
    if (this.engineGain) {
      const vol = 0.12 + throttle * 0.16 + (rpm / 6500) * 0.12;
      this.engineGain.gain.setTargetAtTime(vol, now, 0.05);
    }

    // Tyre squeal on drift or hard braking
    if (this.squealGain) {
      const squealTarget = isDrifting ? 0.35 : 0.0;
      this.squealGain.gain.setTargetAtTime(squealTarget, now, 0.06);
    }
  }

  public setRain(isRaining: boolean) {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(isRaining ? 0.15 : 0.0, this.ctx.currentTime, 0.5);
  }

  // Double-honk: Indian truck/car style "Pip-Pip!"
  public playHorn() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    const playChirp = (delay: number, duration: number) => {
      const osc1 = this.ctx!.createOscillator();
      const osc2 = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(440, t + delay);
      osc2.frequency.setValueAtTime(520, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.25, t + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + delay + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(t + delay);
      osc2.start(t + delay);
      osc1.stop(t + delay + duration);
      osc2.stop(t + delay + duration);
    };

    playChirp(0, 0.12);
    playChirp(0.18, 0.15); // Second tap of the horn
  }

  // Turn signal indicator click
  public playIndicatorTick() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // FASTag Toll Beep
  public playFastagBeep() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.setValueAtTime(2700, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Collision Impact Thud
  public playCollisionThud(intensity: number = 1.0) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.25);

    const vol = Math.min(0.6, 0.2 + intensity * 0.3);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /** Stop all looping nodes and close the context so nothing keeps playing after unmount. */
  public dispose() {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.squealSource?.stop();
    } catch {
      // Nodes may already be stopped
    }
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.squealSource = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    this.engineGain = null;
    this.ambientGain = null;
    this.rainGain = null;
    this.isInitialized = false;
  }
}
