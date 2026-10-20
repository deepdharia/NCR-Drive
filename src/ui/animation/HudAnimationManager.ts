import type {DotLottie} from '@lottiefiles/dotlottie-web';
import wasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url';
import {animationRegistry} from './AnimationRegistry';
import type {HudCue} from './HudStateAdapter';
/** A single, lazy canvas. Failure never removes the accessible static HUD. */
export class HudAnimationManager {
  private player?:DotLottie;
  private ready?:Promise<boolean>;
  private settleReady?: (ready:boolean)=>void;
  private readyTimer?:ReturnType<typeof setTimeout>;
  private disposed=false;
  private suspended=false;
  private generation=0;
  private motion=matchMedia('(prefers-reduced-motion: reduce)');
  private abort=new AbortController();
  private lastCue?:HudCue;
  private lastTime=-Infinity;
  constructor(private canvas:HTMLCanvasElement) {
    this.motion.addEventListener('change',()=>{if(this.motion.matches)this.stop();},{signal:this.abort.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();},{signal:this.abort.signal});
  }
  private stop():void {this.generation++;this.player?.pause();this.canvas.hidden=true;}
  suspend(value:boolean):void {this.suspended=value;if(value)this.stop();}
  async play(cue:HudCue):Promise<void> {
    if(this.disposed||this.suspended||document.hidden||this.motion.matches)return;
    const now=performance.now();if(cue===this.lastCue&&now-this.lastTime<600)return;
    this.lastCue=cue;this.lastTime=now;const generation=++this.generation;
    try {
      const {DotLottie}=await import('@lottiefiles/dotlottie-web');
      if(this.disposed||generation!==this.generation)return;
      DotLottie.setWasmUrl(wasmUrl);
      if(!this.player){
        this.player=new DotLottie({canvas:this.canvas,autoplay:false,loop:false,renderConfig:{devicePixelRatio:1,autoResize:false}});
        this.ready=new Promise(resolve=>{this.settleReady=resolve;this.readyTimer=setTimeout(()=>resolve(false),5000);});
        this.player.addEventListener('ready',()=>{clearTimeout(this.readyTimer);this.settleReady?.(true);});
        this.player.addEventListener('load',()=>{if(this.suspended||document.hidden||this.motion.matches||this.disposed){this.player?.pause();this.canvas.hidden=true;}});
        this.player.addEventListener('renderError',()=>{this.canvas.hidden=true;});
        this.player.addEventListener('complete',()=>{this.canvas.hidden=true;});
        this.player.addEventListener('loadError',()=>{clearTimeout(this.readyTimer);this.settleReady?.(false);this.canvas.hidden=true;});
      }
      if(!await this.ready||this.disposed||generation!==this.generation||this.suspended||document.hidden||this.motion.matches)return;
      this.canvas.hidden=false;
      this.player.load({src:animationRegistry[cue],autoplay:true,loop:false});
    } catch {this.canvas.hidden=true;}
  }
  dispose():void {this.disposed=true;clearTimeout(this.readyTimer);this.settleReady?.(false);this.stop();this.abort.abort();this.player?.destroy();this.player=undefined;}
}
