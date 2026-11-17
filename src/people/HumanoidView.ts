import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTER_URL, CharacterAssetError, validateCharacter } from './CharacterAsset';
export const PEDESTRIAN_FLOOR_OFFSET=0.045; // Sole -0.01 m meets the 0.035 m pavement.

/**
 * Phase 6 — lazy character load.
 *
 * Before this phase `src/main.ts` awaited `loadPeople()` before constructing
 * the game, so the 1.6 MB character GLB blocked startup. Now the game boots
 * immediately and the GLB downloads in the background:
 *
 * - `loadPeople(onProgress?)` starts the download once (idempotent) and
 *   reports real download progress from the GLTFLoader (FileLoader streams
 *   the fetch body and dispatches ProgressEvents with loaded/total when the
 *   server sends a Content-Length; `percent` is null when it does not).
 * - A `HumanoidView` built before the template arrives gets a cheap
 *   placeholder figure (capsule torso + head + limbs, ~1.67 m, tinted from
 *   the same variant) and upgrades itself to the real rig the moment the
 *   template installs — no caller has to wait, re-check, or rebuild views.
 *   The player, drivers, pedestrians and the `displace()` driver all go
 *   through this constructor, so every figure upgrades the same way.
 * - If the download fails, the game keeps running on placeholders: the
 *   failure is reported through the progress listeners (state 'failed') and
 *   `loadPeople()` rejects, but nothing in the boot flow throws. A later
 *   `loadPeople()` call retries from scratch.
 * - `installPeopleTemplate()` is the seam between fetch and install: it
 *   validates the GLTF, installs it as the clone template, and upgrades
 *   every pending view. Tests drive it directly with a parsed GLB instead
 *   of a network fetch.
 */
export type PeopleLoadState = 'pending' | 'loading' | 'ready' | 'failed';
export interface PeopleLoadProgress { state: PeopleLoadState; loaded: number; total: number; percent: number | null; }
export type PeopleProgressListener = (progress: PeopleLoadProgress) => void;
/** Fetch the character GLTF, reporting download progress. Injectable so tests can drive progress without a network fetch. */
export type PeopleGltfLoader = (onProgress: (loaded: number, total: number) => void) => Promise<GLTF>;

let template: THREE.Group | undefined;
let clips: THREE.AnimationClip[] = [];
let loadState: PeopleLoadState = 'pending';
let loadPromise: Promise<void> | null = null;
/** Last known download total (0 until the first progress event, or when installed without a download, e.g. in tests). */
let knownTotal = 0;
let lastProgress: PeopleLoadProgress | null = null;
const progressListeners = new Set<PeopleProgressListener>();
const readyListeners = new Set<() => void>();
/** Views built while the template was missing; upgraded on install. */
const pendingViews = new Set<HumanoidView>();

/** Download percent, or null when the server sent no total (indeterminate). */
export function peopleLoadPercent(loaded: number, total: number): number | null {
  return total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : null;
}

export function peopleLoadState(): PeopleLoadState { return loadState; }

function readyProgress(): PeopleLoadProgress {
  return { state: 'ready', loaded: knownTotal, total: knownTotal, percent: 100 };
}

function notifyProgress(progress: PeopleLoadProgress): void {
  lastProgress = progress;
  for (const listener of [...progressListeners]) listener(progress);
}

/** Subscribe to load progress; replays the latest progress immediately so a late subscriber (e.g. Game, built after the download started) still sees the current state. */
export function onPeopleProgress(listener: PeopleProgressListener): () => void {
  progressListeners.add(listener);
  if (lastProgress) listener(lastProgress);
  return () => { progressListeners.delete(listener); };
}

/** Subscribe to the ready event; fires immediately if the template is already installed. */
export function onPeopleReady(listener: () => void): () => void {
  if (loadState === 'ready') { listener(); return () => undefined; }
  readyListeners.add(listener);
  return () => { readyListeners.delete(listener); };
}

function defaultLoadGltf(onProgress: (loaded: number, total: number) => void): Promise<GLTF> {
  return new GLTFLoader().loadAsync(CHARACTER_URL, (event) => onProgress(event.loaded, event.total));
}

