import * as THREE from 'three';
import { AudioEngine } from './audio/AudioEngine';
import { CameraManager } from './camera/CameraManager';
import { CAR_CATALOG, getCarById } from './cars/CarCatalog';
import { CarVisuals, createCarMesh } from './cars/CarMeshGenerator';
import { GAME_CONFIG } from './config';
import { InputManager } from './input/InputManager';
import { MissionManager } from './missions/MissionManager';
import type { MissionDef } from './missions/MissionPacks';
import { VehiclePhysics } from './physics/VehiclePhysics';
import { SaveManager } from './save/SaveManager';
import { TrafficSystem } from './traffic/TrafficSystem';
import { CameraView, GameMode, HUDState, PlayerSaveData, QualityLevel, Weather } from './types';
import { getGroundHeight, getNearestRoadInfo, POINTS_OF_INTEREST } from './world/MapData';
import { WorldBuilder, WorldObjects } from './world/WorldBuilder';

export class GameEngine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public cameraManager: CameraManager;
  public inputManager: InputManager;
  public audioEngine: AudioEngine;
  public missionManager: MissionManager;
  public trafficSystem: TrafficSystem;

  // Active player car
  public physics: VehiclePhysics;
  public carVisuals: CarVisuals;
  private currentCarId: string = 'alto';

  // Environment & Lighting
  private worldObjects: WorldObjects;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyDome: THREE.Mesh;
  private destinationMarker: THREE.Group;
  private rainParticles: THREE.Points | null = null;
  private pmremGenerator: THREE.PMREMGenerator;

  // Loop & timing
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private physicsAccumulator: number = 0;
  private hudTimer: number = 0;
  private fpsCounter: number = 60;
  private frameCount: number = 0;
  private lastFpsCalcTime: number = 0;

  // Cached save data (refreshed on mode start / settings change) — avoids
  // localStorage JSON.parse on every frame.
  private cachedSave: PlayerSaveData;

  // Auto-quality hysteresis state
  private lowFpsStreak: number = 0;
  private highFpsStreak: number = 0;
  private autoQualityTier: 'med' | 'low' = 'med';

  // Garage preview mode
  public isGarageMode: boolean = false;
  private garageRotation: number = 0;

  // FASTag tracking
  private hasPaidToll: boolean = false;
  private tollAlertTimer: number = 0;

  // Landmark discovery (throttled check + toast state)
  private discoveryTimer: number = 0;
  private discoveryToastTimer: number = 0;
  private discoveryToastText: string | null = null;

  // Callbacks to React HUD
  private onHudUpdateCallback?: (hud: HUDState) => void;
  private onMissionEndCallback?: (result: { success: boolean; cashEarned: number; title: string; message: string; stars?: number }) => void;

  constructor(container: HTMLElement) {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. High-Performance WebGLRenderer with Filmic Tonemapping
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.replaceChildren(this.renderer.domElement);

    // 2. Scene Setup with Depth Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xa7c2d9, 0.0013);

    // PMREM Environment Map Generator for Realistic Automotive Clearcoat Reflections
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.setupEnvironmentMap();

    // Procedural Atmospheric Sky Dome with Clouds & Sun Corona
    this.skyDome = this.createSkyDome();
    this.scene.add(this.skyDome);

    // Hemisphere Ambient Bounce (Sky Light + Warm Ground)
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3d2714, 0.95);
    this.scene.add(this.hemiLight);

    // Sunlight with Crisp 2048x2048 Soft Shadow Map
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.dirLight.position.set(75, 120, 75);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 340;
    this.dirLight.shadow.camera.left = -38;
    this.dirLight.shadow.camera.right = 38;
    this.dirLight.shadow.camera.top = 38;
    this.dirLight.shadow.camera.bottom = -38;
    this.dirLight.shadow.bias = -0.00035;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 3. Subsystems
    const savedData = SaveManager.load();
    this.cachedSave = savedData;
    this.cameraManager = new CameraManager(savedData.settings.preferredCamera);
    this.inputManager = new InputManager();
    this.audioEngine = new AudioEngine();
    this.missionManager = new MissionManager();
    this.trafficSystem = new TrafficSystem(savedData.settings.trafficDensity);
    this.trafficSystem.setAudioEngine(this.audioEngine);
    this.scene.add(this.trafficSystem.trafficGroup);

    // 4. City, Highway & World Construction
    this.worldObjects = WorldBuilder.buildWorld();
    this.scene.add(this.worldObjects.group);

    // 5. Player Car Setup
    this.currentCarId = savedData.selectedCarId || 'alto';
    const spec = getCarById(this.currentCarId);
    const carColor = savedData.carColors[this.currentCarId] || spec.defaultColor;
    const upgrades = savedData.carUpgrades[this.currentCarId];

    this.physics = new VehiclePhysics(spec, upgrades, new THREE.Vector3(0, 0.4, -1120), 0);
    this.carVisuals = createCarMesh(spec, carColor);
    this.scene.add(this.carVisuals.group);

    // 6. Floating 3D Destination Marker
    this.destinationMarker = this.createDestinationMarker();
    this.scene.add(this.destinationMarker);

    // 7. Dynamic Weather & Particle Systems
    this.setupEffects(savedData.settings.weather);

    this.inputManager.setCallbacks({
      onHorn: () => this.audioEngine.playHorn(),
      onIndicator: () => this.audioEngine.playIndicatorTick(),
      onCameraToggle: () => this.cycleCamera(),
    });

    window.addEventListener('resize', this.onResize);
  }

  // Generates high-dynamic range sky gradient canvas and bakes PMREM reflections
  private setupEnvironmentMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Rich sky gradient: zenith deep azure -> horizon warm golden haze -> ground dark warm
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0284c7');   // Sky Zenith
    grad.addColorStop(0.45, '#7dd3fc'); // Sky Horizon
    grad.addColorStop(0.5, '#fef08a');  // Delhi Sun Haze
    grad.addColorStop(0.56, '#f59e0b'); // Golden Warmth
    grad.addColorStop(0.66, '#334155'); // Ground Horizon
    grad.addColorStop(1, '#0f172a');    // Deep Road Ground

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Bright sun specular disc
    const sunGrad = ctx.createRadialGradient(256, 120, 2, 256, 120, 48);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.35, '#fef08a');
    sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(256, 120, 48, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = this.pmremGenerator.fromEquirectangular(tex).texture;
    this.scene.environment = envMap;
    tex.dispose();
  }

  private createSkyDome(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(920, 32, 16);
    geo.scale(-1, 1, 1);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich daylight sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0369a1');
    grad.addColorStop(0.55, '#38bdf8');
    grad.addColorStop(0.75, '#fef08a');
    grad.addColorStop(0.85, '#f59e0b');
    grad.addColorStop(1, '#1e293b');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Procedural soft cloud puffs across horizon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    for (let i = 0; i < 28; i++) {
      const cx = (i * 70) % 1024;
      const cy = 200 + (Math.sin(i) * 50);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 80 + Math.sin(i) * 30, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false });
    return new THREE.Mesh(geo, mat);
  }

  private createDestinationMarker(): THREE.Group {
    const group = new THREE.Group();

    // Pulsating neon teal cylinder beacon
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 38, 24, 1, true), cylMat);
    beacon.position.y = 19;
    group.add(beacon);

    // Golden downward pointing arrow
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5.8, 14), arrowMat);
    arrow.rotation.x = Math.PI;
    arrow.position.y = 9.5;
    group.add(arrow);

    group.visible = false;
    return group;
  }

  private setupEffects(weather: Weather) {
    if (weather === 'rain') {
      this.createRainParticles();
    }
  }

  private createRainParticles() {
    if (this.rainParticles) return;
    const rainCount = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 95;
      rainPos[i * 3 + 1] = Math.random() * 50;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 95;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.5,
      transparent: true,
      opacity: 0.75,
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
    this.audioEngine.setRain(true);
  }

  private disposeRainParticles() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      (this.rainParticles.material as THREE.Material).dispose();
      this.rainParticles = null;
    }
  }

  public setCallbacks(callbacks: {
    onHudUpdate?: (hud: HUDState) => void;
    onMissionEnd?: (result: { success: boolean; cashEarned: number; title: string; message: string }) => void;
  }) {
    this.onHudUpdateCallback = callbacks.onHudUpdate;
    this.onMissionEndCallback = callbacks.onMissionEnd;
  }

  public setQuality(quality: QualityLevel) {
    const q = GAME_CONFIG.QUALITY_SETTINGS[quality === 'auto' ? 'med' : quality];
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.trafficSystem.setDensity(quality === 'low' ? 'low' : quality === 'high' ? 'high' : 'medium');
    if (quality === 'auto') {
      // User re-armed auto mode: restart from the med tier.
      this.autoQualityTier = 'med';
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
    }
  }

  /** Re-read save data (settings/cash) into the engine cache. Call after any SettingsModal change. */
  public refreshSettings() {
    this.cachedSave = SaveManager.load();
  }

  public setWeather(weather: Weather) {
    if (weather === 'rain') {
      this.scene.fog = new THREE.FogExp2(0x64748b, 0.0035);
      this.renderer.toneMappingExposure = 1.0;
      this.createRainParticles();
    } else if (weather === 'smog') {
      this.scene.fog = new THREE.FogExp2(0x78716c, 0.0045);
      this.renderer.toneMappingExposure = 1.05;
      this.disposeRainParticles();
      this.audioEngine.setRain(false);
    } else {
      this.scene.fog = new THREE.FogExp2(0xa7c2d9, 0.0013);
      this.renderer.toneMappingExposure = 1.2;
      this.disposeRainParticles();
      this.audioEngine.setRain(false);
    }
  }

  public switchCar(carId: string) {
    const spec = getCarById(carId);
    this.currentCarId = carId;
    const saved = SaveManager.load();
    const color = saved.carColors[carId] || spec.defaultColor;
    const upgrades = saved.carUpgrades[carId];

    this.scene.remove(this.carVisuals.group);
    // Dispose the old car's GPU resources (geometries/materials are per-car).
    this.carVisuals.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    const pos = this.physics.position.clone();
    const heading = this.physics.heading;

    this.physics = new VehiclePhysics(spec, upgrades, pos, heading);
    this.carVisuals = createCarMesh(spec, color);
    this.scene.add(this.carVisuals.group);
  }

  public cycleCamera(): CameraView {
    const newView = this.cameraManager.cycleView();
    const saved = SaveManager.load();
    saved.settings.preferredCamera = newView;
    SaveManager.save(saved);
    return newView;
  }

  public startMode(mode: GameMode, missionId?: string) {
    // Guard: a mission start without an id would silently do nothing — fall back to free drive.
    if (mode === 'mission' && !missionId) {
      mode = 'free_drive';
    }
    this.refreshSettings();
    this.isGarageMode = false;
    this.isPaused = false;
    this.audioEngine.init();
    this.audioEngine.resume();

    if (mode === 'free_drive') {
      this.missionManager.startFreeDrive();
      this.physics.reset(new THREE.Vector3(0, 0.4, -1120), 0);
      this.destinationMarker.visible = false;
    } else if (mode === 'taxi') {
      const job = this.missionManager.startTaxiJob();
      this.physics.reset(new THREE.Vector3(job.pickupLocation[0] - 4, 0.4, job.pickupLocation[2] - 35), 0);
      this.destinationMarker.position.set(job.pickupLocation[0], 0, job.pickupLocation[2]);
      this.destinationMarker.visible = true;
    } else if (mode === 'mission' && missionId) {
      const m = this.missionManager.startMission(missionId);
      this.physics.reset(new THREE.Vector3(...m.startPos), m.startHeading);
      // Phase-2 mission packs can force weather (e.g. the night-rain taxi dash).
      const missionWeather = (m as MissionDef).weather;
      if (missionWeather) this.setWeather(missionWeather);
      this.destinationMarker.position.set(m.targetPos[0], 0, m.targetPos[2]);
      this.destinationMarker.visible = true;
    }

    if (!this.isRunning) {
      this.startLoop();
    }
  }

  public enterGarage() {
    this.isGarageMode = true;
    this.isPaused = false;
    this.refreshSettings();
    this.destinationMarker.visible = false;
    this.physics.position.set(0, 0.4, 0);
    this.physics.heading = 0;
    this.physics.velocity.set(0, 0, 0);

    if (!this.isRunning) {
      this.startLoop();
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public resetCarToRoad() {
    const roadInfo = getNearestRoadInfo(this.physics.position.x, this.physics.position.z);
    this.physics.reset(
      new THREE.Vector3(roadInfo.nearestWaypoint.x - 3.6, roadInfo.nearestWaypoint.y + 0.4, roadInfo.nearestWaypoint.z),
      0
    );
  }

  public startLoop() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastFpsCalcTime = performance.now();
    requestAnimationFrame(this.renderLoop);
  }

  private renderLoop = (time: number) => {
    if (!this.isRunning) return;

    const frameDelta = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.frameCount++;
    if (time - this.lastFpsCalcTime >= 1000) {
      this.fpsCounter = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCalcTime = time;

      // Auto quality with hysteresis: downgrade only after 3 consecutive slow
      // seconds, and step back up after 10 good seconds — never ratchets down
      // permanently on a single hitch.
      if (this.cachedSave.settings.quality === 'auto') {
        if (this.fpsCounter < 45) {
          this.lowFpsStreak++;
          this.highFpsStreak = 0;
        } else if (this.fpsCounter > 55) {
          this.highFpsStreak++;
          this.lowFpsStreak = 0;
        } else {
          this.lowFpsStreak = 0;
          this.highFpsStreak = 0;
        }

        if (this.lowFpsStreak >= 3 && this.autoQualityTier !== 'low') {
          this.setQuality('low');
          this.autoQualityTier = 'low';
          this.lowFpsStreak = 0;
        } else if (this.highFpsStreak >= 10 && this.autoQualityTier === 'low') {
          this.setQuality('med');
          this.autoQualityTier = 'med';
          this.highFpsStreak = 0;
        }
      }
    }

    if (!this.isPaused) {
      if (this.isGarageMode) {
        this.updateGarage(frameDelta);
      } else {
        this.updateSimulation(frameDelta);
      }
    }

    this.renderer.render(this.scene, this.cameraManager.camera);
    requestAnimationFrame(this.renderLoop);
  };

  private updateGarage(dt: number) {
    this.garageRotation += 0.45 * dt;

    const radius = 6.4;
    const cx = Math.sin(this.garageRotation) * radius;
    const cz = Math.cos(this.garageRotation) * radius;
    this.cameraManager.camera.position.set(cx, 1.8, cz);
    this.cameraManager.camera.lookAt(0, 0.75, 0);

    this.carVisuals.group.position.set(0, 0.35, 0);
    this.carVisuals.group.rotation.set(0, 0, 0);
    this.carVisuals.update(0, 0, false, false, false, false, true, 0.15, 0, 0);
  }

  private updateSimulation(frameDelta: number) {
    const clampedDt = Math.min(frameDelta, 0.08);

    this.inputManager.update(this.physics.speedKmh);

    // 120 Hz Fixed Timestep Physics
    const fixedDt = GAME_CONFIG.PHYSICS_STEP;
    this.physicsAccumulator += clampedDt;
    let substeps = 0;

    const isRaining = this.cachedSave.settings.weather === 'rain';

    while (this.physicsAccumulator >= fixedDt && substeps < GAME_CONFIG.MAX_SUB_STEPS) {
      this.physics.update(fixedDt, this.inputManager.state, getGroundHeight, isRaining);
      this.physicsAccumulator -= fixedDt;
      substeps++;
    }

    // Update Car 3D Transform
    this.carVisuals.group.position.copy(this.physics.position);
    this.carVisuals.group.rotation.set(0, 0, 0);
    this.carVisuals.group.rotation.y = this.physics.heading;
    this.carVisuals.group.rotation.x = this.physics.pitch;
    this.carVisuals.group.rotation.z = this.physics.roll;

    const isBraking = this.inputManager.state.brake > 0;
    const isReversing = this.physics.gearMode === 'R';
    const rpmRatio = this.physics.rpm / GAME_CONFIG.REDLINE_RPM;
    const speedRatio = this.physics.speedKmh / this.physics.spec.topSpeedKmH;

    this.carVisuals.update(
      this.physics.steerAngle,
      this.physics.velocity.length() * clampedDt,
      isBraking,
      isReversing,
      this.inputManager.state.leftBlinker,
      this.inputManager.state.rightBlinker,
      this.inputManager.state.headlights,
      rpmRatio,
      speedRatio,
      this.physics.damagePct
    );

    // Shadow light tracks car
    this.dirLight.position.set(
      this.physics.position.x + 55,
      this.physics.position.y + 90,
      this.physics.position.z + 55
    );
    this.dirLight.target.position.copy(this.physics.position);

    // Sky dome follows camera position
    this.skyDome.position.copy(this.physics.position);

    // Traffic AI
    const trafficResult = this.trafficSystem.update(clampedDt, this.physics.position, this.physics.velocity);
    if (trafficResult.collided && trafficResult.hitVehicle) {
      const hitNormal = new THREE.Vector3()
        .subVectors(this.physics.position, trafficResult.hitVehicle.position)
        .normalize();
      this.physics.applyCollisionImpulse(hitNormal, trafficResult.hitVehicle.mass, trafficResult.hitSpeed);
      this.missionManager.onCollision();
      this.audioEngine.playCollisionThud(trafficResult.hitSpeed / 50);
    }

    // World animation (Metro train, Toll barriers)
    this.worldObjects.update(clampedDt, this.physics.position.z);

    // FASTag Toll check (Z: 150)
    const distToToll = Math.abs(this.physics.position.z - 150);
    if (distToToll < 14 && !this.hasPaidToll && Math.abs(this.physics.position.x) < 20) {
      this.hasPaidToll = true;
      this.tollAlertTimer = 3.5;
      this.audioEngine.playFastagBeep();
      // spendCash already clamps: returns false and deducts nothing when balance < 75,
      // so cash can never go negative here.
      if (SaveManager.spendCash(75)) {
        this.cachedSave.cash -= 75;
      }
    } else if (distToToll > 45) {
      this.hasPaidToll = false;
    }

    if (this.tollAlertTimer > 0) {
      this.tollAlertTimer -= clampedDt;
    }

    // Landmark discovery: throttled to ~1 check/second (never per frame).
    this.discoveryTimer += clampedDt;
    if (this.discoveryTimer >= 1.0) {
      this.discoveryTimer = 0;
      this.checkLandmarkDiscovery();
    }
    if (this.discoveryToastTimer > 0) {
      this.discoveryToastTimer -= clampedDt;
    }

    // Mission Progression
    const missionStatus = this.missionManager.update(
      clampedDt,
      this.physics.position,
      this.physics.speedKmh,
      this.physics.gearMode,
      this.inputManager.state.brake,
      getNearestRoadInfo(this.physics.position.x, this.physics.position.z).speedLimit,
      this.physics.fuelRemaining
    );

    if (missionStatus.completed && this.missionManager.completionResult) {
      const res = this.missionManager.completionResult;
      this.cachedSave.cash = SaveManager.addCash(res.cashEarned);
      this.onMissionEndCallback?.({
        success: true,
        cashEarned: res.cashEarned,
        title: res.title,
        message: res.message,
        stars: res.stars,
      });
      this.destinationMarker.visible = false;
    } else if (missionStatus.failed) {
      this.onMissionEndCallback?.({
        success: false,
        cashEarned: 0,
        title: 'Mission Failed',
        message: this.missionManager.failReason,
      });
      this.destinationMarker.visible = false;
    }

    // Checkpoint missions: keep the beacon glued to the active checkpoint.
    if (this.destinationMarker.visible && this.missionManager.currentMode === 'mission') {
      const mt = this.missionManager.getMissionTarget();
      if (mt) this.destinationMarker.position.set(mt[0], 0.4, mt[2]);
    }

    // Destination beacon animation
    if (this.destinationMarker.visible) {
      this.destinationMarker.rotation.y += 1.8 * clampedDt;
      const s = 1.0 + Math.sin(performance.now() * 0.005) * 0.15;
      this.destinationMarker.scale.set(s, 1.0, s);
    }

    // Camera update with banking roll
    this.cameraManager.update(
      clampedDt,
      this.physics.position,
      this.physics.heading,
      this.physics.pitch,
      this.physics.roll,
      this.physics.speedKmh,
      this.carVisuals.cockpitAnchor,
      this.carVisuals.hoodAnchor
    );

    // Engine Audio
    this.audioEngine.updateEngine(
      this.physics.rpm,
      this.inputManager.state.throttle,
      this.physics.speedKmh,
      this.physics.isDrifting,
      this.physics.spec.isDiesel
    );

    // Push HUD Update at 15 Hz
    this.hudTimer += clampedDt * 1000;
    if (this.hudTimer >= GAME_CONFIG.HUD_UPDATE_INTERVAL_MS) {
      this.hudTimer = 0;
      this.dispatchHud();
    }
  }

  /**
   * Landmark discovery: first visit to a POI grants a cash bonus and a toast.
   * Horizontal (x/z) distance only — driving under the Dhaula Kuan flyover
   * still counts as visiting the landmark. One discovery per check tick.
   */
  private checkLandmarkDiscovery() {
    const data = SaveManager.load();
    const discovered = data.discoveredPOIs ?? [];
    for (const poi of POINTS_OF_INTEREST) {
      if (discovered.includes(poi.id)) continue;
      const dx = this.physics.position.x - poi.position[0];
      const dz = this.physics.position.z - poi.position[2];
      const radius = poi.discoveryRadius ?? 25;
      if (dx * dx + dz * dz <= radius * radius) {
        const bonus = poi.discoveryBonus ?? 150;
        data.discoveredPOIs = [...discovered, poi.id];
        data.cash += bonus;
        SaveManager.save(data);
        // Re-sync the engine's cached save so the HUD cash updates instantly.
        this.cachedSave = data;
        const label = this.cachedSave.settings.hindiLabels ? poi.hindiName : poi.name;
        this.discoveryToastText = `📍 Discovered: ${label}! +₹${bonus}`;
        this.discoveryToastTimer = 3.5;
        break;
      }
    }
  }

  private dispatchHud() {
    if (!this.onHudUpdateCallback) return;

    const roadInfo = getNearestRoadInfo(this.physics.position.x, this.physics.position.z);
    const saved = this.cachedSave;

    let targetDist = 0;
    let gpsTargetName: string | undefined = undefined;

    if (this.missionManager.currentMode === 'taxi' && this.missionManager.currentTaxiJob) {
      const job = this.missionManager.currentTaxiJob;
      const targetPos = job.isPickedUp ? job.dropLocation : job.pickupLocation;
      const dx = this.physics.position.x - targetPos[0];
      const dz = this.physics.position.z - targetPos[2];
      targetDist = Math.round(Math.sqrt(dx * dx + dz * dz));
      gpsTargetName = job.isPickedUp ? job.dropName : job.pickupName;
      this.destinationMarker.position.set(targetPos[0], 0, targetPos[2]);
      this.destinationMarker.visible = true;
    } else if (this.missionManager.currentMode === 'mission' && this.missionManager.currentMission) {
      const m = this.missionManager.currentMission;
      const dx = this.physics.position.x - m.targetPos[0];
      const dz = this.physics.position.z - m.targetPos[2];
      targetDist = Math.round(Math.sqrt(dx * dx + dz * dz));
      gpsTargetName = m.title;
    }

    const isOverSpeed = this.physics.speedKmh > (roadInfo.speedLimit + 5);

    const hudState: HUDState = {
      speedKmH: Math.round(this.physics.speedKmh),
      rpm: Math.round(this.physics.rpm),
      maxRpm: GAME_CONFIG.REDLINE_RPM,
      gear: this.physics.gearMode,
      fuelPct: Math.round((this.physics.fuelRemaining / this.physics.spec.fuelTankCapacity) * 100),
      damagePct: Math.round(this.physics.damagePct * 100),
      cash: saved.cash,
      fps: this.fpsCounter,
      speedLimit: roadInfo.speedLimit,
      isOverSpeed,
      leftBlinker: this.inputManager.state.leftBlinker,
      rightBlinker: this.inputManager.state.rightBlinker,
      headlights: this.inputManager.state.headlights,
      currentStreet: roadInfo.streetName,
      currentZone: roadInfo.zone,
      activeJob: this.missionManager.currentMode === 'taxi' && !!this.missionManager.currentTaxiJob,
      passengerName: this.missionManager.currentTaxiJob?.passengerName,
      passengerQuote: this.missionManager.currentTaxiJob?.quote,
      passengerSatisfaction: this.missionManager.currentTaxiJob?.satisfaction,
      missionTitle: this.missionManager.currentMission?.title,
      missionObjective: this.missionManager.currentMission?.description,
      missionTimeLeft: Math.max(0, Math.ceil(this.missionManager.timeLeftSec)),
      targetDistanceMeters: targetDist,
      // Live fare meter when available (P1-D adds MissionManager.getLiveFare);
      // falls back to the job's base fare so the HUD never shows a stale 0.
      fareAmount:
        (this.missionManager as unknown as { getLiveFare?: () => number }).getLiveFare?.() ??
        this.missionManager.currentTaxiJob?.baseFare,
      fastagNotification: this.tollAlertTimer > 0 ? 'FASTag Paid: ₹75 (Kherki Daula Toll)' : null,
      notificationMessage: this.discoveryToastTimer > 0 ? this.discoveryToastText : null,
      hasGpsTarget: this.destinationMarker.visible,
      gpsTargetName,
    };

    this.onHudUpdateCallback(hudState);
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraManager.resize(w, h);
  };

  public destroy() {
    this.isRunning = false;
    window.removeEventListener('resize', this.onResize);
    this.audioEngine.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
  }
}
