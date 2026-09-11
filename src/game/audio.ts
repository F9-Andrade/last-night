import type { WeaponId } from './weapons';
import type { EnemyKind } from './enemies';
import type { Settings } from './settings';
import { BALANCE } from './config';
import { surfaceAt } from './world';
import type { GameEvent, Simulation } from './simulation';
import type { Vec2 } from './world';
/** Original procedural audio; no audio assets or network requests. Starts on a user gesture. */
export class Sound {
  private mix={master:80,music:35,effects:85}; private effects?:GainNode; private musicGain?:GainNode; private musicOsc:OscillatorNode[]=[]; private musicClock=0;
  private voices=0; private peakVoices=0; private pan=0; private attenuation=1; private ambientTimer=17; private vocalTimer=0; private darkness=0; private surface='grass'; private previousThreat=false;
  private context?: AudioContext; private master?: GainNode; private noise?: AudioBuffer;
  muted = false; private stepTimer = 0; private windGain?: GainNode; private windFilter?: BiquadFilterNode;
  start(): void {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : .24*this.mix.master/100; const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=6;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.12;this.master.connect(compressor).connect(this.context.destination);
      this.effects=this.context.createGain();this.effects.gain.value=this.mix.effects/100;this.effects.connect(this.master);
      this.musicGain=this.context.createGain();this.musicGain.gain.value=0;const musicFilter=this.context.createBiquadFilter();musicFilter.type='lowpass';musicFilter.frequency.value=380;this.musicGain.connect(musicFilter).connect(this.master);
      for(const frequency of [55,82.41,110.07]){const osc=this.context.createOscillator();osc.type='triangle';osc.frequency.value=frequency;osc.connect(this.musicGain);osc.start();this.musicOsc.push(osc);}
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const wind = this.context.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 220;
      const gain = this.context.createGain(); this.windGain = gain; this.windFilter = filter; gain.gain.value = .08; wind.connect(filter).connect(gain).connect(this.effects); wind.start();
    }
    void this.context.resume().catch(() => {});
  }
  metrics():{voices:number;peak:number;state:string} {return {voices:this.voices,peak:this.peakVoices,state:this.context?.state??'uninitialized'};}
  toggle(): void { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : .24*this.mix.master/100; }
  configure(settings:Settings):void {this.mix={master:settings.master,music:settings.music,effects:settings.effects};if(this.context){this.master?.gain.setTargetAtTime(this.muted?0:.24*this.mix.master/100,this.context.currentTime,.05);this.effects?.gain.setTargetAtTime(this.mix.effects/100,this.context.currentTime,.05);}}
  music(dt:number,sim:Simulation,ended=false):void {
    if(!this.context||!this.musicGain)return;this.musicClock+=dt;
    const near=sim.zombies.filter(z=>z.active&&Math.hypot(z.x-sim.player.x,z.z-sim.player.z)<18),nearby=near.length>0;const special=near.some(z=>z.kind!=='walker'),heavy=near.some(z=>z.kind==='tank');
    const baseline=ended||sim.phase==='dawn'||sim.cycle.silence>0?0:sim.phase==='night'?.1:sim.phase==='preparation'?.06:sim.phase==='dusk'?.035:nearby?.025:0;
    const tension=ended||sim.phase==='dawn'?0:baseline+(heavy?.04:special?.018:0);
    const pulse=sim.phase==='night'?.7+.3*Math.sin(this.musicClock*2.6):.8+.2*Math.sin(this.musicClock*.17);
    this.musicGain.gain.setTargetAtTime(tension*pulse*this.mix.music/100,this.context.currentTime,ended||sim.phase==='dawn'?1.2:.8);
    this.musicOsc.forEach((osc,i)=>osc.detune.setTargetAtTime(Math.sin(this.musicClock*.07+i*2)*6,this.context!.currentTime,1));
  }
  suspend(): void { void this.context?.suspend(); }
  private tone(frequency: number, end: number, duration: number, volume: number, type: OscillatorType = 'sine'): void {
    if (!this.context || !this.master || this.voices>=BALANCE.audio.voices) return;
    const now = this.context.currentTime, osc = this.context.createOscillator(), gain = this.context.createGain();
    this.voices++; this.peakVoices=Math.max(this.peakVoices,this.voices); const pan=this.context.createStereoPanner();pan.pan.value=this.pan;frequency*=.96+Math.random()*.08;volume*=this.attenuation;
    osc.type = type; osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration); osc.connect(gain).connect(pan).connect(this.effects!); osc.start(); osc.stop(now + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect();pan.disconnect();this.voices--; };
  }
  shot(id:WeaponId='pistol',suppressed=false): void {
    const voices:Record<WeaponId,{tone:[number,number,number,number,OscillatorType];noise:[number,number,number,BiquadFilterType];tail?:[number,number,number,number,OscillatorType]}>={
      pistol:{tone:[135,40,.16,.7,'triangle'],noise:[2300,.15,.7,'lowpass']},
      revolver:{tone:[95,28,.3,.8,'triangle'],noise:[3600,.22,.65,'lowpass'],tail:[210,70,.18,.14,'sawtooth']},
      smg:{tone:[190,85,.065,.3,'square'],noise:[4300,.055,.5,'bandpass']},
      shotgun:{tone:[72,24,.32,.8,'sine'],noise:[1300,.28,.85,'lowpass'],tail:[125,33,.22,.25,'triangle']},
      rifle:{tone:[170,55,.11,.55,'triangle'],noise:[5100,.09,.65,'highpass'],tail:[650,180,.045,.09,'square']},
      marksman:{tone:[105,32,.25,.7,'triangle'],noise:[2800,.19,.65,'bandpass'],tail:[1200,360,.1,.11,'sawtooth']},
    };const voice=voices[id];if(suppressed){voice.tone[3]*=.45;voice.noise[0]*=.4;voice.noise[2]*=.35;voice.tail=undefined;}this.tone(...voice.tone);if(voice.tail)this.tone(...voice.tail);
    if (!this.context || !this.master || !this.noise || this.voices>=BALANCE.audio.voices) return;
    const s = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain(), now = this.context.currentTime;
    this.voices++;this.peakVoices=Math.max(this.peakVoices,this.voices);s.playbackRate.value=.95+Math.random()*.1;
    s.buffer = this.noise; filter.type = voice.noise[3]; filter.frequency.value = voice.noise[0]; gain.gain.setValueAtTime(voice.noise[2], now); gain.gain.exponentialRampToValueAtTime(.001, now + voice.noise[1]);
    s.connect(filter).connect(gain).connect(this.effects!); s.start(); s.stop(now + voice.noise[1]+.02); s.onended = () => { s.disconnect(); filter.disconnect(); gain.disconnect();this.voices--; };
  }
  ambience(darkness: number): void { this.darkness=darkness; if (this.context && this.windGain && this.windFilter) { this.windGain.gain.setTargetAtTime(.08 + darkness * .09, this.context.currentTime, .5); this.windFilter.frequency.setTargetAtTime(220 + darkness * 160, this.context.currentTime, .5); } }
  event(event: string | GameEvent, listener?:Vec2): void {
    const type=typeof event==='string'?event:event.type;
    if(typeof event!=='string'&&event.type==='shot'&&event.primary===false)return;
    const position=typeof event!=='string' ? ('position' in event?event.position:'to' in event?event.to:undefined):undefined;
    this.pan=position&&listener?Math.max(-.85,Math.min(.85,((position.x-listener.x)-(position.z-listener.z))/18)):0;
    this.attenuation=position&&listener?1/(1+Math.hypot(position.x-listener.x,position.z-listener.z)*.07):1;
    if(typeof event!=='string' && event.type==='shot') {
      if(event.last)this.tone(1600,700,.07,.09,'square');
      if(!event.hit&&event.material!=='air')this.impact(event.material??'concrete');
    }
    if(type==='switch'){this.impact('wood');this.tone(480,230,.08,.08,'triangle');}
    if(type==='rare-pickup'){this.tone(440,660,.4,.09);this.tone(660,880,.7,.065,'triangle');}
    if(type==='spit-ready'){this.tone(125,280,.7,.15,'sawtooth');this.impact('flesh');}
    if(type==='spit'){this.tone(380,75,.24,.2,'triangle');this.impact('flesh');}
    if(type==='heavy-step'){this.tone(48,25,.22,.22,'sine');this.impact('concrete');}
    if(type==='enemy-call'&&typeof event!=='string'&&'enemy' in event)this.vocal(event.enemy??'walker');
    if(type==='reload-out')this.impact('wood');
    if(type==='reload-in'){this.tone(650,260,.09,.2,'square');this.impact('metal');}
    if(type==='reload-slide')this.tone(1800,500,.12,.12,'sawtooth');
    if(type==='reload-done')this.tone(360,220,.045,.07,'triangle');
    if(type==='death')this.tone(110,32,.45,.2,'sawtooth');
    if(type==='alarm'){this.tone(760,1100,.65,.15,'triangle');this.tone(1100,750,.8,.1);}

    if (type === 'shot') {this.pan=0;this.attenuation=1;this.shot(typeof event!=='string'&&event.type==='shot'?event.weapon:'pistol',typeof event!=='string'&&event.type==='shot'&&event.suppressed);}
    if (type === 'hit') {this.impact('flesh');this.tone(typeof event!=='string' && 'zone' in event && event.zone==='HEAD'?240:160,55,.095,.3,'triangle');}
    if (type === 'hurt') this.tone(85, 30, .3, .5, 'sawtooth');
    if (type === 'reload') { this.tone(1200, 350, .1, .15, 'square'); }
    if (type === 'empty') this.tone(300, 150, .05, .13, 'square');
    if(type==='select'||type==='ui')this.tone(420,310,.04,.04,'triangle');
    if (type === 'inventory') this.tone(340, 440, .06, .07, 'triangle');
    if (type === 'search') this.tone(180, 90, .25, .12, 'triangle');
    if (type === 'heal') this.tone(350, 500, .3, .08);
    if (type === 'healed') this.tone(450, 680, .25, .14);
    if (type === 'build' || type === 'repair') this.tone(160, 55, .16, .25, 'triangle');
    if (type === 'barricade-hit') this.tone(120, 40, .12, .18, 'triangle');
    if (type === 'barricade-break') this.tone(180, 28, .4, .3, 'sawtooth');
    if (type === 'warning') this.tone(185, 240, 1.8, .12, 'sine');
    if (type === 'countdown') this.tone(240, 210, .15, .1);
    if (type === 'night') this.tone(125, 48, 2, .2, 'triangle');
    if (type === 'dawn') this.tone(320, 640, 1.8, .13);
    if (type === 'pickup') this.tone(550, 1100, .18, .2);
  }
  private impact(surface:string):void {
    if(!this.context||!this.master||!this.noise||this.voices>=BALANCE.audio.voices)return;
    const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner(),now=c.currentTime;
    this.voices++; this.peakVoices=Math.max(this.peakVoices,this.voices);source.buffer=this.noise;source.playbackRate.value=.88+Math.random()*.24;
    filter.type='bandpass';filter.frequency.value=surface==='metal'?3400:surface==='concrete'?1300:surface==='wood'?700:380;filter.Q.value=surface==='metal'?5:.7;
    pan.pan.value=this.pan;gain.gain.setValueAtTime(.24*this.attenuation,now);gain.gain.exponentialRampToValueAtTime(.001,now+.14);
    source.connect(filter).connect(gain).connect(pan).connect(this.effects!);source.start(now,Math.random()*.5);source.stop(now+.16);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();this.voices--;};
  }
  private vocal(kind:EnemyKind):void {
    if(kind==='runner'){this.tone(310,190,.24,.11,'sawtooth');this.tone(470,210,.13,.07,'triangle');this.impact('wood');}
    else if(kind==='tank'){this.tone(62,28,.8,.17,'sawtooth');this.tone(38,26,.45,.1,'sine');}
    else if(kind==='spitter'){this.tone(170,75,.45,.12,'triangle');this.impact('flesh');this.tone(220,120,.18,.08,'square');}
  }
  threats(dt:number,sim:Simulation):void {
    this.surface=surfaceAt(sim.player);this.vocalTimer-=dt;if(this.vocalTimer>0)return;
    const nearest=sim.zombies.filter(z=>z.active).sort((a,b)=>Math.hypot(a.x-sim.player.x,a.z-sim.player.z)-Math.hypot(b.x-sim.player.x,b.z-sim.player.z))[0];
    if(nearest&&Math.hypot(nearest.x-sim.player.x,nearest.z-sim.player.z)<15){
      this.pan=Math.max(-.8,Math.min(.8,((nearest.x-sim.player.x)-(nearest.z-sim.player.z))/15));this.attenuation=.6;
      if(nearest.kind==='walker'){this.tone(nearest.attack>.8?140:!this.previousThreat&&nearest.hearing>0?180:95,nearest.hearing>0?65:45,.55,.12,'triangle');this.impact('wood');}else this.vocal(nearest.kind);
    }
    this.previousThreat=!!nearest&&nearest.hearing>0;this.vocalTimer=1.7+Math.random()*2;this.pan=0;this.attenuation=1;
  }
  step(dt: number, moving: boolean, running: boolean): void { this.pan=0;this.attenuation=1;this.ambientTimer-=dt;if(this.ambientTimer<=0){this.pan=(Math.random()-.5)*1.5;const choice=Math.floor(Math.random()*3);if(choice===0)this.tone(this.darkness>.5?420:1400,this.darkness>.5?210:1800,this.darkness>.5?1.8:.25,.025);else if(choice===1){this.attenuation=.12;this.impact('metal');}else {this.tone(this.darkness>.5?520:210,this.darkness>.5?820:100,this.darkness>.5?2.2:.45,.018,'triangle');}this.ambientTimer=BALANCE.audio.ambientMin+Math.random()*BALANCE.audio.ambientRange;}this.stepTimer -= dt; if (moving && this.stepTimer <= 0) { this.tone(this.surface==='wood'?130:this.surface==='grass'?65:90,35,.08,this.surface==='grass'?.055:.09,'triangle'); this.stepTimer = running ? .24 : .36; } }
}
