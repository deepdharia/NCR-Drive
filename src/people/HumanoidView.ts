import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
export const PEDESTRIAN_FLOOR_OFFSET=0.045; // Sole -0.01 m meets the 0.035 m pavement.
let template:THREE.Group; let clips:THREE.AnimationClip[]=[];
export async function loadPeople():Promise<void> {const gltf=await new GLTFLoader().loadAsync('/assets/people/delhi-adult.glb');template=gltf.scene;clips=gltf.animations;}
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
/** Shared geometry and skin, independent skeleton/mixer. Authored clips blend at 0.18s. */
export class HumanoidView {
 readonly group=new THREE.Group(); private mixer:THREE.AnimationMixer;private actions=new Map<string,THREE.AnimationAction>();private current='';
 private cup:THREE.Mesh;private phone:THREE.Mesh;private cigarette:THREE.Mesh;private smoke:THREE.InstancedMesh;private time=0;private phase=0;
 constructor(variant:HumanVariant|number=PLAYER_VARIANT){
  const v=resolveVariant(variant);this.phase=v.phase??0;
  const model=clone(template);this.group.add(model);this.group.scale.setScalar(v.scale??1);this.mixer=new THREE.AnimationMixer(model);
  const palette=new Map<THREE.Material,THREE.Material>(),skeletons=new Map<string,THREE.Skeleton>();
  const colors:Record<string,number>={Skin:v.skin,Shirt:v.shirt,Trousers:v.trousers,Shoes:v.shoes,Hair:v.hair};
  model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join(',');const shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}if(o instanceof THREE.Mesh){o.castShadow=true;o.frustumCulled=false;const tint=(m:THREE.Material)=>{if(m.name in colors){if(!palette.has(m)){const next=m.clone() as THREE.MeshStandardMaterial;next.color.setHex(colors[m.name]);next.roughness=ROUGHNESS[m.name]??next.roughness;palette.set(m,next);}return palette.get(m)!;}return m;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);}});
  if(v.accessory==='cap'){const head=model.getObjectByName('Head');if(head){const cap=new THREE.Mesh(capGeo,capMaterials[0]);cap.scale.set(1,0.72,1.05);cap.position.set(0,0.055,0.005);const brim=new THREE.Mesh(capBrimGeo,capMaterials[0]);brim.scale.set(1,1,1.25);brim.position.set(0,0.012,0.075);head.add(cap,brim);}}
  if(v.accessory==='bag'){const spine=model.getObjectByName('spine_02');if(spine){const bag=new THREE.Mesh(bagGeo,bagMaterials[0]);bag.position.set(0.17,-0.28,0.04);bag.rotation.z=0.08;const strap=new THREE.Mesh(bagStrapGeo,bagMaterials[1]);strap.position.set(0.07,0.02,-0.02);strap.rotation.z=0.9;spine.add(bag,strap);}}
  clips.forEach(c=>{const action=this.mixer.clipAction(c);if(['sit_down','stand','enter','exit','takeover'].includes(c.name)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}this.actions.set(c.name,action);});const handover=clips.find(c=>c.name==='talk')!.clone();handover.name='handover';this.actions.set('handover',this.mixer.clipAction(handover));
  this.cup=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.03,0.095,10),new THREE.MeshStandardMaterial({color:0xe9dfc2,roughness:0.9}));
  const tea=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.004,10),new THREE.MeshStandardMaterial({color:0x68422a,roughness:0.7}));tea.position.y=0.048;this.cup.add(tea);
  this.phone=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.115,0.012),new THREE.MeshStandardMaterial({color:0x1e343b,emissive:0x427c8a,emissiveIntensity:0.3}));
  this.cigarette=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.07,5),new THREE.MeshStandardMaterial({color:0xbfb49a,roughness:0.9}));
  this.smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(0.018,4,3),new THREE.MeshBasicMaterial({color:0xb5b9b0,transparent:true,opacity:0.12,depthWrite:false}),4);
  const hand=model.getObjectByName('hand_r')!;hand.add(this.cup,this.phone,this.cigarette,this.smoke);this.cigarette.position.set(0,0.135,0);this.cup.position.set(0,0.135,0.055);this.phone.position.set(0,0.135,0.02);this.cup.visible=this.phone.visible=this.cigarette.visible=this.smoke.visible=false;
 }
 update(dt:number,animation='idle',speed=0):void {
  const action=this.actions.get(animation)??this.actions.get('idle')!;
  if(this.current!==animation){this.actions.get(this.current)?.fadeOut(0.18);action.reset().fadeIn(0.18).play();action.time=this.phase%(action.getClip().duration||1);this.current=animation;}
  action.timeScale=animation==='walk'?Math.max(0.5,speed/1.6):animation==='run'||animation==='flee'?Math.max(0.7,speed/3.4):1;
  this.cup.visible=animation==='drink'||animation==='sit_drink'||animation==='handover';this.phone.visible=animation==='pay';this.mixer.update(dt);
  this.cigarette.visible=this.smoke.visible=animation==='smoke'||animation==='sit_smoke';if(this.smoke.visible){this.time+=dt;const d=new THREE.Object3D();for(let i=0;i<4;i++){const t=(this.time*0.5+i/4)%1;d.position.set(Math.sin(t*4)*0.02,0.15+t*0.16,0);d.scale.setScalar(0.4+t);d.updateMatrix();this.smoke.setMatrixAt(i,d.matrix);}this.smoke.instanceMatrix.needsUpdate=true;}
 }
 dispose():void {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.mixer.getRoot());}
}
