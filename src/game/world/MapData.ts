import * as THREE from 'three';
import { GroundHeightResult } from '../physics/VehiclePhysics';
import { RoadSegment, RoadWaypoint } from '../types';

export interface POI {
  id: string;
  name: string;
  hindiName: string;
  zone: 'Delhi' | 'Gurgaon' | 'Highway' | 'Haryana';
  position: [number, number, number];
  parkingSpot?: [number, number, number];
  description: string;
  /** Horizontal discovery radius in meters (default 25). */
  discoveryRadius?: number;
  /** Cash bonus on first discovery (default ₹150). */
  discoveryBonus?: number;
}

export const POINTS_OF_INTEREST: POI[] = [
  {
    id: 'india_gate',
    name: 'India Gate Memorial',
    hindiName: 'इंडिया गेट',
    zone: 'Delhi',
    position: [0, 0, -1100],
    parkingSpot: [25, 0, -1080],
    description: 'Iconic war memorial archway on Kartavya Path.',
    discoveryRadius: 40,
    discoveryBonus: 250
  },
  {
    id: 'connaught_place',
    name: 'Connaught Place Inner Circle',
    hindiName: 'कनॉट प्लेस',
    zone: 'Delhi',
    position: [0, 0, -800],
    parkingSpot: [-30, 0, -790],
    description: 'Colonnaded Georgian architecture circular hub and metro junction.',
    discoveryRadius: 45,
    discoveryBonus: 200
  },
  {
    id: 'igi_airport',
    name: 'IGI Airport Terminal 3',
    hindiName: 'आईजीआई एयरपोर्ट टी३',
    zone: 'Delhi',
    position: [-220, 0, -600],
    parkingSpot: [-200, 0, -620],
    description: 'International departures forecourt with drop-off lane.',
    discoveryRadius: 50,
    discoveryBonus: 200
  },
  {
    id: 'dhaula_kuan',
    name: 'Dhaula Kuan Flyover',
    hindiName: 'धौला कुआँ फ्लाईओवर',
    zone: 'Delhi',
    position: [0, 7.5, -400],
    parkingSpot: [0, 7.5, -400],
    description: 'Multi-tier elevated flyover passing over Delhi Ring Road.',
    discoveryRadius: 35,
    discoveryBonus: 150
  },
  {
    id: 'toll_plaza',
    name: 'Kherki Daula FASTag Toll',
    hindiName: 'खेड़की दौला टोल प्लाज़ा',
    zone: 'Highway',
    position: [0, 0, 150],
    parkingSpot: [18, 0, 150],
    description: 'Electronic toll lanes with FASTag overhead scanners.',
    discoveryRadius: 30,
    discoveryBonus: 100
  },
  {
    id: 'cyber_hub',
    name: 'Cyber City Hub',
    hindiName: 'साइबर हब गुड़गांव',
    zone: 'Gurgaon',
    position: [120, 0, 800],
    parkingSpot: [150, 0, 810],
    description: 'Futuristic glass-and-steel IT tech park and nightlife hub.',
    discoveryRadius: 40,
    discoveryBonus: 200
  },
  {
    id: 'mg_road_mall',
    name: 'Ambience & MG Road Malls',
    hindiName: 'एमजी रोड मॉल',
    zone: 'Gurgaon',
    position: [-140, 0, 950],
    parkingSpot: [-170, 0, 960],
    description: 'Shopping district with multi-tier valet parking.',
    discoveryRadius: 35,
    discoveryBonus: 150
  },
  {
    id: 'iffco_chowk',
    name: 'IFFCO Chowk Junction',
    hindiName: 'इफ्को चौक',
    zone: 'Gurgaon',
    position: [0, 0, 1050],
    parkingSpot: [20, 0, 1070],
    description: 'Major transit intersection with underpass and bus stops.',
    discoveryRadius: 35,
    discoveryBonus: 150
  },
  {
    id: 'murthal_dhaba',
    name: 'Old Rao Punjabi Dhaba',
    hindiName: 'ओल्ड राव ढाबा',
    zone: 'Haryana',
    position: [80, 0, 1550],
    parkingSpot: [110, 0, 1550],
    description: 'Open-air highway eatery serving hot parathas and sweet kulhad chai.',
    discoveryRadius: 25,
    discoveryBonus: 200
  },
  {
    id: 'manesar_industrial',
    name: 'Manesar Auto Industrial Zone',
    hindiName: 'मानेसर इंडस्ट्रियल हब',
    zone: 'Haryana',
    position: [-100, 0, 1800],
    parkingSpot: [-120, 0, 1800],
    description: 'Manufacturing plants, logistics hubs and wide open KMP expressway.',
    discoveryRadius: 40,
    discoveryBonus: 150
  }
];

