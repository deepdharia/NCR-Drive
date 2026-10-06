import React from 'react';
import { Play, Compass, Car, Settings, IndianRupee, MapPin } from 'lucide-react';
import { getCarById } from '../game/cars/CarCatalog';
import { PlayerSaveData } from '../game/types';

interface MainMenuProps {
  saveData: PlayerSaveData;
  onStartTaxi: () => void;
  onStartFreeDrive: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  onStartTaxi,
  onStartFreeDrive,
  onOpenGarage,
  onOpenSettings,
}) => {
  const activeCar = getCarById(saveData.selectedCarId);
  const hindi = saveData.settings.hindiLabels;

  return (
    <div className="absolute inset-0 bg-neutral-950/75 backdrop-blur-md z-40 flex flex-col justify-between p-8 select-none font-display text-neutral-100">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-10 bg-amber-500 rounded-full" />
          <div>
            <div className="text-[11px] text-amber-400 font-bold uppercase tracking-widest">
              {hindi ? 'राष्ट्रीय राजधानी क्षेत्र' : 'NATIONAL CAPITAL REGION'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100 flex items-center gap-2">
              NCR DRIVE
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40">
                OPEN WORLD
              </span>
            </h1>
          </div>
        </div>

        {/* Player Cash & Selected Car */}
        <div className="flex items-center gap-4">
          <div className="hud-glass-saffron px-4 py-2 rounded-2xl border border-amber-500/50 flex items-center gap-2 shadow-xl">
            <IndianRupee className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-gauge font-bold text-amber-300">
              {saveData.cash.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-3 rounded-2xl hud-glass border border-neutral-700 hover:border-amber-400 text-neutral-300 active:scale-95 transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Core game loop: taxi career, free roam, garage */}
      <div className="max-w-md space-y-3.5 my-auto">
        {/* Taxi Career Mode */}
        <button
          onClick={onStartTaxi}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-extrabold flex items-center justify-between shadow-2xl active:scale-98 transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-neutral-950/20 flex items-center justify-center">
              <Play className="w-6 h-6 fill-neutral-950 text-neutral-950" />
            </div>
            <div className="text-left">
              <div className="text-lg leading-tight">
                {hindi ? 'टैक्सी करियर' : 'TAXI CAREER'}
              </div>
              <div className="text-xs font-semibold text-neutral-900/80">
                Take real-feeling fares across an open Delhi-NCR world
              </div>
            </div>
          </div>
          <span className="text-xl group-hover:translate-x-1 transition-transform">➔</span>
        </button>

        {/* Free Drive */}
        <button
          onClick={onStartFreeDrive}
          className="w-full p-4 rounded-2xl hud-glass border border-neutral-800 hover:border-neutral-600 text-neutral-200 font-bold flex items-center justify-between active:scale-98 transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-400">
              <Compass className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-lg leading-tight text-neutral-200">
                {hindi ? 'फ्री ड्राइव' : 'OPEN WORLD DRIVE'}
              </div>
              <div className="text-xs font-normal text-neutral-400">
                Drive anywhere. No mission, no timer — just the road
              </div>
            </div>
          </div>
          <span className="text-xl text-neutral-400 group-hover:translate-x-1 transition-transform">➔</span>
        </button>

        {/* Garage & Showroom */}
        <button
          onClick={onOpenGarage}
          className="w-full p-4 rounded-2xl hud-glass-saffron border border-amber-500/40 hover:border-amber-400 text-neutral-100 font-bold flex items-center justify-between active:scale-98 transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Car className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-lg leading-tight text-neutral-100">
                {hindi ? 'गैराज और शोरूम' : 'GARAGE & SHOWROOM'}
              </div>
              <div className="text-xs font-normal text-amber-200/80">
                Buy, customize, paint & tune 19 iconic cars
              </div>
            </div>
          </div>
          <span className="text-xl text-amber-400 group-hover:translate-x-1 transition-transform">➔</span>
        </button>
      </div>

      {/* Bottom Bar: Quick Active Car Details */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
        <div className="flex items-center gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Open Connected World: 8 km</span>
          </div>
          <span>•</span>
          <span>Left-Hand Traffic (RHD)</span>
          <span>•</span>
          <span>Procedural Delhi & Gurgaon 3D Engine</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-neutral-400 uppercase font-semibold">Active Vehicle</div>
            <div className="text-sm font-extrabold text-neutral-200">{activeCar.name}</div>
          </div>
          <button
            onClick={onOpenGarage}
            className="px-3.5 py-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-bold active:scale-95 transition-all"
          >
            CHANGE
          </button>
        </div>
      </div>
    </div>
  );
};
