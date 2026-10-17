import * as THREE from 'three';
import { FrameMetrics } from './FrameMetrics';
import { CollisionWorld } from './CollisionWorld';
import { PlayerController } from '../player/PlayerController';
import { PlayerView } from '../player/PlayerView';
import { VehicleController } from '../vehicle/VehicleController';
import { VEHICLE_SPECS } from '../vehicle/VehicleSpec';
import { TrafficSystem } from '../systems/TrafficSystem';
import { StoryMission, REGIONAL_JOURNEY } from '../systems/StoryMission';
import { distance } from './math';
import { VehicleView } from '../vehicle/VehicleView';
import { CameraRig } from '../camera/CameraRig';
import { InputController } from '../input/InputController';
import { InteractionSystem } from '../systems/InteractionSystem';
import { CourierMission, COURIER_TARGET } from '../systems/CourierMission';
import { TaxiMission } from '../systems/TaxiMission';
import { defaultSettings, loadProgress, writeProgress } from '../systems/ProgressStore';
import { recoverToRoad } from '../systems/RecoverySystem';
import { createDistrictLayout } from '../world/DistrictLayout';
import { motorPoolBays } from '../world/WorldRoads';
import { RegionalView } from '../world/RegionalView';
import { DistrictView } from '../world/DistrictView';
import { GameUI } from '../ui/GameUI';

