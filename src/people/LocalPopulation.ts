import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET } from './HumanoidView';
import { Reservations } from '../systems/Neighborhood';
import { distance } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import type { VehicleController } from '../vehicle/VehicleController';
import type { PopulationSpec } from '../world/ClusterData';
import * as THREE from 'three';

/** Config-driven local population for one cluster. Same state machine shape
 * as the market population (queue → order → seat → drink → leave, danger
 * reactions, bounded reservations) but every position comes from the
 * cluster's PopulationSpec — no hardcoded market coordinates. */
type State = 'walk' | 'wait' | 'order' | 'seat' | 'drink' | 'leave' | 'react' | 'flee' | 'vendor';
/** Candidate-avoidance angles for the movement block below (same set as
 * StreetPeople): the old code rebuilt this 7-element array per moving
 * person per frame. Offsets are multiplied by `side` (±1) at use. */
const AVOID_OFFSETS = [0, 0.7, -0.7, 1.3, -1.3, 1.7, -1.7];
interface Person { id: string; position: Point; view: HumanoidView; state: State; time: number; shop: number; target: Point; speed: number; yaw: number; seat?: string; waypoints: Point[]; action?: string; actionTime?: number;
/** Cached numeric id suffix: the old code ran `p.id.match(/\d+$/)` per
 * moving person per frame. Computed once at creation. */
num: number; }

