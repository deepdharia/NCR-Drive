import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { CameraView } from '../types';

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  public currentView: CameraView = 'chase';

  private chasePos: THREE.Vector3 = new THREE.Vector3();
  private chaseLookAt: THREE.Vector3 = new THREE.Vector3();
  private currentCameraRoll: number = 0;
  private needsSnap = true;

  public resetTracking() {
    this.needsSnap = true;
    this.currentCameraRoll = 0;
  }

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
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-6 * dt));
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
      this.currentCameraRoll = THREE.MathUtils.lerp(this.currentCameraRoll, targetRoll, 1 - Math.exp(-8 * dt));

      // Dynamic camera distance: pulls back slightly at high speed for high-speed thrill.
      // (QA: default sat too close — the car's rear filled the frame.)
      const dist = 6.6 + speedRatio * 1.1;
      const height = 2.85 + speedRatio * 0.35;

      const idealPos = new THREE.Vector3(
        carPos.x - forwardX * dist,
        carPos.y + height,
        carPos.z - forwardZ * dist
      );

      // Look slightly ahead of the vehicle
      const lookAheadDist = 14.0 + speedRatio * 8.0;
      const idealLook = new THREE.Vector3(
        carPos.x + forwardX * lookAheadDist,
        carPos.y + 1.25,
        carPos.z + forwardZ * lookAheadDist
      );

      if (this.needsSnap) {
        this.chasePos.copy(idealPos);
        this.chaseLookAt.copy(idealLook);
        this.needsSnap = false;
      }

      // Smooth lag interpolation
      const lag = 9.0;
      this.chasePos.lerp(idealPos, 1 - Math.exp(-lag * dt));
      this.chaseLookAt.lerp(idealLook, 1 - Math.exp(-(lag + 4.0) * dt));

      this.camera.position.copy(this.chasePos);
      this.camera.lookAt(this.chaseLookAt);

      // Apply dynamic banking roll
      this.camera.rotation.z += this.currentCameraRoll;
    }
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
