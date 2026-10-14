export const GAME_CONFIG = {
  // Fixed Timestep Physics (120 Hz)
  PHYSICS_HZ: 120,
  PHYSICS_STEP: 1 / 120,
  MAX_SUB_STEPS: 12,
  GRAVITY: 9.81,

  // HUD Update Rate
  HUD_UPDATE_INTERVAL_MS: 66, // ~15 Hz

  // Dynamic Handling & Tyres
  // NOTE (2026-10-05): Pacejka constants TYRE_B/C/D/E and drift tuning
  // DRIFT_SLIP_THRESHOLD/DRIFT_FRICTION_SCALE were removed — the physics
  // model is arcade damping, not a Pacejka slip model; keep them out.
  SURFACE_GRIP: {
    asphalt_dry: 1.0,
    asphalt_wet: 0.78,
    dirt_shoulder: 0.55,
    speed_breaker: 0.85,
  },

  // Weight Transfer & Suspension
  WEIGHT_TRANSFER_PITCH: 0.16, // Nose dive under braking / squat on launch
  WEIGHT_TRANSFER_ROLL: 0.22,  // Body roll in corners
  SPRING_REST_LENGTH: 0.38, // Metres
  SUSPENSION_TRAVEL_MAX: 0.18, // Metres

  // Powertrain & Transmission
  IDLE_RPM: 850,
  REDLINE_RPM: 6500,
  GEAR_RATIOS: [3.45, 2.05, 1.38, 1.02, 0.82], // 1st to 5th
  REVERSE_RATIO: 3.3,
  FINAL_DRIVE: 4.1,
  ROLLING_RESISTANCE_COEFF: 0.015,

  // Steering
  STEERING_SPEED_SENSITIVITY: 0.55,
  STEERING_SMOOTH_FACTOR: 14.0,
  STEERING_AUTO_CENTER_RATE: 16.0,
  MAX_STEER_ANGLE_RAD: 0.62, // ~35.5 degrees at low speed
  MIN_STEER_ANGLE_RAD: 0.16, // ~9 degrees at top speed

  // Left-Hand Traffic Rules (India)
  TRAFFIC_KEEP_LEFT: true,
  LANE_WIDTH: 3.6, // Metres per lane

  // Speed Limits (km/h)
  SPEED_LIMIT_CITY: 50,
  SPEED_LIMIT_FLYOVER: 70,
  SPEED_LIMIT_HIGHWAY: 100,
  SPEED_LIMIT_GURGAON: 60,
  SPEED_LIMIT_HARYANA: 80,

  // Camera Settings
  CAMERA_CHASE_DISTANCE: 5.4,
  CAMERA_CHASE_HEIGHT: 2.1,
  CAMERA_CHASE_LAG: 8.5,
  CAMERA_COCKPIT_FOV: 68,
  CAMERA_CHASE_FOV: 62,
  CAMERA_HIGH_SPEED_FOV_BOOST: 12,

  // Colors & Theme (Warm Saffron, Deep Charcoal, Crisp Teal)
  THEME: {
    saffron: '#FF9933',
    saffronDark: '#D97706',
    teal: '#14B8A6',
    tealDark: '#0F766E',
    indianGreen: '#138808',
    deepNavy: '#0A0E17',
    charcoal: '#151922',
    asphalt: '#252932',
    roadMarkingYellow: '#FCD34D',
    roadMarkingWhite: '#F8FAFC',
    curbRed: '#DC2626',
    curbWhite: '#F1F5F9',
  },

  // Sound Synth Defaults
  AUDIO_MASTER_VOLUME: 0.8,

  // Quality Profiles
  // NOTE: antiAliasing was removed from these tiers — MSAA is fixed at
  // WebGLRenderer creation (antialias: true) and cannot change post-hoc
  // without recreating the renderer, so per-tier AA values would be a lie.
  QUALITY_SETTINGS: {
    low: {
      shadows: false,
      pixelRatio: 1.0,
      renderDistance: 600,
      trafficCount: 22,
      particles: false,
    },
    med: {
      shadows: true,
      shadowMapSize: 1024,
      pixelRatio: 1.25,
      renderDistance: 600,
      trafficCount: 42,
      particles: true,
    },
    high: {
      shadows: true,
      shadowMapSize: 2048,
      pixelRatio: 1.5,
      renderDistance: 800,
      trafficCount: 65,
      particles: true,
    },
  },
};