// Waypoints forming the road graph
export const ROAD_WAYPOINTS: RoadWaypoint[] = [
  // Delhi India Gate & Kartavya Path
  { x: 0, y: 0, z: -1250, zone: 'Delhi', streetName: 'Kartavya Path North', speedLimit: 50 },
  { x: 0, y: 0, z: -1100, zone: 'Delhi', streetName: 'India Gate Roundabout', speedLimit: 40 },
  { x: 0, y: 0, z: -950, zone: 'Delhi', streetName: 'Kartavya Path South', speedLimit: 50 },

  // Connaught Place Circle
  { x: 0, y: 0, z: -800, zone: 'Delhi', streetName: 'Connaught Place Outer', speedLimit: 40 },
  { x: 70, y: 0, z: -800, zone: 'Delhi', streetName: 'Barakhamba Road', speedLimit: 50 },
  { x: -70, y: 0, z: -800, zone: 'Delhi', streetName: 'Baba Kharak Singh Marg', speedLimit: 50 },

  // Airport Branch
  { x: -140, y: 0, z: -700, zone: 'Delhi', streetName: 'Aerocity Link Road', speedLimit: 60 },
  { x: -220, y: 0, z: -600, zone: 'Delhi', streetName: 'IGI Terminal 3 Departure', speedLimit: 40 },

  // Dhaula Kuan Flyover Stretch (Elevated)
  { x: 0, y: 0, z: -550, zone: 'Delhi', streetName: 'Ring Road Approach', speedLimit: 60 },
  { x: 0, y: 3.8, z: -480, zone: 'Delhi', streetName: 'Dhaula Kuan Incline', speedLimit: 70, isBridge: true },
  { x: 0, y: 7.5, z: -400, zone: 'Delhi', streetName: 'Dhaula Kuan Flyover Deck', speedLimit: 70, isBridge: true },
  { x: 0, y: 3.8, z: -320, zone: 'Delhi', streetName: 'Dhaula Kuan Decline', speedLimit: 70, isBridge: true },
  { x: 0, y: 0, z: -250, zone: 'Highway', streetName: 'NH-48 Entry Portal', speedLimit: 80 },

  // NH-48 Delhi-Gurgaon Expressway (3 Lanes each way)
  { x: 0, y: 0, z: -100, zone: 'Highway', streetName: 'NH-48 Delhi Gurgaon Expwy', speedLimit: 100 },
  { x: 0, y: 0, z: 50, zone: 'Highway', streetName: 'NH-48 Express Lanes', speedLimit: 100 },
  { x: 0, y: 0, z: 150, zone: 'Highway', streetName: 'Kherki Daula FASTag Toll', speedLimit: 30 },
  { x: 0, y: 0, z: 280, zone: 'Highway', streetName: 'NH-48 Expressway Post-Toll', speedLimit: 100 },
  { x: 0, y: 0, z: 450, zone: 'Highway', streetName: 'NH-48 Gurgaon Gate', speedLimit: 90 },

  // Gurgaon City: Cyber Hub & MG Road
  { x: 0, y: 0, z: 620, zone: 'Gurgaon', streetName: 'Cyber City Intersection', speedLimit: 60 },
  { x: 120, y: 0, z: 750, zone: 'Gurgaon', streetName: 'Cyber Hub Rapid Metro Way', speedLimit: 50 },
  { x: 120, y: 0, z: 900, zone: 'Gurgaon', streetName: 'Golf Course Road Link', speedLimit: 60 },
  { x: -140, y: 0, z: 800, zone: 'Gurgaon', streetName: 'MG Road Metro Boulevard', speedLimit: 50 },
  { x: -140, y: 0, z: 950, zone: 'Gurgaon', streetName: 'Ambience Mall Promenade', speedLimit: 40 },
  { x: 0, y: 0, z: 1050, zone: 'Gurgaon', streetName: 'IFFCO Chowk Junction', speedLimit: 50 },
  { x: 0, y: 0, z: 1200, zone: 'Gurgaon', streetName: 'Signature Tower Flyover', speedLimit: 60 },

  // Haryana / Manesar Outskirts
  { x: 0, y: 0, z: 1380, zone: 'Haryana', streetName: 'Delhi-Jaipur Highway Outskirts', speedLimit: 80 },
  { x: 80, y: 0, z: 1550, zone: 'Haryana', streetName: 'Old Rao Dhaba Service Lane', speedLimit: 40 },
  { x: 0, y: 0, z: 1680, zone: 'Haryana', streetName: 'IMT Manesar Expressway', speedLimit: 90 },
  { x: -100, y: 0, z: 1800, zone: 'Haryana', streetName: 'KMP Expressway Connector', speedLimit: 100 },
  { x: 0, y: 0, z: 1950, zone: 'Haryana', streetName: 'Southern Peripheral Terminus', speedLimit: 80 },
];

