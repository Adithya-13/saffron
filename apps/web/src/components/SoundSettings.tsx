import { MUSIC_TRACKS, play, unlockAudio, updateAudio, useAudioSettings } from '../audio/sound.ts';
import type { MusicTrack } from '../audio/sound.ts';
import { Sheet } from './Sheet.tsx';

const TRACK_INFO: Readonly<Record<MusicTrack, { label: string; detail: string }>> = {
  teahouse: { label: 'Tea house', detail: 'Slow plucked strings over a warm drone' },
  harbour: { label: 'Night harbour', detail: 'Sparse, soft tones, the calmest' },
  bazaar: { label: 'Bazaar sounds', detail: 'Market murmur, no melody' },
};

export const SoundSettings = ({ onClose }: { readonly onClose: () => void }) => {
  const settings = useAudioSettings();
  const change = (patch: Parameters<typeof updateAudio>[0]) => {
    unlockAudio();
    updateAudio(patch);
  };

  return (
    <Sheet title="Sound" onClose={onClose}>
      <div className="settings">
        <label className="settings__row">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
            onPointerUp={() => play('chime')}
            aria-label="Volume"
          />
        </label>
        <label className="settings__row">
          <span>Sound effects</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.effectsOn}
            onChange={(e) => change({ effectsOn: e.target.checked })}
          />
        </label>
        <label className="settings__row">
          <span>Music</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.musicOn}
            onChange={(e) => change({ musicOn: e.target.checked })}
          />
        </label>
        <fieldset className="tracks" disabled={!settings.musicOn}>
          <legend className="tracks__legend">Music track</legend>
          {MUSIC_TRACKS.map((track) => (
            <label key={track} className="tracks__option">
              <input
                type="radio"
                name="track"
                value={track}
                checked={settings.track === track}
                onChange={() => change({ track })}
              />
              <span>
                <span className="tracks__label">{TRACK_INFO[track].label}</span>
                <span className="tracks__detail">{TRACK_INFO[track].detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Sheet>
  );
};
