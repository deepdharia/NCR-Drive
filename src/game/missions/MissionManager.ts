import * as THREE from 'three';
import { POINTS_OF_INTEREST } from '../world/MapData';
import { GameMode, MissionType, PassengerJob } from '../types';
import { SaveManager } from '../save/SaveManager';

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

export const TAXI_PASSENGERS: Omit<PassengerJob, 'id' | 'isPickedUp' | 'satisfaction' | 'penalties'>[] = [
  {
    passengerName: 'Rohit Sharma (Tech Lead)',
    pickupLocation: [0, 0, -800],
    dropLocation: [120, 0, 800],
    pickupName: 'Connaught Place Metro',
    dropName: 'Cyber Hub Building 10',
    quote: '"Bhaiya Cyber Hub chalo, 10 baje sprint meeting hai!"',
    baseFare: 120,
    perKmRate: 22,
    timeLimitSec: 150,
  },
  {
    passengerName: 'Priya Malhotra (Consultant)',
    pickupLocation: [120, 0, 800],
    dropLocation: [-220, 0, -600],
    pickupName: 'Cyber Hub Rapid Metro',
    dropName: 'IGI Airport Terminal 3',
    quote: '"Bhaiya thoda jaldi please, boarding band ho jayegi!"',
    baseFare: 180,
    perKmRate: 25,
    timeLimitSec: 160,
  },
  {
    passengerName: 'Uncle Dharamveer',
    pickupLocation: [0, 0, -1100],
    dropLocation: [80, 0, 1550],
    pickupName: 'India Gate Lawns',
    dropName: 'Old Rao Dhaba Manesar',
    quote: '"Chalo beta, garma garam paranthe aur makkhan khayenge!"',
    baseFare: 150,
    perKmRate: 20,
    timeLimitSec: 220,
  },
  {
    passengerName: 'Ananya & Simran',
    pickupLocation: [0, 0, 620],
    dropLocation: [-140, 0, 950],
    pickupName: 'Gurgaon Expressway Gate',
    dropName: 'Ambience Mall South Gate',
    quote: '"Weekend shopping ke liye Ambience Mall drop kar do bhaiya!"',
    baseFare: 90,
    perKmRate: 22,
    timeLimitSec: 110,
  },
];

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

  private taxiJobCounter: number = 0;

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

  private resetRunState() {
    this.completionReported = false;
    this.tripDistanceM = 0;
    this.lastTripPos = null;
    this.missionDistanceM = 0;
    this.lastMissionPos = null;
    this.hardBrakeTime = 0;
    this.overspeedTime = 0;
  }

  public startMission(missionId: string): MissionDefinition {
    const def = MISSION_LIST.find(m => m.id === missionId) || MISSION_LIST[0];
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

  public startTaxiJob(): PassengerJob {
    this.currentMode = 'taxi';
    this.currentMission = null;
    const template = TAXI_PASSENGERS[this.taxiJobCounter % TAXI_PASSENGERS.length];
    this.taxiJobCounter++;

    this.currentTaxiJob = {
      ...template,
      id: `job_${Date.now()}`,
      isPickedUp: false,
      satisfaction: 5.0,
      penalties: 0,
    };

    this.timeLeftSec = template.timeLimitSec;
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
      this.currentTaxiJob.satisfaction = Math.max(1.0, this.currentTaxiJob.satisfaction - 0.7);
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
    speedLimitKmh: number = 80
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
            job.satisfaction = Math.max(1.0, job.satisfaction - 0.15);
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
            job.satisfaction = Math.max(1.0, job.satisfaction - 0.1);
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
          const totalFare = Math.max(
            80,
            Math.round(job.baseFare + job.perKmRate * km - job.penalties + (stars >= 4 ? 60 : 0))
          );

          this.completionResult = {
            title: 'Job Completed!',
            cashEarned: totalFare,
            stars,
            penalties: job.penalties,
            message: `Passenger safely dropped off at ${job.dropName}. Rating: ${stars} Stars!`,
          };
          this.finalizeRun(true);
          return { completed: true, failed: false };
        }
      }
    }

    // 2. Mission Check
    if (this.currentMode === 'mission' && this.currentMission) {
      const m = this.currentMission;
      // Track mission distance for the totalKmDriven stat
      if (this.lastMissionPos) {
        this.missionDistanceM += playerPos.distanceTo(this.lastMissionPos);
      }
      this.lastMissionPos = playerPos.clone();

      const tDx = playerPos.x - m.targetPos[0];
      const tDz = playerPos.z - m.targetPos[2];
      const dist = Math.sqrt(tDx * tDx + tDz * tDz);

      if (dist <= m.targetRadius) {
        if (m.type === 'parking') {
          // Must be in Park ('P') and stopped
          if (gear === 'P' && playerSpeedKmh < 2) {
            this.isCompleted = true;
            this.completionResult = {
              title: 'Parking Perfect!',
              cashEarned: m.rewardCash,
              stars: 5,
              penalties: this.collisionsCount * 50,
              message: 'Vehicle parked perfectly inside the yellow bay!',
            };
            this.finalizeRun(true);
            return { completed: true, failed: false };
          }
        } else {
          // General target arrival
          if (playerSpeedKmh < 25) {
            this.isCompleted = true;
            this.completionResult = {
              title: 'Mission Succeeded!',
              cashEarned: m.rewardCash,
              stars: this.collisionsCount === 0 ? 5 : 4,
              penalties: this.collisionsCount * 100,
              message: m.description,
            };
            this.finalizeRun(true);
            return { completed: true, failed: false };
          }
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
    return Math.max(80, Math.round(job.baseFare + job.perKmRate * km - job.penalties));
  }

  /**
   * Latch the run result (single-shot), persist progression stats, and release
   * job/mission state so the destination beacon and HUD cards don't stick.
   */
  private finalizeRun(completed: boolean) {
    this.completionReported = true;
    this.persistRunStats(completed);
    this.currentTaxiJob = null;
    this.currentMission = null;
    this.lastTripPos = null;
    this.lastMissionPos = null;
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
