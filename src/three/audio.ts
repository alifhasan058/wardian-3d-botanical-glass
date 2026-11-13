import type { WeatherType } from '../types/terrarium';

/**
 * 100% procedural Web Audio soundscape for rain, mist spray, and night ambiance.
 * Starts only on explicit user interaction.
 */
export class TerrariumAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private nightGain: GainNode | null = null;
  private nightOsc: OscillatorNode | null = null;
  private enabled = false;
  private currentWeather: WeatherType = 'clear';
  private isNight = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      this.init();
    }
    if (!this.ctx || !this.masterGain) return;

    if (enabled && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(enabled ? 0.32 : 0.0, now, 0.25);
    this.updateMix();
  }

  public setEnvironment(weather: WeatherType, timeOfDay: number): void {
    this.currentWeather = weather;
    this.isNight = timeOfDay < 5.5 || timeOfDay > 19.5;
    if (this.enabled) {
      this.updateMix();
    }
  }

  public triggerMistBurst(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Filtered noise burst simulating a fine botanical atomizer misting
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.9);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.38));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
  }

  private init(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Looping pink-ish filtered noise for rain on glass
    const bufLen = ctx.sampleRate * 3;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const out = noiseBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1350;
    rainFilter.Q.value = 0.55;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    noiseSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    noiseSrc.start();
    this.rainGain = rainGain;

    // Gentle warm night harmonic drone
    const nightOsc = ctx.createOscillator();
    nightOsc.type = 'sine';
    nightOsc.frequency.value = 174.61; // F3 soft hum
    const nightGain = ctx.createGain();
    nightGain.gain.value = 0;
    nightOsc.connect(nightGain);
    nightGain.connect(master);
    nightOsc.start();
    this.nightOsc = nightOsc;
    this.nightGain = nightGain;
  }

  private updateMix(): void {
    if (!this.ctx || !this.rainGain || !this.nightGain) return;
    const now = this.ctx.currentTime;

    const rainTarget =
      this.currentWeather === 'storm'
        ? 0.55
        : this.currentWeather === 'rain'
          ? 0.28
          : this.currentWeather === 'mist'
            ? 0.06
            : 0.0;

    this.rainGain.gain.setTargetAtTime(rainTarget, now, 0.4);
    this.nightGain.gain.setTargetAtTime(this.isNight ? 0.045 : 0.0, now, 0.6);
  }

  public dispose(): void {
    try {
      this.nightOsc?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
  }
}
