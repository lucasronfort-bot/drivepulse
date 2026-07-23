"use strict";

const $=id=>document.getElementById(id);
const ui={
 status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),journey:$("journeyBtn"),
 quality:$("qualityBtn"),record:$("recordBtn"),downloadLog:$("downloadLogBtn"),
 speed:$("speed"),speedMusic:$("speedMusicState"),speedMusicTrack:$("speedMusicTrack"),energy:$("energyLabel"),energyTrack:$("energyTrack"),
 section:$("sectionState"),mode:$("modeLabel"),bar:$("barLabel"),road:$("roadState"),roadHelp:$("roadModeHelp"),
 accel:$("accelMeter"),brake:$("brakeMeter"),turn:$("turnMeter"),music:$("musicMeter"),
 accelValue:$("accelValue"),brakeValue:$("brakeValue"),turnValue:$("turnValue"),musicValue:$("musicValue"),
 shortMemory:$("shortMemoryState"),longMemory:$("longMemoryState"),shortMemoryMeter:$("shortMemoryMeter"),longMemoryMeter:$("longMemoryMeter"),
 chord:$("chordState"),bass:$("bassState"),drum:$("drumState"),arp:$("arpState"),filter:$("filterState"),variation:$("variationState"),idle:$("idleState"),
 idlePiano:$("idlePianoToggle"),agentGrid:$("agentGrid"),
 responsiveness:$("responsiveness"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity"),
 responsivenessValue:$("responsivenessValue"),accelSensitivityValue:$("accelSensitivityValue"),turnSensitivityValue:$("turnSensitivityValue"),
 helpModal:$("helpModal"),helpTitle:$("helpTitle"),helpText:$("helpText"),helpRecommendation:$("helpRecommendation"),closeHelp:$("closeHelpBtn"),
 calibrationState:$("calibrationState"),motionX:$("motionXState"),motionY:$("motionYState"),motionZ:$("motionZState"),
 imuLong:$("imuLongState"),imuLat:$("imuLatState"),gpsAccel:$("gpsAccelState"),yawRate:$("yawRateState"),headingRate:$("headingRateState"),
 motionHz:$("motionHzState"),audioMode:$("audioModeState")
};

const MANIFEST_URL="audio/kalte-ohren/manifest.json";
const BPM=120;
const BEAT_DURATION=60/BPM;
const BAR_DURATION=BEAT_DURATION*4;
const LOOP_DURATION=BAR_DURATION*8;
const SCHEDULE_AHEAD=.72;
const ENGINE_INTERVAL=50;

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const lowPass=(oldValue,newValue,amount=.12)=>oldValue+amount*(newValue-oldValue);
const smoothstep=(edge0,edge1,value)=>{
 const x=clamp((value-edge0)/(edge1-edge0));
 return x*x*(3-2*x);
};
const mod=(value,divisor)=>((value%divisor)+divisor)%divisor;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;

