import { Howl, Howler } from 'howler';
import { create } from 'zustand';
import { loadSetting, saveSetting } from '../net/storage.ts';
import { startCalmMusic } from './calmMusic.ts';

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
  'pick',
  'unpick',
  'cardOpen',
  'tap',
  'sheetOpen',
  'sheetClose',
  'tick',
  'join',
  'leave',
  'shuffle',
  'pause',
  'resume',
  'ask',
  'yes',
  'no',
] as const;
export type SfxName = (typeof SFX)[number];

export const MUSIC_TRACKS = ['teahouse', 'harbour', 'bazaar'] as const;
export type MusicTrack = (typeof MUSIC_TRACKS)[number];

type AudioSettings = {
  readonly musicOn: boolean;
  readonly track: MusicTrack;
  readonly effectsOn: boolean;
  readonly volume: number;
};

const AMBIENCE_LEVEL = 0.5;

const readVolume = (): number => {
  const raw = loadSetting('volume');
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.6;
};

const readTrack = (): MusicTrack => {
  const raw = loadSetting('track');
  return MUSIC_TRACKS.find((t) => t === raw) ?? 'teahouse';
};

const readFlag = (key: string, fallback: boolean): boolean => {
  const raw = loadSetting(key);
  return raw === null ? fallback : raw === 'true';
};

const prefersQuiet = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const useAudioSettings = create<AudioSettings>()(() => ({
  musicOn: readFlag('musicOn', !prefersQuiet()),
  track: readTrack(),
  effectsOn: readFlag('effectsOn', true),
  volume: readVolume(),
}));

const sources = (name: string): string[] => [
  `/assets/audio/${name}.webm`,
  `/assets/audio/${name}.m4a`,
];

const sfxCache = new Map<SfxName, Howl>();
let unlocked = false;
let playing: { readonly track: MusicTrack; readonly stop: () => void } | null = null;

const sfx = (name: SfxName): Howl => {
  const cached = sfxCache.get(name);
  if (cached) return cached;
  const howl = new Howl({ src: sources(name), preload: true });
  sfxCache.set(name, howl);
  return howl;
};

const startAmbience = (): (() => void) => {
  const howl = new Howl({ src: sources('ambience'), loop: true, html5: true, volume: 0 });
  howl.play();
  howl.fade(0, AMBIENCE_LEVEL, 1200);
  return () => {
    howl.fade(howl.volume(), 0, 800);
    setTimeout(() => howl.unload(), 900);
  };
};

const startTrack = (track: MusicTrack): (() => void) | null => {
  if (track === 'bazaar') return startAmbience();
  const ctx = Howler.ctx;
  if (!ctx) return null;
  void ctx.resume();
  return startCalmMusic(ctx, Howler.masterGain, track);
};

const pageVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

const stopMusic = (): void => {
  playing?.stop();
  playing = null;
};

const silence = (): void => {
  stopMusic();
  Howler.stop();
  void Howler.ctx?.suspend();
};

const syncMusic = (): void => {
  if (!unlocked || !pageVisible()) return;
  const s = useAudioSettings.getState();
  const wanted = s.musicOn && s.volume > 0 ? s.track : null;
  if (playing?.track === wanted) return;
  stopMusic();
  if (wanted === null) return;
  const stop = startTrack(wanted);
  if (stop) playing = { track: wanted, stop };
};

export const unlockAudio = (): void => {
  if (unlocked) return;
  unlocked = true;
  SFX.forEach(sfx);
  syncMusic();
};

export const updateAudio = (patch: Partial<AudioSettings>): void => {
  useAudioSettings.setState(patch);
  for (const [key, value] of Object.entries(patch)) saveSetting(key, String(value));
  Howler.volume(useAudioSettings.getState().volume);
  syncMusic();
};

export const play = (name: SfxName, options: { delay?: number; volume?: number } = {}): void => {
  const s = useAudioSettings.getState();
  if (!unlocked || !s.effectsOn) return;
  const fire = () => {
    const howl = sfx(name);
    const id = howl.play();
    howl.volume(options.volume ?? 1, id);
    howl.rate(0.98 + Math.random() * 0.04, id);
  };
  if (options.delay) setTimeout(fire, options.delay);
  else fire();
};

const CLINKS: readonly SfxName[] = ['clink1', 'clink2', 'clink3'];

export const playClinks = (count: number, startDelay = 0, gap = 70): void => {
  for (let i = 0; i < Math.min(count, 2); i++) {
    play(CLINKS[i % CLINKS.length] ?? 'clink1', { delay: startDelay + i * gap, volume: 0.45 });
  }
};

Howler.volume(useAudioSettings.getState().volume);

const onVisibility = (): void => {
  if (pageVisible()) {
    void Howler.ctx?.resume();
    syncMusic();
    return;
  }
  silence();
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', silence);
}
