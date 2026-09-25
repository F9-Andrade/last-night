import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import type {Viewmodel} from './viewmodel';
import {VISUAL,visualPreset} from './visual-config';

/** Half-resolution world-only AO; the FPS rig is composed afterwards in linear HDR. */
class WorldAO extends GTAOPass {
 resolutionScale=.5;
 private ignored:THREE.Object3D[]=[];
 override setSize(width:number,height:number):void {
  super.setSize(Math.max(1,Math.round(width*this.resolutionScale)),Math.max(1,Math.round(height*this.resolutionScale)));
 }
 override render(renderer:THREE.WebGLRenderer,write:THREE.WebGLRenderTarget,read:THREE.WebGLRenderTarget):void {
  this.ignored.length=0;this.scene.traverse(o=>{if(o.visible&&o.userData.skipAO){o.visible=false;this.ignored.push(o);}});
  const update=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
  try{super.render(renderer,write,read,0,false);}finally{renderer.shadowMap.autoUpdate=update;this.ignored.forEach(o=>o.visible=true);}
 }
}
class RigPass extends Pass {
 constructor(private rig:Viewmodel,private camera:THREE.PerspectiveCamera){super();this.needsSwap=false;}
 override render(renderer:THREE.WebGLRenderer,_write:THREE.WebGLRenderTarget,read:THREE.WebGLRenderTarget):void {renderer.setRenderTarget(read);this.rig.render(renderer,this.camera);}
}
const GradeShader={
 uniforms:{tDiffuse:{value:null},saturation:{value:VISUAL.grade.saturation},contrast:{value:VISUAL.grade.contrast},vignette:{value:VISUAL.grade.vignette},hurt:{value:0}},
 vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:`uniform sampler2D tDiffuse; uniform float saturation,contrast,vignette,hurt; varying vec2 vUv;
 void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
 c=mix(vec3(l),c,saturation);c=(c-.5)*contrast+.5;
 // Restrained split tone: cool shade, gently warm highlights, recognizable colors.
 c+=vec3(-.006,.001,.011)*(1.-smoothstep(.10,.50,l));c+=vec3(.010,.004,-.005)*smoothstep(.55,.9,l);
 vec2 d=vUv-.5;float edge=smoothstep(.12,.52,dot(d,d));c*=1.-edge*(vignette+hurt*.16);
 c=mix(c,c*vec3(1.05,.68,.62),edge*hurt*.22);gl_FragColor=vec4(max(c,vec3(0.)),1.);}`
};
export class PostProcessing {
 readonly composer:EffectComposer;readonly ao:WorldAO;
 private bloom:UnrealBloomPass;private grade=new ShaderPass(GradeShader);private fxaa=new ShaderPass(FXAAShader);
 private quality='high';private width=1;private height=1;private ratio=0;private appliedQuality='';private damage=0;
 /** Individual passes can be disabled for repeatable visual evaluation. */
 constructor(private renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,rig:Viewmodel){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});target.samples=2;
  this.composer=new EffectComposer(renderer,target);this.composer.addPass(new RenderPass(scene,camera));
  this.ao=new WorldAO(scene,camera,1,1);this.ao.output=GTAOPass.OUTPUT.Default;this.ao.blendIntensity=VISUAL.ao.intensity;
  this.ao.updateGtaoMaterial({radius:VISUAL.ao.radius,thickness:VISUAL.ao.thickness,distanceExponent:2,distanceFallOff:1,scale:1,samples:VISUAL.ao.samples,screenSpaceRadius:false});
  this.ao.updatePdMaterial({radius:4,lumaPhi:10,depthPhi:3,normalPhi:4,samples:8});this.composer.addPass(this.ao);
  this.composer.addPass(new RigPass(rig,camera));
  this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),VISUAL.bloom.strength,VISUAL.bloom.radius,VISUAL.bloom.threshold);this.composer.addPass(this.bloom);
  this.composer.addPass(new OutputPass());this.composer.addPass(this.grade);this.composer.addPass(this.fxaa);
 }
 setQuality(quality:string):void {
  if(this.appliedQuality===quality)return;
  this.quality=quality;const p=visualPreset(quality);this.ao.enabled=p.aoScale>0;this.ao.resolutionScale=p.aoScale||.5;
  this.bloom.enabled=p.bloom;this.ao.updateGtaoMaterial({samples:p.aoSamples||8});this.resize(this.width,this.height);
 }
 resize(width:number,height:number):void {
  const ratio=this.renderer.getPixelRatio(),sizeChanged=width!==this.width||height!==this.height;
  if(!sizeChanged&&ratio===this.ratio&&this.appliedQuality===this.quality)return;
  // The AO pass scales composer dimensions itself, so resizing never allocates
  // a full-resolution AO buffer only to discard it for a half-resolution one.
  if(ratio!==this.ratio)this.composer.setPixelRatio(ratio);
  if(sizeChanged)this.composer.setSize(width,height);
  this.ao.setSize(width*ratio,height*ratio);
  this.width=width;this.height=height;this.ratio=ratio;this.appliedQuality=this.quality;
  this.fxaa.uniforms.resolution.value.set(1/(width*ratio),1/(height*ratio));
 }
 hurt():void {this.damage=1;}
 render(dt:number,hp:number):void {this.damage=Math.max(0,this.damage-dt*1.9);this.grade.uniforms.hurt.value=Math.max(this.damage,THREE.MathUtils.clamp((30-hp)/30,0,1)*.65);this.composer.render(dt);}
 metrics(){const p=visualPreset(this.quality);return {ao:this.ao.enabled?'GTAO':'off',aoResolutionScale:p.aoScale,bloom:this.bloom.enabled,toneMapping:'AgX',exposure:this.renderer.toneMappingExposure,post:'world → GTAO → FPS rig → restrained bloom → AgX/output → grade/vignette → FXAA'};}
}
