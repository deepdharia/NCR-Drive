import React from 'react';
import { Play, RotateCcw, Compass, Car, Settings, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onResetCar: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = React.memo(({
  onResume,
  onRestart,
  onResetCar,
  onOpenGarage,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-6 select-none font-display text-neutral-100">
      <div className="w-full max-w-sm hud-glass p-6 rounded-3xl border border-neutral-700 shadow-2xl flex flex-col gap-3">
        <h2 className="text-2xl font-extrabold text-center tracking-wider text-amber-400 mb-2">
          GAME PAUSED
        </h2>

        <button
          onClick={onResume}
          className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
        >
          <Play className="w-5 h-5 fill-neutral-950" />
          RESUME DRIVING
        </button>

        <button
          onClick={onResetCar}
          className="w-full py-2.5 rounded-2xl hud-glass border border-neutral-700 hover:border-teal-400 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Compass className="w-4 h-4 text-teal-400" />
          RESET CAR TO NEAREST ROAD
        </button>

        <button
          onClick={onRestart}
          className="w-full py-2.5 rounded-2xl hud-glass border border-neutral-700 hover:border-amber-400 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          RESTART MODE / MISSION
        </button>

        <button
          onClick={onOpenGarage}
          className="w-full py-2.5 rounded-2xl hud-glass border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Car className="w-4 h-4 text-amber-300" />
          VISIT GARAGE & TUNING
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full py-2.5 rounded-2xl hud-glass border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Settings className="w-4 h-4 text-teal-300" />
          SETTINGS & CONTROLS
        </button>

        <button
          onClick={onMainMenu}
          className="w-full py-2.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 hover:border-rose-600 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all mt-2"
        >
          <Home className="w-4 h-4 text-rose-400" />
          EXIT TO MAIN MENU
        </button>
      </div>
    </div>
  );
});