export class LocalPopulation {
  readonly group = new THREE.Group(); readonly reservations = new Reservations(); readonly people: Person[] = [];
  /** Per-update scratch: car colliders are the same for every person this
   * frame, so they are built once at the top of update() instead of once
   * per avoidance angle (7× per moving person before). */
  private carSolids: Solid[] = [];
  private motionScratch: Point = { x: 0, z: 0 };
  constructor(scene: THREE.Scene, private spec: PopulationSpec, private prefix: string) {
    scene.add(this.group);
    spec.vendors.forEach((v, i) => {
      const view = new HumanoidView(spec.variants[i % spec.variants.length]); this.group.add(view.group);
      view.group.position.set(v.position.x, PEDESTRIAN_FLOOR_OFFSET, v.position.z); view.update(0.2, 'talk');
      this.people.push({ id: `${prefix}-vendor-${i}`, position: { ...v.position }, view, state: 'vendor', time: 0, shop: v.shop, target: { ...v.position }, speed: 0, yaw: 0, waypoints: [], num: i });
    });
    const walkerCount = Math.max(0, spec.variants.length - spec.vendors.length);
    for (let i = 0; i < walkerCount; i++) {
      const spawn = spec.walkerSpawns[i % spec.walkerSpawns.length], shop = i % spec.shopTargets.length;
      const view = new HumanoidView(spec.variants[(spec.vendors.length + i) % spec.variants.length]); this.group.add(view.group);
      view.group.position.set(spawn.x, PEDESTRIAN_FLOOR_OFFSET, spawn.z); view.update(0.2, 'idle');
      this.people.push({ id: `${prefix}-walker-${i}`, position: { ...spawn }, view, state: 'walk', time: 0, shop, target: { ...spec.shopTargets[shop] }, speed: 0, yaw: 0, waypoints: [], num: i });
    }
  }
  serve(shop: number): void { const vendor = this.people.find(p => p.state === 'vendor' && p.shop === shop); if (vendor) { vendor.action = 'handover'; vendor.actionTime = 1.2; } }
  get seats(): { id: string; x: number; z: number; yaw: number }[] { return this.spec.seats; }
  get colliders(): Solid[] { return this.people.filter(p => p.state !== 'vendor').map(p => ({ ...p.position, width: 0.6, depth: 0.6, height: 1.75, yaw: 0 })); }
  private release(p: Person): void { p.waypoints = []; this.reservations.release(p.id); p.seat = undefined; }
  private leaveSeat(p: Person, world: CollisionWorld, cars: readonly VehicleController[], player?: Point): boolean {
    if (p.state !== 'drink') return true;
    const seat = this.spec.seats.find(s => s.id === p.seat); if (!seat) return true;
    const facing = { x: Math.sin(seat.yaw), z: Math.cos(seat.yaw) }, side = { x: Math.cos(seat.yaw), z: -Math.sin(seat.yaw) };
    const exits = [0, -1.3, 1.3].map(o => ({ x: seat.x + facing.x * 0.8 + side.x * o, z: seat.z + facing.z * 0.8 + side.z * o }));
    const exit = exits.find(q => world.isClear(q, 0.3, 0, 1.8, cars.map(c => c.collider)) && this.people.every(o => o === p || distance(o.position, q) >= 0.65) && (!player || distance(player, q) >= 0.7));
    if (!exit) return false; p.position = exit; return true;
  }
  update(dt: number, world: CollisionWorld, cars: readonly VehicleController[], focus: Point, player?: Point): void {
    // Car colliders are the same for every person this frame: build once.
    const carSolids = this.carSolids; carSolids.length = 0; for (const c of cars) carSolids.push(c.collider);
    for (const p of this.people) {
      p.time += dt; p.view.group.visible = distance(p.position, focus) < 100;
      if (!p.view.group.visible) { if (p.state !== 'vendor' && this.leaveSeat(p, world, cars, player)) { this.release(p); p.state = 'leave'; p.time = 0; p.target = this.spec.leaveTarget(p.shop); } continue; }
      const danger = cars.find(c => c.kmh > 15 && distance(c.position, p.position) < 6);
      if (danger && p.state !== 'vendor' && p.state !== 'flee' && p.state !== 'react' && this.leaveSeat(p, world, cars, player)) {
        this.release(p); p.state = 'react'; p.time = 0;
        const dx = p.position.x - danger.position.x, dz = p.position.z - danger.position.z, len = Math.hypot(dx, dz) || 1;
        p.target = { x: p.position.x + dx / len * 4, z: p.position.z + dz / len * 4 };
      }
      if (p.state === 'react' && p.time > 0.8) { p.state = 'flee'; p.time = 0; }
      if (p.state === 'walk') {
        const queue = `queue-${this.prefix}-${p.shop}`;
        if (distance(p.position, p.target) < 0.3 && this.reservations.reserve(queue, p.id)) { p.state = 'wait'; p.time = 0; }
      } else if (p.state === 'wait' && p.time > 2) { p.state = 'order'; p.time = 0; }
      else if (p.state === 'order' && p.time > 2.4) {
        this.release(p);
        const seat = [...this.spec.seats].sort((a, b) => distance(a, p.position) - distance(b, p.position)).find(s => this.reservations.reserve(s.id, p.id));
        if (seat) {
          const facing = { x: Math.sin(seat.yaw), z: Math.cos(seat.yaw) }, side = { x: Math.cos(seat.yaw), z: -Math.sin(seat.yaw) };
          p.state = 'seat'; p.target = { x: seat.x + facing.x * 0.7, z: seat.z + facing.z * 0.7 };
          p.waypoints = [{ x: seat.x + facing.x * 1.3 + side.x, z: seat.z + facing.z * 1.3 + side.z }]; p.seat = seat.id;
        } else { p.state = 'leave'; p.target = this.spec.leaveTarget(p.shop); }
        p.time = 0;
      } else if (p.state === 'seat' && distance(p.position, p.target) < 0.3) {
        const seat = this.spec.seats.find(s => s.id === p.seat)!;
        if (this.people.every(o => o === p || distance(o.position, seat) >= 0.66) && (!player || distance(player, seat) >= 0.7) && cars.every(c => distance(c.position, seat) > Math.hypot(c.width, c.length) / 2 + 0.4)) {
          p.state = 'drink'; p.time = 0; p.position = { x: seat.x, z: seat.z }; p.yaw = seat.yaw;
        }
      }
      else if (p.state === 'drink' && p.time > 9 && this.leaveSeat(p, world, cars, player)) { p.state = 'leave'; this.release(p); p.target = this.spec.leaveTarget(p.shop); p.time = 0; }
      else if ((p.state === 'leave' || p.state === 'flee') && (distance(p.position, p.target) < 0.3 || p.time > 12)) {
        this.release(p); p.shop = (p.shop + 1) % this.spec.shopTargets.length; p.state = 'walk'; p.target = { ...this.spec.shopTargets[p.shop] }; p.time = 0;
      }
      const moving = ['walk', 'seat', 'leave', 'flee'].includes(p.state); p.speed = 0;
      if (moving) {
        if (p.waypoints.length && distance(p.position, p.waypoints[0]) < 0.25) p.waypoints.shift();
        const goal = p.waypoints[0] ?? p.target, dx = goal.x - p.position.x, dz = goal.z - p.position.z, len = Math.hypot(dx, dz);
        if (len > 0.15) {
          const pace = p.state === 'flee' ? 3.4 : 1.35, step = Math.min(len, pace * dt), heading = Math.atan2(dx, dz), side = p.num % 2 ? 1 : -1;
          // First clear angle wins, in the same order as before. The old code
          // built the 7-angle array + 7 motion objects + 7 car-collider arrays
          // per moving person per frame; this loop allocates nothing itself
          // (the moveCircle result is CollisionWorld-owned — see DECISIONS.md).
          let candidate: Point | undefined;
          for (let a = 0; a < AVOID_OFFSETS.length; a++) {
            const angle = heading + AVOID_OFFSETS[a] * side;
            this.motionScratch.x = Math.sin(angle) * step; this.motionScratch.z = Math.cos(angle) * step;
            const next = world.moveCircle(p.position, this.motionScratch, 0.3, 0, carSolids);
            if (distance(next, p.position) > step * 0.2 && !this.people.some(o => o !== p && distance(o.position, next) < 0.63) && (!player || distance(player, next) >= 0.7)) { candidate = next; break; }
          }
          if (candidate) { p.speed = distance(p.position, candidate) / dt; p.yaw = Math.atan2(candidate.x - p.position.x, candidate.z - p.position.z); p.position = candidate; }
        }
      }
      if (p.state !== 'vendor' && p.time > 24 && this.leaveSeat(p, world, cars, player)) { this.release(p); p.state = 'leave'; p.target = this.spec.leaveTarget(p.shop); p.time = 0; }
      p.view.group.position.set(p.position.x, PEDESTRIAN_FLOOR_OFFSET, p.position.z); p.view.group.rotation.y = p.yaw;
      const anim = p.state === 'vendor' ? 'talk' : p.state === 'drink' ? (p.time < 0.8 ? 'sit_down' : p.time > 8 ? 'stand' : 'sit_drink') : p.state === 'react' ? 'react' : p.speed > 0.1 ? (p.state === 'flee' ? 'flee' : 'walk') : p.state === 'order' ? 'talk' : 'wait';
      if (p.actionTime) { p.actionTime = Math.max(0, p.actionTime - dt); if (!p.actionTime) p.action = undefined; }
      p.view.update(dt, p.action ?? anim, p.speed);
    }
  }
  dispose(): void { this.people.forEach(p => p.view.dispose()); }
}
