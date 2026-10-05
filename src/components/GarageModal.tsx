import React, { useState } from 'react';
import { IndianRupee, Wrench, Fuel, Check, Lock, Palette, ChevronLeft, ChevronRight, Zap, Shield, Disc } from 'lucide-react';
import { CAR_CATALOG, getCarById } from '../game/cars/CarCatalog';
import { SaveManager } from '../game/save/SaveManager';
import { CarSpecs, CarUpgrades, PlayerSaveData } from '../game/types';

interface GarageModalProps {
  saveData: PlayerSaveData;
  onSelectCar: (carId: string) => void;
  onRepaint: (carId: string, hex: string) => void;
  onClose: () => void;
  onRefreshSave: () => void;
  onRefuelCar: () => void;
  onRepairCar: () => void;
}

// Catalog-wide maxima (with max stage-3 upgrades applied) for honest bar scaling.
const MAX_TORQUE_NM = Math.max(...CAR_CATALOG.map((c) => c.torqueNm)) * 1.48;
const MAX_BRAKE_N = Math.max(...CAR_CATALOG.map((c) => c.brakeForce)) * 1.6;
const MAX_GRIP = Math.max(...CAR_CATALOG.map((c) => c.tyreGrip)) * 1.54;

// Real per-stage multipliers, matching VehiclePhysics (engineMult/brakeMult/tyreMult/tankMult).
const UPGRADE_EFFECT_LABEL: Record<'engine' | 'brakes' | 'suspension' | 'tyres' | 'tank', string> = {
  engine: '+16% torque / stage',
  brakes: '+20% braking / stage',
  suspension: '',
  tyres: '+18% grip / stage',
  tank: '+15% fuel / stage',
};

