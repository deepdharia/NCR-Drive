import * as THREE from 'three';
import { POINTS_OF_INTEREST, POI } from '../world/MapData';
import { GameMode, MissionType, PassengerJob, TaxiArchetype } from '../types';
import { SaveManager } from '../save/SaveManager';
import { MISSION_PACKS, MissionDef } from './MissionPacks';
import { recordStars } from './MissionStars';

export interface MissionDefinition {
  id: string;
  type: MissionType;
  title: string;
  hindiTitle: string;
  description: string;
  rewardCash: number;
  timeLimitSec: number;
  startPos: [number, number, number];
  startHeading: number;
  targetPos: [number, number, number];
  targetRadius: number;
}

export const MISSION_LIST: MissionDefinition[] = [
  {
    id: 'm_parking_1',
    type: 'parking',
    title: 'Dr. Parking: Ambience Mall Bay',
    hindiTitle: 'पार्किंग चैलेंज: एम्बियंस मॉल',
    description: 'Park precisely inside the yellow bay at Ambience Mall. Shift to Park (P) within tolerance to finish.',
    rewardCash: 4500,
    timeLimitSec: 60,
    startPos: [-140, 0, 910],
    startHeading: 0,
    targetPos: [-170, 0, 960],
    targetRadius: 2.5,
  },
  {
    id: 'm_highway_speed',
    type: 'highway',
    title: 'NH-48 Expressway Clean Run',
    hindiTitle: 'एक्सप्रेसवे क्लीन रन',
    description: 'Cruise from Dhaula Kuan through the FASTag toll to Gurgaon without a single collision!',
    rewardCash: 6800,
    timeLimitSec: 120,
    startPos: [0, 0, -250],
    startHeading: 0,
    targetPos: [0, 0, 620],
    targetRadius: 15,
  },
  {
    id: 'm_fuel_saver',
    type: 'fuel_saver',
    title: 'Green Haryana Eco Run',
    hindiTitle: 'इको रन: मुर्थल ढाबा',
    description: 'Reach Old Rao Dhaba with smooth throttle control and minimal braking to save maximum fuel.',
    rewardCash: 5200,
    timeLimitSec: 140,
    startPos: [0, 0, 1050],
    startHeading: 0,
    targetPos: [110, 0, 1550],
    targetRadius: 12,
  },
  {
    id: 'm_speed_camera',
    type: 'speed_camera',
    title: 'Traffic Police Radar Trap',
    hindiTitle: 'स्पीड रडार चेक',
    description: 'Stay strictly under the 50 km/h limit past the Connaught Place speed trap cameras.',
    rewardCash: 3800,
    timeLimitSec: 80,
    startPos: [0, 0, -1100],
    startHeading: 0,
    targetPos: [0, 0, -800],
    targetRadius: 10,
  },
  {
    id: 'm_lane_discipline',
    type: 'lane_discipline',
    title: 'Dr. Lane Discipline Challenge',
    hindiTitle: 'लेन अनुशासन',
    description: 'Keep left on the expressway and use your indicators when navigating around Cyber Hub.',
    rewardCash: 5000,
    timeLimitSec: 90,
    startPos: [0, 0, 450],
    startHeading: 0,
    targetPos: [120, 0, 800],
    targetRadius: 12,
  },
  {
    id: 'm_vip_escort',
    type: 'vip_escort',
    title: 'VIP Airport Escort',
    hindiTitle: 'वीआईपी एयरपोर्ट एस्कॉर्ट',
    description: 'Rush from Connaught Place to IGI Terminal 3 departures forecourt within the tight VIP deadline.',
    rewardCash: 8500,
    timeLimitSec: 110,
    startPos: [0, 0, -800],
    startHeading: 0,
    targetPos: [-220, 0, -600],
    targetRadius: 15,
  },
];

// ---------------------------------------------------------------------------
// Taxi career: POI-based job generation with passenger archetypes.
// A TaxiOffer is generated (and shown to the player) BEFORE the job starts —
// declining an offer costs nothing and simply generates a fresh one.
// ---------------------------------------------------------------------------

export interface TaxiOffer {
  passengerName: string;
  archetype: TaxiArchetype;
  archetypeLabel: string;
  pickupLocation: [number, number, number];
  dropLocation: [number, number, number];
  pickupName: string;
  dropName: string;
  quote: string;
  baseFare: number;
  perKmRate: number;
  fareMult: number;
  tipBonus: number;
  flatBonus: number;
  satisfactionDecayMult: number;
  timeLimitSec: number;
  estimatedKm: number;
  estimatedFare: number;
  tipHint: string;
}

