import { Howl, Howler } from 'howler';
import { create } from 'zustand';
import { loadSetting, saveSetting } from '../net/storage.ts';

export const SFX = [
  'clink1',
  'clink2',
  'clink3',
  'slide',
  'flip',
  'chime',
  'stamp',
  'bell',
  'thunk',
  'pop',
  'victory',
] as const;
export type SfxName = (typeof SFX)[number];

type LoopName = 'music' | 'ambience';

type AudioSettings = {
  readonly muted: boolean;
  readonly sfxVolume: number;
  readonly musicVolume: number;
  readonly ambienceVolume: number;
};

const readNumber = (key: string, fallback: number): number => {
  const raw = loadSetting(key);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;
};

const prefersQuiet = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const useAudioSettings = create<AudioSettings>()(() => ({
  muted: loadSetting('muted') === 'true',
  sfxVolume: readNumber('sfxVolume', 0.8),
  musicVolume: readNumber('musicVolume', prefersQuiet() ? 0 : 0.35),
  ambienceVolume: readNumber('ambienceVolume', prefersQuiet() ? 0 : 0.25),
}));

const sources = (name: string): string[] => [
  `/assets/audio/${name}.webm`,
  `/assets/audio/${name}.m4a`,
];

const sfxCache = new Map<SfxName, Howl>();
const loops = new Map<LoopName, Howl>();
let unlocked = false;

const sfx = (name: SfxName): Howl => {
  const cached = sfxCache.get(name);
  if (cached) return cached;
  const howl = new Howl({ src: sources(name), preload: true });
  sfxCache.set(name, howl);
  return howl;
};

const loopVolume = (name: LoopName, s: AudioSettings): number =>
  name === 'music' ? s.musicVolume : s.ambienceVolume;

const syncLoop = (name: LoopName, s: AudioSettings): void => {
  const volume = loopVolume(name, s);
  const existing = loops.get(name);
  if (volume === 0 || s.muted) {
    existing?.pause();
    return;
  }
  const howl = existing ?? new Howl({ src: sources(name), loop: true, html5: true, volume: 0 });
  loops.set(name, howl);
  if (!howl.playing()) {
    howl.play();
    howl.fade(0, volume, 1200);
  } else {
    howl.volume(volume);
  }
};

const syncLoops = (): void => {
  if (!unlocked) return;
  const s = useAudioSettings.getState();
  syncLoop('music', s);
  syncLoop('ambience', s);
};

export const unlockAudio = (): void => {
  if (unlocked) return;
  unlocked = true;
  SFX.forEach(sfx);
  syncLoops();
};

export const updateAudio = (patch: Partial<AudioSettings>): void => {
  useAudioSettings.setState(patch);
  for (const [key, value] of Object.entries(patch)) saveSetting(key, String(value));
  Howler.mute(useAudioSettings.getState().muted);
  syncLoops();
};

export const play = (name: SfxName, options: { delay?: number; volume?: number } = {}): void => {
  const s = useAudioSettings.getState();
  if (!unlocked || s.muted || s.sfxVolume === 0) return;
  const fire = () => {
    const howl = sfx(name);
    const id = howl.play();
    howl.volume(s.sfxVolume * (options.volume ?? 1), id);
    howl.rate(0.95 + Math.random() * 0.1, id);
  };
  if (options.delay) setTimeout(fire, options.delay);
  else fire();
};

const CLINKS: readonly SfxName[] = ['clink1', 'clink2', 'clink3'];

export const playClinks = (count: number, startDelay = 0, gap = 70): void => {
  for (let i = 0; i < Math.min(count, 6); i++) {
    play(CLINKS[i % CLINKS.length] ?? 'clink1', { delay: startDelay + i * gap, volume: 0.8 });
  }
};

Howler.mute(useAudioSettings.getState().muted);
