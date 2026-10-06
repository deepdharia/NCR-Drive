import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BodyType, CarSpecs } from '../types';

export interface CarVisuals {
  group: THREE.Group;
  steerWheels: THREE.Group[];
  allWheels: THREE.Group[];
  steeringWheelMesh: THREE.Object3D;
  speedoNeedle?: THREE.Object3D;
  rpmNeedle?: THREE.Object3D;
  paintMaterial: THREE.MeshPhysicalMaterial;
  headlightMaterials: THREE.MeshStandardMaterial[];
  brakeLightMaterials: THREE.MeshStandardMaterial[];
  leftBlinkerMaterials: THREE.MeshStandardMaterial[];
  rightBlinkerMaterials: THREE.MeshStandardMaterial[];
  headlightBeams: THREE.Mesh[];
  headlightSpotLeft?: THREE.SpotLight;
  headlightSpotRight?: THREE.SpotLight;
  cockpitAnchor: THREE.Object3D;
  hoodAnchor: THREE.Object3D;
  chaseAnchor: THREE.Object3D;
  update(
    steerAngle: number,
    speedDelta: number,
    isBraking: boolean,
    isReversing: boolean,
    leftBlink: boolean,
    rightBlink: boolean,
    headlightsOn: boolean,
    rpmRatio: number,
    speedRatio: number,
    damagePct: number
  ): void;
  setPaintColor(hex: string): void;
}

// Procedural contact shadow with smooth radial falloff
let contactShadowCache: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowCache) return contactShadowCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 230);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
  grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.75)');
  grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  contactShadowCache = tex;
  return tex;
}

// Procedural Honeycomb Grille Texture
let grilleTextureCache: THREE.CanvasTexture | null = null;
function getGrilleTexture(): THREE.CanvasTexture {
  if (grilleTextureCache) return grilleTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = '#272a33';
  ctx.lineWidth = 2.5;

  const hexSize = 12;
  for (let y = 0; y < 128; y += hexSize * 1.5) {
    for (let x = 0; x < 256; x += hexSize * Math.sqrt(3)) {
      const offsetX = (Math.floor(y / (hexSize * 1.5)) % 2 === 0) ? 0 : (hexSize * Math.sqrt(3)) / 2;
      ctx.strokeRect(x + offsetX, y, hexSize, hexSize);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  grilleTextureCache = tex;
  return tex;
}

// Procedural GPS screen texture for dashboard
function getGpsScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 160);

  // Map roads
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(40, 160);
  ctx.lineTo(80, 80);
  ctx.lineTo(160, 40);
  ctx.lineTo(240, 20);
  ctx.stroke();

  // Active route
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(128, 160);
  ctx.lineTo(128, 70);
  ctx.lineTo(180, 30);
  ctx.stroke();

  // Route arrow
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(128, 120);
  ctx.lineTo(138, 140);
  ctx.lineTo(118, 140);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Chakra Petch", sans-serif';
  ctx.fillText('NCR GPS • NH-48', 16, 26);

  return new THREE.CanvasTexture(canvas);
}