interface ArchetypeSpec {
  archetype: TaxiArchetype;
  label: string;
  baseFare: number;
  perKmRate: number;
  fareMult: number;
  tipBonus: number;
  flatBonus: number;
  satisfactionDecayMult: number;
  timeMult: number;
  weight: number;
  tipHint: string;
  quotes: string[];
}

const ARCHETYPE_SPECS: ArchetypeSpec[] = [
  {
    archetype: 'standard', label: 'Regular', baseFare: 100, perKmRate: 22,
    fareMult: 1, tipBonus: 0, flatBonus: 0, satisfactionDecayMult: 1, timeMult: 1,
    weight: 50, tipHint: '',
    quotes: [
      '"Bhaiya, aaram se chalana."',
      '"Meter se chalna, okay bhaiya?"',
      '"Gaana baja do bhaiya, mood fresh ho jayega!"',
      '"Zyada ghumana mat, seedha le chalo."',
    ],
  },
  {
    archetype: 'vip', label: 'VIP', baseFare: 150, perKmRate: 26,
    fareMult: 1.4, tipBonus: 0, flatBonus: 0, satisfactionDecayMult: 2, timeMult: 1,
    weight: 20, tipHint: '+40% fare · hates jerks',
    quotes: [
      '"No sudden braking — I\'m on a client call."',
      '"Smooth chalao bhaiya, AC tez kar do."',
      '"Five-star ride chahiye, samjhe?"',
    ],
  },
  {
    archetype: 'impatient', label: 'In a hurry', baseFare: 110, perKmRate: 24,
    fareMult: 1, tipBonus: 80, flatBonus: 0, satisfactionDecayMult: 1.5, timeMult: 0.75,
    weight: 20, tipHint: '+₹80 tip if fast',
    quotes: [
      '"Bhaiya thoda jaldi please, late ho raha hai!"',
      '"Meter se matlab nahi — time pe pahuncha do!"',
      '"Jaldi karo bhaiya, train choot jayegi!"',
    ],
  },
  {
    archetype: 'hopper', label: 'Quick hop', baseFare: 60, perKmRate: 20,
    fareMult: 1, tipBonus: 0, flatBonus: 60, satisfactionDecayMult: 1, timeMult: 1,
    weight: 10, tipHint: '+₹60 hop bonus',
    quotes: [
      '"Bas paas hi jana hai bhaiya."',
      '"Do minute ka kaam hai, chalo!"',
      '"Yahin bagal mein drop kar do."',
    ],
  },
];

const PASSENGER_NAMES = [
  'Rohit S. (Tech Lead)', 'Priya Malhotra', 'Uncle Dharamveer', 'Ananya & Simran',
  'Arjun Mehta', 'Kavya Singh', 'Vikram Rathore', 'Neha Gupta',
  'Suresh Yadav', 'Pooja Verma', 'Aditya Rao', 'Col. Bedi (Retd.)',
];

/** Short display hint for an archetype (used by the HUD taxi card). */
export function getArchetypeTipHint(archetype: TaxiArchetype): string {
  return ARCHETYPE_SPECS.find(s => s.archetype === archetype)?.tipHint ?? '';
}

/** Display label for an archetype. */
export function getArchetypeLabel(archetype: TaxiArchetype): string {
  return ARCHETYPE_SPECS.find(s => s.archetype === archetype)?.label ?? '';
}

export class MissionManager {
  public currentMode: GameMode = 'free_drive';
  public currentMission: MissionDefinition | null = null;
  public currentTaxiJob: PassengerJob | null = null;
  public timeLeftSec: number = 0;
  public collisionsCount: number = 0;
  public isCompleted: boolean = false;
  public isFailed: boolean = false;
  public failReason: string = '';
  public completionResult: {
    title: string;
    cashEarned: number;
    stars: number;
    penalties: number;
    message: string;
  } | null = null;

  // --- Offer staging: an accepted offer is consumed by the next startTaxiJob().
  public pendingTaxiOffer: TaxiOffer | null = null;

  // --- Recent routes ("pickupId>dropId") to avoid back-to-back duplicate jobs.
  private recentRoutes: string[] = [];

