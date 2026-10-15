import type { InputController } from '../input/InputController';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';
import type { InteractionSystem } from '../systems/InteractionSystem';
import { COURIER_TARGET } from '../systems/CourierMission';
import type { CourierMission } from '../systems/CourierMission';
import { distance } from '../core/math';
import { Minimap } from './Minimap';

interface UIActions { start: () => void; phone: () => void; pause: () => void; interact: () => void; accept: () => void }
const phoneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>';

export class GameUI {
  private abort = new AbortController();
  private maps: Minimap[];
  constructor(readonly root: HTMLElement, input: InputController, actions: UIActions) {
    root.innerHTML = `
      <section class="welcome" aria-label="Welcome to NCR Drive">
        <div class="welcome-top"><span class="brand-mark">N</span><span>NCR DRIVE <small>NEW DELHI, INDIA</small></span><span class="edition">OPEN WORLD / 01</span></div>
        <div class="welcome-copy"><span class="eyebrow">A CITY WITH A THOUSAND STORIES</span><h1>Your evening.<br>Your <em>Delhi.</em></h1><p>Walk beneath the arcades. Take the Parvaaz for a spin.<br>Find a little hustle in the heart of Connaught Place.</p><button class="primary" data-action="start">Explore Connaught Place <span>↗</span></button><div class="welcome-note">NO DOWNLOADS. NO KEYS. JUST THE CITY.</div></div>
        <div class="welcome-bottom"><span>28° golden hour · Connaught Place</span><span>WALK / DRIVE / HUSTLE</span></div>
      </section>
      <section class="game-ui" hidden aria-label="Game controls">
        <header class="location"><span class="eyebrow">NCR DRIVE / FREE ROAM</span><h1>Connaught Place <small>नई दिल्ली</small></h1><p><span class="live-dot"></span> Inner Circle <span>· A Delhi evening</span></p></header>
        <div class="top-actions"><div class="wallet"><strong data-cash>₹15,000</strong><span>DELHI WALLET</span></div><button class="icon-button" data-action="phone" aria-label="Open DelhiOS phone">${phoneIcon}</button><button class="icon-button" data-action="pause" aria-label="Pause game">Ⅱ</button></div>
        <div class="radar"><canvas class="radar-map" aria-label="DelhiNav local minimap" role="img"></canvas><span>DELHINAV / LIVE</span></div>
        <div class="gig-tracker" hidden><span>◈</span><div><strong>Shivaji Stadium Courier Run</strong><small data-distance>Parcel collected · Follow the gold marker</small></div></div>
        <div class="mode-card"><span data-mode>ON FOOT / EXPLORER</span><strong data-speed>Take the long way.</strong><small data-mode-detail>The city moves at your pace.</small></div>
        <button class="interaction" data-action="interact"><kbd>F</kbd><span data-prompt>Press [F] or Tap to Drive</span><span>↗</span></button>
        <div class="desktop-help"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>SPACE</kbd> Jump / brake</span><span><kbd>DRAG</kbd> Camera</span><span><kbd>TAB</kbd> DelhiOS</span></div>
        <div class="touch-controls"><div class="joystick" role="group" aria-label="Movement joystick"><div class="joystick-cross"></div><div class="joystick-knob"></div></div><div class="touch-actions">
          <button data-hold="gas" data-driving aria-label="Accelerate">↑<small>ACCELERATE</small></button><button data-hold="brake" data-driving aria-label="Brake">↓<small>BRAKE</small></button>
          <button data-action="reverse" data-driving aria-label="Toggle reverse gear">R<small data-reverse>REVERSE</small></button>
          <button data-action="jump" data-foot aria-label="Jump">↑<small>JUMP</small></button><button data-hold="sprint" data-foot aria-label="Sprint">⇧<small>SPRINT</small></button>
          <button data-action="interact" class="touch-interact" aria-label="Enter vehicle">↗<small data-touch-interact>DRIVE</small></button>
        </div></div>
        <div class="toast" role="status" aria-live="polite" hidden></div>
      </section>
      <aside class="phone" hidden aria-label="DelhiOS smartphone" aria-modal="true" role="dialog">
        <div class="phone-notch"></div><header class="phone-header"><span>DelhiOS<small>CONNECTED TO YOUR CITY</small></span><button data-action="phone" aria-label="Close phone">×</button></header>
        <div class="phone-scroll"><h2>Good evening,<br><em>Delhi explorer.</em></h2><div class="phone-balance"><span>YOUR BALANCE</span><strong data-cash>₹15,000</strong><small>Delhi Wallet · Ready for the road</small></div>
          <div class="app-heading"><span>↗ DelhiNav</span><small>LIVE GPS</small></div><div class="phone-map"><canvas aria-label="DelhiNav GPS minimap" role="img"></canvas><div><span>●</span> Connaught Place <small data-coordinates>New Delhi, India</small></div></div>
          <div class="app-heading"><span>◈ Hustle</span><small>LOCAL GIGS</small></div><article class="gig-card"><span class="gig-tag">YOUR FIRST GIG</span><h3>Shivaji Stadium<br>Courier Run</h3><p>One parcel. A short drive through CP. Hand it over on foot at the stadium metro.</p><div class="gig-reward"><strong>₹750</strong><span>No time limit<br>Parcel included</span></div><button class="primary" data-action="accept">Accept delivery →</button></article><p class="phone-footer">A little hustle. A bigger city.</p>
        </div><div class="phone-home"></div>
      </aside>
      <section class="pause-screen" hidden aria-label="Paused"><div><span class="eyebrow">TAKE A BREATHER</span><h2>Delhi can wait.</h2><p>Your drive will be right here.</p><button class="primary" data-action="pause">Back to the city →</button></div></section>`;
    const options = { signal: this.abort.signal };
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      switch (button.dataset.action) {
        case 'start': actions.start(); break;
        case 'phone': actions.phone(); break;
        case 'pause': actions.pause(); break;
        case 'interact': actions.interact(); break;
        case 'accept': actions.accept(); break;
        case 'jump': input.requestJump(); break;
        case 'reverse': input.reverse = !input.reverse; this.text('[data-reverse]', input.reverse ? 'DRIVE' : 'REVERSE'); break;
      }
    }, options);
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
      let pointer: number | null = null;
      const apply = (held: boolean): void => {
        button.classList.toggle('held', held);
        if (button.dataset.hold === 'gas') input.setGas(held);
        if (button.dataset.hold === 'brake') input.setBrake(held);
        if (button.dataset.hold === 'sprint') input.setSprint(held);
      };
      button.addEventListener('pointerdown', event => {
        if (pointer !== null) return;
        event.preventDefault(); pointer = event.pointerId; button.setPointerCapture(pointer); apply(true);
      }, options);
      const release = (event: PointerEvent): void => { if (event.pointerId === pointer) { pointer = null; apply(false); } };
      button.addEventListener('pointerup', release, options); button.addEventListener('pointercancel', release, options); button.addEventListener('lostpointercapture', release, options);
      window.addEventListener('blur', () => { pointer = null; apply(false); }, options);
    }
    const joystick = this.element<HTMLDivElement>('.joystick'), knob = this.element<HTMLDivElement>('.joystick-knob');
    let pointer: number | null = null;
    const reset = (): void => { pointer = null; input.setJoystick(0, 0); knob.style.transform = 'translate(0,0)'; };
    const move = (event: PointerEvent): void => {
      if (event.pointerId !== pointer) return;
      const rect = joystick.getBoundingClientRect(), radius = rect.width / 3;
      const x = (event.clientX - rect.left - rect.width / 2) / radius, z = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.max(1, Math.hypot(x, z)); input.setJoystick(x / length, z / length);
      knob.style.transform = `translate(${x / length * radius}px,${z / length * radius}px)`;
    };
    joystick.addEventListener('pointerdown', event => { if (pointer !== null) return; event.preventDefault(); pointer = event.pointerId; joystick.setPointerCapture(pointer); move(event); }, options);
    joystick.addEventListener('pointermove', move, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) joystick.addEventListener(name, event => { if (event.pointerId === pointer) reset(); }, options);
    window.addEventListener('blur', reset, options);
    this.maps = [...root.querySelectorAll<HTMLCanvasElement>('canvas')].map(canvas => new Minimap(canvas));
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector); if (!element) throw new Error(`Missing UI element: ${selector}`); return element;
  }
  private text(selector: string, value: string): void { this.root.querySelectorAll(selector).forEach(element => { if (element.textContent !== value) element.textContent = value; }); }
  screen(started: boolean, paused: boolean, phone: boolean): void {
    this.element('.welcome').hidden = started;
    this.element('.game-ui').hidden = !started;
    this.element('.game-ui').classList.toggle('phone-open', phone);
    this.element('.pause-screen').hidden = !paused;
    const panel = this.element('.phone');
    if (panel.hidden === phone) {
      panel.hidden = !phone;
      if (phone) this.element<HTMLButtonElement>('[aria-label="Close phone"]').focus({ preventScroll: true });
      else if (started) this.element<HTMLButtonElement>('[aria-label="Open DelhiOS phone"]').focus({ preventScroll: true });
    }
  }
  update(player: PlayerController, car: VehicleController, interaction: InteractionSystem, mission: CourierMission): void {
    const driving = car.driving, position = driving ? car.position : player.position;
    this.text('[data-cash]', `₹${mission.cash.toLocaleString('en-IN')}`);
    this.text('[data-mode]', driving ? 'THE PARVAAZ / HATCHBACK' : 'ON FOOT / EXPLORER');
    this.text('[data-speed]', driving ? `${Math.round(car.kmh)} km/h` : 'Take the long way.');
    this.text('[data-mode-detail]', driving ? `${Math.abs(car.speed) < 0.1 ? 'IDLE' : car.speed < 0 ? 'REVERSE' : 'DRIVE'} · 900 kg · Indian compact` : 'The city moves at your pace.');
    this.text('[data-prompt]', interaction.prompt);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="interact"]')) {
      button.disabled = !interaction.available; button.setAttribute('aria-label', driving ? 'Exit vehicle' : 'Enter vehicle');
    }
    this.text('[data-touch-interact]', driving ? 'EXIT' : 'DRIVE');
    this.root.querySelectorAll<HTMLElement>('[data-driving]').forEach(e => { e.hidden = !driving; });
    this.root.querySelectorAll<HTMLElement>('[data-foot]').forEach(e => { e.hidden = driving; });
    const metres = Math.round(distance(position, COURIER_TARGET));
    this.element('.gig-tracker').hidden = mission.state !== 'active';
    this.text('[data-distance]', `${metres} m · Deliver on foot at the gold marker`);
    this.text('[data-coordinates]', `${position.x.toFixed(1)}, ${position.z.toFixed(1)} · ${driving ? 'Driving' : 'On foot'}`);
    this.text('.gig-tag', mission.state === 'completed' ? 'DELIVERED' : mission.state === 'active' ? 'IN PROGRESS' : 'YOUR FIRST GIG');
    const accept = this.element<HTMLButtonElement>('[data-action="accept"]'); accept.disabled = mission.state !== 'available';
    this.text('[data-action="accept"]', mission.state === 'available' ? 'Accept delivery →' : mission.state === 'active' ? `GPS active · ${metres} m` : 'Delivery complete · ₹750 earned');
    this.maps.forEach(map => map.draw(position, driving ? car.yaw : player.yaw, car.position, mission.state === 'active'));
  }
  toast(message: string): void { const element = this.element('.toast'); element.textContent = message; element.hidden = false; }
  dispose(): void { this.abort.abort(); this.root.replaceChildren(); }
}