export function createCarMesh(spec: CarSpecs, customColor?: string): CarVisuals {
  const group = new THREE.Group();
  group.name = `car_${spec.id}`;

  const primaryColor = new THREE.Color(customColor || spec.defaultColor);

  // High-End Clearcoat Car Paint (MeshPhysicalMaterial with clearcoat reflection)
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.72,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.95,
  });

  const blackPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.85,
    metalness: 0.15,
  });

  const chromeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.98,
    roughness: 0.08,
  });

  const tintedGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.0,
    transparent: true,
    opacity: 0.88,
    ior: 1.52,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    roughness: 0.1,
    metalness: 0.9,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x450a0a,
    roughness: 0.25,
  });

  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    roughness: 0.3,
  });

  const leftBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0x000000,
    roughness: 0.3,
  });

  const rightBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0x000000,
    roughness: 0.3,
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.92,
    metalness: 0.08,
  });

  const wb = spec.wheelbase;
  const track = spec.track;
  const carLength = wb + 1.62;
  const carWidth = track + 0.34;
  let carHeight = 1.46;
  let groundClearance = 0.22;
  let wheelRadius = 0.32;
  let wheelWidth = 0.22;

  if (spec.bodyType === 'boxy_suv' || spec.bodyType === 'large_suv') {
    carHeight = 1.86;
    groundClearance = 0.30;
    wheelRadius = 0.38;
    wheelWidth = 0.26;
  } else if (spec.bodyType === 'compact_suv' || spec.bodyType === 'micro_suv') {
    carHeight = 1.66;
    groundClearance = 0.26;
    wheelRadius = 0.35;
    wheelWidth = 0.24;
  } else if (spec.bodyType === 'mpv') {
    carHeight = 1.76;
    groundClearance = 0.25;
    wheelRadius = 0.35;
    wheelWidth = 0.24;
  }

  // 1. Soft Realistic Contact Shadow beneath vehicle
  const shadowGeo = new THREE.PlaneGeometry(carWidth * 1.38, carLength * 1.28);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.035;
  group.add(contactShadow);

  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // 2. Sculpted Lower Body with Flared Wheel Arches
  const lowerHeight = carHeight * 0.44;
  const lowerGeo = new RoundedBoxGeometry(carWidth, lowerHeight, carLength, 3, 0.15);
  const lowerMesh = new THREE.Mesh(lowerGeo, paintMaterial);
  lowerMesh.position.y = groundClearance + lowerHeight / 2;
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  bodyGroup.add(lowerMesh);

  // Wheel Arch Protective Claddings
  const archMat = (spec.bodyType === 'compact_suv' || spec.bodyType === 'boxy_suv' || spec.bodyType === 'micro_suv' || spec.bodyType === 'large_suv')
    ? blackPlasticMat
    : paintMaterial;

  for (const sx of [-carWidth / 2 - 0.03, carWidth / 2 + 0.03]) {
    for (const sz of [-wb / 2, wb / 2]) {
      const archMesh = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius * 1.15, 0.045, 8, 16, Math.PI),
        archMat
      );
      archMesh.position.set(sx, wheelRadius + 0.05, sz);
      archMesh.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      bodyGroup.add(archMesh);
    }
  }

  // Aerodynamic Front Bumper with Fog Lamps & Air Dam
  const frontBumper = new THREE.Mesh(
    new RoundedBoxGeometry(carWidth + 0.04, lowerHeight * 0.58, 0.42, 2, 0.1),
    blackPlasticMat
  );
  frontBumper.position.set(0, groundClearance + lowerHeight * 0.28, carLength / 2 + 0.14);
  frontBumper.castShadow = true;
  bodyGroup.add(frontBumper);

  // Honeycomb Front Radiator Grille
  const grilleMat = new THREE.MeshStandardMaterial({
    map: getGrilleTexture(),
    roughness: 0.6,
    metalness: 0.4,
  });
  const frontGrille = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.58, lowerHeight * 0.36, 0.08),
    grilleMat
  );
  frontGrille.position.set(0, groundClearance + lowerHeight * 0.48, carLength / 2 + 0.32);
  bodyGroup.add(frontGrille);

  // Chrome Grille Outline / Badge Strip
  const chromeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.62, 0.04, 0.1),
    chromeTrimMat
  );
  chromeStrip.position.set(0, groundClearance + lowerHeight * 0.68, carLength / 2 + 0.33);
  bodyGroup.add(chromeStrip);

  // Sculpted Hood with Power Bulge
  const hoodLength = carLength * 0.3;
  const hoodMesh = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.94, 0.08, hoodLength),
    paintMaterial
  );
  hoodMesh.position.set(0, groundClearance + lowerHeight + 0.03, carLength / 2 - hoodLength / 2);
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Rear Sculpted Bumper & Diffuser with Dual Exhausts
  const rearBumper = new THREE.Mesh(
    new RoundedBoxGeometry(carWidth + 0.04, lowerHeight * 0.58, 0.4, 2, 0.1),
    blackPlasticMat
  );
  rearBumper.position.set(0, groundClearance + lowerHeight * 0.28, -carLength / 2 - 0.14);
  rearBumper.castShadow = true;
  bodyGroup.add(rearBumper);

  // Dual Chrome Exhaust Tips
  for (const exSide of [-carWidth * 0.32, carWidth * 0.32]) {
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12),
      chromeTrimMat
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(exSide, groundClearance + 0.12, -carLength / 2 - 0.28);
    bodyGroup.add(exhaust);
  }

  // 3. Tapered Greenhouse / Cabin & Pillars
  let cabinLength = carLength * 0.52;
  let cabinZOffset = -carLength * 0.06;
  const cabinWidth = carWidth * 0.88;
  const cabinHeight = carHeight - lowerHeight - groundClearance;

  if (spec.bodyType === 'sedan') {
    cabinLength = carLength * 0.46;
    cabinZOffset = 0.05;
  } else if (spec.bodyType === 'mpv' || spec.bodyType === 'large_suv') {
    cabinLength = carLength * 0.62;
    cabinZOffset = -0.15;
  }

  const cabinMesh = new THREE.Mesh(
    new RoundedBoxGeometry(cabinWidth, cabinHeight, cabinLength, 3, 0.12),
    paintMaterial
  );
  const cabinPositions = cabinMesh.geometry.attributes.position;
  for (let i = 0; i < cabinPositions.count; i++) {
    const t = Math.max(0, Math.min(1, (cabinPositions.getY(i) + cabinHeight / 2) / cabinHeight));
    cabinPositions.setX(i, cabinPositions.getX(i) * (1 - t * .09));
    cabinPositions.setZ(i, cabinPositions.getZ(i) * (1 - t * .23));
  }
  cabinMesh.geometry.computeVertexNormals();
  cabinMesh.position.set(0, groundClearance + lowerHeight + cabinHeight / 2, cabinZOffset);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  // Raked Windshield & Glass Windows
  const windshieldAngle = spec.bodyType === 'boxy_suv' ? 0.22 : 0.42;
  const windshieldW = cabinWidth * 0.94;
  const windshieldH = cabinHeight * 0.88;

  // Front Windshield
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(windshieldW, windshieldH), tintedGlassMat);
  frontGlass.position.set(0, groundClearance + lowerHeight + cabinHeight / 2, cabinZOffset + cabinLength / 2 + 0.035);
  frontGlass.rotation.x = -windshieldAngle;
  bodyGroup.add(frontGlass);

  // Rear Windshield
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(windshieldW, windshieldH * 0.86), tintedGlassMat);
  rearGlass.position.set(0, groundClearance + lowerHeight + cabinHeight / 2, cabinZOffset - cabinLength / 2 - 0.035);
  rearGlass.rotation.x = windshieldAngle;
  rearGlass.rotation.y = Math.PI;
  bodyGroup.add(rearGlass);

  // Left & Right Side Windows with Pillars
  const sideGlassGeo = new THREE.PlaneGeometry(cabinLength * 0.86, cabinHeight * 0.68);
  const leftGlass = new THREE.Mesh(sideGlassGeo, tintedGlassMat);
  leftGlass.rotation.y = -Math.PI / 2;
  leftGlass.position.set(-cabinWidth / 2 - 0.025, groundClearance + lowerHeight + cabinHeight * 0.55, cabinZOffset);
  bodyGroup.add(leftGlass);

  const rightGlass = new THREE.Mesh(sideGlassGeo, tintedGlassMat);
  rightGlass.rotation.y = Math.PI / 2;
  rightGlass.position.set(cabinWidth / 2 + 0.025, groundClearance + lowerHeight + cabinHeight * 0.55, cabinZOffset);
  bodyGroup.add(rightGlass);

  // Sleek Aerodynamic Side Mirrors
  for (const mSide of [-1, 1]) {
    const mirrorStem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), blackPlasticMat);
    mirrorStem.position.set(mSide * (cabinWidth / 2 + 0.06), groundClearance + lowerHeight + cabinHeight * 0.38, cabinZOffset + cabinLength * 0.4);
    bodyGroup.add(mirrorStem);

    const mirrorCap = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.14, 0.1, 2, 0.04), paintMaterial);
    mirrorCap.position.set(mSide * (cabinWidth / 2 + 0.18), groundClearance + lowerHeight + cabinHeight * 0.4, cabinZOffset + cabinLength * 0.4);
    bodyGroup.add(mirrorCap);

    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.11), chromeTrimMat);
    mirrorGlass.rotation.y = mSide > 0 ? -Math.PI / 2 + 0.2 : Math.PI / 2 - 0.2;
    mirrorGlass.position.set(mSide * (cabinWidth / 2 + 0.18 - mSide * 0.05), groundClearance + lowerHeight + cabinHeight * 0.4, cabinZOffset + cabinLength * 0.4);
    bodyGroup.add(mirrorGlass);
  }

  // Taxi Signboard if taxi
  if (spec.id === 'dzire_taxi') {
    const taxiSignMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.2,
      roughness: 0.25,
    });
    const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.68, 0.18, 0.42), taxiSignMat);
    taxiSign.position.set(0, groundClearance + lowerHeight + cabinHeight + 0.11, cabinZOffset);
    bodyGroup.add(taxiSign);
  }

  // 4. Projector Headlights with Chrome Housing & DRL Light Strips
  const hlGeo = new THREE.BoxGeometry(carWidth * 0.24, lowerHeight * 0.34, 0.1);
  const leftHeadlight = new THREE.Mesh(hlGeo, headlightMat);
  leftHeadlight.position.set(-carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.18);
  bodyGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(hlGeo, headlightMat);
  rightHeadlight.position.set(carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.18);
  bodyGroup.add(rightHeadlight);

  // Volumetric Headlight Light Cones (transparent additive glow projecting forward)
  const beamGeo = new THREE.ConeGeometry(3.5, 32, 16, 1, true);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0, 16);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfffaed,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const leftBeam = new THREE.Mesh(beamGeo, beamMat);
  leftBeam.position.set(-carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.2);
  group.add(leftBeam);

  const rightBeam = new THREE.Mesh(beamGeo, beamMat);
  rightBeam.position.set(carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.2);
  group.add(rightBeam);

  // Real Three.js Spotlights for asphalt illumination
  const headlightSpotLeft = new THREE.SpotLight(0xfff7ed, 0, 75, Math.PI / 5.5, 0.35, 1.1);
  headlightSpotLeft.position.set(-carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.25);
  const spotTargetLeft = new THREE.Object3D();
  spotTargetLeft.position.set(-carWidth * 0.36, 0, carLength / 2 + 45);
  group.add(spotTargetLeft);
  headlightSpotLeft.target = spotTargetLeft;
  group.add(headlightSpotLeft);

  const headlightSpotRight = new THREE.SpotLight(0xfff7ed, 0, 75, Math.PI / 5.5, 0.35, 1.1);
  headlightSpotRight.position.set(carWidth * 0.36, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.25);
  const spotTargetRight = new THREE.Object3D();
  spotTargetRight.position.set(carWidth * 0.36, 0, carLength / 2 + 45);
  group.add(spotTargetRight);
  headlightSpotRight.target = spotTargetRight;
  group.add(headlightSpotRight);

  // Front Amber Indicators
  const blinkerGeo = new THREE.BoxGeometry(carWidth * 0.08, lowerHeight * 0.22, 0.1);
  const frontLeftBlinker = new THREE.Mesh(blinkerGeo, leftBlinkerMat);
  frontLeftBlinker.position.set(-carWidth * 0.46, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.16);
  bodyGroup.add(frontLeftBlinker);

  const frontRightBlinker = new THREE.Mesh(blinkerGeo, rightBlinkerMat);
  frontRightBlinker.position.set(carWidth * 0.46, groundClearance + lowerHeight * 0.72, carLength / 2 + 0.16);
  bodyGroup.add(frontRightBlinker);

  // Modern LED Tail Light Lightbars
  const tailLightGeo = new THREE.BoxGeometry(carWidth * 0.22, lowerHeight * 0.36, 0.1);
  const leftBrakeLight = new THREE.Mesh(tailLightGeo, brakeLightMat);
  leftBrakeLight.position.set(-carWidth * 0.36, groundClearance + lowerHeight * 0.72, -carLength / 2 - 0.16);
  bodyGroup.add(leftBrakeLight);

  const rightBrakeLight = new THREE.Mesh(tailLightGeo, brakeLightMat);
  rightBrakeLight.position.set(carWidth * 0.36, groundClearance + lowerHeight * 0.72, -carLength / 2 - 0.16);
  bodyGroup.add(rightBrakeLight);

  // Connecting LED center lightbar across trunk
  const centerLightbar = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.48, 0.04, 0.08),
    brakeLightMat
  );
  centerLightbar.position.set(0, groundClearance + lowerHeight * 0.8, -carLength / 2 - 0.17);
  bodyGroup.add(centerLightbar);

  // Rear Indicators
  const rearLeftBlinker = new THREE.Mesh(blinkerGeo, leftBlinkerMat);
  rearLeftBlinker.position.set(-carWidth * 0.46, groundClearance + lowerHeight * 0.72, -carLength / 2 - 0.15);
  bodyGroup.add(rearLeftBlinker);

  const rearRightBlinker = new THREE.Mesh(blinkerGeo, rightBlinkerMat);
  rearRightBlinker.position.set(carWidth * 0.46, groundClearance + lowerHeight * 0.72, -carLength / 2 - 0.15);
  bodyGroup.add(rearRightBlinker);

  // High-contrast Indian Number Plates
  const plateGeo = new THREE.BoxGeometry(0.58, 0.15, 0.04);
  const plateMat = new THREE.MeshStandardMaterial({
    color: spec.id === 'dzire_taxi' ? 0xf59e0b : 0xf8fafc,
    roughness: 0.3,
  });
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(0, groundClearance + lowerHeight * 0.3, carLength / 2 + 0.36);
  bodyGroup.add(frontPlate);

  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(0, groundClearance + lowerHeight * 0.35, -carLength / 2 - 0.36);
  bodyGroup.add(rearPlate);

  // 5. Detailed RHD Interior: Dashboard with Gauges & Center GPS Screen
  const driverSeatX = cabinWidth * 0.24;
  const passengerSeatX = -cabinWidth * 0.24;
  const driverEyeY = groundClearance + lowerHeight + cabinHeight * 0.68;
  const driverEyeZ = cabinZOffset + cabinLength * 0.05;

  // Main Dashboard
  const dashMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.94, 0.3, 0.48), interiorMat);
  dashMesh.position.set(0, groundClearance + lowerHeight + cabinHeight * 0.32, cabinZOffset + cabinLength * 0.38);
  bodyGroup.add(dashMesh);

  // Center Infotainment Touchscreen GPS Display
  const gpsMat = new THREE.MeshBasicMaterial({ map: getGpsScreenTexture() });
  const gpsScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), gpsMat);
  gpsScreen.position.set(0, groundClearance + lowerHeight + cabinHeight * 0.42, cabinZOffset + cabinLength * 0.38 + 0.24);
  gpsScreen.rotation.x = -Math.PI / 12;
  bodyGroup.add(gpsScreen);

  // RHD Driver Bucket Seat & Passenger Seat
  const seatGeo = new THREE.BoxGeometry(cabinWidth * 0.38, 0.6, 0.46);
  const rightDriverSeat = new THREE.Mesh(seatGeo, interiorMat);
  rightDriverSeat.position.set(driverSeatX, groundClearance + lowerHeight + 0.3, driverEyeZ - 0.15);
  bodyGroup.add(rightDriverSeat);

  const leftPassengerSeat = new THREE.Mesh(seatGeo, interiorMat);
  leftPassengerSeat.position.set(passengerSeatX, groundClearance + lowerHeight + 0.3, driverEyeZ - 0.15);
  bodyGroup.add(leftPassengerSeat);

  // RHD Sport Steering Wheel on the Right
  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.position.set(
    driverSeatX,
    groundClearance + lowerHeight + cabinHeight * 0.44,
    cabinZOffset + cabinLength * 0.28
  );
  steeringWheelGroup.rotation.x = -Math.PI / 7;

  // Wheel rim with grip contours
  const wheelTorus = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 12, 32), blackPlasticMat);
  steeringWheelGroup.add(wheelTorus);

  // 3-Spoke Chrome Accented Hub
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.025), chromeTrimMat);
  steeringWheelGroup.add(spoke);
  const centerBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), blackPlasticMat);
  centerBoss.rotation.x = Math.PI / 2;
  steeringWheelGroup.add(centerBoss);
  bodyGroup.add(steeringWheelGroup);

  // Camera Anchors
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(driverSeatX, driverEyeY, driverEyeZ);
  group.add(cockpitAnchor);

  const hoodAnchor = new THREE.Object3D();
  hoodAnchor.position.set(0, groundClearance + lowerHeight + 0.26, carLength * 0.38);
  group.add(hoodAnchor);

  const chaseAnchor = new THREE.Object3D();
  chaseAnchor.position.set(0, groundClearance + carHeight + 1.2, -carLength * 0.95);
  group.add(chaseAnchor);

  // 6. High-Precision Alloy Wheels, Brake Discs & Calipers
  const allWheels: THREE.Group[] = [];
  const steerWheels: THREE.Group[] = [];

  const halfTrack = track / 2;
  const halfWb = wb / 2;

  const wheelPositions = [
    { x: -halfTrack, z: halfWb, isFront: true },
    { x: halfTrack, z: halfWb, isFront: true },
    { x: -halfTrack, z: -halfWb, isFront: false },
    { x: halfTrack, z: -halfWb, isFront: false },
  ];

  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 28);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.9,
    metalness: 0.1,
  });

  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.7, wheelRadius * 0.7, wheelWidth * 1.02, 20);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.15,
  });

  const discMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.25 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }); // Red Performance Caliper

  for (const pos of wheelPositions) {
    const steerGroup = new THREE.Group();
    steerGroup.position.set(pos.x, wheelRadius, pos.z);

    const spinGroup = new THREE.Group();

    // Tire
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    spinGroup.add(rim);

    // 5-Spoke Alloy Star Pattern
    for (let s = 0; s < 5; s++) {
      const spAng = (s / 5) * Math.PI * 2;
      const spokeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wheelWidth * 1.04, wheelRadius * 0.65, 0.035),
        chromeTrimMat
      );
      spokeMesh.position.set(0, Math.sin(spAng) * (wheelRadius * 0.32), Math.cos(spAng) * (wheelRadius * 0.32));
      spokeMesh.rotation.x = spAng;
      spinGroup.add(spokeMesh);
    }

    // Ventilated Brake Disc inside wheel
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, 0.02, 20),
      discMat
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.x = -pos.x > 0 ? 0.04 : -0.04;
    spinGroup.add(disc);

    steerGroup.add(spinGroup);

    // Fixed Brake Caliper on Hub
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(wheelWidth * 0.75, 0.14, 0.18), caliperMat);
    caliper.position.set(0, wheelRadius * 0.32, 0);
    steerGroup.add(caliper);

    group.add(steerGroup);

    allWheels.push(spinGroup);
    if (pos.isFront) {
      steerWheels.push(steerGroup);
    }
  }

  let totalWheelSpin = 0;

  const update = (
    steerAngle: number,
    speedDelta: number,
    isBraking: boolean,
    isReversing: boolean,
    leftBlink: boolean,
    rightBlink: boolean,
    headlightsOn: boolean,
    rpmRatio: number,
    speedRatio: number,
    damagePct: number
  ) => {
    // Steer front wheels smoothly
    for (const sw of steerWheels) {
      sw.rotation.y = steerAngle;
    }

    // Smooth Cockpit Steering Wheel Rotation
    steeringWheelGroup.rotation.z = -steerAngle * 2.8;

    // Spin wheels
    totalWheelSpin += speedDelta / wheelRadius;
    for (const w of allWheels) {
      w.rotation.x = totalWheelSpin;
    }

    // Headlights, Spotlights and Volumetric Cones
    if (headlightsOn) {
      headlightMat.emissive.setHex(0xfff7ed);
      headlightMat.emissiveIntensity = 2.4;
      headlightSpotLeft.intensity = 4.2;
      headlightSpotRight.intensity = 4.2;
      beamMat.opacity = 0.18;
    } else {
      headlightMat.emissive.setHex(0x000000);
      headlightMat.emissiveIntensity = 0;
      headlightSpotLeft.intensity = 0;
      headlightSpotRight.intensity = 0;
      beamMat.opacity = 0;
    }

    // Brake Lights (Deep Red at rest, Brilliant Red under braking)
    if (isBraking) {
      brakeLightMat.emissive.setHex(0xff0000);
      brakeLightMat.emissiveIntensity = 3.2;
      centerLightbar.material = brakeLightMat;
    } else {
      brakeLightMat.emissive.setHex(0x330000);
      brakeLightMat.emissiveIntensity = 0.45;
    }

    // Blinkers
    leftBlinkerMat.emissive.setHex(leftBlink ? 0xf59e0b : 0x000000);
    leftBlinkerMat.emissiveIntensity = leftBlink ? 2.8 : 0;

    rightBlinkerMat.emissive.setHex(rightBlink ? 0xf59e0b : 0x000000);
    rightBlinkerMat.emissiveIntensity = rightBlink ? 2.8 : 0;

    // Visual damage deformation
    if (damagePct > 0.25) {
      hoodMesh.rotation.x = (damagePct - 0.25) * 0.18;
    }
  };

  const setPaintColor = (hex: string) => {
    paintMaterial.color.set(hex);
  };

  return {
    group,
    steerWheels,
    allWheels,
    steeringWheelMesh: steeringWheelGroup,
    paintMaterial,
    headlightMaterials: [headlightMat],
    brakeLightMaterials: [brakeLightMat],
    leftBlinkerMaterials: [leftBlinkerMat],
    rightBlinkerMaterials: [rightBlinkerMat],
    headlightBeams: [leftBeam, rightBeam],
    headlightSpotLeft,
    headlightSpotRight,
    cockpitAnchor,
    hoodAnchor,
    chaseAnchor,
    update,
    setPaintColor,
  };
}
