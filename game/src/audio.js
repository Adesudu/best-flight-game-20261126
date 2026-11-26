// Ridgeline Run — sound: everything is synthesised with WebAudio, no audio files.
// An engine hum that follows speed, a chime for rings, a thud for a crash.
// Audio only starts after the first key or click, as browsers require.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const target = this.muted || !on ? 0 : 0.035 + speed01 * 0.05;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 68, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + speed01 * 700, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  ring() {
    this.blip(880, 0.16, 'sine', 0.18);
    setTimeout(() => this.blip(1318, 0.22, 'sine', 0.14), 70);
  }

  fuel() {
    this.blip(660, 0.14, 'triangle', 0.16);
    setTimeout(() => this.blip(990, 0.2, 'triangle', 0.14), 80);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    this.blip(70, 0.35, 'sine', 0.3);
  }

  land() {
    this.blip(523, 0.14, 'sine', 0.16);
    setTimeout(() => this.blip(659, 0.14, 'sine', 0.16), 110);
    setTimeout(() => this.blip(784, 0.26, 'sine', 0.16), 220);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }
}
