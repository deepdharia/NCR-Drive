import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { CameraView } from '../types';

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  public currentView: CameraView = 'chase';

  private chaseOrbitAngle = 0;
  public orbitWasDragged = false;
  public orbitYaw = -Math.PI / 2;
  public orbitPitch = 0.3;
  private orbitTarget = new THREE.Vector3();
  private orbitInitialized = false;
  private detachOrbit?: () => void;
  private chasePos: THREE.Vector3 = new THREE.Vector3();
  private chaseLookAt: THREE.Vector3 = new THREE.Vector3();
  private currentCameraRoll: number = 0;

  constructor(preferredView: CameraView = 'chase') {
    this.currentView = preferredView;
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA_CHASE_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );
  }

  public setView(view: CameraView) {
    this.currentView = view;
  }

  public cycleView(): CameraView {
    const views: CameraView[] = ['chase', 'cockpit', 'hood'];
    const idx = views.indexOf(this.currentView);
    this.currentView = views[(idx + 1) % views.length];
    return this.currentView;
  }

  public update(
    dt: number,
    carPos: THREE.Vector3,
    carHeading: number,
    carPitch: number,
    carRoll: number,
    speedKmh: number,
    cockpitAnchor?: THREE.Object3D,
    hoodAnchor?: THREE.Object3D
  ) {
    // Dynamic FOV widening at speed
    const speedRatio = Math.min(1.0, speedKmh / 160.0);
    const baseFov = this.currentView === 'cockpit' ? 68 : 62;
    const targetFov = baseFov + speedRatio * 14;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6 * dt);
    this.camera.updateProjectionMatrix();

    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);

    if (this.currentView === 'cockpit' && cockpitAnchor) {
      // Driver seat eye view (Right-Hand Drive position)
      const worldPos = new THREE.Vector3();
      cockpitAnchor.getWorldPosition(worldPos);

      // Subtle engine vibration at idle/high speed
      const vibration = Math.sin(performance.now() * 0.04) * (0.003 + speedRatio * 0.006);
      worldPos.y += carPitch * 0.12 + vibration;
      this.camera.position.copy(worldPos);

      const lookTarget = worldPos.clone().add(new THREE.Vector3(forwardX * 35, carPitch * 4, forwardZ * 35));
      this.camera.lookAt(lookTarget);

      // Slight head roll when cornering
      this.camera.rotation.z = -carRoll * 0.4;

    } else if (this.currentView === 'hood' && hoodAnchor) {
      const worldPos = new THREE.Vector3();
      hoodAnchor.getWorldPosition(worldPos);
      this.camera.position.copy(worldPos);

      const lookTarget = worldPos.clone().add(new THREE.Vector3(forwardX * 45, carPitch * 4, forwardZ * 45));
      this.camera.lookAt(lookTarget);

    } else {
      // Commercial Simulation Chase Camera (like Taxi Sim / Gran Turismo)
      // Slight camera banking into turns
      const targetRoll = -carRoll * 0.35;
      this.currentCameraRoll = THREE.MathUtils.lerp(this.currentCameraRoll, targetRoll, 8 * dt);

      // Dynamic camera distance: pulls back slightly at high speed for high-speed thrill.
      // (QA: default sat too close — the car's rear filled the frame.)
      const dist = 6.6 + speedRatio * 1.1;
      const height = 2.35 + speedRatio * 0.3;

      const idealPos = new THREE.Vector3(
        carPos.x - Math.sin(carHeading + this.chaseOrbitAngle) * dist,
        carPos.y + height,
        carPos.z - Math.cos(carHeading + this.chaseOrbitAngle) * dist
      );

      // Look slightly ahead of the vehicle
      const lookAheadDist = Math.abs(this.chaseOrbitAngle) > 0.02 ? 0 : 14.0 + speedRatio * 8.0;
      const idealLook = new THREE.Vector3(
        carPos.x + forwardX * lookAheadDist,
        carPos.y + 1.25,
        carPos.z + forwardZ * lookAheadDist
      );

      // Smooth lag interpolation
      const lag = 9.0;
      this.chasePos.lerp(idealPos, Math.min(1.0, lag * dt));
      this.chaseLookAt.lerp(idealLook, Math.min(1.0, (lag + 4.0) * dt));

      this.camera.position.copy(this.chasePos);
      this.camera.lookAt(this.chaseLookAt);

      // Apply dynamic banking roll
      this.camera.rotation.z += this.currentCameraRoll;
    }
  }

  public bindOrbit(element: HTMLElement, enabled: () => boolean, driving: () => boolean): void {
    let pointer: number | null = null;
    let x = 0, y = 0, travel = 0;
    element.style.touchAction = 'none';
    const down = (event: PointerEvent) => {
      if (!enabled() || pointer !== null || event.button !== 0) return;
      this.orbitWasDragged = false; travel = 0;
      pointer = event.pointerId; x = event.clientX; y = event.clientY;
      element.setPointerCapture(pointer);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      travel += Math.hypot(event.clientX - x, event.clientY - y);
      this.orbitWasDragged = travel > 6;
      if (enabled()) {
        if (driving()) this.chaseOrbitAngle -= (event.clientX - x) * 0.006;
        else this.orbitYaw -= (event.clientX - x) * 0.006;
        this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + (event.clientY - y) * 0.006, -0.15, 1.05);
      }
      x = event.clientX; y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      pointer = null;
    };
    const blur = () => { pointer = null; };
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', blur); window.addEventListener('blur', blur);
    this.detachOrbit = () => {
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', blur); window.removeEventListener('blur', blur);
    };
  }

  public resetFollow(): void { this.orbitInitialized = false; }

  public updateOnFoot(dt: number, feet: THREE.Vector3, obstacles?: THREE.Object3D): void {
    const target = feet.clone().add(new THREE.Vector3(0, 1.35, 0));
    if (!this.orbitInitialized) { this.orbitTarget.copy(target); this.orbitInitialized = true; }
    this.orbitTarget.lerp(target, 1 - Math.exp(-14 * dt));
    const offset = new THREE.Vector3(Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch), Math.sin(this.orbitPitch), Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch));
    let distance = 5.2;
    if (obstacles) {
      const ray = new THREE.Raycaster(this.orbitTarget, offset, 0, distance);
      const hits = ray.intersectObject(obstacles, true);
      const hit = hits.find(h => !h.object.userData.noCollision);
      if (hit) distance = Math.max(0.5, hit.distance - 0.2);
    }
    this.camera.position.copy(this.orbitTarget).addScaledVector(offset, distance);
    this.camera.lookAt(this.orbitTarget);
    this.camera.fov = 65; this.camera.updateProjectionMatrix();
  }

  public snapChase(car: THREE.Vector3, heading: number): void {
    this.chaseOrbitAngle = 0;
    this.chasePos.set(car.x - Math.sin(heading) * 6.6, car.y + 2.35, car.z - Math.cos(heading) * 6.6);
    this.chaseLookAt.set(car.x + Math.sin(heading) * 14, car.y + 1.25, car.z + Math.cos(heading) * 14);
  }

  public dispose(): void { this.detachOrbit?.(); }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