// Road Segments connecting Waypoints
export const ROAD_SEGMENTS: RoadSegment[] = [
  // Delhi
  { id: 's1', start: ROAD_WAYPOINTS[0], end: ROAD_WAYPOINTS[1], lanes: 2, width: 14, speedLimit: 50, streetName: 'Kartavya Path', zone: 'Delhi' },
  { id: 's2', start: ROAD_WAYPOINTS[1], end: ROAD_WAYPOINTS[2], lanes: 2, width: 14, speedLimit: 50, streetName: 'Kartavya Path', zone: 'Delhi' },
  { id: 's3', start: ROAD_WAYPOINTS[2], end: ROAD_WAYPOINTS[3], lanes: 2, width: 14, speedLimit: 50, streetName: 'Connaught Place Radial', zone: 'Delhi' },
  { id: 's4_l', start: ROAD_WAYPOINTS[3], end: ROAD_WAYPOINTS[4], lanes: 2, width: 12, speedLimit: 50, streetName: 'Barakhamba Road', zone: 'Delhi' },
  { id: 's4_r', start: ROAD_WAYPOINTS[3], end: ROAD_WAYPOINTS[5], lanes: 2, width: 12, speedLimit: 50, streetName: 'Baba Kharak Singh Marg', zone: 'Delhi' },
  { id: 's5_air', start: ROAD_WAYPOINTS[5], end: ROAD_WAYPOINTS[6], lanes: 2, width: 12, speedLimit: 60, streetName: 'Aerocity Link Road', zone: 'Delhi' },
  { id: 's6_air', start: ROAD_WAYPOINTS[6], end: ROAD_WAYPOINTS[7], lanes: 2, width: 12, speedLimit: 40, streetName: 'IGI Terminal 3', zone: 'Delhi' },

  // Dhaula Kuan Flyover
  { id: 's7', start: ROAD_WAYPOINTS[3], end: ROAD_WAYPOINTS[8], lanes: 3, width: 18, speedLimit: 60, streetName: 'Ring Road Approach', zone: 'Delhi' },
  { id: 's8', start: ROAD_WAYPOINTS[8], end: ROAD_WAYPOINTS[9], lanes: 3, width: 18, speedLimit: 70, streetName: 'Dhaula Kuan Flyover', zone: 'Delhi' },
  { id: 's9', start: ROAD_WAYPOINTS[9], end: ROAD_WAYPOINTS[10], lanes: 3, width: 18, speedLimit: 70, streetName: 'Dhaula Kuan Flyover Deck', zone: 'Delhi' },
  { id: 's10', start: ROAD_WAYPOINTS[10], end: ROAD_WAYPOINTS[11], lanes: 3, width: 18, speedLimit: 70, streetName: 'Dhaula Kuan Ramp Down', zone: 'Delhi' },
  { id: 's11', start: ROAD_WAYPOINTS[11], end: ROAD_WAYPOINTS[12], lanes: 3, width: 18, speedLimit: 80, streetName: 'NH-48 Portal', zone: 'Highway' },

  // NH-48 Expressway (Divided 3+3 lanes)
  { id: 's12', start: ROAD_WAYPOINTS[12], end: ROAD_WAYPOINTS[13], lanes: 3, width: 22, speedLimit: 100, streetName: 'NH-48 Delhi Gurgaon Expwy', zone: 'Highway' },
  { id: 's13', start: ROAD_WAYPOINTS[13], end: ROAD_WAYPOINTS[14], lanes: 3, width: 22, speedLimit: 100, streetName: 'NH-48 Express Lanes', zone: 'Highway' },
  { id: 's14_toll', start: ROAD_WAYPOINTS[14], end: ROAD_WAYPOINTS[15], lanes: 4, width: 26, speedLimit: 30, streetName: 'Kherki Daula FASTag Toll', zone: 'Highway' },
  { id: 's15', start: ROAD_WAYPOINTS[15], end: ROAD_WAYPOINTS[16], lanes: 3, width: 22, speedLimit: 100, streetName: 'NH-48 Expressway Post-Toll', zone: 'Highway' },
  { id: 's16', start: ROAD_WAYPOINTS[16], end: ROAD_WAYPOINTS[17], lanes: 3, width: 22, speedLimit: 90, streetName: 'NH-48 Gurgaon Gate', zone: 'Highway' },

  // Gurgaon City
  { id: 's17', start: ROAD_WAYPOINTS[17], end: ROAD_WAYPOINTS[18], lanes: 3, width: 20, speedLimit: 60, streetName: 'Cyber City Intersection', zone: 'Gurgaon' },
  { id: 's18_ch', start: ROAD_WAYPOINTS[18], end: ROAD_WAYPOINTS[19], lanes: 2, width: 14, speedLimit: 50, streetName: 'Cyber Hub Rapid Metro Way', zone: 'Gurgaon' },
  { id: 's19_gcr', start: ROAD_WAYPOINTS[19], end: ROAD_WAYPOINTS[20], lanes: 2, width: 14, speedLimit: 60, streetName: 'Golf Course Road Link', zone: 'Gurgaon' },
  { id: 's20_mg', start: ROAD_WAYPOINTS[18], end: ROAD_WAYPOINTS[21], lanes: 2, width: 14, speedLimit: 50, streetName: 'MG Road Boulevard', zone: 'Gurgaon' },
  { id: 's21_mall', start: ROAD_WAYPOINTS[21], end: ROAD_WAYPOINTS[22], lanes: 2, width: 14, speedLimit: 40, streetName: 'Ambience Mall Promenade', zone: 'Gurgaon' },
  { id: 's22_iffco', start: ROAD_WAYPOINTS[18], end: ROAD_WAYPOINTS[23], lanes: 3, width: 20, speedLimit: 50, streetName: 'IFFCO Chowk Junction', zone: 'Gurgaon' },
  { id: 's23_sig', start: ROAD_WAYPOINTS[23], end: ROAD_WAYPOINTS[24], lanes: 3, width: 20, speedLimit: 60, streetName: 'Signature Tower Flyover', zone: 'Gurgaon' },

  // Haryana / Manesar
  { id: 's24', start: ROAD_WAYPOINTS[24], end: ROAD_WAYPOINTS[25], lanes: 3, width: 20, speedLimit: 80, streetName: 'Delhi-Jaipur Highway Outskirts', zone: 'Haryana' },
  { id: 's25_dhaba', start: ROAD_WAYPOINTS[25], end: ROAD_WAYPOINTS[26], lanes: 2, width: 12, speedLimit: 40, streetName: 'Old Rao Dhaba Service Lane', zone: 'Haryana' },
  { id: 's26_imt', start: ROAD_WAYPOINTS[25], end: ROAD_WAYPOINTS[27], lanes: 3, width: 20, speedLimit: 90, streetName: 'IMT Manesar Expressway', zone: 'Haryana' },
  { id: 's27_kmp', start: ROAD_WAYPOINTS[27], end: ROAD_WAYPOINTS[28], lanes: 2, width: 14, speedLimit: 100, streetName: 'KMP Expressway Connector', zone: 'Haryana' },
  { id: 's28_term', start: ROAD_WAYPOINTS[27], end: ROAD_WAYPOINTS[29], lanes: 3, width: 20, speedLimit: 80, streetName: 'Southern Peripheral Terminus', zone: 'Haryana' },
];

