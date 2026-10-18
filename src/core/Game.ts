import * as THREE from 'three';
import { FrameMetrics } from './FrameMetrics';
import { CollisionWorld } from './CollisionWorld';
import { PlayerController } from '../player/PlayerController';
import { PlayerView } from '../player/PlayerView';
import { VehicleController } from '../vehicle/VehicleController';
import { VEHICLE_SPECS } from '../vehicle/VehicleSpec';
import { TrafficSystem } from '../systems/TrafficSystem';
import { StoryMission, REGIONAL_JOURNEY } from '../systems/StoryMission';
import { distance, localToWorld } from './math';
import { VehicleView } from '../vehicle/VehicleView';
import { CameraRig } from '../camera/CameraRig';
import { InputController } from '../input/InputController';
import { InteractionSystem } from '../systems/InteractionSystem';
import { CourierMission, COURIER_TARGET } from '../systems/CourierMission';
import { Neighborhood, MARKET, SUPPLY_TARGET, shops, seats, freshNeighborhood } from '../systems/Neighborhood';
import { MarketView } from '../world/MarketView';
import { StreetPeople } from '../people/StreetPeople';
import { StreetAudio } from '../systems/StreetAudio';
import type { WalletSnapshot } from '../systems/Neighborhood';
import { defaultSettings, loadProgress, writeProgress } from '../systems/ProgressStore';
import { recoverToRoad } from '../systems/RecoverySystem';
import { createDistrictLayout } from '../world/DistrictLayout';
import { motorPoolBays, roadsideRetreat } from '../world/WorldRoads';
import { RegionalView } from '../world/RegionalView';
import { DistrictView } from '../world/DistrictView';
import { CentralDelhiView } from '../world/CentralDelhiView';
import { nextQuality, QUALITY, resolvedQuality } from '../rendering/QualityProfile';
import { GameUI } from '../ui/GameUI';

