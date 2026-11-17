export type CalmVariant = 'teahouse' | 'harbour';

type Voice = {
  readonly root: number;
  readonly scale: readonly number[];
  readonly octaves: readonly number[];
  readonly gapSeconds: readonly [number, number];
  readonly pluckDecay: number;
  readonly brightness: number;
  readonly noteGain: number;
  readonly droneGain: number;
  readonly restChance: number;
  readonly doubleChance: number;
};

const VOICES: Readonly<Record<CalmVariant, Voice>> = {
  teahouse: {
    root: 146.83,
    scale: [0, 2, 3, 5, 7, 8, 10],
    octaves: [0, 1],
    gapSeconds: [0.9, 2.2],
    pluckDecay: 0.996,
    brightness: 1800,
    noteGain: 0.22,
    droneGain: 0.05,
    restChance: 0.22,
    doubleChance: 0.18,
  },
  harbour: {
    root: 110,
    scale: [0, 3, 5, 7, 10],
    octaves: [1, 2],
    gapSeconds: [1.6, 3.6],
    pluckDecay: 0.998,
    brightness: 1200,
    noteGain: 0.16,
    droneGain: 0.045,
    restChance: 0.35,
    doubleChance: 0.08,
  },
};

const LOOKAHEAD_SECONDS = 0.6;
const TICK_MS = 200;
const NOTE_SECONDS = 3;
const REVERB_SECONDS = 3.2;
const FADE_SECONDS = 2.5;

const semitone = (root: number, steps: number): number => root * 2 ** (steps / 12);

const pluckBuffer = (ctx: BaseAudioContext, frequency: number, decay: number): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * NOTE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(ctx.sampleRate / frequency));
  for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1;
  for (let i = period; i < length; i++) {
    data[i] = decay * 0.5 * ((data[i - period] ?? 0) + (data[i - period + 1] ?? 0));
  }
  return buffer;
};

const reverbImpulse = (ctx: BaseAudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * REVERB_SECONDS);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return impulse;
};

const between = ([low, high]: readonly [number, number]): number =>
  low + Math.random() * (high - low);

const nextStep = (current: number, size: number): number => {
  const move = Math.round((Math.random() - 0.5) * 4);
  return Math.min(Math.max(current + move, 0), size - 1);
};

export const startCalmMusic = (
  ctx: AudioContext,
  destination: AudioNode,
  variant: CalmVariant,
): (() => void) => {
  const voice = VOICES[variant];
  const notes = voice.octaves.flatMap((octave) =>
    voice.scale.map((step) => semitone(voice.root, step + octave * 12)),
  );
  const buffers = notes.map((f) => pluckBuffer(ctx, f, voice.pluckDecay));

  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_SECONDS);
  out.connect(destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(out);

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = voice.brightness;
  tone.connect(out);
  tone.connect(reverb);

  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 380;
  const droneGain = ctx.createGain();
  droneGain.gain.value = voice.droneGain;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.05;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = voice.droneGain * 0.4;
  swell.connect(swellDepth).connect(droneGain.gain);
  const drones = [voice.root / 2, (voice.root * 3) / 4].map((frequency) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    osc.connect(droneFilter);
    return osc;
  });
  droneFilter.connect(droneGain).connect(out);
  droneGain.connect(reverb);
  [...drones, swell].forEach((osc) => osc.start());

  const playNote = (index: number, at: number, gain: number): void => {
    const buffer = buffers[index];
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = (Math.random() - 0.5) * 8;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level).connect(tone);
    source.start(at);
  };

  let step = Math.floor(voice.scale.length / 2);
  let nextAt = ctx.currentTime + 1;
  const schedule = (): void => {
    while (nextAt < ctx.currentTime + LOOKAHEAD_SECONDS) {
      if (Math.random() > voice.restChance) {
        step = nextStep(step, notes.length);
        playNote(step, nextAt, voice.noteGain * between([0.7, 1]));
        if (Math.random() < voice.doubleChance) {
          playNote(nextStep(step, notes.length), nextAt + 0.18, voice.noteGain * 0.6);
        }
      }
      nextAt += between(voice.gapSeconds);
    }
  };
  schedule();
  const timer = setInterval(schedule, TICK_MS);

  return () => {
    clearInterval(timer);
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + FADE_SECONDS / 2);
    setTimeout(
      () => {
        [...drones, swell].forEach((osc) => osc.stop());
        out.disconnect();
      },
      (FADE_SECONDS / 2) * 1000 + 100,
    );
  };
};
