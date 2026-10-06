import React, { useEffect, useRef, useState } from 'react';
import { Camera, Volume2, ShieldAlert, ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import { InputManager } from '../game/input/InputManager';
import { Gear } from '../game/types';
import { SteeringGesture } from '../game/input/SteeringGesture';

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
  const gesture = useRef(new SteeringGesture());
  const wheelCenter = useRef({ x: 0, y: 0 });
  const pedalPointers = useRef<{ gas: number | null; brake: number | null }>({ gas: null, brake: null });
  const arrowPointers = useRef(new Map<number, number>());
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelHeld, setWheelHeld] = useState(false);
  const [isPedalGasPressed, setIsPedalGasPressed] = useState(false);
  const [isPedalBrakePressed, setIsPedalBrakePressed] = useState(false);
  const [isHandbrakeActive, setIsHandbrakeActive] = useState(false);

  useEffect(() => {
    const reset = () => {
      gesture.current.reset();
      pedalPointers.current = { gas: null, brake: null };
      arrowPointers.current.clear();
      setWheelRotation(0);
      setWheelHeld(false);
      setIsPedalGasPressed(false);
      setIsPedalBrakePressed(false);
      setIsHandbrakeActive(false);
    };
    reset();
    const unsubscribe = inputManager.subscribeReset(reset);
    return () => {
      unsubscribe();
      inputManager.setTouchSteer(0);
      inputManager.setTouchThrottle(0);
      inputManager.setTouchBrake(0);
      inputManager.setTouchHandbrake(false);
    };
  }, [inputManager, controlScheme]);

  const applyWheel = (angle: number) => {
    setWheelRotation(angle);
    inputManager.setTouchSteer(angle / SteeringGesture.maxAngle);
  };
  const handleWheelStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    if (!gesture.current.begin(e.pointerId, e.clientX - center.x, e.clientY - center.y, rect.width / 2)) return;
    e.preventDefault();
    wheelCenter.current = center;
    e.currentTarget.setPointerCapture(e.pointerId);
    setWheelHeld(true);
  };
  const handleWheelMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const angle = gesture.current.move(e.pointerId, e.clientX - wheelCenter.current.x, e.clientY - wheelCenter.current.y);
    if (angle !== null) applyWheel(angle);
  };
  const handleWheelEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.end(e.pointerId)) return;
    applyWheel(0);
    setWheelHeld(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const pedalDown = (kind: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
    if (pedalPointers.current[kind] !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    pedalPointers.current[kind] = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (kind === 'gas') { setIsPedalGasPressed(true); inputManager.setTouchThrottle(1); }
    else { setIsPedalBrakePressed(true); inputManager.setTouchBrake(1); }
  };
  const pedalUp = (kind: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
    if (pedalPointers.current[kind] !== e.pointerId) return;
    pedalPointers.current[kind] = null;
    if (kind === 'gas') { setIsPedalGasPressed(false); inputManager.setTouchThrottle(0); }
    else { setIsPedalBrakePressed(false); inputManager.setTouchBrake(0); }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const arrowDown = (direction: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrowPointers.current.set(e.pointerId, direction);
    inputManager.setTouchSteer(Math.sign([...arrowPointers.current.values()].reduce((a, b) => a + b, 0)));
  };
  const arrowUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    arrowPointers.current.delete(e.pointerId);
    inputManager.setTouchSteer(Math.sign([...arrowPointers.current.values()].reduce((a, b) => a + b, 0)));
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const isWheelRight = controlScheme === 'wheel_right';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none">
      {/* Top action row */}
      <div className="driving-actions absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
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
      <div className={`driving-tools absolute top-24 ${isWheelRight ? 'left-4' : 'right-4'} flex flex-col gap-3 pointer-events-auto`}>
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

      <div className={`driving-pedals control-pedals ${isWheelRight ? 'control-left' : 'control-right'}`}>
        <div className="gear-selector" role="group" aria-label="Transmission">
          {(['P', 'R', 'N', 'D'] as Gear[]).map((value) => <button key={value} aria-label={`Select ${value === 'D' ? 'Drive' : value === 'R' ? 'Reverse' : value === 'N' ? 'Neutral' : 'Park'}`} aria-pressed={gear === value} onClick={() => inputManager.setGear(value)}>{value}</button>)}
        </div>
        {(['brake', 'gas'] as const).map((kind) => <button
          key={kind} aria-label={kind === 'gas' ? 'Accelerator' : 'Brake'}
          className={`metal-pedal ${kind} ${kind === 'gas' ? isPedalGasPressed ? 'pressed' : '' : isPedalBrakePressed ? 'pressed' : ''}`}
          onPointerDown={(e) => pedalDown(kind, e)} onPointerUp={(e) => pedalUp(kind, e)}
          onPointerCancel={(e) => pedalUp(kind, e)} onLostPointerCapture={(e) => pedalUp(kind, e)}
          onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (kind === 'gas') { inputManager.setTouchThrottle(1); setIsPedalGasPressed(true); } else { inputManager.setTouchBrake(1); setIsPedalBrakePressed(true); } } }}
          onKeyUp={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (kind === 'gas') { inputManager.setTouchThrottle(0); setIsPedalGasPressed(false); } else { inputManager.setTouchBrake(0); setIsPedalBrakePressed(false); } } }}
          onBlur={() => { if (pedalPointers.current[kind] === null) { if (kind === 'gas') { inputManager.setTouchThrottle(0); setIsPedalGasPressed(false); } else { inputManager.setTouchBrake(0); setIsPedalBrakePressed(false); } } }}
        ><span className="pedal-grip" /><span>{kind === 'gas' ? 'GAS' : 'BRAKE'}</span></button>)}
      </div>
      <div className={`driving-steering control-steering ${isWheelRight ? 'control-right' : 'control-left'}`}>
        {controlScheme === 'arrows' ? <div className="steering-arrows">
          {([-1, 1] as const).map((direction) => <button key={direction} aria-label={direction < 0 ? 'Steer left' : 'Steer right'}
            onPointerDown={(e) => arrowDown(direction, e)} onPointerUp={arrowUp} onPointerCancel={arrowUp} onLostPointerCapture={arrowUp}
            onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); inputManager.setTouchSteer(direction); } }}
            onKeyUp={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); inputManager.setTouchSteer(0); } }}
            onBlur={() => { if (!arrowPointers.current.size) inputManager.setTouchSteer(0); }}
          >{direction < 0 ? <ArrowLeft /> : <ArrowRight />}</button>)}
        </div> : <div ref={wheelRef} className={`steering-wheel ${wheelHeld ? 'held' : ''}`}
          role="slider" tabIndex={0} aria-label="Steering wheel" aria-valuemin={-135} aria-valuemax={135}
          aria-valuenow={Math.round(wheelRotation)} aria-valuetext={`${Math.abs(Math.round(wheelRotation))} degrees ${wheelRotation < 0 ? 'left' : wheelRotation > 0 ? 'right' : 'centred'}`}
          onPointerDown={handleWheelStart} onPointerMove={handleWheelMove} onPointerUp={handleWheelEnd} onPointerCancel={handleWheelEnd} onLostPointerCapture={handleWheelEnd}
          onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); applyWheel(e.code === 'Home' ? 0 : Math.max(-135, Math.min(135, wheelRotation + (e.code === 'ArrowLeft' ? -18 : 18)))); } }}
          onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); applyWheel(0); } }}
          onBlur={() => { gesture.current.reset(); applyWheel(0); setWheelHeld(false); }}
        >
          <svg viewBox="0 0 200 200" aria-hidden="true" className="wheel-art" style={{ transform: `rotate(${wheelRotation}deg)` }}>
            <defs>
              <linearGradient id="wheel-rim" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#50545a"/><stop offset=".22" stopColor="#1a1d22"/><stop offset=".6" stopColor="#090c10"/><stop offset="1" stopColor="#3e4248"/></linearGradient>
              <linearGradient id="wheel-metal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c4cbd1"/><stop offset=".4" stopColor="#79828c"/><stop offset=".6" stopColor="#343b44"/><stop offset="1" stopColor="#929ba3"/></linearGradient>
              <radialGradient id="wheel-hub"><stop stopColor="#39404a"/><stop offset="1" stopColor="#151b22"/></radialGradient>
            </defs>
            <circle cx="100" cy="100" r="84" fill="none" stroke="#030507" strokeWidth="27"/>
            <circle cx="100" cy="100" r="84" fill="none" stroke="url(#wheel-rim)" strokeWidth="22"/>
            <circle cx="100" cy="100" r="76" fill="none" stroke="#96938a" strokeWidth="1" strokeDasharray="2 3" opacity=".6"/>
            <path d="M24 86 L78 85 L86 108 L27 112 Z M176 86 L122 85 L114 108 L173 112 Z M86 117 L114 117 L112 183 L88 183 Z" fill="url(#wheel-metal)" stroke="#121920" strokeWidth="2"/>
            <path d="M31 92 L71 92 M169 92 L129 92 M96 135 L96 169 M104 135 L104 169" stroke="#17212b" strokeWidth="3" strokeLinecap="round"/>
            <path d="M19 67 Q31 80 27 112 M181 67 Q169 80 173 112" fill="none" stroke="#0c1015" strokeWidth="9" strokeLinecap="round"/>
            <path d="M73 80 Q100 69 127 80 L127 107 Q120 130 100 132 Q80 130 73 107 Z" fill="url(#wheel-hub)" stroke="#58616a" strokeWidth="1.5"/>
            <path d="M91 108 L94 91 L99 91 L105 103 L107 91 L112 91 L108 108 L103 108 L97 96 L94 108 Z" fill="#e9b95c"/>
            <text x="100" y="120" textAnchor="middle" fontSize="5" letterSpacing="1.3" fill="#8b959e">AIRBAG</text>
            <path d="M96 6 L104 6 L104 25 L96 25 Z" fill="#e9b95c"/>
            <path d="M38 39 A84 84 0 0 1 91 17" stroke="#7b8188" strokeWidth="1.5" fill="none" opacity=".7"/>
          </svg>
          <span className="wheel-caption">{wheelHeld ? 'STEERING' : 'GRAB & TURN'}</span>
        </div>}
      </div>
    </div>
  );
};
