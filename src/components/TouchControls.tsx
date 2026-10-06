import React, { useRef, useState } from 'react';
import { Camera, Volume2, ShieldAlert, Disc3, ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import { InputManager } from '../game/input/InputManager';
import { Gear } from '../game/types';

interface TouchControlsProps {
  inputManager: InputManager;
  gear: Gear;
  leftBlinker: boolean;
  rightBlinker: boolean;
  headlights: boolean;
  controlScheme?: 'wheel_right' | 'wheel_left' | 'arrows';
  onCycleCamera: () => void;
  onPause: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  inputManager,
  gear,
  leftBlinker,
  rightBlinker,
  headlights,
  controlScheme = 'wheel_right',
  onCycleCamera,
  onPause,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isPedalGasPressed, setIsPedalGasPressed] = useState<boolean>(false);
  const [isPedalBrakePressed, setIsPedalBrakePressed] = useState<boolean>(false);
  const [throttlePressure, setThrottlePressure] = useState(0);
  const [brakePressure, setBrakePressure] = useState(0);
  const [isHandbrakeActive, setIsHandbrakeActive] = useState<boolean>(false);

  // Steering wheel tracking state
  const isDraggingWheel = useRef<boolean>(false);
  const wheelCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleWheelStart = (e: React.PointerEvent) => {
    isDraggingWheel.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (wheelRef.current) {
      const rect = wheelRef.current.getBoundingClientRect();
      wheelCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      processSteer(e.clientX, e.clientY);
    }
  };

  const processSteer = (clientX: number, clientY: number) => {
    const dx = clientX - wheelCenter.current.x;
    const dy = clientY - wheelCenter.current.y;

    // Radius of touch point from center
    const radius = Math.sqrt(dx * dx + dy * dy);
    if (radius < 8) {
      inputManager.setTouchSteer(0);
      setWheelRotation(0);
      return;
    }

    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Hybrid calculation: direct horizontal drag ratio + angular circular steering
    // Gives ultra-responsive feel whether user swipes sideways or turns wheel
    const horizontalNorm = clamp(dx / 75.0, -1.0, 1.0);
    const circularAngle = Math.atan2(dx, -dy);
    const maxCircular = (Math.PI / 180) * 110;
    const circularNorm = clamp(circularAngle / maxCircular, -1.0, 1.0);

    // Blend for natural intuitive mobile touch
    const steerRaw = lerp(horizontalNorm, circularNorm, 0.45);

    // Center deadzone & progressive sensitivity curve
    let steerFinal = 0;
    const deadzone = 0.04;
    const absSteer = Math.abs(steerRaw);

    if (absSteer > deadzone) {
      const scaled = (absSteer - deadzone) / (1 - deadzone);
      // Progressive curve: smooth small adjustments, sharp full lock
      steerFinal = Math.sign(steerRaw) * Math.pow(scaled, 1.25);
    }

    steerFinal = clamp(steerFinal, -1.0, 1.0);
    inputManager.setTouchSteer(steerFinal);
    setWheelRotation(steerFinal * 95);
  };

  const handleWheelMove = (e: React.PointerEvent) => {
    if (!isDraggingWheel.current) return;
    processSteer(e.clientX, e.clientY);
  };

  const handleWheelEnd = (e: React.PointerEvent) => {
    isDraggingWheel.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    inputManager.setTouchSteer(0);
    setWheelRotation(0);
  };

  const pedalPressure = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    // Bottom of pedal = light input, pushing higher = progressively stronger input.
    return Math.min(1, Math.max(0.12, 1 - y / rect.height));
  };

  const isWheelRight = controlScheme === 'wheel_right';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none">
      {/* Top action row */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => inputManager.toggleHeadlights()}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all active:scale-95 ${
            headlights
              ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : 'bg-neutral-900/60 border-neutral-700 text-neutral-300'
          }`}
          title="Headlights"
        >
          <Lightbulb className="w-5 h-5" />
        </button>

        <button
          onClick={onCycleCamera}
          className="p-2.5 rounded-xl border border-neutral-700 bg-neutral-900/60 backdrop-blur-md text-neutral-200 active:scale-95 transition-all hover:border-teal-400"
          title="Change Camera View"
        >
          <Camera className="w-5 h-5" />
        </button>

        <button
          onClick={onPause}
          className="px-3.5 py-2 rounded-xl border border-neutral-700 bg-neutral-900/80 backdrop-blur-md font-display font-bold text-sm text-neutral-200 active:scale-95 hover:border-amber-400"
        >
          PAUSE
        </button>
      </div>

      {/* Middle row: Horn, Handbrake, Blinkers */}
      <div className={`absolute top-24 ${isWheelRight ? 'left-4' : 'right-4'} flex flex-col gap-3 pointer-events-auto`}>
        <button
          onClick={() => inputManager.triggerHorn()}
          className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/60 backdrop-blur-md flex flex-col items-center justify-center text-amber-400 active:scale-90 active:bg-amber-500/40 shadow-xl transition-all"
        >
          <Volume2 className="w-6 h-6" />
          <span className="text-[9px] font-display font-extrabold uppercase mt-0.5 tracking-wider">HORN</span>
        </button>

        <button
          onClick={() => {
            const next = !isHandbrakeActive;
            setIsHandbrakeActive(next);
            inputManager.setTouchHandbrake(next);
          }}
          className={`w-14 h-14 rounded-2xl border-2 backdrop-blur-md flex flex-col items-center justify-center transition-all active:scale-90 shadow-xl ${
            isHandbrakeActive
              ? 'bg-rose-600/60 border-rose-500 text-rose-200 shadow-[0_0_20px_rgba(225,29,72,0.6)]'
              : 'bg-neutral-900/60 border-neutral-700 text-neutral-300'
          }`}
        >
          <ShieldAlert className="w-6 h-6" />
          <span className="text-[9px] font-display font-extrabold uppercase mt-0.5 tracking-wider">HANDBRAKE</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => inputManager.toggleLeftBlinker()}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
              leftBlinker
                ? 'bg-amber-500 border-amber-300 text-black font-bold animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                : 'bg-neutral-900/60 border-neutral-700 text-neutral-300'
            }`}
          >
            ◀
          </button>
          <button
            onClick={() => inputManager.toggleRightBlinker()}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
              rightBlinker
                ? 'bg-amber-500 border-amber-300 text-black font-bold animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                : 'bg-neutral-900/60 border-neutral-700 text-neutral-300'
            }`}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Pedals Section (Left side by default) */}
      <div className={`absolute bottom-5 ${isWheelRight ? 'left-5' : 'right-5'} flex items-end gap-3 pointer-events-auto`}>
        {/* Gear Toggle Button */}
        <button
          onClick={() => inputManager.cycleGear()}
          className="w-16 h-16 rounded-2xl bg-neutral-900/90 border-2 border-teal-500/60 backdrop-blur-md flex flex-col items-center justify-center active:scale-95 shadow-2xl transition-all"
        >
          <span className="text-[10px] text-teal-400 font-display font-bold">GEAR</span>
          <span className="text-2xl font-gauge font-bold text-neutral-100">{gear}</span>
        </button>

        {/* Brake Pedal */}
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsPedalBrakePressed(true);
            const pressure = pedalPressure(e);
            setBrakePressure(pressure);
            inputManager.setTouchBrake(pressure);
          }}
          onPointerMove={(e) => {
            if (!isPedalBrakePressed) return;
            const pressure = pedalPressure(e);
            setBrakePressure(pressure);
            inputManager.setTouchBrake(pressure);
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
            setIsPedalBrakePressed(false);
            setBrakePressure(0);
            inputManager.setTouchBrake(0);
          }}
          onPointerCancel={() => {
            setIsPedalBrakePressed(false);
            setBrakePressure(0);
            inputManager.setTouchBrake(0);
          }}
          className={`w-20 h-32 rounded-2xl border-2 backdrop-blur-md flex flex-col items-center justify-center transition-all select-none cursor-pointer shadow-2xl ${
            isPedalBrakePressed
              ? 'bg-rose-600 border-rose-400 scale-95 shadow-[0_0_25px_rgba(225,29,72,0.8)]'
              : 'bg-neutral-900/85 border-rose-500/50 text-rose-300 hover:border-rose-400'
          }`}
        >
          <div className="w-12 h-1.5 bg-rose-400/40 rounded-full mb-1.5" />
          <div className="w-12 h-1.5 bg-rose-400/40 rounded-full mb-1.5" />
          <div className="w-12 h-1.5 bg-rose-400/40 rounded-full mb-1.5" />
          <span className="text-xs font-display font-extrabold uppercase tracking-wider text-rose-200 mt-2">
            BRAKE {isPedalBrakePressed ? `${Math.round(brakePressure * 100)}%` : ''}
          </span>
        </div>

        {/* Gas / Accelerator Pedal */}
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsPedalGasPressed(true);
            const pressure = pedalPressure(e);
            setThrottlePressure(pressure);
            inputManager.setTouchThrottle(pressure);
          }}
          onPointerMove={(e) => {
            if (!isPedalGasPressed) return;
            const pressure = pedalPressure(e);
            setThrottlePressure(pressure);
            inputManager.setTouchThrottle(pressure);
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
            setIsPedalGasPressed(false);
            setThrottlePressure(0);
            inputManager.setTouchThrottle(0);
          }}
          onPointerCancel={() => {
            setIsPedalGasPressed(false);
            setThrottlePressure(0);
            inputManager.setTouchThrottle(0);
          }}
          className={`w-20 h-42 rounded-2xl border-2 backdrop-blur-md flex flex-col items-center justify-center transition-all select-none cursor-pointer shadow-2xl ${
            isPedalGasPressed
              ? 'bg-emerald-600 border-emerald-400 scale-95 shadow-[0_0_30px_rgba(16,185,129,0.85)]'
              : 'bg-neutral-900/85 border-emerald-500/50 text-emerald-300 hover:border-emerald-400'
          }`}
        >
          <div className="w-12 h-1.5 bg-emerald-400/40 rounded-full mb-2" />
          <div className="w-12 h-1.5 bg-emerald-400/40 rounded-full mb-2" />
          <div className="w-12 h-1.5 bg-emerald-400/40 rounded-full mb-2" />
          <div className="w-12 h-1.5 bg-emerald-400/40 rounded-full mb-2" />
          <span className="text-sm font-display font-extrabold uppercase tracking-wider text-emerald-100 mt-2">
            GAS {isPedalGasPressed ? `${Math.round(throttlePressure * 100)}%` : ''}
          </span>
        </div>
      </div>

      {/* Steering Section */}
      <div className={`absolute bottom-5 ${isWheelRight ? 'right-6' : 'left-6'} pointer-events-auto`}>
        {controlScheme === 'arrows' ? (
          <div className="flex gap-4">
            <button
              onPointerDown={() => inputManager.setTouchSteer(-1.0)}
              onPointerUp={() => inputManager.setTouchSteer(0)}
              onPointerCancel={() => inputManager.setTouchSteer(0)}
              className="w-22 h-22 rounded-2xl bg-neutral-900/90 border-2 border-amber-500/60 flex items-center justify-center active:bg-amber-500/40 active:scale-95 text-amber-400 shadow-2xl"
            >
              <ArrowLeft className="w-10 h-10" />
            </button>
            <button
              onPointerDown={() => inputManager.setTouchSteer(1.0)}
              onPointerUp={() => inputManager.setTouchSteer(0)}
              onPointerCancel={() => inputManager.setTouchSteer(0)}
              className="w-22 h-22 rounded-2xl bg-neutral-900/90 border-2 border-amber-500/60 flex items-center justify-center active:bg-amber-500/40 active:scale-95 text-amber-400 shadow-2xl"
            >
              <ArrowRight className="w-10 h-10" />
            </button>
          </div>
        ) : (
          <div
            ref={wheelRef}
            onPointerDown={handleWheelStart}
            onPointerMove={handleWheelMove}
            onPointerUp={handleWheelEnd}
            onPointerCancel={handleWheelEnd}
            className="w-42 h-42 rounded-full border-4 border-amber-500/70 bg-neutral-900/90 backdrop-blur-md flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_15px_45px_rgba(0,0,0,0.85)] relative transition-transform duration-75"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
            }}
          >
            {/* Outer grip contour */}
            <div className="absolute inset-2.5 rounded-full border-4 border-neutral-700/80 pointer-events-none" />
            <div className="w-full h-4 bg-neutral-700/90 absolute pointer-events-none" />
            <div className="w-4 h-full bg-neutral-700/90 absolute pointer-events-none" />

            {/* Center Boss / Horn pad */}
            <div className="w-16 h-16 rounded-full bg-neutral-950 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-inner z-10 pointer-events-none">
              <Disc3 className="w-8 h-8" />
            </div>

            {/* 12 o'clock visual alignment marker */}
            <div className="absolute top-0 w-3.5 h-5 bg-amber-400 rounded-b-md pointer-events-none shadow-md" />
          </div>
        )}
      </div>
    </div>
  );
};