  // --- Single-shot result latch: completion/failure is reported exactly once,
  // --- then job/mission state is released so beacons/HUD don't stick around.
  private completionReported: boolean = false;

  // --- Honest fare metering: actual distance driven after pickup (meters).
  private tripDistanceM: number = 0;
  private lastTripPos: THREE.Vector3 | null = null;

  // --- Mission distance (meters) for the revived totalKmDriven stat.
  private missionDistanceM: number = 0;
  private lastMissionPos: THREE.Vector3 | null = null;

  // --- Smooth-driving evaluation accumulators (taxi satisfaction).
  private hardBrakeTime: number = 0;
  private overspeedTime: number = 0;

  // --- Phase-2 mission mechanics: checkpoint sequencing + eco fuel budget.
  private checkpointIdx: number = 0;
  private missionFuelStart: number | null = null;

  private resetRunState() {
    this.completionReported = false;
    this.tripDistanceM = 0;
    this.lastTripPos = null;
    this.missionDistanceM = 0;
    this.lastMissionPos = null;
    this.hardBrakeTime = 0;
    this.overspeedTime = 0;
    this.checkpointIdx = 0;
    this.missionFuelStart = null;
  }

  public startMission(missionId: string): MissionDefinition {
    const def =
      [...MISSION_LIST, ...MISSION_PACKS].find(m => m.id === missionId) ||
      MISSION_LIST[0];
    this.currentMode = 'mission';
    this.currentMission = def;
    this.currentTaxiJob = null;
    this.timeLeftSec = def.timeLimitSec;
    this.collisionsCount = 0;
    this.isCompleted = false;
    this.isFailed = false;
    this.failReason = '';
    this.completionResult = null;
    this.resetRunState();
    return def;
  }

  /**
   * Generate a job offer from real POIs WITHOUT starting it. The App shows
   * this in the offer modal; ACCEPT stages it via pendingTaxiOffer, DECLINE
   * simply generates a fresh one. Pure — no state mutated except recentRoutes.
   */
  public generateTaxiOffer(): TaxiOffer {
    const pois = POINTS_OF_INTEREST;
    let pickup: POI | null = null;
    let drop: POI | null = null;
    let routeKey = '';

    for (let attempt = 0; attempt < 10; attempt++) {
      const p = pois[Math.floor(Math.random() * pois.length)];
      let d = pois[Math.floor(Math.random() * pois.length)];
      if (d.id === p.id) continue;
      const pPos = p.parkingSpot ?? p.position;
      const dPos = d.parkingSpot ?? d.position;
      const straightKm =
        Math.hypot(dPos[0] - pPos[0], dPos[2] - pPos[2]) / 1000;
      if (straightKm < 0.3) continue; // too trivial to be a job
      routeKey = `${p.id}>${d.id}`;
      if (this.recentRoutes.includes(routeKey)) continue;
      pickup = p;
      drop = d;
      break;
    }
    // Fallback: relax the no-repeat rule rather than fail.
    if (!pickup || !drop) {
      pickup = pois[Math.floor(Math.random() * pois.length)];
      do {
        drop = pois[Math.floor(Math.random() * pois.length)];
      } while (drop.id === pickup.id);
      routeKey = `${pickup.id}>${drop.id}`;
    }
    this.recentRoutes.push(routeKey);
    if (this.recentRoutes.length > 4) this.recentRoutes.shift();

    const pPos = pickup.parkingSpot ?? pickup.position;
    const dPos = drop.parkingSpot ?? drop.position;
    const straightKm = Math.hypot(dPos[0] - pPos[0], dPos[2] - pPos[2]) / 1000;
    const estimatedKm = Math.max(0.4, straightKm * 1.4);

    // Archetype: weighted random; hoppers only take short hops.
    const eligible = ARCHETYPE_SPECS.filter(
      s => s.archetype !== 'hopper' || estimatedKm < 1.5
    );
    const totalWeight = eligible.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * totalWeight;
    let spec = eligible[0];
    for (const s of eligible) {
      roll -= s.weight;
      if (roll <= 0) { spec = s; break; }
    }

    const timeLimitSec = Math.max(90, Math.round(estimatedKm * 100 * spec.timeMult));
    const estimatedFare = Math.max(
      80,
      Math.round((spec.baseFare + spec.perKmRate * estimatedKm) * spec.fareMult)
    );

    return {
      passengerName: PASSENGER_NAMES[Math.floor(Math.random() * PASSENGER_NAMES.length)],
      archetype: spec.archetype,
      archetypeLabel: spec.label,
      pickupLocation: [pPos[0], pPos[1], pPos[2]],
      dropLocation: [dPos[0], dPos[1], dPos[2]],
      pickupName: pickup.name,
      dropName: drop.name,
      quote: spec.quotes[Math.floor(Math.random() * spec.quotes.length)],
      baseFare: spec.baseFare,
      perKmRate: spec.perKmRate,
      fareMult: spec.fareMult,
      tipBonus: spec.tipBonus,
      flatBonus: spec.flatBonus,
      satisfactionDecayMult: spec.satisfactionDecayMult,
      timeLimitSec,
      estimatedKm: Math.round(estimatedKm * 10) / 10,
      estimatedFare,
      tipHint: spec.tipHint,
    };
  }

