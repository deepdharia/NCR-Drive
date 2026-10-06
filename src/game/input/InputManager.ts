import { Gear, InputState } from '../types';

export class InputManager {
  public state: InputState = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    gear: 'D',
    horn: false,
    leftBlinker: false,
    rightBlinker: false,
    headlights: false,
    cameraToggle: false,
    resetCar: false,
  };

  private resetListeners = new Set<() => void>();

  public subscribeReset(listener: () => void) {
    this.resetListeners.add(listener);
    return () => { this.resetListeners.delete(listener); };
  }

  private keys: Record<string, boolean> = {};
  private touchThrottleVal: number = 0;
  private touchBrakeVal: number = 0;
  private touchSteerVal: number = 0;
  private touchHandbrakeVal: boolean = false;

  private onPauseCallback?: () => void;
  private onHornCallback?: () => void;
  private onIndicatorCallback?: () => void;
  private onCameraToggleCallback?: () => void;

  constructor() {
    this.setupKeyboard();
  }

  public setCallbacks(callbacks: {
    onPause?: () => void;
    onHorn?: () => void;
    onIndicator?: () => void;
    onCameraToggle?: () => void;
  }) {
    this.onPauseCallback = callbacks.onPause;
    this.onHornCallback = callbacks.onHorn;
    this.onIndicatorCallback = callbacks.onIndicator;
    this.onCameraToggleCallback = callbacks.onCameraToggle;
  }

  private setupKeyboard() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetHeldInputs);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.resetHeldInputs();
  };

  private onKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scrolling on arrow keys or space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      this.keys[e.code] = true;

      if (e.repeat) return;
      if (e.code === 'KeyH') {
        this.state.horn = true;
        this.onHornCallback?.();
      }
      if (e.code === 'KeyC') {
        this.onCameraToggleCallback?.();
      }
      if (e.code === 'KeyL') {
        this.state.headlights = !this.state.headlights;
      }
      if (e.code === 'KeyQ') {
        this.state.leftBlinker = !this.state.leftBlinker;
        this.state.rightBlinker = false;
        this.onIndicatorCallback?.();
      }
      if (e.code === 'KeyE') {
        this.state.rightBlinker = !this.state.rightBlinker;
        this.state.leftBlinker = false;
        this.onIndicatorCallback?.();
      }
      if (e.code === 'Escape') {
        this.onPauseCallback?.();
      }
      if (e.code === 'KeyR') {
        this.state.gear = this.state.gear === 'R' ? 'D' : 'R';
      }
      if (e.code === 'KeyP') {
        this.state.gear = this.state.gear === 'P' ? 'D' : 'P';
      }
  };

  private onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyH') {
        this.state.horn = false;
      }
  };

  public resetHeldInputs = () => {
    this.keys = {};
    this.touchThrottleVal = this.touchBrakeVal = this.touchSteerVal = 0;
    this.touchHandbrakeVal = false;
    this.state.throttle = this.state.brake = this.state.steer = 0;
    this.state.handbrake = this.state.horn = false;
    this.resetListeners.forEach((listener) => listener());
  };

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.resetHeldInputs);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resetHeldInputs();
    this.resetListeners.clear();
  }

  public update(currentSpeedKmh: number = 0) {
    const keyUp = this.keys['KeyW'] || this.keys['ArrowUp'];
    const keyDown = this.keys['KeyS'] || this.keys['ArrowDown'];
    const keyLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
    const keyRight = this.keys['KeyD'] || this.keys['ArrowRight'];
    const keySpace = this.keys['Space'];

    // Desktop Throttle & Brake
    let targetThrottle = 0;
    let targetBrake = 0;

    if (keyUp) {
      if (this.state.gear === 'R' && currentSpeedKmh >= 1.5) {
        targetBrake = 1;
      } else {
        if (this.state.gear === 'P' || this.state.gear === 'R') this.state.gear = 'D';
        targetThrottle = 1;
      }
    }

    if (keyDown) {
      if (this.state.gear === 'R') {
        targetThrottle = 1.0;
      } else if (currentSpeedKmh < 1.5 && !keyUp) {
        // Auto-reverse when stopped and holding S/Down
        this.state.gear = 'R';
        targetThrottle = 1.0;
      } else {
        targetBrake = 1.0;
      }
    }

    // Merge Keyboard + Touch (highest priority wins)
    this.state.throttle = Math.max(targetThrottle, this.touchThrottleVal);
    this.state.brake = Math.max(targetBrake, this.touchBrakeVal);
    // Brake override: a held accelerator cannot fight the brake pedal.
    if (this.state.brake > 0) this.state.throttle = 0;

    // Steering
    let keySteer = 0;
    if (keyLeft && !keyRight) keySteer = -1.0;
    else if (keyRight && !keyLeft) keySteer = 1.0;

    this.state.steer = Math.abs(keySteer) > 0 ? keySteer : this.touchSteerVal;

    // Handbrake
    this.state.handbrake = Boolean(keySpace || this.touchHandbrakeVal);
  }

  public setTouchThrottle(val: number) {
    val = Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0;
    this.touchThrottleVal = val;
    this.state.throttle = val;
    if (val > 0 && this.state.gear === 'P') {
      this.state.gear = 'D';
    }
  }

  public setTouchBrake(val: number) {
    val = Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0;
    this.touchBrakeVal = val;
    this.state.brake = val;
  }

  public setTouchSteer(val: number) {
    val = Number.isFinite(val) ? Math.max(-1, Math.min(1, val)) : 0;
    this.touchSteerVal = val;
    this.state.steer = val;
  }

  public setTouchHandbrake(active: boolean) {
    this.touchHandbrakeVal = active;
    this.state.handbrake = active;
  }

  public cycleGear() {
    const gears: Gear[] = ['P', 'R', 'N', 'D'];
    const idx = gears.indexOf(this.state.gear);
    this.state.gear = gears[(idx + 1) % gears.length];
  }

  public setGear(g: Gear) {
    this.state.gear = g;
  }

  public triggerHorn() {
    this.state.horn = true;
    this.onHornCallback?.();
    setTimeout(() => {
      this.state.horn = false;
    }, 350);
  }

  public toggleLeftBlinker() {
    this.state.leftBlinker = !this.state.leftBlinker;
    this.state.rightBlinker = false;
    this.onIndicatorCallback?.();
  }

  public toggleRightBlinker() {
    this.state.rightBlinker = !this.state.rightBlinker;
    this.state.leftBlinker = false;
    this.onIndicatorCallback?.();
  }

  public toggleCamera() {
    this.onCameraToggleCallback?.();
  }

  public toggleHeadlights() {
    this.state.headlights = !this.state.headlights;
  }
}
