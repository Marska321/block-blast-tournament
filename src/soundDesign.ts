export type SoundCue = "place" | "clear" | "allClear" | "gameOver";

// Dry material contact and a brushed release, shared by live play and auditions.
const textures = new WeakMap<BaseAudioContext, AudioBuffer>();
function textureBuffer(ctx: BaseAudioContext) {
  let buffer = textures.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 41719;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    textures.set(ctx, buffer);
  }
  return buffer;
}
function envelope(ctx: BaseAudioContext, output: AudioNode, start: number,
  duration: number, volume: number, attack: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
  gain.gain.linearRampToValueAtTime(0, start + duration + .012);
  gain.connect(output);
  return gain;
}
function body(ctx: BaseAudioContext, output: AudioNode, start: number,
  frequency: number, duration: number, volume: number) {
  // Quiet non-harmonic modes suggest a physical object rather than a keyboard.
  for (const [ratio, level, decay] of [[1, 1, 1], [2.71, .13, .55], [4.13, .025, .32]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = frequency * ratio;
    const gain = envelope(ctx, output, start, duration * decay, volume * level, .004);
    osc.connect(gain); osc.start(start); osc.stop(start + duration + .025);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}
function brush(ctx: BaseAudioContext, output: AudioNode, start: number,
  duration: number, volume: number, cutoff: number, attack = .008) {
  const source = ctx.createBufferSource(); source.buffer = textureBuffer(ctx);
  const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
  high.type = 'highpass'; high.frequency.value = 380; high.Q.value = .5;
  low.type = 'lowpass'; low.frequency.value = cutoff; low.Q.value = .5;
  const gain = envelope(ctx, output, start, duration, volume, attack);
  source.connect(high); high.connect(low); low.connect(gain);
  source.start(start, .13); source.stop(start + duration + .025);
  source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); gain.disconnect(); };
}
export function scheduleSound(ctx: BaseAudioContext, output: AudioNode, cue: SoundCue,
  start = ctx.currentTime, variation = 0): number {
  if (cue === 'place') {
    const colour = [1350, 1500, 1420][Math.abs(Math.floor(variation)) % 3];
    brush(ctx, output, start, .045, .095, colour, .003);
    body(ctx, output, start, 310, .048, .035);
    return .085;
  }
  if (cue === 'clear') {
    const tier = Math.min(3, Math.max(0, Math.floor(variation / 2)));
    brush(ctx, output, start, .14 + tier * .012, .12, 2100, .014);
    body(ctx, output, start + .012, 510, .15, .07);
    body(ctx, output, start + .034, 765, .12, .025 + tier * .004);
    return .23;
  }
  if (cue === 'allClear') {
    brush(ctx, output, start, .24, .1, 2600, .035);
    // One soft open voicing, with a short tail instead of a reward jingle.
    body(ctx, output, start + .016, 255, .34, .055);
    body(ctx, output, start + .026, 638, .4, .065);
    body(ctx, output, start + .045, 892, .32, .034);
    return .48;
  }
  brush(ctx, output, start, .16, .055, 1150, .018);
  body(ctx, output, start + .008, 185, .18, .045);
  return .23;
}