/**
 * Calculates ground elevation and surface type at (x, z).
 * Handles flat terrain, Dhaula Kuan flyover ramp, and speed bumps.
 */
export function getGroundHeight(x: number, z: number): GroundHeightResult {
  let height = 0;
  let surfaceType: GroundHeightResult['surfaceType'] = 'asphalt_dry';
  const normal = new THREE.Vector3(0, 1, 0);

  // Dhaula Kuan Flyover Ramp (Z: -520 to -280, X within +/- 11m)
  if (z >= -520 && z <= -280 && Math.abs(x) <= 11) {
    if (z >= -520 && z < -420) {
      // Ascending ramp
      const t = (z - (-520)) / 100;
      // Smooth cubic curve
      const smoothT = t * t * (3 - 2 * t);
      height = smoothT * 7.5;
    } else if (z >= -420 && z <= -360) {
      // Peak deck
      height = 7.5;
    } else if (z > -360 && z <= -280) {
      // Descending ramp
      const t = (z - (-360)) / 80;
      const smoothT = t * t * (3 - 2 * t);
      height = (1 - smoothT) * 7.5;
    }
    surfaceType = 'asphalt_dry';
    return { height, normal, surfaceType };
  }

  // Speed breakers (bumps) in city zones
  // 1. Kartavya Path approach Z: -920
  if (Math.abs(z - (-920)) < 1.4 && Math.abs(x) < 10) {
    height = Math.sin((z - (-920) + 1.4) / 2.8 * Math.PI) * 0.08;
    surfaceType = 'speed_breaker';
    return { height, normal, surfaceType };
  }

  // 2. Near Mall entrance Z: 920
  if (Math.abs(z - 920) < 1.4 && Math.abs(x - (-140)) < 9) {
    height = Math.sin((z - 920 + 1.4) / 2.8 * Math.PI) * 0.08;
    surfaceType = 'speed_breaker';
    return { height, normal, surfaceType };
  }

  // Shoulder dirt: compare against the actual half-width of the nearest road
  // segment (P1-C fix — was a hardcoded |x| > 16 that misclassified paved
  // shoulders on narrow 12 m segments and dirt on the 26 m toll plaza)
  let nearestHalfWidth = 11;
  let nearestSegDistSq = Infinity;
  for (const seg of ROAD_SEGMENTS) {
    const ax = seg.start.x, az = seg.start.z;
    const bx = seg.end.x, bz = seg.end.z;
    const dx = bx - ax, dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    const t = lenSq > 0
      ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / lenSq))
      : 0;
    const px = ax + dx * t, pz = az + dz * t;
    const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dSq < nearestSegDistSq) {
      nearestSegDistSq = dSq;
      nearestHalfWidth = seg.width / 2;
    }
  }
  if (Math.sqrt(nearestSegDistSq) > nearestHalfWidth && (z < 1200 || Math.abs(x - 80) > 14)) {
    surfaceType = 'dirt_shoulder';
  }

  return { height, normal, surfaceType };
}

