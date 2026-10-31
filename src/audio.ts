import { storage } from "./storage";
import { scheduleSound, type SoundCue } from "./soundDesign";
import { type PraiseCue, type PraiseId } from "./praise";
import voiceManifest from "./praiseVoices.json";

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private muted = storage.get("bbt_muted") === "true";
  private placeCount = 0;
  private voiceBuffers = new Map<string, AudioBuffer>();
  private voiceLoad: Promise<void> | null = null;
  private voice: AudioBufferSourceNode | null = null;
  private voiceUntil = 0;
  private nextPraise = 0;
  private generation = 0;

  private initCtx(): boolean {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return false;
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 4;
        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
        this.effects = this.ctx.createGain();
        this.effects.connect(this.master);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      this.voiceLoad ??= this.loadVoices();
      return true;
    } catch { return false; } // Sound must never prevent a legal move.
  }

  private async loadVoices() {
    const clips: Partial<Record<PraiseId, string>> = voiceManifest.clips;
    await Promise.all(Object.entries(clips).map(async ([id, url]) => {
      // Only reviewed, self-hosted assets. No runtime TTS service or credentials.
      if (!/^\/audio\/praise\/[a-z0-9-]+\.(mp3|wav|ogg)$/.test(url)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        if (data.byteLength > 1_000_000 || !this.ctx) return;
        const buffer = await this.ctx.decodeAudioData(data);
        if (buffer.duration > 0 && buffer.duration <= 2.5) this.voiceBuffers.set(id, buffer);
      } catch { /* Text and synthesized effects remain available offline. */ }
    }));
  }

  public isMuted() { return this.muted; }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    storage.set("bbt_muted", String(this.muted));
    if (this.muted) {
      this.generation++;
      this.voice?.stop();
      this.voice = null;
      this.voiceUntil = 0;
      // Disconnect ringing/scheduled effects so unmuting cannot resurrect them.
      this.effects?.disconnect();
      if (this.ctx && this.master) {
        this.effects = this.ctx.createGain();
        this.effects.connect(this.master);
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.008);
      }
    } else if (this.initCtx() && this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.008);
    }
    return this.muted;
  }

  private play(cue: SoundCue, variation = 0) {
    if (this.muted || !this.initCtx() || !this.ctx || !this.effects) return;
    scheduleSound(this.ctx, this.effects, cue, this.ctx.currentTime, variation);
  }

  public playPlace() { this.play("place", this.placeCount++); }
  public playClear(combo = 0) { this.play("clear", combo); }
  public playAllClear() { this.play("allClear"); }
  public playGameOver() { this.play("gameOver"); }

  public async playPraise(cue: PraiseCue) {
    if (!cue.speak || this.muted || !this.initCtx() || !this.ctx) return;
    const requestedAt = this.ctx.currentTime;
    if (requestedAt < this.nextPraise) return;
    const generation = this.generation;
    await this.voiceLoad;
    if (this.muted || generation !== this.generation || !this.master || !this.effects ||
      this.ctx.currentTime - requestedAt > 0.15 || this.ctx.currentTime < this.nextPraise) return;
    const buffer = this.voiceBuffers.get(cue.id);
    if (!buffer) return;
    const now = this.ctx.currentTime;
    if (now < this.voiceUntil) return;
    const voice = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    voice.buffer = buffer;
    gain.gain.value = 0.65;
    voice.connect(gain);
    gain.connect(this.master);
    this.voice = voice;
    this.voiceUntil = now + buffer.duration;
    this.nextPraise = now + Math.max(3, buffer.duration + 1);
    // Let the words sit above the chime without increasing overall volume.
    this.effects.gain.cancelScheduledValues(now);
    this.effects.gain.setTargetAtTime(0.4, now, 0.025);
    this.effects.gain.setTargetAtTime(1, this.voiceUntil, 0.09);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      if (this.voice === voice) this.voice = null;
    };
    voice.start(now);
  }
}

export const soundManager = new SoundManager();
