import { play, unlockAudio, updateAudio, useAudioSettings } from '../audio/sound.ts';
import { Sheet } from './Sheet.tsx';

type SliderKey = 'sfxVolume' | 'musicVolume' | 'ambienceVolume';

const SLIDERS: readonly { key: SliderKey; label: string }[] = [
  { key: 'sfxVolume', label: 'Sound effects' },
  { key: 'musicVolume', label: 'Music' },
  { key: 'ambienceVolume', label: 'Bazaar ambience' },
];

export const SoundSettings = ({ onClose }: { onClose: () => void }) => {
  const settings = useAudioSettings();
  return (
    <Sheet title="Sound" onClose={onClose}>
      <div className="settings">
        <label className="settings__row">
          <span>Mute everything</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => {
              unlockAudio();
              updateAudio({ muted: e.target.checked });
            }}
          />
        </label>
        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="settings__row">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[key]}
              onChange={(e) => {
                unlockAudio();
                updateAudio({ [key]: Number(e.target.value) });
              }}
              onPointerUp={() => key === 'sfxVolume' && play('chime')}
            />
          </label>
        ))}
      </div>
    </Sheet>
  );
};
