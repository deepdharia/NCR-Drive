import {HudAnimationManager} from './animation/HudAnimationManager';
import {HudStateAdapter,hudState,routeDirection} from './animation/HudStateAdapter';
import type {FeedbackKind} from './animation/HudStateAdapter';
import {distance} from '../core/math';
import type { InputController } from '../input/InputController';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';
import type { InteractionSystem } from '../systems/InteractionSystem';
import { COURIER_TARGET } from '../systems/CourierMission';
import type { CourierMission } from '../systems/CourierMission';
import type { StoryMission } from '../systems/StoryMission';
import { MARKET, SUPPLY_TARGET } from '../systems/Neighborhood';
import type { Neighborhood } from '../systems/Neighborhood';
import {walkingRoute} from '../systems/WalkingNavigation';
import { roadRoute, routeLength } from '../systems/Navigation';
import { regionAt, regionLabels } from '../world/WorldRoads';
import { Minimap, MAP_SIZE, overviewClickToWorld } from './Minimap';
import type { Point } from '../core/math';
import type { Settings } from '../systems/ProgressStore';
import { nextQuality, QUALITY, resolvedQuality } from '../rendering/QualityProfile';
import { CLUSTER_PLACES } from '../world/ClusterData';

interface UIActions { showcase: () => void; journey:()=>void; start:()=>void; phone:()=>void; pause:()=>void; interact:()=>void; accept:()=>void; story:()=>void; cancelStory:()=>void; quality:()=>void; recover:()=>void; sensitivity:(kind:'steeringSensitivity'|'cameraSensitivity',value:number)=>void; buy:()=>void; pay:()=>void; closeShop:()=>void; supply:()=>void; cancelSupply:()=>void; receive:()=>void; receiveGoods:()=>void; cancelGoods:()=>void; exitPhoto:()=>void; audio:()=>void; volume:(value:number)=>void; waypoint:(point:Point)=>void; clearWaypoint:()=>void }

const phoneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>';

