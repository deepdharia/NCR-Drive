import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { CarSpecs, CarUpgrades, Gear, InputState } from '../types';

export interface GroundHeightResult {
  height: number;
  normal: THREE.Vector3;
  surfaceType: 'asphalt_dry' | 'asphalt_wet' | 'dirt_shoulder' | 'speed_breaker';
}

export type GroundHeightFn = (x: number, z: number) => GroundHeightResult;

export class VehiclePhysics {
  public spec: CarSpecs;
  public upgrades: CarUpgrades;

  // Position, kinematics and orientation
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public heading: number = 0; // Yaw angle in radians (0 = facing +Z)
  public angularVelocity: number = 0; // Yaw rate rad/s
  public pitch: number = 0; // Dive under braking / squat
  public roll: number = 0; // Body roll in corners
  public pitchVel: number = 0;
  public rollVel: number = 0;

  // Speed and powertrain states
  public speedKmh: number = 0;
  public forwardSpeed: number = 0;
  public rpm: number = GAME_CONFIG.IDLE_RPM;
  public currentGear: number = 1; // 1..5 for D
  public gearMode: Gear = 'D';
  public steerAngle: number = 0;
  public handbrakeEngaged: boolean = false;
  public isDrifting: boolean = false;
  public damagePct: number = 0;
  public fuelRemaining: number = 35; // Litres

  // Wheel states
  public wheelSuspensionLengths: number[] = [0.38, 0.38, 0.38, 0.38];
  public isGrounded: boolean = true;

  // Visual/collision bounds
  public readonly halfWidth: number;
  public readonly halfLength: number;

  constructor(spec: CarSpecs, upgrades?: CarUpgrades, initialPos?: THREE.Vector3, initialHeading: number = 0) {
    this.spec = spec;
    this.upgrades = upgrades || { engine: 0, brakes: 0, suspension: 0, tyres: 0, tank: 0 };
    if (initialPos) this.position.copy(initialPos);
    this.heading = initialHeading;
    this.fuelRemaining = spec.fuelTankCapacity * (1 + this.upgrades.tank * 0.15);

    this.halfWidth = (spec.track + 0.32) / 2;
    this.halfLength = (spec.wheelbase + 1.6) / 2;
  }