  public startTaxiJob(offer?: TaxiOffer): PassengerJob {
    this.currentMode = 'taxi';
    this.currentMission = null;
    // An accepted offer is consumed here; otherwise (e.g. Retry) generate fresh.
    const o = offer ?? this.pendingTaxiOffer ?? this.generateTaxiOffer();
    this.pendingTaxiOffer = null;

    this.currentTaxiJob = {
      id: `job_${Date.now()}`,
      passengerName: o.passengerName,
      archetype: o.archetype,
      pickupLocation: o.pickupLocation,
      dropLocation: o.dropLocation,
      pickupName: o.pickupName,
      dropName: o.dropName,
      quote: o.quote,
      baseFare: o.baseFare,
      perKmRate: o.perKmRate,
      fareMult: o.fareMult,
      tipBonus: o.tipBonus,
      flatBonus: o.flatBonus,
      satisfactionDecayMult: o.satisfactionDecayMult,
      timeLimitSec: o.timeLimitSec,
      isPickedUp: false,
      satisfaction: 5.0,
      penalties: 0,
    };

    this.timeLeftSec = o.timeLimitSec;
    this.collisionsCount = 0;
    this.isCompleted = false;
    this.isFailed = false;
    this.failReason = '';
    this.completionResult = null;
    this.resetRunState();
    return this.currentTaxiJob;
  }

  public startFreeDrive() {
    this.currentMode = 'free_drive';
    this.currentMission = null;
    this.currentTaxiJob = null;
    this.isCompleted = false;
    this.isFailed = false;
    this.completionResult = null;
    this.resetRunState();
  }

