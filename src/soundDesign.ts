export type SoundCue = "place" | "clear" | "allClear" | "gameOver";

// The same instrument can be rendered offline for auditions or played live.
// Rounded fundamentals, quiet overtones and a short attack avoid sharp bleeps.
function woodNote(ctx: BaseAudioContext, output: AudioNode, frequency: number,
  start: number, duration: number, volume: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.4;
  filter.connect(output);
  const partials = [[1, 1, 1], [2, 0.22, 0.55], [3, 0.055, 0.3]];
  let remaining = partials.length;
  for (const [ratio, strength, decay] of partials) {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency * ratio, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * ratio * 0.995, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume * strength, start + 0.007);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration * decay);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(envelope);
    envelope.connect(filter);
    osc.start(start);
    osc.stop(start + duration + 0.01);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
      if (--remaining === 0) filter.disconnect();
    };
  }
}

function placementTap(ctx: BaseAudioContext, output: AudioNode, start: number) {
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  // One quiet, rounded tap: no chord, bright overtones or alternating melody.
  osc.type = "sine";
  osc.frequency.setValueAtTime(230, start);
  osc.frequency.exponentialRampToValueAtTime(190, start + 0.075);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(0.045, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
  envelope.gain.linearRampToValueAtTime(0, start + 0.09);
  osc.connect(envelope);
  envelope.connect(output);
  osc.start(start);
  osc.stop(start + 0.1);
  osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
}

export function scheduleSound(ctx: BaseAudioContext, output: AudioNode, cue: SoundCue,
  start = ctx.currentTime, variation = 0): number {
  const note = (frequency: number, delay: number, length: number, volume: number) =>
    woodNote(ctx, output, frequency, start + delay, length, volume);
  if (cue === "place") {
    placementTap(ctx, output, start);
    return 0.1;
  }
  if (cue === "clear") {
    const tier = Math.min(3, Math.max(0, Math.floor(variation / 2)));
    const base = [261.63, 293.66, 329.63, 392][tier];
    [1, 1.25, 1.5].forEach((ratio, index) => note(base * ratio, index * 0.065, 0.38, 0.16));
    return 0.53;
  }
  if (cue === "allClear") {
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => note(frequency, index * 0.085, 0.52, 0.15));
    note(130.81, 0, 0.65, 0.11);
    return 0.8;
  }
  // A gentle descending phrase rather than a failure buzzer.
  [329.63, 293.66, 261.63].forEach((frequency, index) => note(frequency, index * 0.14, 0.38, 0.13));
  return 0.68;
}