const vec=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const scale=(a,s)=>vec(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const length=a=>Math.hypot(a.x,a.y,a.z);
const normalize=(a,fallback=vec(0,0,1))=>{
 const size=length(a);
 return size>.0001?scale(a,1/size):fallback;
};
const projectToPlane=(a,normal)=>add(a,scale(normal,-dot(a,normal)));
const meanVector=samples=>samples.length?scale(samples.reduce((sum,item)=>add(sum,item),vec()),1/samples.length):vec();
const wrapDegrees=value=>((value+180)%360+360)%360-180;

const ROAD_PROFILES={
 city:{label:"Ville",maxSpeed:50,help:"Référence 50 km/h"},
 country:{label:"Campagne",maxSpeed:80,help:"Référence 80 km/h"},
 highway:{label:"Autoroute",maxSpeed:130,help:"Référence 130 km/h"}
};

const SCENE_LABELS={
 intro:"Intro",groove:"Groove",drive:"Montée",breakdown:"Respiration",chorus:"Refrain",finale:"Finale"
};

const BUSES=[
 {id:"rhythm",emoji:"🥁",name:"RHYTHM",role:"Kick, snare & rim",description:"Énergie > 10 % · réduit immédiatement au freinage",color:"#ff5d67",timing:"beat"},
 {id:"tops",emoji:"✨",name:"TOPS",role:"Hi-hats & percussions",description:"Accélération, virages ou énergie > 27 %",color:"#ffc13d",timing:"beat"},
 {id:"bass",emoji:"🔊",name:"BASS",role:"Sub & basses mélodiques",description:"Énergie > 12 % · changement à la prochaine mesure",color:"#25c5ff",timing:"bar"},
 {id:"harmony",emoji:"☁️",name:"HARMONY",role:"Pads, textures & guitare",description:"Fond permanent · légèrement réduit quand l’énergie monte",color:"#f06ec7",timing:"immediate"},
 {id:"piano",emoji:"🎹",name:"PIANO",role:"Rhodes dédié",description:"Actif de 0 à 30 km/h · fondu progressif jusqu’à 34 km/h",color:"#66d7ff",timing:"immediate"},
 {id:"lead",emoji:"🎶",name:"LEAD",role:"Pluck & synth lead",description:"Énergie > 40 % · changement à la prochaine mesure",color:"#dc65d9",timing:"bar"},
 {id:"fx",emoji:"🌊",name:"FX",role:"Risers & impacts",description:"Accélération, freinage et changement de scène",color:"#a853f2",timing:"immediate"}
];

const FIXED_MIX={rhythm:.86,tops:.55,bass:.76,harmony:.74,piano:0,lead:.58,fx:.34};

let manifest=null;
let running=false;
let audioCtx=null;
let masterGain=null;
let masterFilter=null;
let masterCompressor=null;
let schedulerTimer=null;
let updateTimer=null;
let watchId=null;
let demoTimer=null;
let journeyTimer=null;
let generation=0;
let fixedMixMode=false;

let roadMode=localStorage.getItem("drivepulse-road-mode")||"city";
let speedKmh=0;
let gpsSpeedMs=0;
let gpsAcceleration=0;
let gpsHeadingRate=0;
let smoothed={accel:0,brake:0,turn:0};
let rawMotion=vec();
let linearMotion=vec();
let imuLongitudinal=0;
let imuLateral=0;
let verticalYawRate=0;
let motionFrequency=0;
let motionEventCount=0;
let motionFrequencyWindow=performance.now();
let automaticSignScore=0;

let sensorCalibration={
 gravity:vec(0,1,0),
 forward:vec(0,0,-1),
 lateral:vec(1,0,0),
 calibrated:false,
 source:"Orientation par défaut"
};
let calibration={phase:"idle",stationary:[],drive:[],driveWeights:[],timer:null};

let shortMemory=0;
let longMemory=0;
let stableSpeedMemory=0;
let previousSpeed=0;
let lastMemoryUpdate=performance.now();
let energy=0;
let speedIntensity=0;
let currentScene="intro";
let targetScene="intro";
let currentPhaseStart=0;
let nextLoopTime=0;
let activeGroup=null;
let pendingTransition=null;
let nextLoopGroup=null;
let candidateScene="intro";
let candidateSince=0;
let lastFinaleChoice=false;

const sceneCache=new Map();
const sceneLoads=new Map();
const sceneAccess=new Map();
const busNodes=new Map();
const busRequestedLevels=new Map();
const lastVisualLevels=new Map();
const visualTimeouts=new Map();
const activeGroups=new Set();

let sensorLogging=false;
let sensorLog=[];
let lastLogAt=0;
let lastGps={timestamp:0,speed:null,heading:null};

function setStatus(text){ui.status.innerHTML=`<i></i> ${text}`;}

function renderAgents(){
 ui.agentGrid.innerHTML=BUSES.map((bus,index)=>`
  <article class="agent-card" data-agent="${bus.id}" style="--agent-color:${bus.color}">
   <div class="agent-head">
    <div class="agent-avatar">${bus.emoji}</div>
    <div class="agent-copy"><span class="agent-name">${bus.name}</span><span class="agent-role">${bus.role}</span></div>
   </div>
   <p class="agent-description">${bus.description}</p>
   <div class="agent-status"><i></i><span>Inactif</span></div>
   <div class="agent-meter" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="animation-delay:-${((i*.09)+(index*.03)).toFixed(2)}s"></i>`).join("")}</div>
  </article>`).join("");
}

function setAgentVisualState(id,state){
 const card=ui.agentGrid.querySelector(`[data-agent="${id}"]`);
 if(!card)return;
 card.classList.toggle("active",state==="active");
 card.classList.toggle("transition",state==="transition");
 const label=card.querySelector(".agent-status span");
 if(label)label.textContent=state==="active"?"Actif":state==="transition"?"En transition":"Inactif";
}

function updateAgentVisual(id,level){
 const previous=lastVisualLevels.get(id)||0;
 const wasActive=previous>.055;
 const isActive=level>.055;
 lastVisualLevels.set(id,level);
 if(wasActive!==isActive){
  setAgentVisualState(id,"transition");
  if(visualTimeouts.has(id))clearTimeout(visualTimeouts.get(id));
  visualTimeouts.set(id,setTimeout(()=>setAgentVisualState(id,isActive?"active":"inactive"),220));
 }else setAgentVisualState(id,isActive?"active":"inactive");
}

async function loadManifest(){
 if(manifest)return manifest;
 const response=await fetch(MANIFEST_URL,{cache:"no-cache"});
 if(!response.ok)throw new Error("Manifest audio V8.1 introuvable.");
 manifest=await response.json();
 return manifest;
}

function createAudioGraph(){
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)throw new Error("Web Audio API indisponible.");
 try{audioCtx=new AudioContextClass({latencyHint:"interactive",sampleRate:44100});}
 catch{audioCtx=new AudioContextClass();}

 masterGain=audioCtx.createGain();
 masterFilter=audioCtx.createBiquadFilter();
 masterCompressor=audioCtx.createDynamicsCompressor();
 masterGain.gain.value=.88;
 masterFilter.type="lowpass";
 masterFilter.frequency.value=19000;
 masterFilter.Q.value=.55;
 masterCompressor.threshold.value=-4;
 masterCompressor.knee.value=3;
 masterCompressor.ratio.value=4;
 masterCompressor.attack.value=.008;
 masterCompressor.release.value=.12;
 masterGain.connect(masterFilter).connect(masterCompressor).connect(audioCtx.destination);

 BUSES.forEach(bus=>{
  const gain=audioCtx.createGain();
  gain.gain.value=0;
  gain.connect(masterGain);
  busNodes.set(bus.id,gain);
  busRequestedLevels.set(bus.id,0);
  lastVisualLevels.set(bus.id,0);
 });
}

async function decodeAudio(url){
 const response=await fetch(url,{cache:"force-cache"});
 if(!response.ok)throw new Error(`Audio introuvable : ${url}`);
 const arrayBuffer=await response.arrayBuffer();
 return audioCtx.decodeAudioData(arrayBuffer);
}

function estimateBufferDb(buffer){
 let sum=0,count=0;
 const stride=512;
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const data=buffer.getChannelData(channel);
  for(let index=0;index<data.length;index+=stride){sum+=data[index]*data[index];count++;}
 }
 if(!count)return -120;
 const rms=Math.sqrt(sum/count);
 return rms>1e-7?20*Math.log10(rms):-120;
}

async function loadScene(name){
 if(sceneCache.has(name)){
  sceneAccess.set(name,performance.now());
  return sceneCache.get(name);
 }
 if(sceneLoads.has(name))return sceneLoads.get(name);
 const promise=(async()=>{
  const scene=manifest.scenes[name];
  if(!scene)throw new Error(`Scène inconnue : ${name}`);
  const entries=await Promise.all(BUSES.map(async bus=>{
   const buffer=await decodeAudio(scene.files[bus.id]);
   return [bus.id,{buffer,rmsDb:estimateBufferDb(buffer)}];
  }));
  const data=new Map(entries);
  sceneCache.set(name,data);
  sceneAccess.set(name,performance.now());
  sceneLoads.delete(name);
  pruneSceneCache();
  return data;
 })().catch(error=>{sceneLoads.delete(name);throw error;});
 sceneLoads.set(name,promise);
 return promise;
}

function pruneSceneCache(){
 const protectedScenes=new Set([currentScene,targetScene,pendingTransition?.scene,nextLoopGroup?.scene].filter(Boolean));
 const candidates=[...sceneCache.keys()].filter(name=>!protectedScenes.has(name));
 while(sceneCache.size>3&&candidates.length){
  candidates.sort((a,b)=>(sceneAccess.get(a)||0)-(sceneAccess.get(b)||0));
  const oldest=candidates.shift();
  sceneCache.delete(oldest);
  sceneAccess.delete(oldest);
 }
}

async function prefetchAllAudio(){
 if(!manifest)return;
 const urls=[];
 Object.values(manifest.scenes).forEach(scene=>Object.values(scene.files).forEach(url=>urls.push(url)));
 for(const url of urls){
  if(!running)return;
  try{await fetch(url,{cache:"force-cache"});}catch{}
 }
}

function sceneSignal(scene,bus){
 const db=sceneCache.get(scene)?.get(bus)?.rmsDb??-120;
 return db>-68?1:0;
}

function startSceneGroup(scene,when,offset=0,fadeIn=.055){
 const data=sceneCache.get(scene);
 if(!data)return null;
 const duration=Math.max(.05,LOOP_DURATION-offset);
 const group={scene,when,offset,end:when+duration,sources:[],sourceGains:[],stopped:false};
 BUSES.forEach(bus=>{
  const entry=data.get(bus.id);
  if(!entry)return;
  const source=audioCtx.createBufferSource();
  const sourceGain=audioCtx.createGain();
  source.buffer=entry.buffer;
  if(fadeIn>0){
   sourceGain.gain.setValueAtTime(0,when);
   sourceGain.gain.linearRampToValueAtTime(1,when+fadeIn);
  }else sourceGain.gain.setValueAtTime(1,when);
  source.connect(sourceGain).connect(busNodes.get(bus.id));
  const available=Math.max(.03,Math.min(duration,entry.buffer.duration-offset));
  source.start(when,offset,available);
  source.stop(when+available+.04);
  group.sources.push(source);
  group.sourceGains.push(sourceGain);
 });
 activeGroups.add(group);
 const cleanupDelay=Math.max(0,(group.end-audioCtx.currentTime+.2)*1000);
 setTimeout(()=>activeGroups.delete(group),cleanupDelay);
 return group;
}

function fadeOutGroup(group,when,duration=.055){
 if(!group||group.stopped)return;
 group.sourceGains.forEach(gain=>{
  gain.gain.cancelScheduledValues(when);
  gain.gain.setValueAtTime(gain.gain.value,when);
  gain.gain.linearRampToValueAtTime(0,when+duration);
 });
 group.sources.forEach(source=>{try{source.stop(when+duration+.025);}catch{}});
 group.stopped=true;
}

function cancelFutureGroup(group){
 if(!group)return;
 group.sources.forEach(source=>{try{source.stop();}catch{}});
 group.sourceGains.forEach(node=>{try{node.disconnect();}catch{}});
 group.stopped=true;
 activeGroups.delete(group);
}

function nextGridTime(step,minimumTime=audioCtx.currentTime+.06){
 const elapsed=minimumTime-currentPhaseStart;
 return currentPhaseStart+Math.ceil(elapsed/step)*step;
}

function commitSceneAt(scene,group,phaseStart){
 currentScene=scene;
 activeGroup=group;
 currentPhaseStart=phaseStart;
 updateSectionTimeline();
 pruneSceneCache();
 warmLikelyScenes();
}

function scheduleTransitionIfReady(){
 if(!running||fixedMixMode&&targetScene!=="chorus")return;
 if(targetScene===currentScene||pendingTransition||!sceneCache.has(targetScene))return;
 const now=audioCtx.currentTime;
 const boundary=nextGridTime(BAR_DURATION,now+.12);

 if(boundary>=nextLoopTime-.045){
  if(nextLoopGroup&&nextLoopGroup.scene!==targetScene&&now<nextLoopGroup.when-.035){
   cancelFutureGroup(nextLoopGroup.group);
   nextLoopGroup=null;
  }
  return;
 }

 const offset=mod(boundary-currentPhaseStart,LOOP_DURATION);
 const transitionScene=targetScene;
 const group=startSceneGroup(transitionScene,boundary,offset,.065);
 if(!group)return;
 fadeOutGroup(activeGroup,boundary,.065);
 pendingTransition={scene:transitionScene,when:boundary,offset,group};
 setTimeout(()=>{
  if(!running||pendingTransition?.group!==group)return;
  commitSceneAt(transitionScene,group,boundary-offset);
  pendingTransition=null;
  applyBusMix(true);
 },Math.max(0,(boundary-audioCtx.currentTime)*1000));
}

function scheduler(){
 if(!running||!audioCtx)return;
 const now=audioCtx.currentTime;
 scheduleTransitionIfReady();

 if(nextLoopGroup&&now>=nextLoopGroup.when-.012){
  const item=nextLoopGroup;
  nextLoopGroup=null;
  commitSceneAt(item.scene,item.group,item.when);
  nextLoopTime=item.when+LOOP_DURATION;
  applyBusMix(true);
 }

 if(!nextLoopGroup&&nextLoopTime<now+SCHEDULE_AHEAD){
  let scene=currentScene;
  if(sceneCache.has(targetScene))scene=targetScene;
  if(pendingTransition)scene=pendingTransition.scene;
  const group=startSceneGroup(scene,nextLoopTime,0,.012);
  if(group)nextLoopGroup={scene,when:nextLoopTime,group};
 }
}

function requestTargetScene(name){
 if(!manifest?.scenes?.[name])return;
 targetScene=name;
 loadScene(name).then(()=>scheduleTransitionIfReady()).catch(error=>setStatus(error.message||"Chargement audio impossible."));
}

function warmLikelyScenes(){
 const choices={intro:["groove"],groove:["drive","breakdown"],drive:["chorus","breakdown"],breakdown:["groove","drive"],chorus:["finale","breakdown"],finale:["breakdown","groove"]}[currentScene]||[];
 choices.slice(0,2).forEach(name=>loadScene(name).catch(()=>{}));
}

function desiredBusLevels(){
 if(fixedMixMode)return {...FIXED_MIX};
 const e=energy;
 const stopped=speedKmh<4;
 const accel=smoothed.accel;
 const brake=smoothed.brake;
 const turn=smoothed.turn;
 const pianoEnabled=ui.idlePiano.checked;
 const pianoFade=pianoEnabled?1-smoothstep(26,34,speedKmh):0;
 const harmonyBase=clamp(.70-.15*e,0,.70);
 return {
  rhythm:clamp(smoothstep(.10,.36,e)*(.90-brake*.72),0,.90),
  tops:clamp(Math.max(smoothstep(.27,.60,e)*.62,accel*.62,turn*.58),0,.68),
  bass:clamp(smoothstep(.12,.40,e)*.78,0,.78),
  harmony:clamp(harmonyBase-(pianoFade*.18),.38,.70),
  piano:clamp(.78*pianoFade,0,.78),
  lead:clamp(smoothstep(.40,.72,e)*.64,0,.64),
  fx:clamp(.07+accel*.42+brake*.36+(targetScene!==currentScene?.20:0),0,.42)
 };
}

function scheduleBusLevel(bus,level,force=false){
 const node=busNodes.get(bus.id);
 if(!node||!audioCtx)return;
 const previous=busRequestedLevels.get(bus.id)||0;
 if(!force&&Math.abs(level-previous)<.025)return;
 busRequestedLevels.set(bus.id,level);
 const now=audioCtx.currentTime;
 node.gain.cancelScheduledValues(now);
 node.gain.setValueAtTime(node.gain.value,now);
 if(bus.timing==="immediate")node.gain.setTargetAtTime(level,now,.038);
 else{
  const grid=bus.timing==="beat"?BEAT_DURATION:BAR_DURATION;
  const when=nextGridTime(grid,now+.035);
  node.gain.setValueAtTime(node.gain.value,when);
  node.gain.linearRampToValueAtTime(level,when+.055);
 }
}

function applyBusMix(force=false){
 if(!audioCtx)return;
 const desired=desiredBusLevels();
 const availabilityScene=pendingTransition?.scene||currentScene;
 BUSES.forEach(bus=>{
  const signal=Math.max(sceneSignal(currentScene,bus.id),pendingTransition?sceneSignal(pendingTransition.scene,bus.id):0);
  let level=desired[bus.id]*(signal?1:0);
  scheduleBusLevel(bus,level,force);
  updateAgentVisual(bus.id,level);
 });

 const now=audioCtx.currentTime;
 const brake=smoothed.brake;
 const cutoff=fixedMixMode?19000:brake>.04?900+(1-brake)*6800:10500+energy*8500+smoothed.accel*1800;
 masterFilter.frequency.setTargetAtTime(clamp(cutoff,650,19500),now,.045);
 masterGain.gain.setTargetAtTime(fixedMixMode?.88:brake>.58?.68:.88,now,.055);
}

function updateDrivingMemory(){
 const now=performance.now();
 const dt=Math.min(1,(now-lastMemoryUpdate)/1000);
 lastMemoryUpdate=now;
 const profile=ROAD_PROFILES[roadMode];
 speedIntensity=clamp(speedKmh/profile.maxSpeed);
 const immediate=clamp(speedIntensity*.57+smoothed.accel*.26+smoothed.turn*.12-smoothed.brake*.18);
 shortMemory=lowPass(shortMemory,immediate,Math.min(.52,dt*.72));
 longMemory=lowPass(longMemory,shortMemory,Math.min(.12,dt*.065));
 const speedDelta=Math.abs(speedKmh-previousSpeed);
 const stable=speedKmh>8&&speedDelta<2.8&&smoothed.accel<.20&&smoothed.brake<.20?1:0;
 stableSpeedMemory=lowPass(stableSpeedMemory,stable,Math.min(.28,dt*.18));
 previousSpeed=speedKmh;
 energy=clamp(speedIntensity*.54+shortMemory*.19+longMemory*.11+smoothed.accel*.20+smoothed.turn*.08-smoothed.brake*.13);
}

function evaluateScene(){
 if(fixedMixMode)return "chorus";
 if(smoothed.brake>.36)return "breakdown";
 if(speedKmh<4)return "intro";
 if(speedIntensity>.74&&longMemory>.45)return longMemory>.70?"finale":"chorus";
 if(smoothed.accel>.24||shortMemory>.54)return "drive";
 if(speedIntensity>.27||stableSpeedMemory>.34)return "groove";
 return "intro";
}

function maybeUpdateTarget(){
 const candidate=evaluateScene();
 const now=performance.now();
 if(candidate!==candidateScene){candidateScene=candidate;candidateSince=now;return;}
 const responsiveness=Math.max(.5,Number(ui.responsiveness.value));
 const hold=candidate==="breakdown"?70:candidate==="drive"?220/responsiveness:420/responsiveness;
 if(candidate!==targetScene&&now-candidateSince>=hold)requestTargetScene(candidate);
}

function updateSectionTimeline(){
 document.querySelectorAll("[data-section]").forEach(node=>node.classList.toggle("current",node.dataset.section===currentScene));
}

function modeLabel(){
 if(fixedMixMode)return "Mix fixe";
 if(smoothed.brake>.36)return "Brake";
 if(energy>.70)return "Boost";
 if(smoothed.turn>.34)return "Curve";
 if(energy>.34)return "Drive";
 return "Cruise";
}

function updateCalibrationBadge(){
 const phase=calibration.phase;
 ui.calibrationState.classList.toggle("running",phase!=="idle");
 ui.calibrationState.classList.toggle("ready",phase==="idle"&&sensorCalibration.calibrated);
 if(phase==="stationary")ui.calibrationState.textContent="Étape 1/2 : immobile";
 else if(phase==="drive")ui.calibrationState.textContent="Étape 2/2 : ligne droite";
 else ui.calibrationState.textContent=sensorCalibration.calibrated?"Calibration 3D prête":"Orientation par défaut";
}

function updateUi(){
 const profile=ROAD_PROFILES[roadMode];
 const now=audioCtx&&running?audioCtx.currentTime:currentPhaseStart;
 const barPosition=running?Math.floor(mod(now-currentPhaseStart,LOOP_DURATION)/BAR_DURATION)+1:1;
 const levels=desiredBusLevels();
 ui.speed.textContent=Math.round(speedKmh);
 ui.speedMusic.textContent=`${Math.round(speedIntensity*100)}%`;
 ui.speedMusicTrack.style.width=`${Math.round(speedIntensity*100)}%`;
 ui.energy.textContent=`${Math.round(energy*100)}%`;
 ui.energyTrack.style.width=`${Math.round(energy*100)}%`;
 ui.section.textContent=SCENE_LABELS[currentScene];
 ui.mode.textContent=modeLabel();
 ui.bar.textContent=`${barPosition} / 8`;
 ui.road.textContent=profile.label;
 ui.roadHelp.textContent=profile.help;

 ui.accel.value=smoothed.accel;ui.brake.value=smoothed.brake;ui.turn.value=smoothed.turn;ui.music.value=energy;
 ui.accelValue.value=smoothed.accel.toFixed(2);ui.brakeValue.value=smoothed.brake.toFixed(2);ui.turnValue.value=smoothed.turn.toFixed(2);ui.musicValue.value=energy.toFixed(2);
 ui.shortMemory.textContent=`${Math.round(shortMemory*100)}%`;ui.longMemory.textContent=`${Math.round(longMemory*100)}%`;
 ui.shortMemoryMeter.value=shortMemory;ui.longMemoryMeter.value=longMemory;

 ui.chord.textContent="Kalte Ohren · HQ";
 ui.bass.textContent=levels.bass>.58?"Pleine":levels.bass>.22?"Active":"Légère";
 ui.drum.textContent=levels.rhythm>.65?"Complète":levels.rhythm>.20?"Progressive":"Réduite";
 ui.arp.textContent=levels.lead>.46?"Présent":levels.lead>.08?"Discret":"Retiré";
 ui.filter.textContent=smoothed.brake>.18?"Fermé":"Ouvert";
 ui.variation.textContent=SCENE_LABELS[targetScene];
 ui.idle.textContent=ui.idlePiano.checked?(speedKmh<=30?"Piano actif":"Piano hors plage"):"Piano désactivé";

 ui.motionX.textContent=rawMotion.x.toFixed(2);ui.motionY.textContent=rawMotion.y.toFixed(2);ui.motionZ.textContent=rawMotion.z.toFixed(2);
 ui.imuLong.textContent=imuLongitudinal.toFixed(2);ui.imuLat.textContent=imuLateral.toFixed(2);
 ui.gpsAccel.textContent=`${gpsAcceleration.toFixed(2)} m/s²`;ui.yawRate.textContent=`${verticalYawRate.toFixed(1)} °/s`;ui.headingRate.textContent=`${gpsHeadingRate.toFixed(1)} °/s`;
 ui.motionHz.textContent=`${motionFrequency.toFixed(0)} Hz`;ui.audioMode.textContent=fixedMixMode?"Mix fixe":"Adaptatif low latency";
 updateCalibrationBadge();
}

function maybeLogSensors(){
 if(!sensorLogging)return;
 const now=performance.now();
 if(now-lastLogAt<200)return;
 lastLogAt=now;
 sensorLog.push({
  iso:new Date().toISOString(),elapsed_ms:Math.round(now),road_mode:roadMode,scene:currentScene,target_scene:targetScene,
  speed_kmh:speedKmh.toFixed(2),gps_accel_ms2:gpsAcceleration.toFixed(3),gps_heading_rate_dps:gpsHeadingRate.toFixed(3),
  motion_x:rawMotion.x.toFixed(4),motion_y:rawMotion.y.toFixed(4),motion_z:rawMotion.z.toFixed(4),
  imu_longitudinal:imuLongitudinal.toFixed(4),imu_lateral:imuLateral.toFixed(4),yaw_rate_dps:verticalYawRate.toFixed(3),
  accel_signal:smoothed.accel.toFixed(4),brake_signal:smoothed.brake.toFixed(4),turn_signal:smoothed.turn.toFixed(4),
  energy:energy.toFixed(4),motion_hz:motionFrequency.toFixed(1),calibrated:sensorCalibration.calibrated?1:0
 });
 if(sensorLog.length>24000)sensorLog.shift();
 ui.downloadLog.disabled=sensorLog.length===0;
}

function updateEngine(){
 if(!running)return;
 updateDrivingMemory();
 maybeUpdateTarget();
 applyBusMix();
 updateUi();
 maybeLogSensors();
}

async function requestMotionPermission(){
 try{
  if(typeof DeviceMotionEvent==="undefined")return false;
  if(typeof DeviceMotionEvent.requestPermission==="function"){
   const result=await DeviceMotionEvent.requestPermission();
   if(result!=="granted")return false;
  }
  return true;
 }catch{return false;}
}

function loadSavedCalibration(){
 try{
  const saved=JSON.parse(localStorage.getItem("drivepulse-calibration-3d")||"null");
  if(saved?.gravity&&saved?.forward&&saved?.lateral){
   sensorCalibration={gravity:normalize(saved.gravity),forward:normalize(saved.forward),lateral:normalize(saved.lateral),calibrated:true,source:"Calibration enregistrée"};
  }
 }catch{}
}

function saveCalibration(){
 localStorage.setItem("drivepulse-calibration-3d",JSON.stringify(sensorCalibration));
}

function calculateLinearAcceleration(event){
 const acceleration=event.acceleration;
 if(acceleration&&[acceleration.x,acceleration.y,acceleration.z].some(value=>value!==null&&Number.isFinite(Number(value)))){
  return vec(finite(acceleration.x),finite(acceleration.y),finite(acceleration.z));
 }
 const including=event.accelerationIncludingGravity;
 if(!including)return vec();
 return add(vec(finite(including.x),finite(including.y),finite(including.z)),scale(sensorCalibration.gravity,-9.80665));
}

function handleMotion(event){
 if(!running||demoTimer||journeyTimer)return;
 motionEventCount++;
 const now=performance.now();
 if(now-motionFrequencyWindow>=1000){
  motionFrequency=motionEventCount*1000/(now-motionFrequencyWindow);
  motionEventCount=0;motionFrequencyWindow=now;
 }

 const including=event.accelerationIncludingGravity;
 const includingVector=including?vec(finite(including.x),finite(including.y),finite(including.z)):vec();
 linearMotion=calculateLinearAcceleration(event);
 rawMotion=linearMotion;

 if(calibration.phase==="stationary"&&including)calibration.stationary.push(includingVector);
 if(calibration.phase==="drive"){
  const magnitude=length(linearMotion);
  if(magnitude>.045){
   calibration.drive.push(linearMotion);
   calibration.driveWeights.push(Math.max(.15,clamp(gpsAcceleration/1.5),clamp(magnitude/2)));
  }
 }

 imuLongitudinal=dot(linearMotion,sensorCalibration.forward);
 imuLateral=dot(linearMotion,sensorCalibration.lateral);
 const rotation=event.rotationRate||{};
 const angular=vec(finite(rotation.beta),finite(rotation.gamma),finite(rotation.alpha));
 verticalYawRate=Math.abs(dot(angular,sensorCalibration.gravity));

 if(gpsAcceleration>.25&&Math.abs(imuLongitudinal)>.05&&sensorCalibration.calibrated){
  automaticSignScore=lowPass(automaticSignScore,Math.sign(gpsAcceleration*imuLongitudinal),.035);
  if(automaticSignScore<-.68){
   sensorCalibration.forward=scale(sensorCalibration.forward,-1);
   sensorCalibration.lateral=scale(sensorCalibration.lateral,-1);
   automaticSignScore=0;
   saveCalibration();
   setStatus("Sens de l’axe avant corrigé automatiquement.");
  }
 }

 const accelSensitivity=Number(ui.accelSensitivity.value);
 const turnSensitivity=Number(ui.turnSensitivity.value);
 const imuPositive=Math.max(0,imuLongitudinal)/2.25;
 const imuNegative=Math.max(0,-imuLongitudinal)/2.25;
 const gpsPositive=Math.max(0,gpsAcceleration)/2.0;
 const gpsNegative=Math.max(0,-gpsAcceleration)/2.2;
 const accelerationTarget=clamp(Math.max(imuPositive*.74+gpsPositive*.26,gpsPositive*.78)*accelSensitivity);
 const brakeTarget=clamp(Math.max(imuNegative*.72+gpsNegative*.28,gpsNegative*.82)*accelSensitivity);
 const turnTarget=clamp(Math.max(Math.abs(imuLateral)/2.5*.72,verticalYawRate/45*.68,gpsHeadingRate/34*.82)*turnSensitivity);
 smoothed.accel=lowPass(smoothed.accel,accelerationTarget,.24);
 smoothed.brake=lowPass(smoothed.brake,brakeTarget,.24);
 smoothed.turn=lowPass(smoothed.turn,turnTarget,.23);
}

function beginCalibration(){
 if(calibration.phase!=="idle")return;
 calibration={phase:"stationary",stationary:[],drive:[],driveWeights:[],timer:null};
 ui.calibrate.disabled=true;
 setStatus("Calibration 1/2 : véhicule arrêté, ne touche pas le téléphone pendant 2,5 s.");
 updateCalibrationBadge();
 calibration.timer=setTimeout(()=>{
  if(calibration.phase!=="stationary")return;
  const gravityMean=meanVector(calibration.stationary);
  if(length(gravityMean)<2){
   cancelCalibration("Gravité non détectée. Recommence la calibration.");
   return;
  }
  sensorCalibration.gravity=normalize(gravityMean);
  calibration.phase="drive";
  setStatus("Calibration 2/2 : accélère doucement en ligne droite pendant 6 s.");
  updateCalibrationBadge();
  calibration.timer=setTimeout(finishCalibration,6500);
 },2500);
}

function finishCalibration(){
 if(calibration.phase!=="drive")return;
 let weighted=vec(),totalWeight=0;
 calibration.drive.forEach((sample,index)=>{
  const weight=calibration.driveWeights[index]||.2;
  weighted=add(weighted,scale(sample,weight));totalWeight+=weight;
 });
 let forwardVector=totalWeight?scale(weighted,1/totalWeight):vec();
 forwardVector=projectToPlane(forwardVector,sensorCalibration.gravity);
 if(length(forwardVector)<.055){
  const strongest=[...calibration.drive].sort((a,b)=>length(b)-length(a))[0];
  if(strongest)forwardVector=projectToPlane(strongest,sensorCalibration.gravity);
 }
 if(length(forwardVector)<.04){
  cancelCalibration("Accélération insuffisante. Recommence sur une ligne droite.");
  return;
 }
 sensorCalibration.forward=normalize(forwardVector,sensorCalibration.forward);
 sensorCalibration.lateral=normalize(cross(sensorCalibration.gravity,sensorCalibration.forward),sensorCalibration.lateral);
 sensorCalibration.calibrated=true;
 sensorCalibration.source="Calibration Motion + GPS";
 saveCalibration();
 calibration.phase="idle";
 calibration.timer=null;
 ui.calibrate.disabled=false;
 automaticSignScore=0;
 updateCalibrationBadge();
 setStatus("Calibration 3D terminée : axes avant, latéral et vertical enregistrés.");
}

function cancelCalibration(message){
 if(calibration.timer)clearTimeout(calibration.timer);
 calibration={phase:"idle",stationary:[],drive:[],driveWeights:[],timer:null};
 ui.calibrate.disabled=false;
 updateCalibrationBadge();
 setStatus(message);
}

function startGps(){
 if(!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(position=>{
  if(demoTimer||journeyTimer)return;
  const {coords,timestamp}=position;
  const speed=coords.speed!=null&&Number.isFinite(coords.speed)?Math.max(0,coords.speed):gpsSpeedMs;
  if(lastGps.timestamp&&lastGps.speed!=null){
   const dt=Math.max(.2,Math.min(5,(timestamp-lastGps.timestamp)/1000));
   const rawAcceleration=clamp((speed-lastGps.speed)/dt,-4,4);
   gpsAcceleration=lowPass(gpsAcceleration,rawAcceleration,.34);
  }
  gpsSpeedMs=speed;
  speedKmh=lowPass(speedKmh,speed*3.6,.42);

  const heading=coords.heading;
  if(lastGps.timestamp&&lastGps.heading!=null&&heading!=null&&Number.isFinite(heading)&&speed>2){
   const dt=Math.max(.2,Math.min(5,(timestamp-lastGps.timestamp)/1000));
   const rate=Math.abs(wrapDegrees(heading-lastGps.heading))/dt;
   gpsHeadingRate=lowPass(gpsHeadingRate,clamp(rate,0,120),.30);
  }else gpsHeadingRate=lowPass(gpsHeadingRate,0,.08);
  lastGps={timestamp,speed,heading:heading!=null&&Number.isFinite(heading)?heading:lastGps.heading};
 },()=>setStatus("GPS indisponible : les capteurs Motion restent actifs."),{enableHighAccuracy:true,maximumAge:250,timeout:10000});
}

function startDemo(){
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;ui.demo.textContent="Simulation libre";setStatus("Simulation arrêtée.");return;}
 if(journeyTimer){clearInterval(journeyTimer);journeyTimer=null;}
 let phase=0;ui.demo.textContent="Arrêter la simulation";setStatus("Simulation low latency active.");
 demoTimer=setInterval(()=>{
  phase+=.075;speedKmh=Math.max(0,50+48*Math.sin(phase*.22));
  smoothed.accel=clamp((Math.sin(phase)+.15)*.72);smoothed.brake=clamp((-Math.sin(phase*.51)-.34)*.86);smoothed.turn=clamp(Math.abs(Math.sin(phase*.37))*.92);
 },100);
}

function startJourney(){
 if(journeyTimer){clearInterval(journeyTimer);journeyTimer=null;ui.journey.textContent="Scénario trajet complet";setStatus("Scénario arrêté.");return;}
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;ui.demo.textContent="Simulation libre";}
 let elapsed=0;ui.journey.textContent="Arrêter le scénario";setStatus("Scénario : ville → campagne → autoroute → freinage.");
 journeyTimer=setInterval(()=>{
  elapsed+=.1;let targetSpeed=0,acceleration=0,brake=0,turn=0;
  if(elapsed<8){targetSpeed=0;roadMode="city";}
  else if(elapsed<26){targetSpeed=(elapsed-8)/18*50;acceleration=.48;roadMode="city";}
  else if(elapsed<45){targetSpeed=50;turn=.10;}
  else if(elapsed<62){targetSpeed=50+(elapsed-45)/17*30;acceleration=.38;roadMode="country";}
  else if(elapsed<82){targetSpeed=80;turn=.32;}
  else if(elapsed<102){targetSpeed=80+(elapsed-82)/20*50;acceleration=.43;roadMode="highway";}
  else if(elapsed<126){targetSpeed=130;}
  else if(elapsed<138){targetSpeed=130-(elapsed-126)/12*125;brake=.76;}
  else{targetSpeed=0;clearInterval(journeyTimer);journeyTimer=null;ui.journey.textContent="Scénario trajet complet";setStatus("Scénario terminé.");}
  applyRoadMode(roadMode);speedKmh=Math.max(0,targetSpeed);
  smoothed.accel=lowPass(smoothed.accel,acceleration,.25);smoothed.brake=lowPass(smoothed.brake,brake,.25);smoothed.turn=lowPass(smoothed.turn,turn,.25);
 },100);
}

function toggleFixedMix(){
 fixedMixMode=!fixedMixMode;
 ui.quality.textContent=fixedMixMode?"Revenir à l’adaptatif":"Mix fixe A/B";
 ui.audioMode.textContent=fixedMixMode?"Mix fixe":"Adaptatif low latency";
 if(fixedMixMode){requestTargetScene("chorus");setStatus("Mix fixe : niveaux stables pour contrôler la qualité audio.");}
 else{candidateSince=0;setStatus("Mix adaptatif low latency réactivé.");}
 applyBusMix(true);
}

function toggleLogging(){
 sensorLogging=!sensorLogging;
 ui.record.textContent=sensorLogging?"Arrêter l’enregistrement":"Enregistrer capteurs";
 if(sensorLogging){lastLogAt=0;setStatus("Journal capteurs actif (5 mesures/s). ");}
 else setStatus(`${sensorLog.length} mesures capteurs enregistrées.`);
}

function downloadSensorLog(){
 if(!sensorLog.length)return;
 const headers=Object.keys(sensorLog[0]);
 const lines=[headers.join(";"),...sensorLog.map(row=>headers.map(key=>String(row[key]).replaceAll(";",",")).join(";"))];
 const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 link.href=url;link.download=`drivepulse-v8-2-sensors-${new Date().toISOString().replaceAll(":","-")}.csv`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function start(){
 if(running)return;
 try{
  generation++;setStatus("Chargement des six bus audio AAC 256 kb/s…");
  createAudioGraph();
  const resumePromise=audioCtx.resume();
  const permissionPromise=requestMotionPermission();
  await loadManifest();
  await resumePromise;
  await Promise.all([loadScene("intro"),loadScene("groove")]);
  const motionGranted=await permissionPromise;
  loadSavedCalibration();

  running=true;currentScene="intro";targetScene="intro";candidateScene="intro";candidateSince=performance.now();
  const startAt=audioCtx.currentTime+.28;
  activeGroup=startSceneGroup("intro",startAt,0,.025);
  currentPhaseStart=startAt;nextLoopTime=startAt+LOOP_DURATION;
  schedulerTimer=setInterval(scheduler,40);updateTimer=setInterval(updateEngine,ENGINE_INTERVAL);
  if(motionGranted)window.addEventListener("devicemotion",handleMotion,{passive:true});
  startGps();
  prefetchAllAudio();

  ui.start.disabled=true;ui.calibrate.disabled=!motionGranted;ui.stop.disabled=false;ui.demo.disabled=false;ui.journey.disabled=false;
  ui.quality.disabled=false;ui.record.disabled=false;ui.downloadLog.disabled=sensorLog.length===0;
  setStatus(motionGranted?(sensorCalibration.calibrated?"V8.2 active : calibration 3D enregistrée.":"V8.2 active : effectue la calibration 3D."):"Audio actif. Capteurs Motion indisponibles.");
  applyBusMix(true);updateEngine();
 }catch(error){console.error(error);setStatus(error.message||"Impossible de démarrer DrivePulse V8.2.");stop(false);}
}

function stop(updateStatus=true){
 generation++;running=false;
 if(calibration.timer)clearTimeout(calibration.timer);
 calibration.phase="idle";
 [schedulerTimer,updateTimer,demoTimer,journeyTimer].forEach(timer=>{if(timer)clearInterval(timer);});
 schedulerTimer=updateTimer=demoTimer=journeyTimer=null;
 if(watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);watchId=null;
 window.removeEventListener("devicemotion",handleMotion);
 activeGroups.forEach(group=>cancelFutureGroup(group));activeGroups.clear();
 if(audioCtx)audioCtx.close().catch(()=>{});
 audioCtx=masterGain=masterFilter=masterCompressor=null;
 busNodes.clear();sceneCache.clear();sceneLoads.clear();sceneAccess.clear();activeGroup=pendingTransition=nextLoopGroup=null;
 BUSES.forEach(bus=>setAgentVisualState(bus.id,"inactive"));
 if(sensorLogging){sensorLogging=false;ui.record.textContent="Enregistrer capteurs";}
 ui.start.disabled=false;ui.calibrate.disabled=true;ui.stop.disabled=true;ui.demo.disabled=true;ui.journey.disabled=true;ui.quality.disabled=true;ui.record.disabled=true;
 ui.demo.textContent="Simulation libre";ui.journey.textContent="Scénario trajet complet";ui.quality.textContent="Mix fixe A/B";fixedMixMode=false;
 updateCalibrationBadge();if(updateStatus)setStatus("Arrêté.");
}

function applyRoadMode(mode){
 if(!ROAD_PROFILES[mode])return;roadMode=mode;localStorage.setItem("drivepulse-road-mode",mode);
 document.querySelectorAll(".road-mode").forEach(button=>button.classList.toggle("active",button.dataset.roadMode===mode));
 ui.road.textContent=ROAD_PROFILES[mode].label;ui.roadHelp.textContent=ROAD_PROFILES[mode].help;
}

const HELP_CONTENT={
 responsiveness:{title:"Réactivité musicale",text:"Les volumes réagissent désormais immédiatement, au prochain temps ou à la prochaine mesure. Ce réglage agit surtout sur la durée de validation avant un changement de scène.",recommendation:"Conseil : 1,0. Monte vers 1,3 si les scènes changent encore trop lentement."},
 accelSensitivity:{title:"Sensibilité accélération",text:"Amplifie la fusion entre l’accélération 3D du téléphone et la variation de vitesse GPS.",recommendation:"Conseil : commence à 1,0 après la calibration 3D."},
 turnSensitivity:{title:"Sensibilité virage",text:"Combine l’accélération latérale, la rotation autour de la verticale et le changement de cap GPS.",recommendation:"Conseil : 1,0 ; baisse si les bosses déclenchent trop de percussions."}
};
function openHelp(key){const item=HELP_CONTENT[key];if(!item)return;ui.helpTitle.textContent=item.title;ui.helpText.textContent=item.text;ui.helpRecommendation.textContent=item.recommendation;ui.helpModal.hidden=false;}
function closeHelp(){ui.helpModal.hidden=true;}
function updateSettingValues(){ui.responsivenessValue.value=Number(ui.responsiveness.value).toFixed(1);ui.accelSensitivityValue.value=Number(ui.accelSensitivity.value).toFixed(2);ui.turnSensitivityValue.value=Number(ui.turnSensitivity.value).toFixed(2);}

renderAgents();loadSavedCalibration();applyRoadMode(roadMode);updateSectionTimeline();updateSettingValues();updateCalibrationBadge();setStatus("Prêt — V8.2 avec piano adaptatif jusqu’à 30 km/h.");
ui.start.addEventListener("click",start);ui.stop.addEventListener("click",()=>stop(true));ui.calibrate.addEventListener("click",beginCalibration);
ui.demo.addEventListener("click",startDemo);ui.journey.addEventListener("click",startJourney);ui.quality.addEventListener("click",toggleFixedMix);
ui.record.addEventListener("click",toggleLogging);ui.downloadLog.addEventListener("click",downloadSensorLog);
ui.idlePiano.addEventListener("change",()=>{localStorage.setItem("drivepulse-idle-music",ui.idlePiano.checked?"1":"0");applyBusMix(true);});
document.querySelectorAll(".road-mode").forEach(button=>button.addEventListener("click",()=>applyRoadMode(button.dataset.roadMode)));
document.querySelectorAll(".help-btn").forEach(button=>button.addEventListener("click",()=>openHelp(button.dataset.help)));
ui.closeHelp.addEventListener("click",closeHelp);ui.helpModal.addEventListener("click",event=>{if(event.target===ui.helpModal)closeHelp();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHelp();});
[ui.responsiveness,ui.accelSensitivity,ui.turnSensitivity].forEach(input=>input.addEventListener("input",updateSettingValues));
const savedIdle=localStorage.getItem("drivepulse-idle-music");if(savedIdle!==null)ui.idlePiano.checked=savedIdle==="1";
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js?v=8.2"));
