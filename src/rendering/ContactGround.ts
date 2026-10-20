import * as THREE from 'three';
let material:THREE.MeshBasicMaterial;
const geometry=new THREE.PlaneGeometry(1,1);
/** One shared 32px radial mask. Retained on Low; no lights or render passes. */
export function contactGround(width:number,depth:number):THREE.Mesh {
 if(!material){
  const data=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),i=(y*32+x)*4;
   data[i]=data[i+1]=data[i+2]=28;data[i+3]=Math.round(Math.max(0,1-r)**1.8*105);
  }
  const map=new THREE.DataTexture(data,32,32);map.needsUpdate=true;map.magFilter=THREE.LinearFilter;
  material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.scale.set(width,depth,1);mesh.position.y=0.041;mesh.name='Inexpensive contact grounding';return mesh;
}
