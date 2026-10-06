import React from 'react';
import { Fuel, Wrench, IndianRupee, AlertTriangle, Navigation, Star, Gauge, Timer, MapPin } from 'lucide-react';
import { InputManager } from '../game/input/InputManager';
import { Gear, HUDState } from '../game/types';
import { Minimap } from './Minimap';
import { TouchControls } from './TouchControls';
import { getArchetypeLabel } from '../game/missions/MissionManager';

interface HUDProps {
  state: HUDState;
  inputManager: InputManager;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  hindiLabels?: boolean;
  controlScheme?: 'wheel_right' | 'wheel_left' | 'arrows';
  onCycleCamera: () => void;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  state,
  inputManager,
  playerX,
  playerZ,
  playerHeading,
  hindiLabels = false,
  controlScheme,
  onCycleCamera,
  onPause,
}) => {
  // Speed arc calculation (0..240 km/h)
  const speedRatio = Math.min(1.0, state.speedKmH / 220);
  const arcDash = speedRatio * 220;

  // RPM arc calculation
  const rpmRatio = Math.min(1.0, state.rpm / state.maxRpm);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden font-display">
      {/* Top Left: Minimap & Street Badge */}
      <div className="hud-map absolute top-3 left-3 flex flex-col gap-2 pointer-events-auto">
        <Minimap
          playerX={playerX}
          playerZ={playerZ}
          playerHeading={playerHeading}
          targetX={state.gpsTargetX}
          targetZ={state.gpsTargetZ}
          hasTarget={state.hasGpsTarget}
        />

        {/* Current Street / Zone Banner */}
        <div className="hud-glass px-3 py-1.5 rounded-xl border border-teal-500/30 flex items-center gap-2 max-w-[210px] shadow-lg">
          <Navigation className="w-4 h-4 text-teal-400 shrink-0" />
          <div className="truncate">
            <div className="text-xs font-bold text-neutral-100 truncate">{state.currentStreet}</div>
            <div className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">
              {state.currentZone} • {hindiLabels ? 'एनसीआर' : 'NCR'}
            </div>
          </div>
        </div>
      </div>

      {/* Top Center: Cash Balance, Fuel, Damage */}
      <div className="hud-resources absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {/* Cash Balance */}
        <div className="hud-glass-saffron px-4 py-1.5 rounded-2xl flex items-center gap-2 shadow-xl border border-amber-500/40">
          <IndianRupee className="w-5 h-5 text-amber-400" />
          <span className="text-lg font-gauge font-bold text-amber-300 tracking-wider">
            {state.cash.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Fuel Gauge */}
        <div className="hud-glass px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg border border-neutral-700">
          <Fuel className={`w-4 h-4 ${state.fuelPct < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
          <div className="w-14 h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
            <div
              className={`h-full transition-all duration-300 ${
                state.fuelPct < 20 ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${state.fuelPct}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-neutral-300">{state.fuelPct}%</span>
        </div>

        {/* Vehicle Health / Damage */}
        <div className="hud-glass px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg border border-neutral-700">
          <Wrench className={`w-4 h-4 ${state.damagePct > 40 ? 'text-amber-500' : 'text-neutral-400'}`} />
          <div className="w-14 h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
            <div
              className={`h-full transition-all duration-300 ${
                state.damagePct > 70 ? 'bg-rose-600' : state.damagePct > 35 ? 'bg-amber-500' : 'bg-teal-500'
              }`}
              style={{ width: `${Math.max(4, 100 - state.damagePct)}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-neutral-300">{100 - state.damagePct}%</span>
        </div>
      </div>

      {/* Top Notifications (FASTag, Speed Limit) */}
      <div className="hud-alerts absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        {/* FASTag Toll banner */}
        {state.fastagNotification && (
          <div className="hud-glass px-4 py-2 rounded-2xl border-2 border-emerald-500 bg-emerald-950/80 text-emerald-200 font-bold text-sm flex items-center gap-2 shadow-2xl animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            {state.fastagNotification}
          </div>
        )}

        {/* Landmark discovery toast */}
        {state.notificationMessage && (
          <div className="hud-glass px-4 py-2 rounded-2xl border-2 border-amber-500 bg-amber-950/80 text-amber-200 font-bold text-sm flex items-center gap-2 shadow-2xl animate-bounce">
            <MapPin className="w-4 h-4 text-amber-400" />
            {state.notificationMessage}
          </div>
        )}

        {/* Speed Limit & Overspeed Warning */}
        <div className="flex items-center gap-2">
          {/* Speed Limit Signboard (Circular Indian style) */}
          <div className="w-11 h-11 rounded-full bg-white border-4 border-red-600 flex items-center justify-center shadow-lg">
            <span className="text-black font-extrabold text-sm font-gauge">{state.speedLimit}</span>
          </div>

          {state.isOverSpeed && (
            <div className="hud-glass px-3 py-1 rounded-xl border border-rose-500/80 bg-rose-950/80 text-rose-300 text-xs font-extrabold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              {hindiLabels ? 'तेज़ रफ़्तार!' : 'OVERSPEED!'}
            </div>
          )}
        </div>
      </div>

      {/* Active Taxi Job Card / Mission Objective Card */}
      {state.activeJob && (
        <div className="hud-job absolute top-[212px] left-3 hud-glass-saffron p-3 rounded-2xl border border-amber-500/40 shadow-2xl max-w-[270px] pointer-events-auto">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
            <span>{hindiLabels ? 'सवारी' : 'TAXI RIDER'}</span>
            <div className="flex items-center text-amber-300">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
              <span>{(state.passengerSatisfaction || 5).toFixed(1)}</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-neutral-100">{state.passengerName}</div>
          {/* Passenger archetype tag + tip/bonus hint */}
          {state.taxiArchetype && state.taxiArchetype !== 'standard' && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                {getArchetypeLabel(state.taxiArchetype)}
              </span>
              {state.taxiTipHint && (
                <span className="text-[10px] font-semibold text-emerald-300/90">{state.taxiTipHint}</span>
              )}
            </div>
          )}
          <div className="text-[11px] italic text-amber-200/90 mt-1 line-clamp-2">
            {state.passengerQuote}
          </div>
          {state.targetDistanceMeters !== undefined && (
            <div className="mt-2 pt-1.5 border-t border-amber-500/20 flex justify-between items-center text-[11px] font-bold">
              <span className="text-neutral-400">{hindiLabels ? 'दूरी:' : 'Distance:'}</span>
              <span className="text-amber-300">{state.targetDistanceMeters}m</span>
            </div>
          )}
          {/* Live fare meter */}
          <div className="mt-1.5 flex justify-between items-center text-[11px] font-bold">
            <span className="text-neutral-400">{hindiLabels ? 'किराया:' : 'Fare:'}</span>
            <span className="text-emerald-300 text-sm">₹{(state.fareAmount ?? 0).toLocaleString('en-IN')}</span>
          </div>
          {/* Job countdown */}
          {state.missionTimeLeft !== undefined && (
            <div className="mt-1.5 flex justify-between items-center text-[11px] font-bold">
              <span className="text-neutral-400">{hindiLabels ? 'समय:' : 'Time left:'}</span>
              <span className={`flex items-center gap-1 ${state.missionTimeLeft < 30 ? 'text-rose-400' : 'text-amber-300'}`}>
                <Timer className="w-3.5 h-3.5" />
                {Math.ceil(state.missionTimeLeft)}s
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mission Timer / Objective — sits below the minimap + street badge
          column (~200px tall) so it never overlaps or clips off-screen. */}
      {state.missionTitle && !state.activeJob && (
        <div className="hud-job absolute top-[212px] left-3 hud-glass-teal p-3 rounded-2xl border border-teal-500/40 shadow-2xl max-w-[min(260px,calc(100vw-24px))] pointer-events-auto break-words">
          <div className="flex items-center justify-between text-xs text-teal-400 font-bold mb-1">
            <span>{hindiLabels ? 'मिशन' : 'MISSION'}</span>
            {state.missionTimeLeft !== undefined && (
              <div className="flex items-center text-teal-300">
                <Timer className="w-3.5 h-3.5 mr-1" />
                <span>{state.missionTimeLeft}s</span>
              </div>
            )}
          </div>
          <div className="text-xs font-bold text-neutral-100">{state.missionTitle}</div>
          <div className="text-[10px] text-neutral-300 mt-1 line-clamp-2">
            {state.missionObjective}
          </div>
        </div>
      )}

      {/* Bottom Center: Dashboard Instrument Gauges (Speedometer, RPM, Gear) */}
      <div className="hud-gauges absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Circular SVG Speedometer Arc */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#1f2937"
              strokeWidth="6"
              strokeDasharray="188"
              strokeDashoffset="35"
              strokeLinecap="round"
            />
            {/* Speed filled arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={state.speedKmH > state.speedLimit ? '#ef4444' : '#14b8a6'}
              strokeWidth="6"
              strokeDasharray="188"
              strokeDashoffset={Math.max(35, 188 - speedRatio * 153)}
              strokeLinecap="round"
              className="transition-all duration-75"
            />
          </svg>

          {/* Center Digital Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {/* Turn indicators */}
            <div className="flex gap-4 mb-1">
              <span className={`text-xs font-bold ${state.leftBlinker ? 'text-amber-400 animate-pulse' : 'text-neutral-700'}`}>◀</span>
              <span className={`text-xs font-bold ${state.rightBlinker ? 'text-amber-400 animate-pulse' : 'text-neutral-700'}`}>▶</span>
            </div>

            <span className="text-4xl font-gauge font-bold tracking-tight text-neutral-100 leading-none">
              {state.speedKmH}
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-0.5">
              KM/H
            </span>

            {/* Gear & RPM indicator */}
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-300 font-gauge font-bold text-sm">
                {state.gear}
              </span>
              <span className="text-[10px] text-teal-400 font-bold">
                {state.rpm} <span className="text-[8px] text-neutral-500">RPM</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hud-keys">WASD / ARROWS <span>DRIVE</span> C <span>CAMERA</span> R <span>REVERSE</span> ESC <span>PAUSE</span></div>

      {/* On-Screen Mobile Driving Controls */}
      <TouchControls
        inputManager={inputManager}
        controlScheme={controlScheme}
        gear={state.gear}
        leftBlinker={state.leftBlinker}
        rightBlinker={state.rightBlinker}
        headlights={state.headlights}
        onCycleCamera={onCycleCamera}
        onPause={onPause}
      />
    </div>
  );
};
