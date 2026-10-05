import React, { useState } from 'react';
import { X, Sliders, Monitor, Volume2, VolumeX, CloudRain, Globe } from 'lucide-react';
import { SaveManager } from '../game/save/SaveManager';
import { PlayerSaveData, QualityLevel, Weather } from '../game/types';

interface SettingsModalProps {
  saveData: PlayerSaveData;
  onUpdateSave: (newSave: PlayerSaveData) => void;
  onClose: () => void;
  onQualityChange: (quality: QualityLevel) => void;
  onWeatherChange: (weather: Weather) => void;
  /** Live volume callback (0..1) — same pattern as onQualityChange/onWeatherChange. Optional. */
  onVolumeChange?: (vol: number) => void;
  /** Toggles engine mute; returns the new muted state. Optional. */
  onMuteToggle?: () => boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  saveData,
  onUpdateSave,
  onClose,
  onQualityChange,
  onWeatherChange,
  onVolumeChange,
  onMuteToggle,
}) => {
  const settings = saveData.settings;
  const [muted, setMuted] = useState(false);

  const updateSetting = <K extends keyof PlayerSaveData['settings']>(
    key: K,
    val: PlayerSaveData['settings'][K]
  ) => {
    const updated = {
      ...saveData,
      settings: {
        ...saveData.settings,
        [key]: val,
      },
    };
    SaveManager.save(updated);
    onUpdateSave(updated);

    if (key === 'quality') onQualityChange(val as QualityLevel);
    if (key === 'weather') onWeatherChange(val as Weather);
  };

  const volumePct = Math.round(settings.soundVolume * 100);

  const handleVolumeInput = (pct: number) => {
    const v = Math.min(1, Math.max(0, pct / 100));
    updateSetting('soundVolume', v); // persists via the existing onUpdateSave path
    onVolumeChange?.(v); // live apply
    if (muted && v > 0) {
      // Raising the volume unmutes.
      const m = onMuteToggle?.();
      setMuted(m ?? false);
    }
  };

  const handleMuteToggle = () => {
    const m = onMuteToggle?.();
    setMuted(m ?? !muted);
  };

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-6 select-none font-display">
      <div className="w-full max-w-xl hud-glass p-6 rounded-3xl border border-neutral-700 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <h2 className="text-xl font-extrabold text-neutral-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            GAME SETTINGS & PREFERENCES
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 hover:border-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Options */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 text-xs">
          {/* Quality Preset */}
          <div>
            <div className="text-neutral-400 font-bold mb-2 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-teal-400" />
              GRAPHICS PERFORMANCE QUALITY
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['auto', 'low', 'med', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => updateSetting('quality', q)}
                  className={`py-2 rounded-xl font-bold uppercase transition-all ${
                    settings.quality === q
                      ? 'bg-amber-500 text-black shadow-lg font-extrabold'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Traffic Density */}
          <div>
            <div className="text-neutral-400 font-bold mb-2">TRAFFIC DENSITY (DELHI ROADS)</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => updateSetting('trafficDensity', d)}
                  className={`py-2 rounded-xl font-bold uppercase transition-all ${
                    settings.trafficDensity === d
                      ? 'bg-teal-500 text-black shadow-lg font-extrabold'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Volume */}
          <div>
            <div className="text-neutral-400 font-bold mb-2 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-400" />
              SOUND & VOLUME
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleMuteToggle}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className={`p-2.5 rounded-xl font-bold transition-all ${
                  muted
                    ? 'bg-rose-500/20 border border-rose-500/60 text-rose-300'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-neutral-100'
                }`}
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volumePct}
                onChange={(e) => handleVolumeInput(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-2 cursor-pointer"
                aria-label="Master volume"
              />
              <span className="w-12 text-right text-neutral-200 font-bold tabular-nums">
                {volumePct}%
              </span>
            </div>
          </div>

          {/* Control Scheme */}
          <div>
            <div className="text-neutral-400 font-bold mb-2">MOBILE / TOUCH CONTROLS</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'wheel_right', label: 'Wheel Right (Standard)' },
                { id: 'wheel_left', label: 'Wheel Left' },
                { id: 'arrows', label: 'Arrow Buttons' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateSetting('controlScheme', c.id as any)}
                  className={`py-2 px-2 text-center rounded-xl font-bold text-[11px] transition-all ${
                    settings.controlScheme === c.id
                      ? 'bg-amber-500 text-black shadow-lg font-extrabold'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weather Simulation */}
          <div>
            <div className="text-neutral-400 font-bold mb-2 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-teal-400" />
              ENVIRONMENT & WEATHER
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'clear', label: 'Clear Daylight' },
                { id: 'rain', label: 'Monsoon Rain (Wet Road)' },
                { id: 'smog', label: 'Winter Delhi Smog' },
              ].map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateSetting('weather', w.id as any)}
                  className={`py-2 px-2 text-center rounded-xl font-bold text-[11px] transition-all ${
                    settings.weather === w.id
                      ? 'bg-teal-500 text-black shadow-lg font-extrabold'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language / Hindi toggle */}
          <div>
            <div className="text-neutral-400 font-bold mb-2 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-400" />
              LANGUAGE / भाषा
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateSetting('hindiLabels', false)}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  !settings.hindiLabels
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                }`}
              >
                English
              </button>
              <button
                onClick={() => updateSetting('hindiLabels', true)}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  settings.hindiLabels
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
