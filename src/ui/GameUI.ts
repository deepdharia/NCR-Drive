import type { InputController } from '../input/InputController';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';
import type { InteractionSystem } from '../systems/InteractionSystem';
import { COURIER_TARGET } from '../systems/CourierMission';
import type { CourierMission } from '../systems/CourierMission';
import type { StoryMission } from '../systems/StoryMission';
import type { TaxiMission } from '../systems/TaxiMission';
import { roadRoute, routeLength } from '../systems/Navigation';
import { Minimap } from './Minimap';
import type { Settings } from '../systems/ProgressStore';

interface UIActions { journey: () => void; regionalTaxi: (noida: boolean) => void; start: () => void; phone: () => void; pause: () => void; interact: () => void; accept: () => void; taxi: () => void; cancelTaxi: () => void; story: () => void; cancelStory: () => void; quality: () => void; recover: () => void; sensitivity: (kind: 'steeringSensitivity' | 'cameraSensitivity', value: number) => void }
const phoneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>';

export class GameUI {
  private abort = new AbortController();
  private maps: Minimap[];
  private cachedRoute: {x:number;z:number}[]=[];
  private routeTarget: object | undefined;
  private routeTime=0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(readonly root: HTMLElement, input: InputController, actions: UIActions) {
    root.innerHTML = `
      <section class="welcome" aria-label="Welcome to NCR Drive">
        <div class="welcome-top"><span class="brand-mark">N</span><span>NCR DRIVE <small>NEW DELHI, INDIA</small></span><span class="edition">OPEN WORLD / 01</span></div>
        <div class="welcome-copy"><span class="eyebrow">A CITY WITH A THOUSAND STORIES</span><h1>Your evening.<br>Your <em>Delhi.</em></h1><p>Walk beneath the arcades. Take the Parvaaz for a spin.<br>Switch cars. Pick up passengers. Start your first city story.</p><button class="primary" data-action="start">Explore Connaught Place <span>↗</span></button><div class="welcome-note">NO DOWNLOADS. NO KEYS. JUST THE CITY.</div></div>
        <div class="welcome-bottom"><span>25° golden hour · Connaught Place</span><span>WALK / DRIVE / HUSTLE</span></div>
      </section>
      <section class="game-ui" hidden aria-label="Game controls">
        <header class="location"><span class="eyebrow">NCR DRIVE / FREE ROAM</span><h1>Connaught Place <small>नई दिल्ली</small></h1><p><span class="live-dot"></span> Inner Circle <span>· A Delhi evening</span></p></header>
        <div class="top-actions"><div class="wallet"><strong data-cash>₹15,000</strong><span>DELHI WALLET</span></div><button class="icon-button" data-action="phone" aria-label="Open DelhiOS phone">${phoneIcon}</button><button class="icon-button" data-action="pause" aria-label="Pause game">Ⅱ</button></div>
        <div class="radar"><canvas class="radar-map" aria-label="DelhiNav local minimap" role="img"></canvas><span>DELHINAV / LIVE</span></div>
        <button class="gig-tracker" data-action="phone" aria-label="Open current job in DelhiOS"><span>◈</span><div><strong data-job-title>Shivaji Stadium Courier Run</strong><small data-distance>Parcel collected · Follow the gold marker</small></div></button>
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
        <div class="phone-scroll"><h2>Good evening,<br><em>Delhi explorer.</em></h2><div class="phone-balance"><span>YOUR BALANCE</span><strong data-cash>₹15,000</strong><small data-save>Progress saved on this device</small><small data-career>0 rides · New driver</small></div>
          <div class="app-heading"><span>↗ DelhiNav</span><small>LIVE GPS</small></div><div class="phone-map"><canvas aria-label="DelhiNav GPS minimap" role="img"></canvas><div><span>●</span> Connaught Place <small data-coordinates>New Delhi, India</small></div></div>
          <div class="app-heading"><span>↗ Delhi Cabs</span><small>YOUR DRIVING CAREER</small></div>
          <article class="taxi-card"><span class="taxi-tag">NEXT FARE</span><h3 data-taxi-route></h3><p>Stop below 2 km/h inside each marker for 2 seconds. Stay in the car for pickup and drop-off.</p><div class="gig-reward"><strong data-taxi-fare></strong><span>+ ₹150 clean-drive bonus<br>No time limit</span></div><p data-taxi-status></p><button class="primary" data-action="taxi">Accept passenger →</button><button class="cancel-fare" data-action="regionalTaxi">Delhi → Gurgaon fare</button><button class="cancel-fare" data-action="noidaTaxi">Gurgaon → Noida fare (via Delhi)</button><button class="cancel-fare" data-action="cancelTaxi" hidden>Cancel current fare</button></article>
          <div class="app-heading"><span>↗ City Stories</span><small>CHAPTER 01</small></div><article class="taxi-card"><span class="story-tag">KABIR’S EVENING RUN</span><h3>One evening. Three stops.</h3><p data-story-status>Collect paperwork, cross the circle and finish a handover on foot. 4 minutes · ₹1,200.</p><button class="primary" data-action="story">Start chapter →</button><p>Kabir’s Regional Dispatch: Delhi pickup → Gurgaon delivery. 12 minutes · ₹2,400. Optional Noida taxi follow-up after delivery.</p><button class="cancel-fare" data-action="journey">Start regional dispatch →</button><button class="cancel-fare" data-action="cancelStory" hidden>Abandon chapter</button></article>
          <div class="app-heading"><span>↗ Motor pool</span><small>THREE CARS · FREE TO DRIVE</small></div><article class="taxi-card"><p>Gold Parvaaz: inner circle. White Raahi estate: west approach. Blue Baaz sport: east approach. Walk to the right-hand door and press F. Cars remain parked where you leave them this session.</p></article>
          <div class="app-heading"><span>◈ Hustle</span><small>LOCAL GIGS</small></div><article class="gig-card"><span class="gig-tag">YOUR FIRST GIG</span><h3>Shivaji Stadium<br>Courier Run</h3><p>One parcel. A short drive through CP. Hand it over on foot at the stadium metro.</p><div class="gig-reward"><strong>₹750</strong><span>No time limit<br>Parcel included</span></div><button class="primary" data-action="accept">Accept delivery →</button></article><p class="phone-footer">A little hustle. A bigger city.</p>
        </div><div class="phone-home"></div>
      </aside>
      <section class="pause-screen" hidden aria-label="Paused"><div><span class="eyebrow">TAKE A BREATHER</span><h2>Delhi can wait.</h2><p>Your drive will be right here.</p><button class="graphics-button" data-action="quality">Graphics: Detailed · Tap for performance</button>
        <small data-render-stats aria-label="Rolling render statistics">Drive to collect frame statistics.</small><div class="control-settings"><label for="steering-sensitivity">Steering sensitivity <output data-steering-value>1.0×</output></label><input id="steering-sensitivity" type="range" min="0.5" max="1.5" step="0.1" value="1" data-setting="steeringSensitivity"><label for="camera-sensitivity">Camera sensitivity <output data-camera-value>1.0×</output></label><input id="camera-sensitivity" type="range" min="0.5" max="1.5" step="0.1" value="1" data-setting="cameraSensitivity"></div>
        <p class="recovery-note" id="recovery-policy">Stuck? Recovery is free. Your nearby car returns to a clear road.<br>Active jobs are cancelled without payout. Earned money is kept.</p><button class="graphics-button" data-action="recover" aria-describedby="recovery-policy">Recover to a clear road · Free</button><p data-recovery-status role="status"></p>
        <button class="primary" data-action="pause">Back to the city →</button></div></section>`;
    const options = { signal: this.abort.signal };
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      switch (button.dataset.action) {
        case 'start': actions.start(); break;
        case 'phone': actions.phone(); break;
        case 'pause': actions.pause(); break;
        case 'quality': actions.quality(); break;
        case 'recover': actions.recover(); break;
        case 'interact': actions.interact(); break;
        case 'accept': actions.accept(); break;
        case 'journey': actions.journey(); break;
        case 'regionalTaxi': actions.regionalTaxi(false); break;
        case 'noidaTaxi': actions.regionalTaxi(true); break;
        case 'story': actions.story(); break;
        case 'cancelStory': actions.cancelStory(); break;
        case 'taxi': actions.taxi(); break;
        case 'cancelTaxi': actions.cancelTaxi(); break;
        case 'jump': input.requestJump(); break;
        case 'reverse': input.reverse = !input.reverse; this.text('[data-reverse]', input.reverse ? 'DRIVE' : 'REVERSE'); break;
      }
    }, options);
    root.addEventListener('change', event => {
      const slider = event.target as HTMLInputElement;
      const kind = slider.dataset.setting;
      if (kind === 'steeringSensitivity' || kind === 'cameraSensitivity') actions.sensitivity(kind, Number(slider.value));
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
    this.maps = [...root.querySelectorAll<HTMLCanvasElement>('canvas')].map((canvas, i) => new Minimap(canvas, i > 0));
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
  update(player: PlayerController, car: VehicleController, interaction: InteractionSystem, mission: CourierMission, taxi: TaxiMission, saveAvailable: boolean, story: StoryMission): void {
    const driving = car.driving, position = driving ? car.position : player.position;
    this.text('[data-cash]', `₹${mission.cash.toLocaleString('en-IN')}`);
    this.text('[data-mode]', driving ? `${car.spec.name.toUpperCase()} / ${car.spec.role.toUpperCase()}` : 'ON FOOT / EXPLORER');
    this.text('[data-speed]', driving ? `${Math.round(car.kmh)} km/h` : 'Take the long way.');
    this.text('[data-mode-detail]', driving ? `${Math.abs(car.speed) < 0.1 ? 'IDLE' : car.speed < 0 ? 'REVERSE' : 'DRIVE'} · ${car.spec.role} · HDG ${((car.yaw * 180 / Math.PI % 360 + 360) % 360).toFixed(0)}°` : 'The city moves at your pace.');
    this.text('[data-prompt]', interaction.prompt);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="interact"]')) {
      button.disabled = !interaction.available; button.setAttribute('aria-label', driving ? 'Exit vehicle' : 'Enter vehicle');
    }
    this.text('[data-touch-interact]', driving ? 'EXIT' : 'DRIVE');
    this.root.querySelectorAll<HTMLElement>('[data-driving]').forEach(e => { e.hidden = !driving; });
    this.root.querySelectorAll<HTMLElement>('[data-foot]').forEach(e => { e.hidden = driving; });
    const courier = mission.state === 'active';
    const target = story.active ? story.step.target : taxi.active ? taxi.target : courier ? COURIER_TARGET : undefined;
    if(target !== this.routeTarget || performance.now()-this.routeTime>750) {
      this.cachedRoute=target ? roadRoute(position,target) : [];this.routeTarget=target;this.routeTime=performance.now();
    }
    const route=this.cachedRoute;
    const metres = Math.round(routeLength(route));
    const stage = taxi.state === 'pickup' ? 'Pickup' : 'Drop-off';
    const stopHint = taxi.dwell > 0 ? `Hold still · ${Math.max(0, 2 - taxi.dwell).toFixed(1)} s` : `Stop in marker · ${metres} m by road`;
    this.text('[data-job-title]', taxi.active ? `${stage} · ${taxi.state === 'pickup' ? taxi.pickup.name : taxi.destination.name}` : courier ? 'Shivaji Stadium Courier Run' : 'Delhi Cabs · Your next fare');
    this.text('[data-distance]', taxi.active ? (driving ? stopHint : 'Enter a motor-pool car to collect your passenger') : courier ? `${metres} m by road · Deliver on foot` : 'Open DelhiOS · Find a passenger →');
    this.text('[data-coordinates]', `${position.x.toFixed(1)}, ${position.z.toFixed(1)} · ${driving ? 'Driving' : 'On foot'}`);
    this.text('[data-save]', saveAvailable ? 'Progress saved on this device' : 'Saving unavailable · This session only');
    this.text('[data-career]', `${taxi.completed} rides · ${taxi.completed >= 10 ? 'CP regular' : taxi.completed >= 3 ? 'City driver' : 'New driver'}`);
    this.text('[data-taxi-route]', `${taxi.pickup.name} → ${taxi.destination.name}`);
    this.text('[data-taxi-fare]', `₹${taxi.fare}`);
    this.text('.taxi-tag', taxi.active ? `${stage.toUpperCase()} IN PROGRESS` : 'NEXT FARE');
    this.text('[data-taxi-status]', taxi.active ? `${stage} · ${taxi.collisions ? 'Clean bonus lost after impact' : 'Clean bonus available'}` : courier ? 'Finish your courier gig to take a fare.' : 'One passenger. A new route through CP.');
    const taxiButton = this.element<HTMLButtonElement>('[data-action="taxi"]');
    taxiButton.disabled = taxi.active || courier || story.active;
    this.text('[data-action="taxi"]', taxi.active ? 'Fare in progress · Close phone to drive' : 'Accept passenger →');
    this.element('[data-action="cancelTaxi"]').hidden = !taxi.active;
    this.text('.gig-tag', mission.state === 'completed' ? 'DELIVERED' : courier ? 'IN PROGRESS' : 'YOUR FIRST GIG');
    const accept = this.element<HTMLButtonElement>('[data-action="accept"]'); accept.disabled = mission.state !== 'available' || taxi.active || story.active;
    this.text('[data-action="accept"]', courier ? `GPS active · ${metres} m` : mission.state === 'completed' ? 'Delivery complete · ₹750 earned' : taxi.active ? 'Finish your taxi fare first' : 'Accept delivery →');
    const storyButton = this.element<HTMLButtonElement>('[data-action="story"]');
    storyButton.disabled = story.active || courier || taxi.active;
    this.text('[data-action="story"]', story.active ? 'Chapter in progress' : story.state === 'failed' ? 'Retry chapter →' : story.state === 'completed' ? 'Replay chapter →' : 'Start chapter →');
    this.element('[data-action="cancelStory"]').hidden = !story.active;
    this.text('[data-story-status]', story.active ? `${story.index + 1}/${story.steps.length} · ${story.step.title} · ${Math.ceil(story.remaining)}s remaining` : 'Collect paperwork, cross the circle and finish a handover on foot. 4 minutes · ₹1,200.');
    if (story.active) {
      this.text('[data-job-title]', `${story.index + 1}/${story.steps.length} · ${story.step.title}`);
      this.text('[data-distance]', `${Math.ceil(story.remaining)}s · ${metres} m · ${story.step.mode === 'foot' ? 'Exit car · hand over on foot' : 'Stop in car'} · Hold still 1.5s`);
    }
    for (const action of ['journey','regionalTaxi','noidaTaxi']) this.element<HTMLButtonElement>(`[data-action="${action}"]`).disabled = taxi.active || courier || story.active;
    this.maps.forEach(map => map.draw(position, driving ? car.yaw : player.yaw, car.position, target, route, taxi.state === 'pickup'));
  }

  renderStats(value:string):void {this.text('[data-render-stats]',value);}

  setSettings(settings: Settings): void {
    this.text('[data-action="quality"]', settings.performanceMode ? 'Graphics: Performance · Tap for detailed' : 'Graphics: Detailed · Tap for performance');
    this.element<HTMLInputElement>('[data-setting="steeringSensitivity"]').value = String(settings.steeringSensitivity);
    this.element<HTMLInputElement>('[data-setting="cameraSensitivity"]').value = String(settings.cameraSensitivity);
    this.text('[data-steering-value]', `${settings.steeringSensitivity.toFixed(1)}×`);
    this.text('[data-camera-value]', `${settings.cameraSensitivity.toFixed(1)}×`);
  }
  recoveryStatus(message: string): void { this.text('[data-recovery-status]', message); }
  toast(message: string): void {
    clearTimeout(this.toastTimer);
    const element = this.element('.toast'); element.textContent = message; element.hidden = false;
    this.toastTimer = setTimeout(() => { element.hidden = true; }, 5500);
  }
  dispose(): void { clearTimeout(this.toastTimer); this.abort.abort(); this.root.replaceChildren(); }
}
