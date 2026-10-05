export type GameScreen = 'main_menu' | 'garage' | 'game' | 'mission_select' | 'pause';

export type GameMode = 'free_drive' | 'taxi' | 'mission';

export type MissionType = 
  | 'parking'
  | 'highway'
  | 'fuel_saver'
  | 'speed_camera'
  | 'lane_discipline'
  | 'vip_escort';

export type BodyType = 
  | 'hatchback'
  | 'sedan'
  | 'micro_suv'
  | 'compact_suv'
  | 'boxy_suv'
  | 'large_suv'
  | 'mpv';

export type Gear = 'P' | 'R' | 'N' | 'D';

export type Weather = 'clear' | 'rain' | 'smog';

export type QualityLevel = 'auto' | 'low' | 'med' | 'high';

export type CameraView = 'chase' | 'cockpit' | 'hood';

export interface CarSpecs {
  id: string;
  name: string;
  hindiName: string;
  bodyType: BodyType;
  price: number;
  unlocked: boolean;
  mass: number; // kg (e.g. Alto 750, Scorpio 1850)
  wheelbase: number; // m
  track: number; // m
  comHeight: number; // m
  powerHp: number; // horsepower
  torqueNm: number; // Nm
  dragCoeff: number; // Aerodynamic drag Cd
  tyreGrip: number; // Base grip multiplier
  suspensionStiffness: number; // N/m
  suspensionDamping: number; // Ns/m
  brakeForce: number; // N
  fuelTankCapacity: number; // Litres
  topSpeedKmH: number;
  isDiesel?: boolean;
  wheelRadiusM?: number; // m (default 0.32) — feeds traction force and road RPM
  agility?: number; // handling character multiplier, default 1.0 (>1 nimble, <1 boaty)
  colors: string[]; // hex codes
  defaultColor: string;
  description: string;
  tagline: string;
}

export interface CarUpgrades {
  engine: number; // 0..3
  brakes: number; // 0..3
  suspension: number; // 0..3
  tyres: number; // 0..3
  tank: number; // 0..3
}

export interface PlayerSaveData {
  cash: number;
  ownedCarIds: string[];
  selectedCarId: string;
  carColors: Record<string, string>;
  carUpgrades: Record<string, CarUpgrades>;
  highScores: Record<string, number>;
  totalJobsCompleted: number;
  totalKmDriven: number;
  settings: {
    quality: QualityLevel;
    trafficDensity: 'low' | 'medium' | 'high';
    controlScheme: 'wheel_right' | 'wheel_left' | 'arrows';
    steeringAssist: boolean;
    soundVolume: number; // 0..1 master volume
    hindiLabels: boolean;
    weather: Weather;
    timeOfDay: number; // 0..24
    preferredCamera: CameraView;
    smogEffect: boolean;
  };
}

export interface HUDState {
  speedKmH: number;
  rpm: number;
  maxRpm: number;
  gear: Gear;
  fuelPct: number;
  damagePct: number;
  cash: number;
  fps: number;
  speedLimit: number;
  isOverSpeed: boolean;
  leftBlinker: boolean;
  rightBlinker: boolean;
  headlights: boolean;
  currentStreet: string;
  currentZone: 'Delhi' | 'Gurgaon' | 'Highway' | 'Haryana';
  // Taxi / Mission specific
  activeJob: boolean;
  passengerName?: string;
  passengerQuote?: string;
  passengerSatisfaction?: number; // 1 to 5
  taxiArchetype?: TaxiArchetype;
  taxiTipHint?: string;
  missionTitle?: string;
  missionObjective?: string;
  missionTimeLeft?: number; // seconds
  targetDistanceMeters?: number;
  fareAmount?: number;
  fastagNotification?: string | null;
  notificationMessage?: string | null;
  // Route GPS
  hasGpsTarget: boolean;
  gpsTargetName?: string;
}

export interface InputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  handbrake: boolean;
  gear: Gear;
  horn: boolean;
  leftBlinker: boolean;
  rightBlinker: boolean;
  headlights: boolean;
  cameraToggle: boolean;
  resetCar: boolean;
}

export interface RoadWaypoint {
  x: number;
  y: number; // height
  z: number;
  zone: 'Delhi' | 'Gurgaon' | 'Highway' | 'Haryana';
  streetName: string;
  speedLimit: number;
  isBridge?: boolean;
}

export interface RoadSegment {
  id: string;
  start: RoadWaypoint;
  end: RoadWaypoint;
  lanes: number; // lanes in this direction
  width: number;
  speedLimit: number;
  streetName: string;
  zone: 'Delhi' | 'Gurgaon' | 'Highway' | 'Haryana';
  oneWay?: boolean;
}

export interface PassengerJob {
  id: string;
  passengerName: string;
  archetype: TaxiArchetype;
  pickupLocation: [number, number, number];
  dropLocation: [number, number, number];
  pickupName: string;
  dropName: string;
  quote: string;
  baseFare: number;
  perKmRate: number;
  fareMult: number; // VIP 1.4x etc. — applied to the distance component
  tipBonus: number; // impatient: speed tip paid at completion when fast
  flatBonus: number; // hopper: flat completion bonus
  satisfactionDecayMult: number; // VIP 2x — penalties sting more
  timeLimitSec: number;
  isPickedUp: boolean;
  satisfaction: number; // 5.0 base
  penalties: number;
}

export type TaxiArchetype = 'standard' | 'vip' | 'impatient' | 'hopper';
