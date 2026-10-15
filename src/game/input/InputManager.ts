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

  private touchMove = { x: 0, z: 0 };
  private jumpRequested = false;
  private onInteractCallback?: () => void;
  private onPhoneCallback?: () => void;
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
    onInteract?: () => void;
    onPhone?: () => void;
    onPause?: () => void;
    onHorn?: () => void;
    onIndicator?: () => void;
    onCameraToggle?: () => void;
  }) {
    this.onInteractCallback = callbacks.onInteract;
    this.onPhoneCallback = callbacks.onPhone;
    this.onPauseCallback = callbacks.onPause;
    this.onHornCallback = callbacks.onHorn;
    this.onIndicatorCallback = callbacks.onIndicator;
    this.onCameraToggleCallback = callbacks.onCameraToggle;
  }

  private setupKeyboard() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetInputs);
  }

  private onKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scrolling on arrow keys or space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }

      this.keys[e.code] = true;

      if (e.repeat) return;
      if (e.code === 'KeyF') this.onInteractCallback?.();
      if (e.code === 'Tab') this.onPhoneCallback?.();
      if (e.code === 'Space') this.jumpRequested = true;
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

  public resetInputs = () => {
    this.keys = {};
    this.touchMove = { x: 0, z: 0 };
    this.jumpRequested = false;
    this.touchThrottleVal = this.touchBrakeVal = this.touchSteerVal = 0;
    this.touchHandbrakeVal = false;
    this.state.throttle = this.state.brake = this.state.steer = 0;
    this.state.handbrake = this.state.horn = false;
  };

  public dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.resetInputs);
    this.resetInputs();
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

    if (keyUp && !keyDown) {
      if (this.state.gear === 'R' && currentSpeedKmh >= 1.5) targetBrake = 1;
      else { this.state.gear = 'D'; targetThrottle = 1; }
    } else if (keyDown && !keyUp) {
      if (this.state.gear !== 'R' && currentSpeedKmh >= 1.5) targetBrake = 1;
      else { this.state.gear = 'R'; targetThrottle = 1; }
    }

    // Merge Keyboard + Touch (highest priority wins)
    this.state.throttle = Math.max(targetThrottle, this.touchThrottleVal);
    this.state.brake = Math.max(targetBrake, this.touchBrakeVal);

    // Steering
    let keySteer = 0;
    if (keyLeft && !keyRight) keySteer = -1.0;
    else if (keyRight && !keyLeft) keySteer = 1.0;

    this.state.steer = Math.abs(keySteer) > 0 ? keySteer : this.touchSteerVal;

    // Handbrake
    this.state.handbrake = Boolean(keySpace || this.touchHandbrakeVal);
  }

  public setJoystick(x: number, z: number): void {
    const length = Math.max(1, Math.hypot(x, z));
    this.touchMove = { x: x / length, z: z / length };
    this.setTouchSteer(this.touchMove.x);
  }

  public requestJump(): void { this.jumpRequested = true; }

  public characterInput() {
    const x = Number(!!(this.keys.KeyD || this.keys.ArrowRight)) - Number(!!(this.keys.KeyA || this.keys.ArrowLeft));
    const z = Number(!!(this.keys.KeyS || this.keys.ArrowDown)) - Number(!!(this.keys.KeyW || this.keys.ArrowUp));
    const jump = this.jumpRequested; this.jumpRequested = false;
    return { x: x || this.touchMove.x, z: z || this.touchMove.z,
      sprint: !!(this.keys.ShiftLeft || this.keys.ShiftRight), jump };
  }

  public setTouchThrottle(val: number) {
    this.touchThrottleVal = val;
    this.state.throttle = val;
    if (val > 0 && this.state.gear === 'P') {
      this.state.gear = 'D';
    }
  }

  public setTouchBrake(val: number) {
    this.touchBrakeVal = val;
    this.state.brake = val;
  }

  public setTouchSteer(val: number) {
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