export class GameUI {
  private abort = new AbortController();
  private maps: Minimap[];
  private photo = false;
  private animations:HudAnimationManager;
  private hudAdapter=new HudStateAdapter();
  private releaseControls: (()=>void)[]=[];
  private lastMode?:boolean;
  private lastSeated?:boolean;
  private lastSaveAvailable=true;
  private lastArc=-1;
  private lastToast="";
  private lastToastTime=0;
  private cachedRoute: {x:number;z:number}[]=[];
  private routeTarget: object | undefined;
  private routeTime=0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(readonly root: HTMLElement, private input: InputController, actions: UIActions) {
    root.innerHTML = `
      <section class="welcome" aria-label="Welcome to NCR Drive">
        <div class="welcome-top"><span class="brand-mark">N</span><span>NCR DRIVE <small>NEW DELHI, INDIA</small></span><span class="edition">OPEN WORLD / 01</span></div>
        <div class="welcome-copy"><span class="eyebrow">A CITY WITH A THOUSAND STORIES</span><h1>Your evening.<br>Your <em>Delhi.</em></h1><p>Walk beneath the arcades. Take the Parvaaz for a spin.<br>Visit Market Lane. Share a chai. Help your neighbors.</p><button class="primary" data-action="start">Explore the neighborhood <span>↗</span></button><div class="welcome-note">NO DOWNLOADS. NO KEYS. JUST THE CITY.</div></div>
        <div class="welcome-bottom"><span>25° golden hour · Connaught Place</span><span>WALK / DRIVE / HUSTLE</span></div>
      </section>
      <section class="game-ui" hidden aria-label="Game controls">
        <header class="location"><span class="eyebrow">NCR DRIVE / FREE ROAM</span><h1 data-region-title>Connaught Place · नई दिल्ली</h1><p data-region-detail>Inner Circle · A Delhi evening</p></header>
        <div class="top-actions"><div class="wallet"><strong data-cash>₹15,000</strong><span>DELHI WALLET</span></div><button class="icon-button" data-action="phone" aria-label="Open DelhiOS phone">${phoneIcon}</button><button class="icon-button" data-action="pause" aria-label="Pause game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14M16 5v14"/></svg></button></div>
        <div class="radar"><canvas class="radar-map" aria-label="DelhiNav local minimap" role="img"></canvas><span>DELHINAV / LIVE</span></div>
        <button class="gig-tracker" data-action="phone" aria-label="Open current job in DelhiOS"><span class="objective-bearing" aria-hidden="true">↑</span><div><span class="route-mode" data-route-mode>WALKING ROUTE</span><strong data-job-title>Shivaji Stadium Courier Run</strong><small data-distance>Parcel collected · Follow the gold marker</small></div></button>
        <div class="mode-card" aria-label="Movement status"><span data-mode>ON FOOT / EXPLORER</span><div class="speed-dial"><svg viewBox="0 0 200 120" aria-hidden="true"><path class="dial-track" d="M20 105 A80 80 0 0 1 180 105"/><path class="dial-fill" pathLength="1" d="M20 105 A80 80 0 0 1 180 105"/></svg><strong data-speed>ON FOOT</strong><span class="speed-unit">km/h</span></div><div class="cluster-status"><b data-gear>N</b><small data-mode-detail>The city moves at your pace.</small><span data-braking hidden>BRAKE</span></div></div>
        <div class="hud-feedback" aria-hidden="true"><canvas width="64" height="64" data-hud-animation hidden></canvas></div>
        <button class="interaction" data-action="interact"><kbd>F</kbd><span data-prompt>Press [F] or Tap to Drive</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>
        <div class="desktop-help"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>SPACE</kbd> Jump / brake</span><span><kbd>DRAG</kbd> Camera</span><span><kbd>TAB</kbd> DelhiOS</span></div>
        <div class="touch-controls"><div class="joystick" role="group" aria-label="Movement joystick"><div class="joystick-cross"></div><div class="joystick-knob"></div></div><div class="touch-actions">
          <button data-hold="gas" data-driving aria-label="Accelerate">↑<small>ACCELERATE</small></button><button data-hold="brake" data-driving aria-label="Brake">↓<small>BRAKE</small></button>
          <button data-action="reverse" data-driving aria-label="Toggle reverse gear">R<small data-reverse>REVERSE</small></button>
          <button data-action="jump" data-foot aria-label="Jump">↑<small>JUMP</small></button><button data-hold="sprint" data-foot aria-label="Sprint">⇧<small>SPRINT</small></button>
          <button data-action="interact" class="touch-interact" aria-label="Enter vehicle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v16h-6M3 12h12M10 7l5 5-5 5"/></svg><small data-touch-interact>DRIVE</small></button>
        </div></div>
        <div class="toast" role="status" aria-live="polite" hidden></div>
      </section>
      <aside class="phone" hidden aria-label="DelhiOS smartphone" aria-modal="true" role="dialog">
        <div class="phone-notch"></div><header class="phone-header"><span>DelhiOS<small>CONNECTED TO YOUR CITY</small></span><button data-action="phone" aria-label="Close phone">×</button></header>
        <div class="phone-scroll"><h2>Good evening,<br><em>Delhi explorer.</em></h2><div class="phone-balance"><span>YOUR BALANCE</span><strong data-cash>₹15,000</strong><small data-save>Progress saved on this device</small><small data-career>Local helper · Building trust</small></div>
          <div class="app-heading"><span>↗ DelhiNav</span><small>LIVE GPS</small></div><div class="phone-map"><canvas aria-label="DelhiNav GPS map — click anywhere to set a waypoint" role="img" style="cursor:crosshair" title="Click anywhere to set a waypoint"></canvas><div><span>●</span> <span data-map-region>Connaught Place</span> <small data-coordinates>New Delhi, India</small></div><button class="cancel-job" data-action="clearWaypoint" hidden>Clear waypoint</button></div>
          <div class="app-heading"><span>↗ Neighborhood</span><small>LIVING DELHI</small></div><article class="activity-card"><h3>Market Lane · बाज़ार गली</h3><p>Head west from CP. Park, walk to Neem Chai, pay with fictional game currency, sit and drink. Visit Gali Baithak for local news and Nimbu Corner for a fruit supply job.</p><p data-neighborhood></p><button class="primary" data-action="receive" hidden>Confirm cold-store receipt · ₹650</button><button class="cancel-job" data-action="cancelSupply" hidden>Cancel supply delivery</button></article>
          <div class="app-heading"><span>↗ Parks & Shopping</span><small>NEW PLACES</small></div><article class="activity-card"><h3>Parks, boulevards & a viewpoint</h3><p>Route to a usable arrival point — parking or gate, never a building centre. Drive in, park, walk around.</p>${CLUSTER_PLACES.map(p => `<button class="graphics-button" data-action="place" data-x="${p.arrival.x}" data-z="${p.arrival.z}">Route → ${p.name}</button>`).join('')}</article>
          <div class="app-heading"><span>↗ Goods delivery</span><small>LOCAL JOBS</small></div><article class="activity-card"><h3 data-goods-title>No goods job yet</h3><p data-goods-status>Accept a prepared order at a cluster shop — flowers or cake — and hand it over at the destination counter.</p><button class="primary" data-action="receiveGoods" hidden>Confirm handover</button><button class="cancel-job" data-action="cancelGoods" hidden>Cancel goods delivery</button></article>
          <div class="app-heading"><span>↗ City Stories</span><small>CHAPTER 01</small></div><article class="activity-card"><span class="story-tag" data-story-name>KABIR’S EVENING RUN</span><h3 data-story-description>One evening. Three stops.</h3><p data-story-status>Collect paperwork, cross the circle and finish a handover on foot. 4 minutes · ₹1,200.</p><p>CP west junction → Market Lane → park → Neem Chai. 467m driving, then a short walk. 10 minutes · ₹900.</p><button class="primary" data-action="showcase">Start CP evening delivery →</button><button class="primary" data-action="story">Start chapter →</button><p>Kabir’s Regional Dispatch: Delhi pickup → Gurgaon delivery. 12 minutes · ₹2,400. All three regions remain open for exploration.</p><button class="cancel-job" data-action="journey">Start regional dispatch →</button><button class="cancel-job" data-action="cancelStory" hidden>Abandon chapter</button></article>
          <div class="app-heading"><span>↗ Motor pool</span><small>THREE CARS · FREE TO DRIVE</small></div><article class="activity-card"><p>Gold Parvaaz: inner circle. Additional prototype cars: west/east approaches. Any stopped civilian car is usable. Approach its right-hand door and press F. Occupied cars need a short takeover. Taken cars remain in this session and are never recycled.</p></article>
          <div class="app-heading"><span>◈ Hustle</span><small>LOCAL GIGS</small></div><article class="gig-card"><span class="gig-tag">YOUR FIRST GIG</span><h3>Shivaji Stadium<br>Courier Run</h3><p>One parcel. A short drive through CP. Hand it over on foot at the stadium metro.</p><div class="gig-reward"><strong>₹750</strong><span>No time limit<br>Parcel included</span></div><button class="primary" data-action="accept">Accept delivery →</button></article><p class="phone-footer">A little hustle. A bigger city.</p>
        </div><div class="phone-home"></div>
      </aside>
      <section class="pause-screen" hidden aria-label="Paused"><div><span class="eyebrow">TAKE A BREATHER</span><h2>Delhi can wait.</h2><p>Your drive will be right here.</p><button class="graphics-button" data-action="quality">Graphics: Detailed · Tap for performance</button>
        <button class="graphics-button" data-action="audio">Sound: On</button><label>Sound volume <input aria-label="Sound volume" data-volume type="range" min="0" max="1" step="0.05" value="0.35"></label><small data-render-stats aria-label="Rolling render statistics">Drive to collect frame statistics.</small><div class="control-settings"><label for="steering-sensitivity">Steering sensitivity <output data-steering-value>1.0×</output></label><input id="steering-sensitivity" type="range" min="0.5" max="1.5" step="0.1" value="1" data-setting="steeringSensitivity"><label for="camera-sensitivity">Camera sensitivity <output data-camera-value>1.0×</output></label><input id="camera-sensitivity" type="range" min="0.5" max="1.5" step="0.1" value="1" data-setting="cameraSensitivity"></div>
        <p class="recovery-note" id="recovery-policy">Stuck? Recovery is free. Your nearby car returns to a clear road.<br>Active jobs are cancelled without payout. Earned money is kept.</p><button class="graphics-button" data-action="recover" aria-describedby="recovery-policy">Recover to a clear road · Free</button><p data-recovery-status role="status"></p>
        <button class="primary" data-action="pause">Back to the city →</button></div></section>
      <section class="shop-modal" hidden role="dialog" aria-modal="true" aria-label="Neighborhood interaction"><div><span class="eyebrow">LIVING DELHI · GAME CURRENCY ONLY</span><h2 data-shop-title></h2><p data-shop-copy></p><button class="primary" data-action="buy" hidden>Order drink</button><button class="primary" data-action="pay" hidden>Confirm fictional UPI payment</button><button class="graphics-button" data-action="supply" hidden>Help with the fruit supply · ₹650</button><button class="graphics-button" data-action="closeShop">Back to the street</button></div></section>
      <section class="photo-overlay" hidden aria-label="Photo stop"><div><span class="eyebrow">PHOTO STOP</span><h2 data-photo-title>Viewpoint</h2><p>HUD hidden. Take your screenshot, then exit.</p><button class="primary" data-action="exitPhoto">Exit photo stop →</button></div></section>`;
    this.animations=new HudAnimationManager(this.element<HTMLCanvasElement>('[data-hud-animation]'));
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
        case 'showcase': actions.showcase(); break;
        case 'journey': actions.journey(); break;
        case 'story': actions.story(); break;
        case 'cancelStory': actions.cancelStory(); break;
        case 'buy': actions.buy(); break;
        case 'pay': actions.pay(); break;
        case 'closeShop': actions.closeShop(); break;
        case 'supply': actions.supply(); break;
        case 'receive': actions.receive(); break;
        case 'receiveGoods': actions.receiveGoods(); break;
        case 'cancelGoods': actions.cancelGoods(); break;
        case 'exitPhoto': actions.exitPhoto(); break;
        case 'cancelSupply': actions.cancelSupply(); break;
        case 'place': { const x = Number(button.dataset.x), z = Number(button.dataset.z); if (Number.isFinite(x) && Number.isFinite(z)) actions.waypoint({ x, z }); break; }
        case 'clearWaypoint': actions.clearWaypoint(); break;
        case 'audio': actions.audio(); break;
        case 'jump': input.requestJump(); break;
        case 'reverse': input.reverse = !input.reverse; this.text('[data-reverse]', input.reverse ? 'DRIVE' : 'REVERSE'); button.setAttribute('aria-pressed',String(input.reverse)); break;
      }
    }, options);
    root.addEventListener('change', event => {
      const slider = event.target as HTMLInputElement;
      if(slider.hasAttribute('data-volume'))actions.volume(Number(slider.value));
      const kind = slider.dataset.setting;
      if (kind === 'steeringSensitivity' || kind === 'cameraSensitivity') actions.sensitivity(kind, Number(slider.value));
    }, options);
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
      let pointer: number | null = null;
      const apply = (held: boolean): void => {
        button.classList.toggle('held', held); button.setAttribute('aria-pressed',String(held));
        if (button.dataset.hold === 'gas') input.setGas(held);
        if (button.dataset.hold === 'brake') input.setBrake(held);
        if (button.dataset.hold === 'sprint') input.setSprint(held);
      };
      button.addEventListener('pointerdown', event => {
        if (pointer !== null || !input.enabled) return;
        event.preventDefault(); pointer = event.pointerId; button.setPointerCapture(pointer); apply(true);
      }, options);
      const release = (event: PointerEvent): void => { if (event.pointerId === pointer) { pointer = null; apply(false); } };
      button.addEventListener('pointerup', release, options); button.addEventListener('pointercancel', release, options); button.addEventListener('lostpointercapture', release, options);
      const reset=():void=>{pointer=null;apply(false);};this.releaseControls.push(reset);
      window.addEventListener('blur', reset, options);
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
    joystick.addEventListener('pointerdown', event => { if (pointer !== null || !input.enabled) return; event.preventDefault(); pointer = event.pointerId; joystick.setPointerCapture(pointer); move(event); }, options);
    joystick.addEventListener('pointermove', move, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) joystick.addEventListener(name, event => { if (event.pointerId === pointer) reset(); }, options);
    window.addEventListener('blur', reset, options);this.releaseControls.push(reset);
    this.maps = [...root.querySelectorAll<HTMLCanvasElement>('.radar-map,.phone-map canvas')].map((canvas, i) => new Minimap(canvas, i > 0));
    // Clicking anywhere on the full DelhiOS map drops a waypoint pin.
    const overviewCanvas = this.element<HTMLCanvasElement>('.phone-map canvas');
    overviewCanvas.addEventListener('click', event => {
      const rect = overviewCanvas.getBoundingClientRect();
      const px = (event.clientX - rect.left) * MAP_SIZE / rect.width;
      const pz = (event.clientY - rect.top) * MAP_SIZE / rect.height;
      actions.waypoint(overviewClickToWorld(px, pz));
    }, options);
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector); if (!element) throw new Error(`Missing UI element: ${selector}`); return element;
  }
  private text(selector: string, value: string): void { this.root.querySelectorAll(selector).forEach(element => { if (element.textContent !== value) element.textContent = value; }); }
  screen(started: boolean, paused: boolean, phone: boolean): void {
    this.setBlocked(!started||paused||phone||this.photo);
    this.releaseControls.forEach(release=>release());
    this.element('.welcome').hidden = started;
    this.element('.game-ui').hidden = !started || this.photo;
    this.element('.game-ui').classList.toggle('phone-open', phone);
    this.element('.pause-screen').hidden = !paused;
    const panel = this.element('.phone');
    if (panel.hidden === phone) {
      panel.hidden = !phone;
      if (phone) this.element<HTMLButtonElement>('[aria-label="Close phone"]').focus({ preventScroll: true });
      else if (started) this.element<HTMLButtonElement>('[aria-label="Open DelhiOS phone"]').focus({ preventScroll: true });
    }
  }
  update(player:PlayerController,car:VehicleController,interaction:InteractionSystem,mission:CourierMission,neighborhood:Neighborhood,saveAvailable:boolean,story:StoryMission,prompt?:string,locked=false,waypoint?:Point,seated=false,contextAvailable=false):void {
    const driving=car.driving,position=driving?car.position:player.position,region=regionAt(position);
    this.text('[data-region-title]',region==='delhi'?'Delhi · नई दिल्ली':regionLabels[region].split(' · ')[0]);
    this.text('[data-region-detail]',region==='delhi'&&position.x< -130?'Market Lane · बाज़ार गली':regionLabels[region]);this.text('[data-map-region]',regionLabels[region]);
    this.text('[data-cash]',`₹${mission.cash.toLocaleString('en-IN')}`);
    const state=hudState(player,car,this.input.reverse,seated);
    const hud=this.element('.game-ui');
    if(this.lastMode!==driving){this.releaseControls.forEach(release=>release());this.lastMode=driving;this.routeTarget=undefined;}
    if(this.lastSeated!==seated){this.releaseControls.forEach(release=>release());this.lastSeated=seated;hud.dataset.hudSeated=String(seated);this.element('.joystick').setAttribute('aria-disabled',String(seated));}
    hud.dataset.hudMode=driving?'driving':'walking';
    hud.dataset.hudBraking=String(state.braking);
    this.text('[data-mode]',driving?car.spec.name.toUpperCase(): 'ON FOOT / EXPLORER');
    this.text('[data-speed]',driving?String(state.speed):state.movement);
    this.text('[data-gear]',state.gear);
    this.text('[data-mode-detail]',driving?`${state.speed?'IN MOTION':'STATIONARY'} · HDG ${((car.yaw*180/Math.PI%360+360)%360).toFixed(0)}°`:'Explore at your own pace');
    this.element('[data-braking]').hidden=!state.braking;
    if(this.lastArc!==state.arc){this.element('.mode-card').style.setProperty('--speed',String(state.arc));this.lastArc=state.arc;}
    for(const cue of this.hudAdapter.update(state))void this.animations.play(cue);
    this.text('[data-route-mode]',driving?'DRIVING ROUTE':'WALKING ROUTE');
    this.text('[data-prompt]',prompt??interaction.prompt);
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="interact"]')){button.disabled=locked||(!contextAvailable&&!interaction.available);if(!button.classList.contains('touch-interact'))button.hidden=button.disabled&&!interaction.busy;button.setAttribute('aria-label',driving?'Exit vehicle':'Interact nearby');}
    this.text('[data-touch-interact]',driving?'EXIT':interaction.available&&!prompt?'ENTER':seated?'STAND':'USE');
    this.text('[data-reverse]',this.input.reverse?'DRIVE':'REVERSE');this.element('[data-action=reverse]').setAttribute('aria-pressed',String(this.input.reverse));
    this.root.querySelectorAll<HTMLElement>('[data-driving]').forEach(e=>{e.hidden=!driving;});this.root.querySelectorAll<HTMLElement>('[data-foot]').forEach(e=>{e.hidden=driving||seated;});
    const courier=mission.state==='active',supply=neighborhood.active,receipt=neighborhood.job==='receipt';
    const goodsActive=neighborhood.goodsActive,goodsReceipt=neighborhood.goods==='receipt',supplyJob=neighborhood.job==='delivery'||neighborhood.job==='receipt';
    const target=waypoint??(story.active?story.step.target:courier?COURIER_TARGET:supply?(neighborhood.activeTarget??MARKET):MARKET);
    if(target!==this.routeTarget||performance.now()-this.routeTime>750){this.cachedRoute=driving?roadRoute(position,target):walkingRoute(position,target);this.routeTarget=target;this.routeTime=performance.now();}
    const bearing=routeDirection(position,driving?car.yaw:player.yaw,this.cachedRoute);
    const direction=this.element('.objective-bearing');direction.hidden=bearing===undefined;
    if(bearing!==undefined)direction.style.transform=`rotate(${bearing}rad)`;
    const route=this.cachedRoute,metres=Math.round(routeLength(route));
    this.text('[data-job-title]',story.active?story.step.title:courier?'Shivaji Stadium Courier Run':goodsActive?neighborhood.goodsName:receipt?'Cold-store receipt · Follow-up':supply?'Fruit crate → Delhi Cold Store':'Explore the neighborhood');
    this.text('[data-distance]',story.active?`${metres} m · ${Math.ceil(story.remaining)}s · ${story.step.mode==='foot'?'On-foot handover':'Stop in car'}`:courier?`${metres} m · Deliver on foot`:goodsReceipt?`${metres} m · Stop at the counter → DelhiOS → Confirm handover`:goodsActive?`${metres} m · Deliver the prepared order · ₹${neighborhood.goodsReward}`:receipt?`${metres} m · Stop by bay → DelhiOS → Confirm receipt`:supply?`${metres} m · Stop in the goods bay · ₹650`:`${metres} m · Visit Neem Chai on Market Lane`);
    this.text('[data-coordinates]',`${position.x.toFixed(1)}, ${position.z.toFixed(1)} · ${driving?'Driving':'On foot'}`);
    if(!saveAvailable&&this.lastSaveAvailable)this.toast('Progress could not be saved on this device.','warning');this.lastSaveAvailable=saveAvailable;
    this.text('[data-save]',saveAvailable?'Progress saved on this device':'Saving unavailable · Purchases and neighborhood rewards require a successful save');
    this.text('[data-career]',`Neighborhood trust ${neighborhood.data.relationship} · ${neighborhood.data.completed?'Trusted local helper':'Local explorer'}`);
    this.text('[data-neighborhood]',`Bag: ${neighborhood.data.chai} chai · ${neighborhood.data.juice} juice · ${neighborhood.data.flowers} flowers · ${neighborhood.data.sweets} sweets · ${neighborhood.data.cake} cake. ${neighborhood.message}`);
    this.element('[data-action="cancelSupply"]').hidden=!supplyJob;
    const receive=this.element<HTMLButtonElement>('[data-action="receive"]');receive.hidden=!receipt;receive.disabled=distance(position,SUPPLY_TARGET)>5||(driving?car.kmh:player.speed*3.6)>2;
    const receiveGoods=this.element<HTMLButtonElement>('[data-action="receiveGoods"]');receiveGoods.hidden=!goodsReceipt;receiveGoods.disabled=!neighborhood.goodsDropoff||distance(position,neighborhood.goodsDropoff)>5||(driving?car.kmh:player.speed*3.6)>2;
    this.element('[data-action="cancelGoods"]').hidden=!goodsActive;
    this.text('[data-goods-title]',goodsActive?neighborhood.goodsName:neighborhood.data.goodsDone.length?`Goods jobs complete · ${neighborhood.data.goodsDone.length}`:'No goods job yet');
    this.text('[data-goods-status]',goodsActive?(goodsReceipt?'At the handover counter — confirm the receipt in DelhiOS.':'Deliver the prepared order to the destination counter.'):neighborhood.data.goodsDone.length?`Completed: ${neighborhood.data.goodsDone.join(', ')}. Speak to a shop to find more work.`:'Accept a prepared order at a cluster shop — flowers or cake — and hand it over at the destination counter.');
    const busy=courier||story.active||supply;
    this.element<HTMLButtonElement>('[data-action="accept"]').disabled=mission.state!=='available'||busy;
    this.text('[data-action="accept"]',mission.state==='completed'?'Delivery complete · ₹750 earned':courier?'Delivery in progress':'Accept delivery →');
    for(const action of ['story','journey','showcase'])this.element<HTMLButtonElement>(`[data-action="${action}"]`).disabled=busy;
    this.element('[data-action="cancelStory"]').hidden=!story.active;
    this.text('[data-story-status]',story.active?`${story.index+1}/${story.steps.length} · ${story.step.title} · ${Math.ceil(story.remaining)}s remaining`:'Collect paperwork, cross the circle and finish on foot. 4 minutes · ₹1,200.');
    if(waypoint)this.text('[data-distance]',`${metres} m · Waypoint · Tap the map to move it`);
    this.element('[data-action="clearWaypoint"]').hidden=!waypoint;
    if(!route.length)this.text('[data-distance]','Walk to a signed roadway for a safe road route');
    if(prompt?.includes('Stand')||prompt?.includes('Standing'))this.text('[data-distance]','Enjoy the neighborhood · F to stand');
    this.maps.forEach(map=>map.draw(position,driving?car.yaw:player.yaw,car.position,target,route,false));
  }
  setPhotoMode(show: boolean, name?: string): void {
    this.photo = show;
    this.element('.photo-overlay').hidden = !show;
    if (show && name) this.text('[data-photo-title]', name);
  }
  private setBlocked(value:boolean):void {this.animations.suspend(value);this.element('.game-ui').classList.toggle('hud-blocked',value);if(value)this.releaseControls.forEach(release=>release());}
  shop(title:string,copy:string,buy=false,pay=false,supply=false,supplyLabel?:string):void {
    this.setBlocked(true);this.element('.shop-modal').hidden=false;this.text('[data-shop-title]',title);this.text('[data-shop-copy]',copy);
    for(const [action,show] of [['buy',buy],['pay',pay],['supply',supply]] as const)this.element(`[data-action="${action}"]`).hidden=!show;
    if(supplyLabel)this.text('[data-action="supply"]',supplyLabel);else this.text('[data-action="supply"]','Help with the fruit supply · ₹650');
    this.element<HTMLButtonElement>(pay?'[data-action="pay"]':'[data-action="closeShop"]').focus();
  }
  closeShop():void {this.element('.shop-modal').hidden=true;}

  renderStats(value:string):void {this.text('[data-render-stats]',value);}

  setSettings(settings: Settings): void {
    this.text('[data-action="audio"]',settings.muted?'Sound: Muted':'Sound: On');
    this.element<HTMLInputElement>('[data-volume]').value=String(settings.volume??0.35);
    const quality = resolvedQuality(settings);
    this.text('[data-action="quality"]', `Graphics: ${QUALITY[quality].label} · Tap for ${QUALITY[nextQuality(quality)].label}`);
    this.element<HTMLInputElement>('[data-setting="steeringSensitivity"]').value = String(settings.steeringSensitivity);
    this.element<HTMLInputElement>('[data-setting="cameraSensitivity"]').value = String(settings.cameraSensitivity);
    this.text('[data-steering-value]', `${settings.steeringSensitivity.toFixed(1)}×`);
    this.text('[data-camera-value]', `${settings.cameraSensitivity.toFixed(1)}×`);
  }
  recoveryStatus(message: string): void { this.text('[data-recovery-status]', message); }
  toast(message: string,kind:FeedbackKind='neutral'): void {
    const now=performance.now();if(message===this.lastToast&&now-this.lastToastTime<1500)return;this.lastToast=message;this.lastToastTime=now;
    this.element('.toast').dataset.kind=kind;
    void this.animations.play(kind==='warning'?'warning':kind==='success'||kind==='reward'?'success':'mode');
    clearTimeout(this.toastTimer);
    const element = this.element('.toast'); element.textContent = message; element.hidden = false;
    this.toastTimer = setTimeout(() => { element.hidden = true; }, 5500);
  }
  dispose(): void { this.releaseControls.forEach(release=>release());this.animations.dispose(); clearTimeout(this.toastTimer); this.abort.abort(); this.root.replaceChildren(); }
}