  public reset(pos: THREE.Vector3, heading: number = 0) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.angularVelocity = 0;
    this.pitch = 0;
    this.roll = 0;
    this.pitchVel = 0;
    this.rollVel = 0;
    this.speedKmh = 0;
    this.forwardSpeed = 0;
    this.rpm = GAME_CONFIG.IDLE_RPM;
    this.currentGear = 1;
    this.gearMode = 'D';
    this.steerAngle = 0;
  }

  public repair() {
    this.damagePct = 0;
  }

  public refuel() {
    this.fuelRemaining = this.spec.fuelTankCapacity * (1 + this.upgrades.tank * 0.15);
  }

  public update(dt: number, input: InputState, getGround: GroundHeightFn, isRaining: boolean = false) {
    if (dt <= 0 || isNaN(dt)) return;
    dt = Math.min(dt, 0.05);

    this.gearMode = input.gear;

    // Upgrades
    const engineMult = 1 + this.upgrades.engine * 0.16;
    const brakeMult = 1 + this.upgrades.brakes * 0.20;
    const tyreMult = 1 + this.upgrades.tyres * 0.18;
    const performanceFactor = Math.max(0.45, 1.0 - this.damagePct * 0.45);

    // Forward and Lateral unit vectors in world space
    // heading = 0 means facing +Z, right is +X
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    // Current forward & lateral speeds
    this.forwardSpeed = this.velocity.x * forwardX + this.velocity.z * forwardZ;
    const lateralSpeed = this.velocity.x * rightX + this.velocity.z * rightZ;
    this.speedKmh = Math.abs(this.forwardSpeed) * 3.6;

    // 1. Natural & Responsive Steering
    // Speed-sensitive steering: high speeds reduce max steering angle smoothly
    const speedRatio = Math.min(1.0, this.speedKmh / 160.0);
    const maxSteer = THREE.MathUtils.lerp(
      0.62, // ~35.5 degrees at low speed
      0.14, // ~8 degrees at top speed: calmer motorway steering
      speedRatio
    );

    // input.steer: -1 (left), +1 (right)
    const targetSteer = input.steer * maxSteer * (1 - this.damagePct * 0.15);
    // Steering rack response: deliberate at speed, quicker while parking, with natural self-centering.
    const steerSpeed = input.steer === 0
      ? THREE.MathUtils.lerp(10.0, 16.0, speedRatio)
      : THREE.MathUtils.lerp(10.5, 6.5, speedRatio);
    const steerBlend = 1 - Math.exp(-steerSpeed * dt);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, steerBlend);

    // 2. Ground & Suspension Raycasting
    const halfWb = this.spec.wheelbase / 2;
    const halfTr = this.spec.track / 2;

    const wheelOffsets = [
      { x: -halfTr, z: halfWb },
      { x: halfTr, z: halfWb },
      { x: -halfTr, z: -halfWb },
      { x: halfTr, z: -halfWb },
    ];

    let totalGroundHeight = 0;
    let surfaceGripTotal = 0;
    const restLen = GAME_CONFIG.SPRING_REST_LENGTH;

    for (let i = 0; i < 4; i++) {
      const off = wheelOffsets[i];
      const wx = this.position.x + off.x * rightX + off.z * forwardX;
      const wz = this.position.z + off.x * rightZ + off.z * forwardZ;

      const gResult = getGround(wx, wz);
      totalGroundHeight += gResult.height;

      let surfaceGrip = GAME_CONFIG.SURFACE_GRIP[gResult.surfaceType] || 1.0;
      if (isRaining && gResult.surfaceType === 'asphalt_dry') {
        surfaceGrip = GAME_CONFIG.SURFACE_GRIP.asphalt_wet;
      }
      surfaceGripTotal += surfaceGrip;

      const distToGround = this.position.y - gResult.height;
      this.wheelSuspensionLengths[i] = THREE.MathUtils.clamp(distToGround, 0.05, restLen * 1.5);
    }

    const avgGroundY = totalGroundHeight / 4;
    const avgSurfaceGrip = (surfaceGripTotal / 4) * this.spec.tyreGrip * tyreMult;

    // Firm ground contact
    const targetY = avgGroundY + restLen * 0.6;
    this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, 22.0 * dt);

    // 3. Engine & Powertrain
    this.handbrakeEngaged = input.handbrake;

    if (this.fuelRemaining <= 0) {
      input.throttle = 0;
    } else if (input.throttle > 0) {
      // Fuel burn scales with throttle and speed: a full tank lasts ~1-2h of mixed driving
      this.fuelRemaining = Math.max(0, this.fuelRemaining - 0.004 * (0.3 + 0.7 * input.throttle) * (0.5 + Math.abs(this.forwardSpeed) / 45) * dt);
    }

    const wheelRadius = this.spec.wheelRadiusM ?? 0.32;
    const baseTorque = this.spec.torqueNm * engineMult * performanceFactor;
    let tractionForce = 0;

    if (this.gearMode === 'D') {
      const speed = Math.abs(this.forwardSpeed);
      if (speed < 11) this.currentGear = 1;
      else if (speed < 20) this.currentGear = 2;
      else if (speed < 30) this.currentGear = 3;
      else if (speed < 42) this.currentGear = 4;
      else this.currentGear = 5;

      const gearRatio = GAME_CONFIG.GEAR_RATIOS[this.currentGear - 1] || 1.0;
      const roadRpm = (speed / (wheelRadius * 2 * Math.PI)) * 60 * gearRatio * GAME_CONFIG.FINAL_DRIVE;
      const throttleRpmBoost = input.throttle * 2800;
      const targetRpm = Math.max(GAME_CONFIG.IDLE_RPM + throttleRpmBoost, roadRpm);
      this.rpm = THREE.MathUtils.lerp(this.rpm, targetRpm, 15.0 * dt);

      let rpmTorqueFactor = 1.0;
      if (this.spec.isDiesel) {
        rpmTorqueFactor = 0.95 + 0.35 * Math.sin(Math.min(1, this.rpm / 3200) * Math.PI);
      } else {
        rpmTorqueFactor = 0.85 + 0.35 * (this.rpm / GAME_CONFIG.REDLINE_RPM);
      }

      const launchBoost = speed < 9 ? (1.5 - (speed / 9) * 0.5) : 1.0;
      const driveTorque = baseTorque * rpmTorqueFactor * gearRatio * (GAME_CONFIG.FINAL_DRIVE * 0.88) * launchBoost;
      tractionForce = input.throttle * (driveTorque / wheelRadius);

    } else if (this.gearMode === 'R') {
      this.currentGear = 1;
      const gearRatio = GAME_CONFIG.REVERSE_RATIO;
      const speed = Math.abs(this.forwardSpeed);
      const roadRpm = (speed / (wheelRadius * 2 * Math.PI)) * 60 * gearRatio * GAME_CONFIG.FINAL_DRIVE;
      const throttleRpmBoost = input.throttle * 2500;
      this.rpm = THREE.MathUtils.lerp(this.rpm, Math.max(GAME_CONFIG.IDLE_RPM + throttleRpmBoost, roadRpm), 15.0 * dt);

      const driveTorque = baseTorque * 0.92 * gearRatio * (GAME_CONFIG.FINAL_DRIVE * 0.88);
      tractionForce = -input.throttle * (driveTorque / wheelRadius);
      // Reverse is speed-capped: no 150 km/h backing-up
      if (this.forwardSpeed < -12) tractionForce = Math.max(0, tractionForce);

    } else {
      // Park or Neutral
      const throttleRpmBoost = input.throttle * 4200;
      this.rpm = THREE.MathUtils.lerp(this.rpm, GAME_CONFIG.IDLE_RPM + throttleRpmBoost, 12.0 * dt);
      tractionForce = 0;
    }

    this.rpm = THREE.MathUtils.clamp(this.rpm, GAME_CONFIG.IDLE_RPM, GAME_CONFIG.REDLINE_RPM);

    // Soft top-speed limiter: the catalog's rated top speed is real, not display fiction
    if (this.speedKmh > this.spec.topSpeedKmH) {
      tractionForce *= Math.max(0, 1 - (this.speedKmh - this.spec.topSpeedKmH) / 25);
    }

    // 4. Braking & Longitudinal Forces
    let brakeForceTotal = 0;
    if (input.brake > 0) {
      const maxBrake = this.spec.brakeForce * brakeMult * 1.35;
      // Progressive pedal curve gives fine low-pressure control and strong braking near full press.
      const brakePressure = 0.18 * input.brake + 0.82 * input.brake * input.brake;
      brakeForceTotal = brakePressure * maxBrake * (this.forwardSpeed > 0 ? 1 : -1);
      // Grip-limited braking: wet/dirt surfaces mean longer stopping distances
      brakeForceTotal *= (0.55 + 0.45 * avgSurfaceGrip);
    }

    // Engine braking when off throttle
    if (input.throttle === 0 && Math.abs(this.forwardSpeed) > 0.5) {
      tractionForce -= Math.sign(this.forwardSpeed) * (this.spec.mass * 0.4);
    }

    // Aerodynamic Drag & Rolling Resistance
    const aeroDrag = 0.5 * 1.2 * this.spec.dragCoeff * 2.1 * this.forwardSpeed * Math.abs(this.forwardSpeed);
    const rollingResistance = GAME_CONFIG.ROLLING_RESISTANCE_COEFF * this.spec.mass * GAME_CONFIG.GRAVITY * (Math.abs(this.forwardSpeed) > 0.1 ? Math.sign(this.forwardSpeed) : 0);

    const netLongitudinalForce = tractionForce - brakeForceTotal - aeroDrag - rollingResistance;
    const forwardAcc = netLongitudinalForce / this.spec.mass;

    // 5. TRUE BICYCLE & ACKERMANN STEERING (Zero Inverse Bug!)
    // When steerAngle > 0 (Right), yaw rate MUST be POSITIVE.
    // When steerAngle < 0 (Left), yaw rate MUST be NEGATIVE.
    const effectiveWheelbase = this.spec.wheelbase;
    // Kinematic Ackermann target yaw rate
    const kinematicYawRate = (this.forwardSpeed / effectiveWheelbase) * Math.tan(this.steerAngle);
    // Yaw rate clamp: full lock at very high speed must not instantly spin the car
    const clampedYawRate = THREE.MathUtils.clamp(kinematicYawRate, -1.4 * avgSurfaceGrip, 1.4 * avgSurfaceGrip);
    // Per-car handling character: >1 nimble (hatchbacks), <1 boaty (heavy SUVs)
    const agility = this.spec.agility ?? 1.0;

    if (this.handbrakeEngaged && Math.abs(this.forwardSpeed) > 5.0) {
      // Handbrake drift: allows high yaw velocity and rear slip
      this.isDrifting = true;
      const driftBoost = 1.6;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, kinematicYawRate * driftBoost, 10.0 * dt);
    } else {
      this.isDrifting = false;
      // High-precision smooth yaw tracking: turns naturally and crisply
      const yawResponsiveness = 18.0 * avgSurfaceGrip * agility;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, clampedYawRate, yawResponsiveness * dt);
    }

    // Update vehicle heading
    this.heading += this.angularVelocity * dt;

    // Integrate forward and lateral velocities
    const newForwardSpeed = this.forwardSpeed + forwardAcc * dt;
    // Lateral drift dampening (tyres grip road firmly unless drifting)
    const lateralDamp = this.isDrifting ? 4.0 : 22.0 * avgSurfaceGrip * agility;
    const newLateralSpeed = lateralSpeed * Math.exp(-lateralDamp * dt);

    // Stop completely when braked to a halt
    if (Math.abs(newForwardSpeed) < 0.25 && input.throttle === 0 && (input.brake > 0 || this.gearMode === 'P')) {
      this.velocity.set(0, 0, 0);
      this.forwardSpeed = 0;
    } else {
      // Reconstitute velocity vector in world coordinates from updated heading
      const updatedForwardX = Math.sin(this.heading);
      const updatedForwardZ = Math.cos(this.heading);
      const updatedRightX = Math.cos(this.heading);
      const updatedRightZ = -Math.sin(this.heading);

      this.velocity.x = newForwardSpeed * updatedForwardX + newLateralSpeed * updatedRightX;
      this.velocity.z = newForwardSpeed * updatedForwardZ + newLateralSpeed * updatedRightZ;
      this.forwardSpeed = newForwardSpeed;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Dynamic Body Weight Transfer (Pitch dive & Roll lean)
    const targetPitch = (-forwardAcc / GAME_CONFIG.GRAVITY) * GAME_CONFIG.WEIGHT_TRANSFER_PITCH;
    const lateralG = (this.forwardSpeed * this.angularVelocity) / GAME_CONFIG.GRAVITY;
    const targetRoll = lateralG * GAME_CONFIG.WEIGHT_TRANSFER_ROLL * (this.spec.comHeight / 0.42);

    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, 14 * dt);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, 12 * dt);

    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.22, 0.22);
    this.roll = THREE.MathUtils.clamp(this.roll, -0.26, 0.26);

    // Guard against NaN
    if (isNaN(this.position.x) || isNaN(this.position.z)) {
      this.position.set(0, 0.4, -1120);
      this.velocity.set(0, 0, 0);
    }
  }

  public applyCollisionImpulse(hitNormal: THREE.Vector3, otherMass: number, impactSpeed: number) {
    const restitution = 0.35;
    const massRatio = otherMass / (this.spec.mass + otherMass);
    const impulse = impactSpeed * (1 + restitution) * massRatio * 0.9;

    this.velocity.addScaledVector(hitNormal, impulse);
    this.damagePct = THREE.MathUtils.clamp(this.damagePct + (impactSpeed / 100.0) * 0.22, 0, 1.0);
  }
}
