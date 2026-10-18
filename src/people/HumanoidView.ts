import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
let template:THREE.Group; let clips:THREE.AnimationClip[]=[];
export async function loadPeople():Promise<void> {const gltf=await new GLTFLoader().loadAsync('/assets/people/delhi-adult.glb');template=gltf.scene;clips=gltf.animations;}
/** Shared geometry and skin, independent skeleton/mixer. Authored clips blend at 0.18s. */
export class HumanoidView {
 readonly group=new THREE.Group(); private mixer:THREE.AnimationMixer;private actions=new Map<string,THREE.AnimationAction>();private current='';
 private cup:THREE.Mesh;private phone:THREE.Mesh;
 constructor(color=0x417d80){
  const model=clone(template);this.group.add(model);this.mixer=new THREE.AnimationMixer(model);
  const palette=new Map<THREE.Material,THREE.Material>();
  model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.frustumCulled=false;const tint=(m:THREE.Material)=>{if(m.name==='Shirt'){if(!palette.has(m)){const next=m.clone() as THREE.MeshStandardMaterial;next.color.setHex(color);palette.set(m,next);}return palette.get(m)!;}return m;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);}});
  clips.forEach(c=>this.actions.set(c.name,this.mixer.clipAction(c)));
  this.cup=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.03,0.095,10),new THREE.MeshStandardMaterial({color:0xc48c59,roughness:0.9}));
  this.phone=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.115,0.012),new THREE.MeshStandardMaterial({color:0x1e343b,emissive:0x427c8a,emissiveIntensity:0.3}));
  const hand=model.getObjectByName('hand_r')!;hand.add(this.cup,this.phone);this.cup.position.set(0,0.035,0);this.phone.position.set(0,0.03,0);this.cup.visible=this.phone.visible=false;
 }
 update(dt:number,animation='idle',speed=0):void {
  const action=this.actions.get(animation)??this.actions.get('idle')!;
  if(this.current!==animation){this.actions.get(this.current)?.fadeOut(0.18);action.reset().fadeIn(0.18).play();this.current=animation;}
  action.timeScale=animation==='walk'?Math.max(0.5,speed/1.6):animation==='run'||animation==='flee'?Math.max(0.7,speed/3.4):1;
  this.cup.visible=animation==='drink'||animation==='sit_drink';this.phone.visible=animation==='pay';this.mixer.update(dt);
 }
 dispose():void {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.mixer.getRoot());}
}
