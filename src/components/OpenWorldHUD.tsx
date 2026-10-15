import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, X, Pause, Footprints, CarFront, ArrowUp, Package, Navigation, ArrowDown, Circle, MapPin } from 'lucide-react';
import type { GameEngine } from '../game/GameEngine';
import type { HUDState } from '../game/types';
import { Minimap } from './Minimap';

function HoldButton({ label, children, onHold }: { label: string; children: React.ReactNode; onHold: (held: boolean) => void }) {
  const callback = useRef(onHold); callback.current = onHold;
  const pointer = useRef<number | null>(null);
  const [held, setHeld] = useState(false);
  const release = () => { pointer.current = null; setHeld(false); callback.current(false); };
  const releasePointer = (event: React.PointerEvent) => { if (event.pointerId === pointer.current) release(); };
  useEffect(() => {
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); callback.current(false); };
  }, []);
  return <button aria-label={label} className={`ow-action ${held ? 'held' : ''}`} onPointerDown={event => {
    if (pointer.current !== null) return;
    event.preventDefault(); pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId); setHeld(true); callback.current(true);
  }} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}>{children}<span>{label}</span></button>;
}

function Joystick({ engine }: { engine: GameEngine }) {
  const active = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const reset = () => { active.current = null; setKnob({ x: 0, y: 0 }); engine.inputManager.setJoystick(0, 0); };
  useEffect(() => {
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('blur', reset); engine.inputManager.setJoystick(0, 0); };
  }, [engine]);
  const end = (event: React.PointerEvent) => { if (event.pointerId === active.current) reset(); };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== active.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / 40;
    const y = (event.clientY - bounds.top - bounds.height / 2) / 40;
    const length = Math.max(1, Math.hypot(x, y));
    engine.inputManager.setJoystick(x / length, y / length);
    setKnob({ x: x / length * 40, y: y / length * 40 });
  };
  return <div className="ow-joystick" role="group" aria-label="Movement joystick" onPointerDown={event => {
    if (active.current !== null) return;
    event.preventDefault(); active.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event);
  }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <div className="ow-joystick-cross" /><div className="ow-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
  </div>;
}