/**
 * Finds the closest road waypoint and street info for any (x, z)
 */
export function getNearestRoadInfo(x: number, z: number): {
  nearestWaypoint: RoadWaypoint;
  streetName: string;
  speedLimit: number;
  zone: 'Delhi' | 'Gurgaon' | 'Highway' | 'Haryana';
  distance: number;
} {
  let closest = ROAD_WAYPOINTS[0];
  let minDistanceSq = Infinity;

  for (const wp of ROAD_WAYPOINTS) {
    const dx = wp.x - x;
    const dz = wp.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = wp;
    }
  }

  return {
    nearestWaypoint: closest,
    streetName: closest.streetName,
    speedLimit: closest.speedLimit,
    zone: closest.zone,
    distance: Math.sqrt(minDistanceSq)
  };
}

/**
 * Computes shortest path waypoints using Dijkstra / A*
 */
export function findGpsRoute(startPos: [number, number, number], targetPos: [number, number, number]): RoadWaypoint[] {
  const startInfo = getNearestRoadInfo(startPos[0], startPos[2]);
  const endInfo = getNearestRoadInfo(targetPos[0], targetPos[2]);

  // Construct node list
  const startNode = startInfo.nearestWaypoint;
  const targetNode = endInfo.nearestWaypoint;

  if (startNode === targetNode) {
    return [startNode, targetNode];
  }

  // Simple graph traversal for road chain
  const visited = new Set<RoadWaypoint>();
  const queue: { wp: RoadWaypoint; path: RoadWaypoint[] }[] = [{ wp: startNode, path: [startNode] }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.wp === targetNode) {
      return curr.path;
    }

    visited.add(curr.wp);

    // Find neighboring segments
    for (const seg of ROAD_SEGMENTS) {
      let neighbor: RoadWaypoint | null = null;
      if (seg.start === curr.wp) neighbor = seg.end;
      else if (seg.end === curr.wp && !seg.oneWay) neighbor = seg.start;

      if (neighbor && !visited.has(neighbor)) {
        queue.push({
          wp: neighbor,
          path: [...curr.path, neighbor]
        });
      }
    }
  }

  return [startNode, targetNode];
}
