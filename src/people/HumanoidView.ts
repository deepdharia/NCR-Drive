import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
let template:THREE.Group; let clips:THREE.AnimationClip[]=[];
export async function loadPeople():Promise<void> {const gltf=await new GLTFLoader().loadAsync('/assets/people/delhi-adult.glb');template=gltf.scene;clips=gltf.animations;}
/** Shared geometry and skin, independent skeleton/mixer. Authored clips blend at 0.18s. */
export class HumanoidView {
 readonly group=new THREE.Group(); private mixer:THREE.AnimationMixer;private actions=new Map<string,THREE.AnimationAction>();private current='';
 private cup:THREE.Mesh;private phone:THREE.Mesh;private cigarette:THREE.Mesh;private smoke:THREE.InstancedMesh;private time=0;
 constructor(color=0x417d80){
  const model=clone(template);this.group.add(model);this.mixer=new THREE.AnimationMixer(model);
  const palette=new Map<THREE.Material,THREE.Material>(),skeletons=new Map<string,THREE.Skeleton>();
  model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join(',');const shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}if(o instanceof THREE.Mesh){o.castShadow=true;o.frustumCulled=false;const tint=(m:THREE.Material)=>{if(m.name==='Shirt'){if(!palette.has(m)){const next=m.clone() as THREE.MeshStandardMaterial;next.color.setHex(color);palette.set(m,next);}return palette.get(m)!;}return m;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);}});
  clips.forEach(c=>this.actions.set(c.name,this.mixer.clipAction(c)));const handover=clips.find(c=>c.name==='talk')!.clone();handover.name='handover';this.actions.set('handover',this.mixer.clipAction(handover));
  this.cup=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.03,0.095,10),new THREE.MeshStandardMaterial({color:0xc48c59,roughness:0.9}));
  this.phone=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.115,0.012),new THREE.MeshStandardMaterial({color:0x1e343b,emissive:0x427c8a,emissiveIntensity:0.3}));
  this.cigarette=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.07,5),new THREE.MeshStandardMaterial({color:0xbfb49a,roughness:0.9}));
  this.smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(0.018,4,3),new THREE.MeshBasicMaterial({color:0xb5b9b0,transparent:true,opacity:0.12,depthWrite:false}),4);
  const hand=model.getObjectByName('hand_r')!;hand.add(this.cup,this.phone,this.cigarette,this.smoke);this.cigarette.position.set(0,0.135,0);this.cup.position.set(0,0.135,0.025);this.phone.position.set(0,0.135,0.02);this.cup.visible=this.phone.visible=this.cigarette.visible=this.smoke.visible=false;
 }
 update(dt:number,animation='idle',speed=0):void {
  const action=this.actions.get(animation)??this.actions.get('idle')!;
  if(this.current!==animation){this.actions.get(this.current)?.fadeOut(0.18);action.reset().fadeIn(0.18).play();this.current=animation;}
  action.timeScale=animation==='walk'?Math.max(0.5,speed/1.6):animation==='run'||animation==='flee'?Math.max(0.7,speed/3.4):1;
  this.cup.visible=animation==='drink'||animation==='sit_drink'||animation==='handover';this.phone.visible=animation==='pay';this.mixer.update(dt);
  this.cigarette.visible=this.smoke.visible=animation==='smoke'||animation==='sit_smoke';if(this.smoke.visible){this.time+=dt;const d=new THREE.Object3D();for(let i=0;i<4;i++){const t=(this.time*0.5+i/4)%1;d.position.set(Math.sin(t*4)*0.02,0.15+t*0.16,0);d.scale.setScalar(0.4+t);d.updateMatrix();this.smoke.setMatrixAt(i,d.matrix);}this.smoke.instanceMatrix.needsUpdate=true;}
 }
 dispose():void {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.mixer.getRoot());}
}
