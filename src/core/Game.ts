import * as THREE from 'three';
import { CollisionWorld } from './CollisionWorld';
import { PlayerController } from '../player/PlayerController';
import { PlayerView } from '../player/PlayerView';
import { VehicleController } from '../vehicle/VehicleController';
import { VehicleView } from '../vehicle/VehicleView';
import { CameraRig } from '../camera/CameraRig';
import { InputController } from '../input/InputController';
import { InteractionSystem } from '../systems/InteractionSystem';
import { CourierMission, COURIER_TARGET } from '../systems/CourierMission';
import { TaxiMission } from '../systems/TaxiMission';
import { readProgress, writeProgress } from '../systems/ProgressStore';
import { createDistrictLayout } from '../world/DistrictLayout';
import { DistrictView } from '../world/DistrictView';
import { GameUI } from '../ui/GameUI';

/** One owner for simulation, rendering, DOM controls and their lifecycle. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private player = new PlayerController();
  private car = new VehicleController();
  private playerView = new PlayerView();
  private carView = new VehicleView();
  private world: CollisionWorld;
  private district: DistrictView;
  private camera: CameraRig;
  private input: InputController;
  private interaction: InteractionSystem;
  private mission = new CourierMission();
  private taxi = new TaxiMission();
  private saveAvailable = true;
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
      const saved = readProgress(localStorage);
      this.mission.cash = saved.cash;
      this.mission.state = saved.courierCompleted ? 'completed' : 'available';
      this.taxi = new TaxiMission(saved.rides);
      this.saveProgress();
    } catch { this.saveAvailable = false; }
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
    this.scene.add(this.playerView.group, this.carView.group);
    this.camera = new CameraRig(root.clientWidth / root.clientHeight);
    this.interaction = new InteractionSystem(this.player, this.car, this.world);
    this.player.teleport({ x: this.interaction.door.x - 0.45, z: this.interaction.door.z });
    this.input = new InputController(this.renderer.domElement, {
      interact: () => this.interact(), phone: () => this.togglePhone(), pause: () => this.togglePause(),
      rotate: (dx, dy) => this.camera.rotate(dx, dy, this.car.driving), tap: (x, y) => this.tapCar(x, y),
    });
    this.ui = new GameUI(overlay, this.input, {
      start: () => { this.started = true; this.syncScreen(); }, phone: () => this.togglePhone(),
      pause: () => this.togglePause(), interact: () => this.interact(),
      accept: () => {
        if (!this.taxi.active && this.mission.accept()) { this.phone = false; this.syncScreen(); this.ui.toast('Parcel collected. Follow DelhiNav and deliver on foot.'); }
      },
      taxi: () => {
        if (this.mission.state !== 'active' && this.taxi.accept()) { this.phone = false; this.syncScreen(); this.ui.toast('Fare accepted. Stop at the blue pickup marker for 2 seconds.'); }
      },
      cancelTaxi: () => { this.taxi.cancel(); this.refreshUI(); this.ui.toast('Fare cancelled. No payment taken.'); },
    });
    this.syncScreen(); this.updateViews(1); this.renderer.render(this.scene, this.camera.camera);
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
    if (ray.intersectObject(this.carView.group, true).length) this.interact();
  }
  private refreshUI(): void {
    const target = this.taxi.active ? this.taxi.target : COURIER_TARGET;
    this.district.delivery.visible = this.taxi.active || this.mission.state === 'active';
    this.district.delivery.position.set(target.x, 0, target.z);
    this.district.setPickup(this.taxi.state === 'pickup');
    this.ui.update(this.player, this.car, this.interaction, this.mission, this.taxi, this.saveAvailable);
  }
  private updateViews(dt: number): void {
    this.playerView.update(this.player, dt); this.carView.update(this.car);
    this.district.update(this.car.driving ? this.car.position : this.player.position); this.camera.update(dt, this.player, this.car, this.world);
  }
  private frame = (time: number): void => {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000); this.lastTime = time;
    this.frameId = requestAnimationFrame(this.frame);
    // Retain the scene under menus. No GPU work competes with phone scrolling.
    if (!this.started || this.paused || this.phone) return;
    const step = 1 / 120;
    this.accumulator = Math.min(0.1, this.accumulator + dt);
    while (this.accumulator >= step) {
      if (!this.car.driving) this.player.update(step, this.input.foot(), this.camera.yaw, this.world, this.car.collider);
      this.car.update(step, this.input.drive(), this.world);
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
    if (this.uiElapsed > 0.1) { this.uiElapsed = 0; this.refreshUI(); }
  };
  private saveProgress(): void {
    try {
      this.saveAvailable = writeProgress(localStorage, { version: 1, cash: this.mission.cash, rides: this.taxi.completed, courierCompleted: this.mission.state === 'completed' });
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
