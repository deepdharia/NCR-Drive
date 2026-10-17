import * as THREE from 'three';
import { roads, ends, destinations, worldBarriers, riverBanks } from './WorldRoads';
import type { Point } from '../core/math';
import { signTexture } from '../rendering/ProceduralTextures';

/** Small shared-resource chunks, visibility independent of collision (which stays indexed globally). */
export class RegionalView {
 readonly group=new THREE.Group();
 private chunks: {group:THREE.Group;point:Point;radius:number}[]=[];
 constructor(scene:THREE.Scene){
  scene.add(this.group);
  const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1);
  const asphalt=new THREE.MeshStandardMaterial({color:0x464d50,roughness:1});
  const verge=new THREE.MeshStandardMaterial({color:0x788263,roughness:1});
  const paint=new THREE.MeshBasicMaterial({color:0xe9dbad});
  const rail=new THREE.MeshStandardMaterial({color:0xc5bda0,roughness:0.85});
  const glass=new THREE.MeshStandardMaterial({color:0x587e8b,metalness:0.35,roughness:0.3});
  const residential=new THREE.MeshStandardMaterial({color:0xb7b095,roughness:0.9});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(300,2200),new THREE.MeshStandardMaterial({color:0x497e86,roughness:0.35,metalness:0.25}));
  water.rotation.x=-Math.PI/2;water.position.set(1375,-1,-170);this.group.add(water);
  const mesh=(g:THREE.Group,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>{
   const m=new THREE.Mesh(box,material);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.y=yaw;g.add(m);return m;
  };
  for(const bank of riverBanks)mesh(this.group,rail,bank.x,0.5,bank.z,bank.width,bank.height,bank.depth);
  for(const r of roads.filter(r=>!r.id.startsWith('cp-'))){
   const [a,b]=ends(r),length=Math.hypot(b.x-a.x,b.z-a.z),yaw=Math.atan2(b.x-a.x,b.z-a.z),cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
   const chunk=new THREE.Group();this.group.add(chunk);this.chunks.push({group:chunk,point:{x:cx,z:cz},radius:length/2+160});
   if(!r.bridge)mesh(chunk,verge,cx,-0.15,cz,r.width+95,0.2,length+32,yaw);
   // Slightly overlapping ends close junction seams; deck top equals CP road height.
   mesh(chunk,asphalt,cx,-0.075,cz,r.width,0.2,length+r.width,yaw);
   const markings=new THREE.InstancedMesh(box,paint,Math.floor(length/18));const dummy=new THREE.Object3D();
   for(let i=0;i<markings.count;i++){const t=(i+0.5)/markings.count;dummy.position.set(a.x+(b.x-a.x)*t,0.04,a.z+(b.z-a.z)*t);dummy.rotation.y=yaw;dummy.scale.set(0.16,0.02,6);dummy.updateMatrix();markings.setMatrixAt(i,dummy.matrix);}chunk.add(markings);
   for(const barrier of worldBarriers.filter(s=>Math.abs(s.x-cx)<40&&Math.abs(s.z-cz)<40))mesh(chunk,rail,barrier.x,0.5,barrier.z,barrier.width,1,barrier.depth,barrier.yaw);
   const city=r.region==='gurgaon'||r.region==='noida';
   if(city){
    const buildings=new THREE.InstancedMesh(box,r.region==='gurgaon'?glass:residential,16);
    for(let i=0;i<16;i++){const t=0.2+Math.floor(i/2)/7*0.6,side=i%2?1:-1,height=r.region==='gurgaon'?28+(i%5)*12:15+(i%4)*7;
     dummy.position.set(a.x+(b.x-a.x)*t+Math.cos(yaw)*65*side,height/2,a.z+(b.z-a.z)*t-Math.sin(yaw)*65*side);dummy.rotation.y=yaw;dummy.scale.set(26,height,27);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);}chunk.add(buildings);
    // Low planted median islands leave 35m at every junction and wide gaps for bays.
    for(const t of [0.25,0.75])mesh(chunk,verge,a.x+(b.x-a.x)*t,0.15,a.z+(b.z-a.z)*t,1.2,0.25,32,yaw);
   }
   const label=r.region==='gurgaon'?'GURGAON · BUSINESS AVENUE':r.region==='noida'?'NOIDA · SECTOR 18 / 19':r.region==='gurgaon-corridor'?'GURGAON ↗   |   DELHI ↙':r.bridge?'YAMUNA CROSSING · NOIDA ↗':'NOIDA ↗   |   DELHI ↙';
   for(const reverse of [false,true]){
    const t=reverse?0.85:0.15,side=reverse?-1:1;
    const x=a.x+(b.x-a.x)*t+Math.cos(yaw)*(r.width/2+3)*side,z=a.z+(b.z-a.z)*t-Math.sin(yaw)*(r.width/2+3)*side;
    mesh(chunk,rail,x,2,z,0.2,4,0.2);
    const sign=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:signTexture(label),side:THREE.DoubleSide}));sign.position.set(x,4,z);sign.scale.set(12,2.5,1);sign.rotation.y=yaw+(reverse?0:Math.PI);chunk.add(sign);
   }
  }
  for(const bay of destinations){
   const g=new THREE.Group();this.group.add(g);this.chunks.push({group:g,point:bay,radius:80});
   mesh(g,asphalt,bay.x,0.01,bay.z,30,0.04,12);
   for(const dx of [-14,14])mesh(g,paint,bay.x+dx,0.05,bay.z,0.2,0.02,11);
   const label=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:signTexture(bay.name),side:THREE.DoubleSide}));label.position.set(bay.x,3,bay.z+7);label.scale.set(16,2,1);g.add(label);
  }
 }
 update(focus:Point):void {for(const chunk of this.chunks)chunk.group.visible=Math.hypot(chunk.point.x-focus.x,chunk.point.z-focus.z)<chunk.radius+550;}
}