/** One owner for simulation, rendering, DOM controls and their lifecycle. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private metrics = new FrameMetrics();
  private scene = new THREE.Scene();
  private player = new PlayerController();
  private fleet = VEHICLE_SPECS.map(spec => new VehicleController(spec));
  private selected = 0;
  private get car(): VehicleController { return this.fleet[this.selected]; }
  private traffic = new TrafficSystem();
  private story = new StoryMission();
  private playerView = new PlayerView();
  private fleetViews = VEHICLE_SPECS.map((spec, i) => new VehicleView(spec, `DL 1C AB ${4092 + i}`));
  private trafficViews = this.traffic.cars.map((car, i) => new VehicleView(car.spec, `DL 2C CD ${1200 + i}`));
  private world: CollisionWorld;
  private district: DistrictView;
  private regional: RegionalView;
  private camera: CameraRig;
  private input: InputController;
  private interaction: InteractionSystem;
  private mission = new CourierMission();
  private taxi = new TaxiMission();
  private saveAvailable = true;
  private saveWritable = true;
  private settings = defaultSettings();
  private ui: GameUI;
  private started = false;
  private paused = false;
  private phone = false;
  private accumulator = 0;
  private uiElapsed = 0;
  private lastTime = performance.now();
  private frameId = 0;
  private abort = new AbortController();

  constructor(private root: HTMLElement) {
    try {
      const loaded = loadProgress(localStorage), saved = loaded.progress;
      this.saveWritable = loaded.writable;
      this.saveAvailable = loaded.writable;
      this.settings = saved.settings;
      this.mission.cash = saved.cash;
      this.mission.state = saved.courierCompleted ? 'completed' : 'available';
      this.taxi = new TaxiMission(saved.rides);
      this.saveProgress();
    } catch { this.saveAvailable = this.saveWritable = false; }
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
    this.renderer.setSize(root.clientWidth, root.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas'; this.renderer.domElement.setAttribute('aria-label', 'NCR Drive 3D district');
    const overlay = document.createElement('div'); overlay.className = 'overlay';
    root.replaceChildren(this.renderer.domElement, overlay);
    const layout = createDistrictLayout(); this.world = new CollisionWorld(layout.solids);
    this.district = new DistrictView(this.scene, layout, mobile);
    this.regional = new RegionalView(this.scene);
    motorPoolBays.forEach((bay,i)=>{this.fleet[i+1].position={x:bay.x,z:bay.z};this.fleet[i+1].yaw=bay.yaw;});
    this.scene.add(this.playerView.group, ...this.fleetViews.map(v => v.group), ...this.trafficViews.map(v => v.group));
    this.camera = new CameraRig(root.clientWidth / root.clientHeight);
    this.interaction = new InteractionSystem(this.player, this.car, this.world, () => this.otherCars());
    this.player.teleport({ x: this.interaction.door.x - 0.45, z: this.interaction.door.z });
    this.input = new InputController(this.renderer.domElement, {
      interact: () => this.interact(), phone: () => this.togglePhone(), pause: () => this.togglePause(),
      rotate: (dx, dy) => this.camera.rotate(dx * this.settings.cameraSensitivity, dy * this.settings.cameraSensitivity, this.car.driving), tap: (x, y) => this.tapCar(x, y),
    });
    this.ui = new GameUI(overlay, this.input, {
      start: () => { this.started = true; this.syncScreen(); }, phone: () => this.togglePhone(),
      pause: () => this.togglePause(), interact: () => this.interact(),
      quality: () => {
        this.settings.performanceMode = !this.settings.performanceMode;
        this.applySettings(); this.saveProgress(); this.refreshUI();
        this.renderer.render(this.scene, this.camera.camera);
      },
      sensitivity: (kind, value) => {
        if (!Number.isFinite(value) || value < 0.5 || value > 1.5) return;
        this.settings[kind] = value; this.applySettings(); this.saveProgress(); this.refreshUI();
      },
      recover: () => this.recover(),
      accept: () => {
        if (!this.taxi.active && !this.story.active && this.mission.accept()) { this.phone = false; this.syncScreen(); this.ui.toast('Parcel collected. Follow DelhiNav and deliver on foot.'); }
      },
      taxi: () => {
        if (this.mission.state !== 'active' && !this.story.active && this.taxi.accept()) { this.phone = false; this.syncScreen(); this.ui.toast('Fare accepted. Stop at the blue pickup marker for 2 seconds.'); }
      },
      journey: () => {
        if (this.taxi.active || this.mission.state === 'active' || this.story.active) return;
        this.story = new StoryMission(REGIONAL_JOURNEY, 720, 2400); this.story.accept(); this.phone=false; this.syncScreen(); this.ui.toast(this.story.step.dialogue);
      },
      regionalTaxi: (noida) => {
        if (this.mission.state === 'active' || this.story.active || !this.taxi.acceptRegional(noida)) return;
        this.phone=false; this.syncScreen(); this.ui.toast('Regional fare accepted. Follow the blue pickup marker.');
      },
      story: () => {
        if (!this.story.active) this.story = new StoryMission();
        if (!this.taxi.active && this.mission.state !== 'active' && this.story.accept()) { this.phone = false; this.syncScreen(); this.ui.toast(this.story.step.dialogue); }
      },
      cancelStory: () => { this.story.cancel(); this.refreshUI(); },
      cancelTaxi: () => { this.taxi.cancel(); this.refreshUI(); this.ui.toast('Fare cancelled. No payment taken.'); },
    });
    this.applySettings(); this.syncScreen(); this.updateViews(1); this.renderer.render(this.scene, this.camera.camera);
    window.addEventListener('resize', this.resize, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.started) { this.paused = true; this.phone = false; this.syncScreen(); }
    }, { signal: this.abort.signal });
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.paused = true; this.syncScreen();
      this.ui.toast('Graphics interrupted. Reload this page to continue.');
    }, { signal: this.abort.signal });
    this.frameId = requestAnimationFrame(this.frame);
  }

  private syncScreen(): void {
    this.input.reset(); this.input.enabled = this.started && !this.paused && !this.phone;
    this.accumulator = 0; this.ui.screen(this.started, this.paused, this.phone); this.refreshUI();
  }
  private applySettings(): void {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.input.steeringSensitivity = this.settings.steeringSensitivity;
    this.renderer.shadowMap.enabled = !this.settings.performanceMode;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.performanceMode ? 0.75 : mobile ? 1.25 : 1.5));
    this.ui.setSettings(this.settings);
  }
  private recover(): void {
    if (!this.started || !this.paused) return;
    if (!recoverToRoad(this.world, this.car, this.player, this.otherCars(), this.mission, this.taxi, this.story)) {
      this.ui.recoveryStatus('No clear recovery space. Resume and move a blocking car, then try again.'); return;
    }
    this.input.reset(); this.input.reverse = false; this.interaction.message = '';
    this.camera.reset(); this.saveProgress(); this.paused = false;
    this.syncScreen(); this.updateViews(1); this.renderer.render(this.scene, this.camera.camera);
    this.ui.toast('Back on a clear road. Recovery is free; active jobs cancelled with no payout.');
  }
  private togglePhone(): void {
    if (!this.started || this.paused) return;
    this.phone = !this.phone; this.syncScreen();
  }
  private togglePause(): void {
    if (!this.started) return;
    if (this.phone) this.phone = false;
    else this.paused = !this.paused;
    this.syncScreen();
  }
  private interact(): void {
    if (!this.input.enabled) return;
    this.selectNearbyCar();
    if (this.interaction.interact()) {
      this.input.reset(); this.input.reverse = false;
      if (this.car.driving) this.camera.enterVehicle();
    }
    this.refreshUI();
  }
  private tapCar(x: number, y: number): void {
    if (this.car.driving || !this.input.enabled) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), this.camera.camera);
    if (ray.intersectObject(this.fleetViews[this.selected].group, true).length) this.interact();
  }
  private refreshUI(): void {
    this.selectNearbyCar();
    const target = this.story.active ? this.story.step.target : this.taxi.active ? this.taxi.target : COURIER_TARGET;
    this.district.delivery.visible = this.story.active || this.taxi.active || this.mission.state === 'active';
    this.district.delivery.position.set(target.x, 0, target.z);
    this.district.setPickup(this.taxi.state === 'pickup');
    this.ui.update(this.player, this.car, this.interaction, this.mission, this.taxi, this.saveAvailable, this.story);
  }
  private updateViews(dt: number): void {
    this.playerView.update(this.player, dt);
    const focus=this.car.driving ? this.car.position : this.player.position;
    this.fleetViews.forEach((view,i)=>{view.group.visible=distance(this.fleet[i].position,focus)<450;if(view.group.visible)view.update(this.fleet[i]);});
    this.trafficViews.forEach((view,i)=>{view.group.visible=distance(this.traffic.cars[i].position,focus)<450;if(view.group.visible)view.update(this.traffic.cars[i]);});
    this.regional.update(this.car.driving ? this.car.position : this.player.position);
    this.district.update(this.car.driving ? this.car.position : this.player.position); this.camera.update(dt, this.player, this.car, this.world);
  }
  private frame = (time: number): void => {
    const frameMs=time-this.lastTime;
    const dt = Math.min(0.1, frameMs / 1000); this.lastTime = time;
    this.frameId = requestAnimationFrame(this.frame);
    // Retain the scene under menus. No GPU work competes with phone scrolling.
    if (!this.started || this.paused || this.phone) return;
    this.metrics.add(frameMs);
    const step = 1 / 120;
    this.accumulator = Math.min(0.1, this.accumulator + dt);
    while (this.accumulator >= step) {
      if (!this.car.driving) this.player.update(step, this.input.foot(), this.camera.yaw, this.world, this.car.collider, this.otherCars());
      this.car.update(step, this.input.drive(), this.world, this.otherCars());
      const pedestrian = { ...this.player.position, width: 0.8, depth: 0.8, height: 1.8, yaw: 0 };
      this.traffic.update(step, this.world, [...this.fleet.map(c => c.collider), ...(!this.car.driving ? [pedestrian] : [])], this.car.driving ? this.car.position : this.player.position);
      const storyEvent = this.story.update(step, this.car.driving ? this.car.position : this.player.position, this.car.driving, this.car.driving ? this.car.kmh : this.player.speed * 3.6);
      if (storyEvent === 'step') this.ui.toast(this.story.step.dialogue);
      if (storyEvent === 'failed') this.ui.toast('Time ran out. Retry Kabir’s Evening Run in DelhiOS.');
      if (storyEvent === 'completed') { this.mission.cash += this.story.reward; this.saveProgress(); this.ui.toast(`Kabir: Delivered. ₹${this.story.reward} added. Delhi Cabs offers the optional Gurgaon → Noida follow-up.`); }

      if (this.mission.update(this.car.driving ? this.car.position : this.player.position, !this.car.driving)) {
        this.saveProgress(); this.ui.toast('Parcel delivered. ₹750 added to your Delhi Wallet.'); this.refreshUI();
      }
      const event = this.taxi.update(step, this.car.position, this.car.driving, this.car.kmh, this.car.impact);
      if (event === 'boarded') { this.ui.toast('Passenger aboard. Follow the gold marker to drop-off.'); this.refreshUI(); }
      if (event === 'delivered') {
        this.mission.cash += this.taxi.lastReward; this.saveProgress();
        this.ui.toast(`Fare complete. ₹${this.taxi.lastReward} earned. Open DelhiOS for your next passenger.`); this.refreshUI();
      }
      this.accumulator -= step;
    }
    this.updateViews(dt); this.renderer.render(this.scene, this.camera.camera);
    this.uiElapsed += dt;
    if (this.uiElapsed > 0.1) { this.uiElapsed = 0; this.refreshUI();
      const frames=this.metrics.percentiles,info=this.renderer.info;
      this.ui.renderStats(`Frame ms p50 ${frames.p50.toFixed(1)} / p95 ${frames.p95.toFixed(1)} · ${info.render.calls} draws · ${info.render.triangles} triangles · ${info.memory.geometries} geometries / ${info.memory.textures} textures`); }
  };
  private otherCars() { return [...this.fleet.filter(c => c !== this.car), ...this.traffic.cars].map(c => c.collider); }
  private selectNearbyCar(): void {
    if (this.car.driving) return;
    let best = this.selected, nearest = Infinity;
    this.fleet.forEach((car, i) => {
      this.interaction.car = car;
      const d = distance(this.player.position, this.interaction.door);
      if (d < nearest) { nearest = d; best = i; }
    });
    this.selected = best; this.interaction.car = this.car;
  }
  private saveProgress(): void {
    if (!this.saveWritable) { this.saveAvailable = false; return; }
    try {
      this.saveAvailable = writeProgress(localStorage, { version: 2, cash: this.mission.cash, rides: this.taxi.completed, courierCompleted: this.mission.state === 'completed', settings: this.settings });
    } catch { this.saveAvailable = false; }
  }
  private resize = (): void => {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.resize(width, height);
    this.renderer.render(this.scene, this.camera.camera);
  };
  dispose(): void {
    cancelAnimationFrame(this.frameId); this.abort.abort(); this.input.dispose(); this.ui.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
      }
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    if (this.scene.environment instanceof THREE.Texture) textures.add(this.scene.environment);
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.district.sun.shadow.map?.dispose(); this.renderer.dispose(); this.root.replaceChildren();
  }
}
