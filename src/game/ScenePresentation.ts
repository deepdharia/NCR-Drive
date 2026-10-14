import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Official Three.js post-processing, with a direct-render mobile fallback. */
export class ScenePresentation {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private enabled = false;
  private antialias: ShaderPass | null = null;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera) {}

  public setQuality(quality: 'low' | 'med' | 'high'): void {
    this.enabled = quality !== 'low';
    if (this.enabled && !this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.18, 0.4, 1.15);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.antialias = new ShaderPass(FXAAShader);
      this.composer.addPass(this.antialias);
    }
    if (this.bloom) this.bloom.strength = quality === 'high' ? 0.22 : 0.12;
    this.resize();
  }

  public resize(): void {
    if (!this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    this.antialias?.uniforms.resolution.value.set(1 / (size.x * this.renderer.getPixelRatio()), 1 / (size.y * this.renderer.getPixelRatio()));
  }

  public render(): void {
    if (this.enabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.bloom?.dispose();
    this.composer?.passes.forEach(pass => { if (pass !== this.bloom) pass.dispose(); });
    this.composer?.dispose();
  }
}