/** One owner for simulation, rendering, DOM controls and their lifecycle. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private metrics = new FrameMetrics();
  private scene = new THREE.Scene();
  private player = new PlayerController();
  private fleet = VEHICLE_SPECS.map(spec => new VehicleController(spec));
  private selected = 0;
  private get cars():VehicleController[] {return [...this.fleet,...this.traffic.cars];}
  private get car(): VehicleController { return this.cars[this.selected]; }
  private traffic = new TrafficSystem();
  private story = new StoryMission();
  private playerView = new PlayerView();
  private fleetViews = VEHICLE_SPECS.map((spec, i) => new VehicleView(spec, `DL 1C AB ${4092 + i}`));
  private trafficViews = this.traffic.cars.map((car, i) => new VehicleView(car.spec, `DL 2C CD ${1200 + i}`));
  private world: CollisionWorld;
  private district: DistrictView;
  private central: CentralDelhiView;
  private regional: RegionalView;
  private camera: CameraRig;
  private input: InputController;
  private interaction: InteractionSystem;
  private mission = new CourierMission();
  private neighborhood!:Neighborhood;
  private market!:MarketView;private people!:StreetPeople;private audio=new StreetAudio();
  private modal=false;private shopIndex=0;private payment:number|undefined;
  private seated:string|undefined;private drinkTime=0;private standing=0;private consumedAtSeat=false;private rewardRetry=0;private handover=0;
  private get jobBusy():boolean{return this.story.active||this.mission.state==='active'||this.neighborhood.active;}
  private saveAvailable = true;
  private saveWritable = true;
  private settings = defaultSettings();
  private ui: GameUI;
  private started = false;
  private paused = false;
  private phone = false;
  private accumulator = 0;
  private uiElapsed = 0;
  private lastTime = performance.now();
  private frameId = 0;
  private abort = new AbortController();
  private disposed = false;

  constructor(private root: HTMLElement) {
    try {
      const loaded = loadProgress(localStorage), saved = loaded.progress;
      this.saveWritable = loaded.writable;
      this.saveAvailable = loaded.writable;
      this.settings = saved.settings;
      this.mission.cash = saved.cash;
      this.mission.state = saved.courierCompleted ? 'completed' : 'available';
      this.neighborhood = new Neighborhood({cash:saved.cash,neighborhood:saved.neighborhood},next=>this.commitNeighborhood(next));
      this.saveProgress();
    } catch { this.saveAvailable = this.saveWritable = false; }
    this.neighborhood ??= new Neighborhood({cash:this.mission.cash,neighborhood:freshNeighborhood()},next=>this.commitNeighborhood(next));
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
    this.renderer.setSize(root.clientWidth, root.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas'; this.renderer.domElement.setAttribute('aria-label', 'NCR Drive 3D district');
    const overlay = document.createElement('div'); overlay.className = 'overlay';
    root.replaceChildren(this.renderer.domElement, overlay);
    const layout = createDistrictLayout(); this.world = new CollisionWorld(layout.solids);
    this.district = new DistrictView(this.scene, layout, this.renderer);
    this.central = new CentralDelhiView(this.scene);
    this.regional = new RegionalView(this.scene);
    this.market=new MarketView(this.scene);this.people=new StreetPeople(this.scene);
    motorPoolBays.forEach((bay,i)=>{this.fleet[i+1].position={x:bay.x,z:bay.z};this.fleet[i+1].yaw=bay.yaw;});
    const civilian=new VehicleController(VEHICLE_SPECS[0]);civilian.position={x:-182,z:12.5};civilian.yaw=Math.PI/2;civilian.occupant=`driver-${civilian.id}`;this.fleet.push(civilian);this.fleetViews.push(new VehicleView(civilian.spec,'DL 4C LM 5831'));
    this.scene.add(this.playerView.group, ...this.fleetViews.map(v => v.group), ...this.trafficViews.map(v => v.group));
    this.camera = new CameraRig(root.clientWidth / root.clientHeight);
    this.interaction = new InteractionSystem(this.player, this.car, this.world, () => [...this.otherCars(),...this.people.colliders]);
    this.interaction.onDisplaced=(id,point)=>{const target=roadsideRetreat(point);this.people.displace(id,point,this.world.isClear(target,0.35,0,1.8,this.otherCars())?target:point);this.ui.toast('Driver retreats. Nearby neighbors are startled.');};
    this.interaction.onTransferred=()=>{this.input.reset();this.input.reverse=false;if(this.car.driving)this.camera.enterVehicle();this.refreshUI();};
    this.player.teleport({ x: this.interaction.door.x - 0.45, z: this.interaction.door.z });
    this.input = new InputController(this.renderer.domElement, {
      interact: () => this.interact(), phone: () => this.togglePhone(), pause: () => this.togglePause(),
      rotate: (dx, dy) => this.camera.rotate(dx * this.settings.cameraSensitivity, dy * this.settings.cameraSensitivity, this.car.driving), tap: (x, y) => this.tapCar(x, y),
    });
    this.ui = new GameUI(overlay, this.input, {
      start: () => { this.started = true; this.audio.start(); this.syncScreen(); }, phone: () => this.togglePhone(),
      pause: () => this.togglePause(), interact: () => this.interact(),
      quality: () => {
        this.settings.graphicsQuality = nextQuality(resolvedQuality(this.settings));
        this.settings.performanceMode = this.settings.graphicsQuality === 'low';
        this.applySettings(); this.saveProgress(); this.refreshUI();
        this.renderer.render(this.scene, this.camera.camera);
      },
      sensitivity: (kind, value) => {
        if (!Number.isFinite(value) || value < 0.5 || value > 1.5) return;
        this.settings[kind] = value; this.applySettings(); this.saveProgress(); this.refreshUI();
      },
      recover: () => this.recover(),
      accept: () => {
        if (!this.jobBusy && this.mission.accept()) { this.phone = false; this.syncScreen(); this.ui.toast('Parcel collected. Follow DelhiNav and deliver on foot.'); }
      },
      journey: () => {
        if (this.jobBusy) return;
        this.story = new StoryMission(REGIONAL_JOURNEY, 720, 2400); this.story.accept(); this.phone=false; this.syncScreen(); this.ui.toast(this.story.step.dialogue);
      },
      story: () => {
        if (!this.story.active) this.story = new StoryMission();
        if (!this.jobBusy && this.story.accept()) { this.phone = false; this.syncScreen(); this.ui.toast(this.story.step.dialogue); }
      },
      cancelStory: () => { this.story.cancel(); this.refreshUI(); },
      buy:()=>this.orderDrink(),pay:()=>this.pay(),closeShop:()=>this.closeShop(),
      supply:()=>{if(!this.jobBusy&&this.neighborhood.accept()){this.closeShop();this.ui.toast(this.neighborhood.message);}},
      receive:()=>{const position=this.car.driving?this.car.position:this.player.position;this.neighborhood.cash=this.mission.cash;if(this.neighborhood.confirm(position,this.car.driving?this.car.kmh:this.player.speed*3.6)){this.mission.cash=this.neighborhood.cash;this.phone=false;this.syncScreen();}this.ui.toast(this.neighborhood.message);this.refreshUI();},
      cancelSupply:()=>{this.neighborhood.cancelJob();this.refreshUI();},
      audio:()=>{this.settings.muted=!this.settings.muted;this.applySettings();this.saveProgress();},
      volume:value=>{if(Number.isFinite(value)&&value>=0&&value<=1){this.settings.volume=value;this.applySettings();this.saveProgress();}},
    });
    this.applySettings(); this.syncScreen(); this.updateViews(1); this.renderer.render(this.scene, this.camera.camera);
    window.addEventListener('resize', this.resize, { signal: this.abort.signal });
    window.addEventListener('blur',()=>{if(this.started){if(this.modal)this.closeShop();this.paused=true;this.phone=false;this.syncScreen();}}, {signal:this.abort.signal});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.started) { if(this.modal)this.closeShop();this.paused = true; this.phone = false; this.syncScreen(); }
    }, { signal: this.abort.signal });
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.paused = true; this.syncScreen();
      this.ui.toast('Graphics interrupted. Reload this page to continue.');
    }, { signal: this.abort.signal });
    this.frameId = requestAnimationFrame(this.frame);
  }

  private syncScreen(): void {
    this.input.reset(); this.input.enabled = this.started && !this.paused && !this.phone && !this.modal;
    if(this.paused||this.phone||this.modal)this.interaction.cancel();
    this.audio.settings(this.settings,!this.started||this.paused||this.phone);
    this.accumulator = 0; this.ui.screen(this.started, this.paused, this.phone); this.refreshUI();
  }
  private applySettings(): void {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.input.steeringSensitivity = this.settings.steeringSensitivity;
    const quality = resolvedQuality(this.settings), profile = QUALITY[quality];
    this.renderer.shadowMap.enabled = profile.shadowSize > 0;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? Math.min(1.25, profile.pixelRatio) : profile.pixelRatio));
    this.district.setQuality(quality); this.central.setQuality(quality); this.regional.setQuality(quality);
    this.ui.setSettings(this.settings);this.audio.settings(this.settings,!this.started||this.paused||this.phone);
  }
  private recover(): void {
    if (!this.started || !this.paused) return;
    if (!recoverToRoad(this.world, this.car, this.player, [...this.otherCars(),...this.people.colliders], this.mission, this.neighborhood, this.story)) {
      this.ui.recoveryStatus('No clear recovery space. Resume and move a blocking car, then try again.'); return;
    }
    this.interaction.cancel();this.stand(true);this.input.reset(); this.input.reverse = false; this.interaction.message = '';
    this.camera.reset(); this.saveProgress(); this.paused = false;
    this.syncScreen(); this.updateViews(1); this.renderer.render(this.scene, this.camera.camera);
    this.ui.toast('Back on a clear road. Recovery is free; active jobs cancelled with no payout.');
  }
  private togglePhone(): void {
    if (!this.started || this.paused || this.modal || this.interaction.busy || this.handover>0) return;
    this.phone = !this.phone; this.syncScreen();
  }
  private togglePause(): void {
    if (!this.started) return;
    if(this.modal){this.closeShop();return;}
    if (this.phone) this.phone = false;
    else this.paused = !this.paused;
    this.syncScreen();
  }
  private interact(): void {
    if (!this.input.enabled) return;
    if(this.interaction.busy||this.handover>0)return;
    if(this.seated){if(!this.standing)this.stand();return;}
    if(!this.car.driving){
      const shop=shops.findIndex(s=>distance(s,this.player.position)<2.6);
      if(shop>=0){this.openShop(shop);return;}
      const seat=this.nearbySeat();
      if(seat){this.seated=seat.id;this.people.reservations.reserve(seat.id,'player');this.player.teleport(seat);this.player.yaw=seat.yaw;this.player.speed=0;this.playerView.overrideAnimation='sit_down';this.drinkTime=0;this.consumedAtSeat=false;this.refreshUI();return;}
    }
    this.selectNearbyCar();
    if (this.interaction.interact()) {
      this.input.reset(); this.input.reverse = false;
      if (this.car.driving) this.camera.enterVehicle();
    }
    this.refreshUI();
  }
  private tapCar(x: number, y: number): void {
    if (this.car.driving || !this.input.enabled) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), this.camera.camera);
    if (ray.intersectObject((this.selected<this.fleet.length?this.fleetViews[this.selected]:this.trafficViews[this.selected-this.fleet.length]).group, true).length) this.interact();
  }
  private refreshUI(): void {
    this.selectNearbyCar();
    const target = this.story.active ? this.story.step.target : this.mission.state==='active'?COURIER_TARGET:this.neighborhood.active?SUPPLY_TARGET:MARKET;
    this.district.delivery.visible = distance(target,this.car.driving?this.car.position:this.player.position)>20 || this.jobBusy;
    this.district.delivery.position.set(target.x, 0, target.z);

    this.ui.update(this.player, this.car, this.interaction, this.mission, this.neighborhood, this.saveAvailable, this.story,this.contextPrompt(),this.interaction.busy||this.handover>0);
  }
  private updateViews(dt: number): void {
    if(this.handover>0)this.playerView.overrideAnimation='pay';else if(this.interaction.busy)this.playerView.overrideAnimation=this.interaction.animation;else if(!this.seated&&!this.modal)this.playerView.overrideAnimation=undefined;
    this.playerView.updatePlayer(this.player, dt);
    if(this.interaction.busy){const t=this.interaction.progress,door=this.interaction.door,seat=localToWorld({x:-0.35,z:-0.2},this.car.position,this.car.yaw),f=this.interaction.occupiedEntry?0:this.interaction.exiting?1-t:t;this.playerView.group.visible=true;this.playerView.group.position.set(door.x+(seat.x-door.x)*f,0.045*(1-f)+0.18*f,door.z+(seat.z-door.z)*f);this.playerView.group.rotation.y=this.car.yaw+(this.interaction.occupiedEntry?Math.PI/2:0);}
    const focus=this.car.driving ? this.car.position : this.player.position;
    const quality = resolvedQuality(this.settings);
    this.fleetViews.forEach((view,i)=>{view.group.visible=distance(this.fleet[i].position,focus)<450;if(view.group.visible){view.update(this.fleet[i],dt);view.setDetail(distance(this.fleet[i].position,focus),quality);}});
    this.trafficViews.forEach((view,i)=>{view.group.visible=distance(this.traffic.cars[i].position,focus)<450;if(view.group.visible){view.update(this.traffic.cars[i],dt);view.setDetail(distance(this.traffic.cars[i].position,focus),quality);}});
    this.central.update(focus);this.market.update(dt,focus);
    const audible=this.car.driving?this.car:this.cars.filter(c=>c.owner==='ai'&&Math.abs(c.speed)>0.1&&distance(c.position,focus)<90).sort((a,b)=>distance(a.position,focus)-distance(b.position,focus))[0];
    this.audio.update(focus,this.camera.yaw,audible?.position??this.car.position,audible?.speed??0,!!audible,audible?.braking??false,audible?.steering??0);
    this.regional.update(this.car.driving ? this.car.position : this.player.position);
    this.district.update(this.car.driving ? this.car.position : this.player.position); this.camera.update(dt, this.player, this.car, this.world);
  }
  private frame = (time: number): void => {
    const frameMs=time-this.lastTime;
    const dt = Math.min(0.1, frameMs / 1000); this.lastTime = time;
    this.frameId = requestAnimationFrame(this.frame);
    // Retain the scene under menus. No GPU work competes with phone scrolling.
    if (!this.started || this.paused || this.phone) return;
    if(this.modal){this.people.update(dt,this.world,this.cars,this.player.position,this.player.position);this.updateViews(dt);this.renderer.render(this.scene,this.camera.camera);return;}
    this.metrics.add(frameMs);
    const step = 1 / 120;
    this.accumulator = Math.min(0.1, this.accumulator + dt);
    while (this.accumulator >= step) {
      this.handover=Math.max(0,this.handover-step);this.interaction.update(step);
      if (!this.car.driving && !this.seated && !this.interaction.busy && this.handover<=0) this.player.update(step, this.input.foot(), this.camera.yaw, this.world, this.car.collider, [...this.otherCars(),...this.people.colliders]);
      if(!this.interaction.busy)this.car.update(step, this.input.drive(), this.world, [...this.otherCars(),...this.people.colliders]);
      const pedestrian = { ...this.player.position, width: 0.8, depth: 0.8, height: 1.8, yaw: 0 };
      this.traffic.update(step, this.world, [...this.fleet.map(c => c.collider), ...this.people.colliders,...(!this.car.driving ? [pedestrian] : [])], this.car.driving ? this.car.position : this.player.position);
      const focus=this.car.driving?this.car.position:this.player.position;

      if(this.seated&&this.standing>0){this.standing-=step;if(this.standing<=0){const exits=[{x:this.player.position.x,z:this.player.position.z+0.85},{x:this.player.position.x-1,z:this.player.position.z+0.6}];const clear=exits.find(p=>this.world.isClear(p,0.32,0,1.8,[...this.cars.map(c=>c.collider),...this.people.colliders]));if(clear){this.stand(true);this.player.teleport(clear);}else{this.standing=0;this.playerView.overrideAnimation='sit';this.ui.toast('Someone is in front of the seat. Wait, then press F to stand.');}}}
      if(this.seated&&!this.standing){this.drinkTime+=step;if(this.drinkTime>=1&&!this.consumedAtSeat){this.consumedAtSeat=true;this.neighborhood.cash=this.mission.cash;const drink=this.neighborhood.drink();this.mission.cash=this.neighborhood.cash;this.playerView.overrideAnimation=drink?'sit_drink':'sit';if(drink)this.ui.toast(`Enjoying ${drink}. Press F to stand.`);}if(this.drinkTime>5)this.playerView.overrideAnimation='sit';}
      this.neighborhood.cash=this.mission.cash;
      this.rewardRetry-=step;
      if(this.rewardRetry<=0&&this.neighborhood.update(focus,this.car.driving,this.car.kmh)){this.mission.cash=this.neighborhood.cash;this.ui.toast(this.neighborhood.message);this.refreshUI();}if(this.rewardRetry<=0)this.rewardRetry=1;
      const storyEvent = this.story.update(step, this.car.driving ? this.car.position : this.player.position, this.car.driving, this.car.driving ? this.car.kmh : this.player.speed * 3.6);
      if (storyEvent === 'step') this.ui.toast(this.story.step.dialogue);
      if (storyEvent === 'failed') this.ui.toast('Time ran out. Retry Kabir’s Evening Run in DelhiOS.');
      if (storyEvent === 'completed') { this.mission.cash += this.story.reward; this.saveProgress(); this.ui.toast(`Kabir: Delivered. ₹${this.story.reward} added. Explore the connected NCR world.`); }

      if (this.mission.update(this.car.driving ? this.car.position : this.player.position, !this.car.driving)) {
        this.saveProgress(); this.ui.toast('Parcel delivered. ₹750 added to your Delhi Wallet.'); this.refreshUI();
      }
      this.accumulator -= step;
    }
    this.people.update(dt,this.world,this.cars,this.car.driving?this.car.position:this.player.position,this.car.driving?undefined:this.player.position);
    this.updateViews(dt); this.renderer.render(this.scene, this.camera.camera);
    this.uiElapsed += dt;
    if (this.uiElapsed > 0.1) { this.uiElapsed = 0; this.refreshUI();
      const frames=this.metrics.percentiles,info=this.renderer.info;
      this.ui.renderStats(`Frame ms p50 ${frames.p50.toFixed(1)} / p95 ${frames.p95.toFixed(1)} · ${info.render.calls} draws · ${info.render.triangles} triangles · ${info.memory.geometries} geometries / ${info.memory.textures} textures`); }
  };
  private otherCars() { return this.cars.filter(c=>c!==this.car).map(c=>c.collider); }
  private selectNearbyCar(): void {
    if (this.car.driving || this.interaction.busy || this.seated) return;
    let best = this.selected, nearest = Infinity;
    this.cars.forEach((car, i) => {
      this.interaction.car = car;
      const d = distance(this.player.position, this.interaction.door);
      if (d < nearest) { nearest = d; best = i; }
    });
    this.selected = best; this.interaction.car = this.car;
  }
  private saveProgress(): void {
    if (!this.saveWritable) { this.saveAvailable = false; return; }
    try {
      this.saveAvailable = writeProgress(localStorage, { version: 3, cash: this.mission.cash, neighborhood:this.neighborhood.data, courierCompleted: this.mission.state === 'completed', settings: this.settings });
    } catch { this.saveAvailable = false; }
  }
  private commitNeighborhood(next:WalletSnapshot):boolean {
    if(!this.saveWritable)return false;
    try{this.saveAvailable=writeProgress(localStorage,{version:3,cash:next.cash,neighborhood:next.neighborhood,courierCompleted:this.mission.state==='completed',settings:this.settings});}catch{this.saveAvailable=false;}
    return this.saveAvailable;
  }
  private contextPrompt():string|undefined {
    if(this.handover>0)return 'Collecting your cup…';
    if(this.interaction.busy)return undefined;
    if(this.seated)return this.standing?'Standing up…':'Press F · Stand up';
    if(this.car.driving)return undefined;
    const shop=shops.find(s=>distance(s,this.player.position)<2.6);if(shop)return `Press F · Visit ${shop.name}`;
    if(this.nearbySeat())return 'Press F · Sit and enjoy a drink';
    return undefined;
  }
  private nearbySeat(){return seats.find(s=>this.player.grounded&&this.player.y<0.15&&distance(s,this.player.position)<1.7&&!this.people.reservations.owner(s.id)&&this.people.people.every(p=>distance(p.position,s)>=0.75)&&this.cars.every(c=>distance(c.position,s)>Math.hypot(c.width,c.length)/2+0.5));}
  private stand(force=false):void {if(!this.seated)return;if(!force){this.standing=1;this.playerView.overrideAnimation='stand';return;}this.standing=0;this.people.reservations.release('player');this.seated=undefined;this.drinkTime=0;this.playerView.overrideAnimation=undefined;this.player.speed=0;}
  private openShop(index:number):void {
    this.shopIndex=index;this.modal=true;this.player.speed=0;this.player.yaw=Math.PI;this.playerView.overrideAnimation='talk';
    const shop=shops[index];this.ui.shop(shop.name,index===1?'Asha: The new cold store is at the west end. Nimbu Corner needs a fruit crate delivered. Speak to them; they pay in game currency.':'Welcome, neighbor. Drinks are optional. Pay only with fictional Delhi Wallet currency. Nothing here connects to a real bank.',index!==1,false,index===2&&!this.jobBusy&&this.neighborhood.job==='available');this.syncScreen();this.updateViews(0.2);this.renderer.render(this.scene,this.camera.camera);
  }
  private orderDrink():void {
    const shop=shops[this.shopIndex];if(!('item' in shop)||this.payment!==undefined)return;
    this.neighborhood.cash=this.mission.cash;this.payment=this.neighborhood.order(shop.item);if(this.payment===undefined)return;
    this.playerView.overrideAnimation='pay';this.ui.shop('Delhi Wallet · Fictional UPI',`${shop.item.toUpperCase()} · ₹${shop.price}. Confirm to pay and receive one cup. This uses game currency only. Cancel leaves your balance unchanged.`,false,true,false);this.updateViews(0.2);this.renderer.render(this.scene,this.camera.camera);
  }
  private pay():void {if(this.payment===undefined)return;const id=this.payment;this.payment=undefined;const paid=this.neighborhood.pay(id);this.mission.cash=this.neighborhood.cash;this.closeShop();if(paid){this.handover=1.2;this.people.serve(this.shopIndex);}this.ui.toast(this.neighborhood.message);}
  private closeShop():void {this.neighborhood.cancel();this.payment=undefined;this.modal=false;this.playerView.overrideAnimation=undefined;this.ui.closeShop();this.syncScreen();this.updateViews(0.02);this.renderer.render(this.scene,this.camera.camera);}
  private resize = (): void => {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.resize(width, height);
    this.renderer.render(this.scene, this.camera.camera);
  };
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.audio.dispose();this.people.dispose();this.playerView.dispose();this.fleetViews.forEach(v=>v.dispose());this.trafficViews.forEach(v=>v.dispose());this.interaction.cancel();cancelAnimationFrame(this.frameId); this.abort.abort(); this.input.dispose(); this.ui.dispose();
    const skeletons=new Set<THREE.Skeleton>();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if(object instanceof THREE.SkinnedMesh)skeletons.add(object.skeleton);
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
      }
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    skeletons.forEach(s=>s.dispose());geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.district.lighting.dispose(); this.scene.environment = null;
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.root.replaceChildren();
  }
}