export function OpenWorldHUD({ state, engine, onPause }: { state: HUDState; engine: GameEngine; onPause: () => void }) {
  const world = state.openWorld;
  if (!world) return null;
  const driving = world.mode === 'driving';
  return <div className="ow-hud">
    <div className="ow-location"><span className="ow-eyebrow">NCR DRIVE / {state.activeJob ? 'TAXI CAREER' : state.missionTitle ? 'MISSION' : 'FREE ROAM'}</span><h1>Connaught Place<span>नई दिल्ली</span></h1>
      <p><span className="ow-live" /> {state.currentStreet} <span className="ow-muted">· Delhi evening</span></p>
    </div>
    <div className="ow-top-actions">
      <div className="ow-wallet">₹{state.cash.toLocaleString('en-IN')}<small>WALLET</small></div>
      <button className="ow-icon" aria-label="Open DelhiOS phone" onClick={() => engine.setPhoneOpen(!world.phoneOpen)}><Smartphone size={21} /></button>
      <button className="ow-icon" aria-label="Pause game" onClick={onPause}><Pause size={19} /></button>
    </div>
    <div className="ow-radar"><Minimap zoom={0.55} playerX={world.x} playerZ={world.z} playerHeading={world.heading} hasTarget={world.courier === 'active'} targetX={world.targetX} targetZ={world.targetZ} /><div className="ow-radar-caption"><Navigation size={12} /> DELHI / {driving ? 'ON THE ROAD' : 'ON FOOT'}</div></div>
    {world.courier === 'active' && <div className="ow-gig-tracker"><Package size={17} /><div><b>Shivaji Stadium Courier Run</b><span>{world.courierDistance} m · Deliver on foot at the gold marker</span></div></div>}
    {state.activeJob && <div className="ow-gig-tracker"><CarFront size={17} /><div><b>{state.passengerName} · Taxi fare</b><span>{state.gpsTargetName} · {state.targetDistanceMeters} m</span></div></div>}
    {state.missionTitle && <div className="ow-gig-tracker"><MapPin size={17} /><div><b>{state.missionTitle}</b><span>{state.missionObjective} · {state.missionTimeLeft}s</span></div></div>}
    {!world.phoneOpen && <>
      <div className="ow-mode"><span>{driving ? <CarFront size={17} /> : <Footprints size={17} />}{driving ? engine.physics.spec.name.toUpperCase() : 'EXPLORER'}</span>{driving ? <strong>{state.speedKmH}<small>km/h · {state.gear}</small></strong> : <small>Walk the city. Find your next hustle.</small>}</div>
      <button className={`ow-prompt ${world.canInteract ? 'available' : ''}`} onClick={() => engine.interact()} disabled={!world.canInteract}><kbd>F</kbd>{world.prompt}{world.canInteract && <span>↗</span>}</button>
      <div className="ow-desktop-tips"><span><kbd>W A S D</kbd> {driving ? 'Drive' : 'Move'}</span><span><kbd>{driving ? 'SPACE' : 'SHIFT'}</kbd> {driving ? 'Handbrake' : 'Sprint'}</span><span><kbd>{driving ? 'S' : 'SPACE'}</kbd> {driving ? 'Brake / reverse' : 'Jump'}</span><span><kbd>DRAG</kbd> Orbit</span><span><kbd>TAB</kbd> DelhiOS</span></div>
      <div className="ow-mobile-controls" key={world.mode}><Joystick engine={engine} /><div className="ow-action-grid">
        {driving ? <><HoldButton label="Accelerate" onHold={held => engine.inputManager.setTouchThrottle(held ? 1 : 0)}><ArrowUp /></HoldButton><HoldButton label="Brake" onHold={held => { engine.inputManager.setTouchBrake(held ? 1 : 0); engine.inputManager.setTouchHandbrake(held); }}><ArrowDown /></HoldButton><button className="ow-action" onClick={() => engine.inputManager.setGear(engine.inputManager.state.gear === 'R' ? 'D' : 'R')}><Circle /><span>{state.gear === 'R' ? 'Drive' : 'Reverse'}</span></button></> : <button className="ow-action" onClick={() => engine.inputManager.requestJump()}><ArrowUp /><span>Jump</span></button>}
        <button className="ow-action" disabled={!world.canInteract} aria-label={driving ? 'Exit car' : 'Enter car'} onClick={() => engine.interact()}><CarFront /><span>{driving ? 'Exit' : 'Drive'}</span></button>
      </div></div>
    </>}
    <aside className={`delhios ${world.phoneOpen ? 'is-open' : ''}`} aria-label="DelhiOS smartphone" aria-hidden={!world.phoneOpen} inert={!world.phoneOpen}>
      <div className="phone-notch" /><div className="phone-header"><span>DelhiOS <small>CONNECTED TO THE CITY</small></span><button aria-label="Close phone" onClick={() => engine.setPhoneOpen(false)}><X size={19} /></button></div>
      <div className="phone-scroll"><h2>Good evening,<br /><em>Delhi explorer.</em></h2>
        <div className="phone-balance"><span>YOUR BALANCE</span><strong>₹{state.cash.toLocaleString('en-IN')}</strong><small>Delhi Wallet · Ready for the road</small></div>
        <div className="phone-section-title"><Navigation size={15} /> GPS <span>LIVE POSITION</span></div>
        <div className="phone-map"><Minimap zoom={0.55} playerX={world.x} playerZ={world.z} playerHeading={world.heading} hasTarget={world.courier === 'active'} targetX={world.targetX} targetZ={world.targetZ} /><div><MapPin size={18} /><b>Connaught Place</b><small>{Math.round(world.x)}, {Math.round(world.z)}<br />{world.courier === 'active' ? `${world.courierDistance} m to delivery` : 'New Delhi, India'}</small></div></div>
        <div className="phone-section-title"><Package size={16} /> Hustle <span>LOCAL GIGS</span></div>
        <div className="hustle-card"><div className="hustle-tag">{world.courier === 'completed' ? 'DELIVERED' : world.courier === 'active' ? 'IN PROGRESS' : 'FIRST GIG'}</div><h3>Shivaji Stadium<br />Courier Run</h3><p>One parcel. A short ride through CP. Hand it over on foot by the stadium metro.</p><div className="hustle-details"><strong>₹750</strong><span>{world.courier === 'completed' ? 'Added to your wallet' : 'No time limit · Parcel included'}</span></div>
          <button disabled={world.courier !== 'available' || state.activeJob || !!state.missionTitle} onClick={() => engine.acceptCourier()}>{state.activeJob || state.missionTitle ? 'Finish your current job first' : world.courier === 'available' ? 'Accept delivery →' : world.courier === 'active' ? `GPS active · ${world.courierDistance} m` : 'Delivery complete ✓'}</button>
        </div><p className="phone-footer">A little hustle. A bigger city.</p>
      </div><div className="phone-home" />
    </aside>
  </div>;
}