  public onCollision() {
    this.collisionsCount++;
    if (this.currentTaxiJob) {
      const mult = this.currentTaxiJob.satisfactionDecayMult;
      this.currentTaxiJob.satisfaction = Math.max(1.0, this.currentTaxiJob.satisfaction - 0.7 * mult);
      this.currentTaxiJob.penalties += 40;
    }

    if (this.currentMission && this.currentMission.type === 'highway') {
      this.isFailed = true;
      this.failReason = 'Crashed on Expressway! Clean run failed.';
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerSpeedKmh: number,
    gear: string,
    brakeInput: number = 0,
    speedLimitKmh: number = 80,
    fuelLitres: number | null = null
  ): { completed: boolean; failed: boolean } {
    // Single-shot event semantics: a latched completion/failure is reported
    // exactly once, then the run is finalized (stats persisted, job/mission
    // released). This prevents per-frame cash duplication in the engine.
    if (this.completionReported) return { completed: false, failed: false };
    if (this.isCompleted || this.isFailed) {
      this.finalizeRun(this.isCompleted);
      return { completed: this.isCompleted, failed: this.isFailed };
    }

    // Update timers
    if (this.currentMode !== 'free_drive') {
      this.timeLeftSec -= dt;
      if (this.timeLeftSec <= 0) {
        this.isFailed = true;
        this.failReason = 'Time limit expired!';
        this.finalizeRun(false);
        return { completed: false, failed: true };
      }
    }

    // 1. Taxi Job Check
    if (this.currentMode === 'taxi' && this.currentTaxiJob) {
      const job = this.currentTaxiJob;

      if (!job.isPickedUp) {
        // Distance to pickup
        const pDx = playerPos.x - job.pickupLocation[0];
        const pDz = playerPos.z - job.pickupLocation[2];
        const dist = Math.sqrt(pDx * pDx + pDz * pDz);

        if (dist < 10 && playerSpeedKmh < 8) {
          job.isPickedUp = true;
          // Passenger entered — fare meter starts from here
          this.tripDistanceM = 0;
          this.lastTripPos = playerPos.clone();
        }
      } else {
        // Fare meter: accumulate actual distance driven since pickup
        if (this.lastTripPos) {
          this.tripDistanceM += playerPos.distanceTo(this.lastTripPos);
        }
        this.lastTripPos = playerPos.clone();

        // Smooth-driving evaluation: hard braking dings satisfaction
        if (brakeInput > 0.8 && playerSpeedKmh > 15) {
          this.hardBrakeTime += dt;
          if (this.hardBrakeTime >= 1.0) {
            job.satisfaction = Math.max(1.0, job.satisfaction - 0.15 * job.satisfactionDecayMult);
            job.penalties += 10;
            this.hardBrakeTime = 0;
          }
        } else {
          this.hardBrakeTime = Math.max(0, this.hardBrakeTime - dt);
        }

        // Sustained overspeed dings satisfaction
        if (playerSpeedKmh > speedLimitKmh + 20) {
          this.overspeedTime += dt;
          if (this.overspeedTime >= 3.0) {
            job.satisfaction = Math.max(1.0, job.satisfaction - 0.1 * job.satisfactionDecayMult);
            job.penalties += 15;
            this.overspeedTime = 0;
          }
        } else {
          this.overspeedTime = 0;
        }

        // Distance to drop-off
        const dDx = playerPos.x - job.dropLocation[0];
        const dDz = playerPos.z - job.dropLocation[2];
        const dist = Math.sqrt(dDx * dDx + dDz * dDz);

        if (dist < 14 && playerSpeedKmh < 8) {
          this.isCompleted = true;
          const stars = Math.round(job.satisfaction);
          const km = this.tripDistanceM / 1000;
          // Archetype-aware fare: distance component × fareMult, minus penalties,
          // plus star bonus, speed tip (impatient) and hop bonus (hopper).
          let totalFare =
            (job.baseFare + job.perKmRate * km) * job.fareMult -
            job.penalties +
            (stars >= 4 ? 60 : 0);
          let bonusNote = '';
          if (job.archetype === 'impatient' && this.timeLeftSec > 0.2 * job.timeLimitSec) {
            totalFare += job.tipBonus;
            bonusNote = ` Speed bonus +₹${job.tipBonus}!`;
          }
          if (job.archetype === 'hopper') {
            totalFare += job.flatBonus;
            bonusNote = ` Hop bonus +₹${job.flatBonus}!`;
          }
          totalFare = Math.max(80, Math.round(totalFare));

          this.completionResult = {
            title: 'Job Completed!',
            cashEarned: totalFare,
            stars,
            penalties: job.penalties,
            message: `Passenger safely dropped off at ${job.dropName}. Rating: ${stars} Stars!${bonusNote}`,
          };
          this.finalizeRun(true);
          return { completed: true, failed: false };
        }
      }
    }

    // 2. Mission Check
    if (this.currentMode === 'mission' && this.currentMission) {
      const m = this.currentMission;
      const md = m as MissionDef;
      // Track mission distance for the totalKmDriven stat
      if (this.lastMissionPos) {
        this.missionDistanceM += playerPos.distanceTo(this.lastMissionPos);
      }
      this.lastMissionPos = playerPos.clone();

      // Eco missions: capture fuel at run start, fail when the budget is blown.
      if (this.missionFuelStart == null && fuelLitres != null) {
        this.missionFuelStart = fuelLitres;
      }
      if (
        md.maxFuelLitres != null &&
        fuelLitres != null &&
        this.missionFuelStart != null &&
        this.missionFuelStart - fuelLitres > md.maxFuelLitres
      ) {
        this.isFailed = true;
        this.failReason = 'Fuel budget exceeded! Drive smoother.';
        this.finalizeRun(false);
        return { completed: false, failed: true };
      }

      // Speed-discipline missions: breaching the margin fails the run.
      if (md.maxOverKmh != null && playerSpeedKmh > speedLimitKmh + md.maxOverKmh) {
        this.isFailed = true;
        this.failReason = `Speeding! Stay within ${md.maxOverKmh} km/h of the limit.`;
        this.finalizeRun(false);
        return { completed: false, failed: true };
      }

      // Checkpoint sequencing (degrades gracefully to the single targetPos).
      const cps = md.checkpoints;
      const hasCps = !!cps && cps.length > 0;
      const cpIdx = Math.min(this.checkpointIdx, hasCps ? cps.length - 1 : 0);
      const target = hasCps ? cps[cpIdx] : m.targetPos;
      const radius = hasCps ? (md.checkpointRadiusM ?? m.targetRadius) : m.targetRadius;

      const tDx = playerPos.x - target[0];
      const tDz = playerPos.z - target[2];
      const dist = Math.sqrt(tDx * tDx + tDz * tDz);

      if (dist <= radius) {
        // Intermediate checkpoints: slow through to advance.
        if (hasCps && this.checkpointIdx < cps.length - 1) {
          if (playerSpeedKmh < 25) {
            this.checkpointIdx++;
          }
          return { completed: false, failed: false };
        }

        // Final target: gear + stop rules (generalized from the old parking branch).
        const needGear = md.requiredGear ?? (m.type === 'parking' ? 'P' : null);
        const stopLimit = md.stopSpeedKmh ?? (m.type === 'parking' ? 2 : 25);
        const gearOk = needGear ? gear === needGear : true;
        if (gearOk && playerSpeedKmh < stopLimit) {
          this.isCompleted = true;
          const isParking = m.type === 'parking';
          this.completionResult = {
            title: isParking ? 'Parking Perfect!' : 'Mission Succeeded!',
            cashEarned: m.rewardCash,
            stars: isParking ? 5 : this.collisionsCount === 0 ? 5 : 4,
            penalties: this.collisionsCount * (isParking ? 50 : 100),
            message: isParking
              ? 'Vehicle parked perfectly inside the yellow bay!'
              : m.description,
          };
          this.finalizeRun(true);
          return { completed: true, failed: false };
        }
      }
    }

    return { completed: false, failed: false };
  }

  /** Live fare meter for the HUD: actual distance-based fare while the job runs. */
  public getLiveFare(): number {
    const job = this.currentTaxiJob;
    if (!job) return 0;
    if (!job.isPickedUp) return job.baseFare;
    const km = this.tripDistanceM / 1000;
    return Math.max(80, Math.round((job.baseFare + job.perKmRate * km) * job.fareMult - job.penalties));
  }

  /**
   * Latch the run result (single-shot), persist progression stats, and release
   * job/mission state so the destination beacon and HUD cards don't stick.
   */
  private finalizeRun(completed: boolean) {
    this.completionReported = true;
    // Phase-2 progression: bank the star rating for tier unlocks.
    if (completed && this.currentMode === 'mission' && this.currentMission && this.completionResult) {
      try {
        recordStars(this.currentMission.id, this.completionResult.stars);
      } catch {
        /* star bucket is best-effort; never fail a run over it */
      }
    }
    this.persistRunStats(completed);
    this.currentTaxiJob = null;
    this.currentMission = null;
    this.lastTripPos = null;
    this.lastMissionPos = null;
  }

  /**
   * Current navigation target for the destination beacon: the active
   * checkpoint in sequenced missions, otherwise the mission target.
   * Null when no mission is running.
   */
  public getMissionTarget(): [number, number, number] | null {
    if (this.currentMode !== 'mission' || !this.currentMission) return null;
    const md = this.currentMission as MissionDef;
    const cps = md.checkpoints;
    if (cps && cps.length > 0) {
      return cps[Math.min(this.checkpointIdx, cps.length - 1)];
    }
    return this.currentMission.targetPos;
  }

  /** Revive the dead save fields: job count, per-mission high scores, total km. */
  private persistRunStats(completed: boolean) {
    const data = SaveManager.load();
    let changed = false;

    if (this.currentMode === 'taxi') {
      if (completed) {
        data.totalJobsCompleted += 1;
        changed = true;
      }
      data.totalKmDriven += this.tripDistanceM / 1000;
      changed = true;
    } else if (this.currentMode === 'mission' && this.currentMission) {
      const m = this.currentMission;
      const cash = this.completionResult?.cashEarned ?? 0;
      data.highScores[m.id] = Math.max(data.highScores[m.id] || 0, cash);
      data.totalKmDriven += this.missionDistanceM / 1000;
      changed = true;
    }

    if (changed) SaveManager.save(data);
  }
}