export async function loadPeople(onProgress?: PeopleProgressListener, loadGltf: PeopleGltfLoader = defaultLoadGltf): Promise<void> {
  if (loadState === 'ready') { onProgress?.(readyProgress()); return; }
  if (loadPromise) {
    if (onProgress) {
      progressListeners.add(onProgress);
      loadPromise.then(() => progressListeners.delete(onProgress), () => progressListeners.delete(onProgress));
    }
    return loadPromise;
  }
  loadState = 'loading';
  if (onProgress) progressListeners.add(onProgress);
  notifyProgress({ state: 'loading', loaded: 0, total: 0, percent: null });
  const attempt = loadGltf((loaded, total) => {
    knownTotal = total;
    notifyProgress({ state: 'loading', loaded, total, percent: peopleLoadPercent(loaded, total) });
  }).then((gltf) => { installPeopleTemplate(gltf); }).catch((error: unknown) => {
    loadState = 'failed';
    notifyProgress({ state: 'failed', loaded: 0, total: knownTotal, percent: null });
    throw new CharacterAssetError('Required character asset could not be loaded.', { cause: error });
  });
  loadPromise = attempt.finally(() => {
    if (loadState === 'failed') loadPromise = null;
    if (onProgress) progressListeners.delete(onProgress);
  });
  return loadPromise;
}

/** Validate and install a parsed character GLTF as the clone template, then upgrade every placeholder view built so far. */
export function installPeopleTemplate(gltf: GLTF): void {
  validateCharacter(gltf);
  template = gltf.scene;
  clips = gltf.animations;
  loadState = 'ready';
  for (const view of [...pendingViews]) view.upgradeToRig();
  pendingViews.clear();
  notifyProgress(readyProgress());
  for (const listener of [...readyListeners]) listener();
  readyListeners.clear();
}

/** Test-only: drop the installed template so a fresh placeholder path can be exercised in-process. Views built before the reset keep their rigs; views built after it are placeholders until the next install. */
export function resetPeopleLoadForTest(): void {
  template = undefined;
  clips = [];
  loadState = 'pending';
  loadPromise = null;
  knownTotal = 0;
  lastProgress = null;
  progressListeners.clear();
  readyListeners.clear();
}

