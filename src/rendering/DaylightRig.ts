import * as THREE from 'three';
import { environmentTexture } from './ProceduralTextures';
import { QUALITY } from './QualityProfile';
import type { QualityPreset } from './QualityProfile';
import type { Point } from '../core/math';

/** One shadowed sun, neutral sky fill, no per-lantern lights or full-screen passes. */
export class DaylightRig {
  readonly sun = new THREE.DirectionalLight(0xffd5a0, 2.8);
  readonly sky: THREE.Mesh;
  private offset = new THREE.Vector3(-95, 68, -55);
  private quality: QualityPreset = 'balanced';
  private environment: THREE.WebGLRenderTarget;
  private shadowTargets = new Map<QualityPreset, THREE.RenderTarget>();
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    scene.background = new THREE.Color(0xd2c9b6);
    scene.fog = new THREE.FogExp2(0xd2c9b6, 0.0022);
    // Pre-filter once with an explicit owner, then free generator scratch data.
    // No renderer-private PMREM lifetime or lazy first-drive allocations.
    const source = environmentTexture(), pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = pmrem.fromEquirectangular(source); pmrem.dispose(); source.dispose();
    scene.environment = this.environment.texture; scene.environmentIntensity = 0.6;
    scene.add(new THREE.HemisphereLight(0xc6d8e5, 0x7c6b4f, 1.45));
    this.sun.name = 'Late-afternoon Delhi sun'; this.sun.castShadow = true;
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00015; this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { sunDirection: { value: this.offset.clone().normalize() } },
      vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 sunDirection; varying vec3 direction;
        void main(){ vec3 ray=normalize(direction); float h=max(0.,ray.y);
          vec3 color=mix(vec3(.78,.73,.63),vec3(.30,.49,.65),smoothstep(0.,.85,h));
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
    // r186 native comparison-depth attachments are not safely resized/replaced
    // while their light uniforms are cached. Keep at most two complete targets,
    // one per enabled preset, and release both with this rig.
    if (this.quality !== 'low' && this.sun.shadow.map) this.shadowTargets.set(this.quality, this.sun.shadow.map);
    this.quality = quality;
    const profile = QUALITY[quality], size = profile.shadowSize || 512;
    if (quality !== 'low') this.sun.shadow.map = this.shadowTargets.get(quality) ?? null;
    this.sun.shadow.mapSize.set(size, size);
    const extent = profile.shadowExtent;
    Object.assign(this.sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 240 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  update(focus: Point): void {
    // Quantized follow reduces shadow movement and gives every region shadows.
    const p = QUALITY[this.quality], texel = p.shadowExtent * 2 / (p.shadowSize || 512);
    const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(x, 0, z); this.sun.position.set(x, 0, z).add(this.offset);
    this.sky.position.set(focus.x, 0, focus.z);
  }
  dispose(): void {
    this.environment.dispose();
    const targets = new Set(this.shadowTargets.values()); if (this.sun.shadow.map) targets.add(this.sun.shadow.map);
    targets.forEach(target => target.dispose()); this.shadowTargets.clear(); this.sun.shadow.map = null;
  }
}
