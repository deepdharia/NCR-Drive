import { MissionDefinition } from './MissionManager';
import { Gear, Weather } from '../types';

/**
 * Extended mission definition for the Phase-2 mission packs.
 *
 * Compatible with the base MissionDefinition shape (so the lead can register
 * these directly in MissionManager), plus optional mechanic fields that the
 * completion wiring can enforce:
 * - requiredGear: finish inside the radius in this gear ('P' or 'R')
 * - stopSpeedKmh: max speed allowed inside the radius to complete
 * - checkpoints: sequential targets (lead wires sequencing); targetPos is the
 *   final checkpoint so the shape degrades gracefully
 * - maxFuelLitres: fuel cap for eco missions (fuel used since mission start)
 * - maxOverKmh: speed-discipline margin above the posted roadInfo.speedLimit
 * - weather: weather to apply when the mission starts (lead wires setWeather)
 */
export interface MissionDef extends MissionDefinition {
  tier: 1 | 2 | 3;
  requiredGear?: Extract<Gear, 'P' | 'R'>;
  stopSpeedKmh?: number;
  checkpoints?: [number, number, number][];
  checkpointRadiusM?: number;
  maxFuelLitres?: number;
  maxOverKmh?: number;
  weather?: Weather;
}

export const MISSION_PACKS: MissionDef[] = [
  // ---------------------------------------------------------------- ROOKIE
  {
    id: 'm_reverse_parking_2',
    type: 'parking',
    tier: 1,
    title: 'Reverse Bay: Cyber Hub Parking',
    hindiTitle: 'रिवर्स पार्किंग: साइबर हब',
    description:
      'Back into the marked bay at Cyber Hub. Finish inside the zone in Reverse (R) under 2 km/h — mirrors out, no rush.',
    rewardCash: 4200,
    timeLimitSec: 60,
    startPos: [120, 0, 760],
    startHeading: 0,
    targetPos: [150, 0, 810],
    targetRadius: 8,
    requiredGear: 'R',
    stopSpeedKmh: 2,
  },
  {
    id: 'm_parallel_parking_2',
    type: 'parking',
    tier: 1,
    title: 'Parallel Park: Connaught Place',
    hindiTitle: 'पैरेलल पार्किंग: कनॉट प्लेस',
    description:
      'Slide into the tight roadside bay at Connaught Place. Shift to Park (P) inside the 6 m zone before the timer runs out.',
    rewardCash: 4500,
    timeLimitSec: 55,
    startPos: [0, 0, -850],
    startHeading: 0,
    targetPos: [-30, 0, -790],
    targetRadius: 6,
    requiredGear: 'P',
    stopSpeedKmh: 2,
  },
  {
    id: 'm_precision_stop_2',
    type: 'parking',
    tier: 1,
    title: 'Red Light Stop: IFFCO Chowk',
    hindiTitle: 'सटीक स्टॉप: इफ्को चौक',
    description:
      'The signal just turned red at IFFCO Chowk. Stop with your nose inside the 4 m stop box under 2 km/h — any gear.',
    rewardCash: 4000,
    timeLimitSec: 50,
    startPos: [0, 0, 990],
    startHeading: 0,
    targetPos: [0, 0, 1050],
    targetRadius: 4,
    stopSpeedKmh: 2,
  },
  {
    id: 'm_speed_discipline_2',
    type: 'speed_camera',
    tier: 1,
    title: 'Radar Zone: Ring Road',
    hindiTitle: 'रडार ज़ोन: रिंग रोड',
    description:
      'Traffic police radar is live on the Ring Road approach. Stay within 10 km/h of the posted limit all the way to NH-48.',
    rewardCash: 4800,
    timeLimitSec: 75,
    startPos: [0, 0, -550],
    startHeading: 0,
    targetPos: [0, 0, -250],
    targetRadius: 12,
    maxOverKmh: 10,
  },

  // ---------------------------------------------------------------- DRIVER
  {
    id: 'm_checkpoint_chase_2',
    type: 'highway',
    tier: 2,
    title: 'Gurgaon Checkpoint Rally',
    hindiTitle: 'गुड़गांव चेकपॉइंट रैली',
    description:
      'Hit every checkpoint in order — Cyber City, Cyber Hub, MG Road. Miss one and the rally is over. Clean driving, quick lines.',
    rewardCash: 7500,
    timeLimitSec: 120,
    startPos: [0, 0, 450],
    startHeading: 0,
    targetPos: [-140, 0, 950],
    targetRadius: 12,
    checkpoints: [
      [0, 0, 620],
      [120, 0, 800],
      [-140, 0, 950],
    ],
    checkpointRadiusM: 12,
  },
  {
    id: 'm_eco_delivery_2',
    type: 'fuel_saver',
    tier: 2,
    title: 'Eco Courier: Manesar Parts Run',
    hindiTitle: 'इको कूरियर: मानेसर',
    description:
      'Deliver the parts crate to Manesar burning under 0.4 litres. Feather the throttle — full-send driving fails this run.',
    rewardCash: 6800,
    timeLimitSec: 130,
    startPos: [0, 0, 1380],
    startHeading: 0,
    targetPos: [-100, 0, 1800],
    targetRadius: 12,
    maxFuelLitres: 0.4,
  },
  {
    id: 'm_clean_highway_2',
    type: 'highway',
    tier: 2,
    title: 'Spotless Expressway: Toll to Outskirts',
    hindiTitle: 'साफ़ एक्सप्रेसवे रन',
    description:
      'Kherki Daula toll to the Haryana outskirts with zero collisions and no more than 15 km/h over the limit. Perfection pays.',
    rewardCash: 8200,
    timeLimitSec: 120,
    startPos: [0, 0, 280],
    startHeading: 0,
    targetPos: [0, 0, 1380],
    targetRadius: 15,
    maxOverKmh: 15,
  },
  {
    id: 'm_night_rain_taxi_2',
    type: 'vip_escort',
    tier: 2,
    title: 'Monsoon Airport Dash',
    hindiTitle: 'बारिश में एयरपोर्ट डैश',
    description:
      'A VIP lands in 100 seconds and it is pouring. Blast from Connaught Place to IGI T3 in the rain — grip is low, stakes are high.',
    rewardCash: 9000,
    timeLimitSec: 100,
    startPos: [0, 0, -800],
    startHeading: 0,
    targetPos: [-220, 0, -600],
    targetRadius: 15,
    weather: 'rain',
  },

  // ---------------------------------------------------------------- PRO
  {
    id: 'm_checkpoint_chase_3',
    type: 'highway',
    tier: 3,
    title: 'NCR Grand Tour',
    hindiTitle: 'एनसीआर ग्रैंड टूर',
    description:
      'The ultimate rally: CP to IGI Airport, back past the toll, Cyber Hub, and finish at Old Rao Dhaba. Five checkpoints, one shot.',
    rewardCash: 12000,
    timeLimitSec: 240,
    startPos: [0, 0, -950],
    startHeading: 0,
    targetPos: [80, 0, 1550],
    targetRadius: 15,
    checkpoints: [
      [0, 0, -800],
      [-220, 0, -600],
      [0, 0, 150],
      [120, 0, 800],
      [80, 0, 1550],
    ],
    checkpointRadiusM: 15,
  },
  {
    id: 'm_eco_delivery_3',
    type: 'fuel_saver',
    tier: 3,
    title: 'Hyper-miler: Delhi to Manesar',
    hindiTitle: 'हाइपर-माइलर: दिल्ली-मानेसर',
    description:
      'Nearly 2 km from the NH-48 portal to Manesar on under 1.2 litres. Coast the declines, short-shift, never brake late.',
    rewardCash: 11000,
    timeLimitSec: 240,
    startPos: [0, 0, -250],
    startHeading: 0,
    targetPos: [-100, 0, 1800],
    targetRadius: 12,
    maxFuelLitres: 1.2,
  },
  {
    id: 'm_parallel_parking_3',
    type: 'parking',
    tier: 3,
    title: 'Valet Pro: Ambience Tight Bay',
    hindiTitle: 'वैले प्रो: एम्बियंस मॉल',
    description:
      'The valet bay at Ambience Mall is only 4 m wide and a queue is forming. Nail it in Park (P) in 40 seconds flat.',
    rewardCash: 10000,
    timeLimitSec: 40,
    startPos: [-140, 0, 910],
    startHeading: 0,
    targetPos: [-170, 0, 960],
    targetRadius: 4,
    requiredGear: 'P',
    stopSpeedKmh: 2,
  },
  {
    id: 'm_speed_discipline_3',
    type: 'speed_camera',
    tier: 3,
    title: 'Speed Camera Gauntlet',
    hindiTitle: 'स्पीड कैमरा गॉंटलेट',
    description:
      'NH-48 to IFFCO Chowk through 100, 30 (toll), 90, 60 and 50 zones. Exceed any posted limit by more than 5 km/h and you fail.',
    rewardCash: 15000,
    timeLimitSec: 200,
    startPos: [0, 0, 50],
    startHeading: 0,
    targetPos: [0, 0, 1050],
    targetRadius: 12,
    maxOverKmh: 5,
  },
];