/** Full per-actor look. A bare number keeps the old shirt-only call working. */
export interface HumanVariant { shirt:number; trousers:number; shoes:number; skin:number; hair:number; scale?:number; accessory?:'none'|'cap'|'bag'; phase?:number; }
export const PLAYER_VARIANT:HumanVariant={shirt:0x357a86,trousers:0x2e3442,shoes:0x4a3220,skin:0xb08a68,hair:0x1f1a16,scale:1,accessory:'none',phase:0};
export const DRIVER_VARIANT:HumanVariant={shirt:0x877f63,trousers:0x3a3f4a,shoes:0x2e2620,skin:0x9a6b4a,hair:0x201a14,scale:0.93,accessory:'none',phase:0.4};
const DEFAULT_VARIANT:HumanVariant={shirt:0x417d80,trousers:0x3c4855,shoes:0x352e29,skin:0xaf8565,hair:0x2c241f,scale:1,accessory:'none',phase:0};
function resolveVariant(variant:HumanVariant|number):HumanVariant {return typeof variant==='number'?{...DEFAULT_VARIANT,shirt:variant}:{...DEFAULT_VARIANT,...variant};}
/** Shared accessory geometry/materials: no per-actor allocation, never disposed per actor. */
const capGeo=new THREE.SphereGeometry(0.105,12,8,0,Math.PI*2,0,Math.PI/2);
const capBrimGeo=new THREE.CylinderGeometry(0.105,0.115,0.012,12);
const capMaterials=[0x6d3b2c,0x2e4a5e,0x8a7a4a].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.9}));
const bagGeo=new THREE.BoxGeometry(0.17,0.24,0.08);
const bagStrapGeo=new THREE.BoxGeometry(0.03,0.42,0.012);
const bagMaterials=[0x5a4632,0x2e2a26].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.95}));
const ROUGHNESS:Record<string,number>={Skin:0.65,Shirt:0.92,Trousers:0.92,Shoes:0.7,Hair:0.9,Eyes:0.35};
/** Reused smoke-puff dummy: HumanoidView.update used to allocate a fresh Object3D every frame for every smoking pedestrian (see PERF_AFTER.md). */
const smokeDummy = new THREE.Object3D();
/** Shared geometry and skin, independent skeleton/mixer. Authored clips blend at 0.18s. */
export class HumanoidView {
 readonly group=new THREE.Group(); private variant:HumanVariant; private mixer:THREE.AnimationMixer|undefined; private actions=new Map<string,THREE.AnimationAction>(); private current='';
 private cup:THREE.Mesh|undefined; private phone:THREE.Mesh|undefined; private cigarette:THREE.Mesh|undefined; private smoke:THREE.InstancedMesh|undefined; private time=0; private phase=0;
 private placeholder:THREE.Group|undefined; private placeholderParts:{geometry:THREE.BufferGeometry;material:THREE.Material}[]=[];
 constructor(variant:HumanVariant|number=PLAYER_VARIANT){
  const v=resolveVariant(variant); this.variant=v; this.phase=v.phase??0;
  this.group.scale.setScalar(v.scale??1);
  // Before the GLB arrives, stand in a placeholder figure and upgrade when
  // the template installs — the game never waits on the download.
  if(template) this.buildRig(v);
  else { this.buildPlaceholder(v); pendingViews.add(this); }
 }
 /** True once the GLB rig is installed (immediately, or after the background load swaps the placeholder in). */
 get ready(): boolean { return this.mixer !== undefined; }
 /** Swap the placeholder figure for the real GLB rig. Called automatically when the background load finishes; a no-op if the rig is already installed or the template still hasn't arrived. */
 upgradeToRig(): void {
  if(this.mixer||!template) return;
  pendingViews.delete(this);
  this.disposePlaceholder();
  this.buildRig(this.variant);
 }
 private disposePlaceholder(): void {
  if(this.placeholder){ this.group.remove(this.placeholder); this.placeholder=undefined; }
  for(const part of this.placeholderParts){ part.geometry.dispose(); part.material.dispose(); }
  this.placeholderParts=[];
 }
 /** Cheap stand-in while the GLB downloads: capsule torso, head, two legs, two arms, ~1.67 m, tinted from the same variant so the swap-in reads as the same person. Per-view geometry/materials (not shared) so Game.dispose's scene traverse and upgrade both dispose them exactly once. */
 private buildPlaceholder(v:HumanVariant): void {
  const group=new THREE.Group();
  const shirt=new THREE.MeshStandardMaterial({color:v.shirt,roughness:0.92});
  const trousers=new THREE.MeshStandardMaterial({color:v.trousers,roughness:0.92});
  const skin=new THREE.MeshStandardMaterial({color:v.skin,roughness:0.65});
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number):void=>{
   const mesh=new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); mesh.castShadow=true; group.add(mesh);
   this.placeholderParts.push({geometry,material});
  };
  add(new THREE.CapsuleGeometry(0.17,0.62,4,10),shirt,0,0.98,0);
  add(new THREE.SphereGeometry(0.115,12,10),skin,0,1.55,0);
  add(new THREE.BoxGeometry(0.11,0.62,0.13),trousers,-0.09,0.31,0);
  add(new THREE.BoxGeometry(0.11,0.62,0.13),trousers,0.09,0.31,0);
  add(new THREE.BoxGeometry(0.08,0.55,0.1),shirt,-0.26,0.98,0);
  add(new THREE.BoxGeometry(0.08,0.55,0.1),shirt,0.26,0.98,0);
  this.placeholder=group; this.group.add(group);
 }
 private buildRig(v:HumanVariant): void {
  const model=clone(template!); this.group.add(model); this.mixer=new THREE.AnimationMixer(model);
  const palette=new Map<THREE.Material,THREE.Material>(),skeletons=new Map<string,THREE.Skeleton>();
  const colors:Record<string,number>={Skin:v.skin,Shirt:v.shirt,Trousers:v.trousers,Shoes:v.shoes,Hair:v.hair};
  model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join(',');const shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}if(o instanceof THREE.Mesh){o.castShadow=true;o.frustumCulled=false;const tint=(m:THREE.Material)=>{if(m.name in colors){if(!palette.has(m)){const next=m.clone() as THREE.MeshStandardMaterial;next.color.setHex(colors[m.name]);next.roughness=ROUGHNESS[m.name]??next.roughness;palette.set(m,next);}return palette.get(m)!;}return m;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);}});
  if(v.accessory==='cap'){const head=model.getObjectByName('Head');if(head){const cap=new THREE.Mesh(capGeo,capMaterials[0]);cap.scale.set(1,0.72,1.05);cap.position.set(0,0.055,0.005);const brim=new THREE.Mesh(capBrimGeo,capMaterials[0]);brim.scale.set(1,1,1.25);brim.position.set(0,0.012,0.075);head.add(cap,brim);}}
  if(v.accessory==='bag'){const spine=model.getObjectByName('spine_02');if(spine){const bag=new THREE.Mesh(bagGeo,bagMaterials[0]);bag.position.set(0.17,-0.28,0.04);bag.rotation.z=0.08;const strap=new THREE.Mesh(bagStrapGeo,bagMaterials[1]);strap.position.set(0.07,0.02,-0.02);strap.rotation.z=0.9;spine.add(bag,strap);}}
  clips.forEach(c=>{const action=this.mixer!.clipAction(c);if(['sit_down','stand','enter','exit','takeover'].includes(c.name)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}this.actions.set(c.name,action);});const handover=clips.find(c=>c.name==='talk')!.clone();handover.name='handover';this.actions.set('handover',this.mixer.clipAction(handover));
  this.cup=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.03,0.095,10),new THREE.MeshStandardMaterial({color:0xe9dfc2,roughness:0.9}));
  const tea=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.004,10),new THREE.MeshStandardMaterial({color:0x68422a,roughness:0.7}));tea.position.y=0.048;this.cup.add(tea);
  this.phone=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.115,0.012),new THREE.MeshStandardMaterial({color:0x1e343b,emissive:0x427c8a,emissiveIntensity:0.3}));
  this.cigarette=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.07,5),new THREE.MeshStandardMaterial({color:0xbfb49a,roughness:0.9}));
  this.smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(0.018,4,3),new THREE.MeshBasicMaterial({color:0xb5b9b0,transparent:true,opacity:0.12,depthWrite:false}),4);
  const hand=model.getObjectByName('hand_r')!;hand.add(this.cup,this.phone,this.cigarette,this.smoke);this.cigarette.position.set(0,0.135,0);this.cup.position.set(0,0.135,0.055);this.phone.position.set(0,0.135,0.02);this.cup.visible=this.phone.visible=this.cigarette.visible=this.smoke.visible=false;
 }
 update(dt:number,animation='idle',speed=0):void {
  // Placeholder figure: stands still until the rig arrives. Owners still
  // move/rotate the group, so pedestrians and drivers are in the right
  // place when they upgrade.
  if(!this.mixer) return;
  const action=this.actions.get(animation)??this.actions.get('idle')!;
  if(this.current!==animation){this.actions.get(this.current)?.fadeOut(0.18);action.reset().fadeIn(0.18).play();action.time=this.phase%(action.getClip().duration||1);this.current=animation;}
  action.timeScale=animation==='walk'?Math.max(0.5,speed/1.6):animation==='run'||animation==='flee'?Math.max(0.7,speed/3.4):1;
  if(this.cup) this.cup.visible=animation==='drink'||animation==='sit_drink'||animation==='handover';
  if(this.phone) this.phone.visible=animation==='pay';
  this.mixer.update(dt);
  const smoking=animation==='smoke'||animation==='sit_smoke';
  if(this.cigarette) this.cigarette.visible=smoking;
  if(this.smoke) this.smoke.visible=smoking;
  if(this.smoke?.visible){this.time+=dt;for(let i=0;i<4;i++){const t=(this.time*0.5+i/4)%1;smokeDummy.position.set(Math.sin(t*4)*0.02,0.15+t*0.16,0);smokeDummy.scale.setScalar(0.4+t);smokeDummy.updateMatrix();this.smoke.setMatrixAt(i,smokeDummy.matrix);}this.smoke.instanceMatrix.needsUpdate=true;}
 }
 dispose():void {
  pendingViews.delete(this);
  this.disposePlaceholder();
  this.mixer?.stopAllAction();
  if(this.mixer) this.mixer.uncacheRoot(this.mixer.getRoot());
 }
}
