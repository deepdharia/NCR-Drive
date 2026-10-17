import * as THREE from 'three';
import { environmentTexture } from './ProceduralTextures';
import { QUALITY } from './QualityProfile';
import type { QualityPreset } from './QualityProfile';
import type { Point } from '../core/math';

/** One shadowed sun, neutral sky fill, no per-lantern lights or full-screen passes. */
export class DaylightRig {
  readonly sun = new THREE.DirectionalLight(0xfff0d7, 3.0);
  readonly sky: THREE.Mesh;
  private offset = new THREE.Vector3(-65, 105, -45);
  private quality: QualityPreset = 'balanced';
  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0xc9d8db);
    scene.fog = new THREE.FogExp2(0xc9d8db, 0.0022);
    scene.environment = environmentTexture(); scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x726952, 1.6));
    this.sun.name = 'Late morning sun'; this.sun.castShadow = true;
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00015; this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { sunDirection: { value: this.offset.clone().normalize() } },
      vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 sunDirection; varying vec3 direction;
        void main(){ vec3 ray=normalize(direction); float h=max(0.,ray.y);
          vec3 color=mix(vec3(.68,.76,.78),vec3(.23,.46,.68),smoothstep(0.,.85,h));
          float sun=max(0.,dot(ray,sunDirection));
          color+=vec3(.12,.10,.06)*pow(sun,24.)+vec3(1.,.92,.72)*smoothstep(.9995,.99985,sun);
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.name = 'Procedural daylight sky'; this.sky.frustumCulled = false; scene.add(this.sky);
    this.setQuality('balanced'); this.update({ x: 0, z: 0 });
  }
  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    const profile = QUALITY[quality], size = profile.shadowSize || 512;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.mapSize.set(size, size);
    const extent = profile.shadowExtent;
    Object.assign(this.sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 240 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  update(focus: Point): void {
    // Texel-snapped follow avoids shimmering, and gives every region shadows.
    const p = QUALITY[this.quality], texel = p.shadowExtent * 2 / (p.shadowSize || 512);
    const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(x, 0, z); this.sun.position.set(x, 0, z).add(this.offset);
    this.sky.position.set(focus.x, 0, focus.z);
  }
}