export const GarageModal: React.FC<GarageModalProps> = ({
  saveData,
  onSelectCar,
  onRepaint,
  onClose,
  onRefreshSave,
  onRefuelCar,
  onRepairCar,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    const idx = CAR_CATALOG.findIndex((c) => c.id === saveData.selectedCarId);
    return idx >= 0 ? idx : 0;
  });

  const car = CAR_CATALOG[selectedIdx];
  const isOwned = saveData.ownedCarIds.includes(car.id);
  const isSelected = saveData.selectedCarId === car.id;
  const currentUpgrades: CarUpgrades = saveData.carUpgrades[car.id] || {
    engine: 0,
    brakes: 0,
    suspension: 0,
    tyres: 0,
    tank: 0,
  };
  const currentColor = saveData.carColors[car.id] || car.defaultColor;

  // Carousel is preview-only: browsing the showroom never changes the active car.
  // Selection commits only via SET ACTIVE or purchase.
  const handleNext = () => {
    const next = (selectedIdx + 1) % CAR_CATALOG.length;
    setSelectedIdx(next);
  };

  const handlePrev = () => {
    const prev = (selectedIdx - 1 + CAR_CATALOG.length) % CAR_CATALOG.length;
    setSelectedIdx(prev);
  };

  const handleBuy = () => {
    if (saveData.cash >= car.price) {
      SaveManager.spendCash(car.price);
      SaveManager.unlockCar(car.id);
      onSelectCar(car.id); // purchase commits the selection
      onRefreshSave();
    }
  };

  const handleUpgrade = (part: 'engine' | 'brakes' | 'suspension' | 'tyres' | 'tank') => {
    const currentLvl = currentUpgrades[part];
    if (currentLvl >= 3) return;
    const costs = [3500, 7500, 15000];
    const cost = costs[currentLvl];

    if (SaveManager.upgradeCar(car.id, part, cost)) {
      onRefreshSave();
    }
  };

  // Performance stats — computed from the REAL physics multipliers in
  // VehiclePhysics (engine +16%/stage torque, brakes +20%/stage, tyres +18%/stage).
  const torqueNow = car.torqueNm * (1 + currentUpgrades.engine * 0.16);
  const brakeNowKn = (car.brakeForce * (1 + currentUpgrades.brakes * 0.2)) / 1000;
  const gripNow = car.tyreGrip * (1 + currentUpgrades.tyres * 0.18);

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-40 flex flex-col font-display text-neutral-100 select-none">
      {/* Top Bar */}
      <div className="h-16 px-6 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-8 bg-amber-500 rounded-full" />
          <div>
            <h1 className="text-xl font-extrabold tracking-wide text-neutral-100">
              NCR MOTOR GARAGE & SHOWROOM
            </h1>
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
              {car.hindiName} • Gurugram High Performance Workshop
            </p>
          </div>
        </div>

        {/* Player Cash */}
        <div className="flex items-center gap-4">
          <div className="hud-glass-saffron px-4 py-1.5 rounded-2xl flex items-center gap-2 border border-amber-500/50">
            <IndianRupee className="w-5 h-5 text-amber-400" />
            <span className="text-xl font-gauge font-bold text-amber-300">
              {saveData.cash.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-sm shadow-xl active:scale-95 transition-all"
          >
            DRIVE THIS CAR
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Car Carousel & Visual Selector */}
        <div className="w-1/3 flex flex-col justify-between">
          <div>
            {/* Tagline & Name */}
            <div className="text-xs text-teal-400 font-bold uppercase tracking-widest mb-1">
              {car.tagline}
            </div>
            <div className="text-3xl font-extrabold text-neutral-100 flex items-center gap-3">
              {car.name}
              {!isOwned && <Lock className="w-6 h-6 text-rose-500" />}
            </div>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{car.description}</p>

            {/* Price badge or Owned badge */}
            <div className="mt-4 flex items-center gap-3">
              {isOwned ? (
                <div className="px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  OWNED IN GARAGE
                </div>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={saveData.cash < car.price}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 shadow-xl transition-all ${
                    saveData.cash >= car.price
                      ? 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  }`}
                >
                  <IndianRupee className="w-4 h-4" />
                  BUY FOR ₹{car.price.toLocaleString('en-IN')}
                </button>
              )}

              {isOwned && !isSelected && (
                <button
                  onClick={() => {
                    SaveManager.selectCar(car.id);
                    onSelectCar(car.id);
                    onRefreshSave();
                  }}
                  className="px-4 py-1.5 rounded-xl border border-teal-500/60 text-teal-300 hover:bg-teal-500/20 text-xs font-bold active:scale-95"
                >
                  SET ACTIVE
                </button>
              )}
            </div>

            {/* Paint Booth Colors */}
            <div className="mt-6 pt-4 border-t border-neutral-800">
              <div className="text-xs font-bold text-neutral-400 mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                FACTORY PAINT FINISH
              </div>
              <div className="flex gap-2.5">
                {car.colors.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => {
                      onRepaint(car.id, hex);
                      SaveManager.setCarColor(car.id, hex);
                      onRefreshSave();
                    }}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      currentColor.toLowerCase() === hex.toLowerCase()
                        ? 'border-amber-400 scale-110 shadow-lg'
                        : 'border-neutral-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Car Navigation Carousel Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              onClick={handlePrev}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-amber-400 text-neutral-200 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-sm font-bold text-neutral-200">
                {selectedIdx + 1} / {CAR_CATALOG.length}
              </span>
              <div className="text-[10px] text-neutral-500 uppercase">Models Available</div>
            </div>
            <button
              onClick={handleNext}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-amber-400 text-neutral-200 active:scale-90 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Center: 3D interactive view hint */}
        <div className="flex-1 flex flex-col justify-end items-center pointer-events-none pb-4">
          <div className="hud-glass px-4 py-1.5 rounded-full text-xs font-semibold text-neutral-400 border border-neutral-800">
            360° Showroom Preview Active
          </div>
        </div>

        {/* Right: Performance Specs & Upgrades */}
        <div className="w-1/3 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-neutral-300 uppercase tracking-wider mb-3">
              VEHICLE TELEMETRY & SPECS
            </h2>

            {/* Spec Bars — values computed from real physics multipliers */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-neutral-400">Top Speed</span>
                  <span className="text-amber-400">{car.topSpeedKmH} km/h</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${(car.topSpeedKmH / 260) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-neutral-400">Torque</span>
                  <span className="text-teal-400">{Math.round(torqueNow)} Nm</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400"
                    style={{ width: `${Math.min(100, (torqueNow / MAX_TORQUE_NM) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-neutral-400">Braking Force</span>
                  <span className="text-rose-400">{brakeNowKn.toFixed(1)} kN</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${Math.min(100, ((brakeNowKn * 1000) / MAX_BRAKE_N) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-neutral-400">Handling</span>
                  <span className="text-sky-400">{gripNow.toFixed(2)}× grip</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${Math.min(100, (gripNow / MAX_GRIP) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-neutral-400">Curb Mass</span>
                  <span className="text-neutral-300">{car.mass} kg</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-500" style={{ width: `${(car.mass / 2600) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Performance Upgrades Section */}
            {isOwned && (
              <div className="mt-6 pt-4 border-t border-neutral-800">
                <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  TUNING & PERFORMANCE KITS
                </h3>

                <div className="space-y-2">
                  {(['engine', 'brakes', 'suspension', 'tyres', 'tank'] as const).map((part) => {
                    const lvl = currentUpgrades[part];
                    const nextCost = [3500, 7500, 15000][lvl];

                    return (
                      <div
                        key={part}
                        className="hud-glass p-2.5 rounded-xl border border-neutral-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-neutral-200 uppercase">{part}</div>
                          {UPGRADE_EFFECT_LABEL[part] && (
                            <div className="text-[10px] text-neutral-500 font-semibold">
                              {UPGRADE_EFFECT_LABEL[part]}
                            </div>
                          )}
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3].map((star) => (
                              <div
                                key={star}
                                className={`w-3.5 h-1.5 rounded-sm ${
                                  star <= lvl ? 'bg-amber-400' : 'bg-neutral-800'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {lvl < 3 ? (
                          <button
                            onClick={() => handleUpgrade(part)}
                            disabled={saveData.cash < nextCost}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              saveData.cash >= nextCost
                                ? 'bg-teal-500 hover:bg-teal-400 text-black active:scale-95'
                                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            }`}
                          >
                            + Lvl {lvl + 1} (₹{nextCost.toLocaleString('en-IN')})
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-extrabold uppercase">
                            MAX STAGE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Maintenance Station */}
          {isOwned && (
            <div className="flex gap-2 pt-4 border-t border-neutral-800">
              <button
                onClick={() => {
                  if (saveData.cash >= 400) {
                    SaveManager.spendCash(400);
                    onRefuelCar();
                    onRefreshSave();
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-neutral-900 border border-emerald-500/50 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Fuel className="w-4 h-4" />
                REFUEL (₹400)
              </button>

              <button
                onClick={() => {
                  if (saveData.cash >= 600) {
                    SaveManager.spendCash(600);
                    onRepairCar();
                    onRefreshSave();
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-neutral-900 border border-teal-500/50 hover:bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Wrench className="w-4 h-4" />
                REPAIR DENTS (₹600)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
