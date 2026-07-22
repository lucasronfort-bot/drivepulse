"use strict";

const $=id=>document.getElementById(id);
const ui={
 status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),journey:$("journeyBtn"),
 speed:$("speed"),speedMusic:$("speedMusicState"),speedMusicTrack:$("speedMusicTrack"),energy:$("energyLabel"),energyTrack:$("energyTrack"),
 section:$("sectionState"),mode:$("modeLabel"),bar:$("barLabel"),road:$("roadState"),roadHelp:$("roadModeHelp"),
 accel:$("accelMeter"),brake:$("brakeMeter"),turn:$("turnMeter"),music:$("musicMeter"),
 accelValue:$("accelValue"),brakeValue:$("brakeValue"),turnValue:$("turnValue"),musicValue:$("musicValue"),
 shortMemory:$("shortMemoryState"),longMemory:$("longMemoryState"),shortMemoryMeter:$("shortMemoryMeter"),longMemoryMeter:$("longMemoryMeter"),
 chord:$("chordState"),bass:$("bassState"),drum:$("drumState"),arp:$("arpState"),filter:$("filterState"),variation:$("variationState"),idle:$("idleState"),
 idlePiano:$("idlePianoToggle"),agentGrid:$("agentGrid"),
 responsiveness:$("responsiveness"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity"),
 responsivenessValue:$("responsivenessValue"),accelSensitivityValue:$("accelSensitivityValue"),turnSensitivityValue:$("turnSensitivityValue"),
 helpModal:$("helpModal"),helpTitle:$("helpTitle"),helpText:$("helpText"),helpRecommendation:$("helpRecommendation"),closeHelp:$("closeHelpBtn")
};

const MANIFEST_URL="audio/kalte-ohren/manifest.json";
const BPM=120;
const BAR_DURATION=2;
const LOOP_DURATION=16;
const SCHEDULE_AHEAD=1.25;

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const lowPass=(oldValue,newValue,amount=.12)=>oldValue+amount*(newValue-oldValue);
const smoothstep=(edge0,edge1,value)=>{
 const x=clamp((value-edge0)/(edge1-edge0));
 return x*x*(3-2*x);
};

const ROAD_PROFILES={
 city:{label:"Ville",maxSpeed:50,help:"Référence 50 km/h"},
 country:{label:"Campagne",maxSpeed:80,help:"Référence 80 km/h"},
 highway:{label:"Autoroute",maxSpeed:130,help:"Référence 130 km/h"}
};

const SEGMENT_LABELS={
 intro:"Intro",
 groove:"Groove",
 drive:"Montée",
 breakdown:"Respiration",
 chorus:"Refrain",
 finale:"Finale"
};

const AGENTS=[
 {id:"pulse",emoji:"🥁",name:"PULSE",role:"Kick",description:"Battement principal",color:"#ff5d67"},
 {id:"clap",emoji:"👏",name:"CLAP",role:"Claps & snare",description:"Accents rythmiques",color:"#a66cff"},
 {id:"spark",emoji:"✨",name:"SPARK",role:"Hi-hat & shaker",description:"Vitesse et mouvement",color:"#ffc13d"},
 {id:"sub",emoji:"🔊",name:"SUB",role:"Basse profonde",description:"Fondations graves",color:"#25c5ff"},
 {id:"bounce",emoji:"🎸",name:"BOUNCE",role:"Basses mélodiques",description:"Groove principal",color:"#44dc72"},
 {id:"keys",emoji:"🎹",name:"KEYS",role:"Rhodes",description:"Accords et respiration",color:"#f06ec7"},
 {id:"cloud",emoji:"☁️",name:"CLOUD",role:"Pads & textures",description:"Atmosphère harmonique",color:"#36d8ea"},
 {id:"hook",emoji:"🎶",name:"HOOK",role:"Pluck & synth lead",description:"Thème mélodique",color:"#dc65d9"},
 {id:"motion",emoji:"🪘",name:"MOTION",role:"Bongos & percussions",description:"Courbes et mouvement",color:"#ffad31"},
 {id:"guitar",emoji:"🎸",name:"GUITAR",role:"Guitare",description:"Couche organique",color:"#39d98a"},
 {id:"rise",emoji:"🌊",name:"RISE",role:"Risers & impacts",description:"Transitions",color:"#a853f2"},
 {id:"aura",emoji:"◌",name:"AURA",role:"Delay & réverbération",description:"Profondeur du mix",color:"#5e9cff"}
];

let manifest=null;
let running=false;
let audioCtx=null;
let masterGain=null;
let masterFilter=null;
let compressor=null;
let schedulerTimer=null;
let updateTimer=null;
let watchId=null;
let demoTimer=null;
let journeyTimer=null;
let generation=0;

let roadMode=localStorage.getItem("drivepulse-road-mode")||"city";
let speedKmh=0;
let smoothed={accel:0,brake:0,turn:0};
let forward={x:0,y:1};
let calibrationActive=false;
let calibrationSamples=[];
let shortMemory=0;
let longMemory=0;
let stableSpeedMemory=0;
let previousSpeed=0;
let lastMemoryUpdate=performance.now();
let energy=0;
let speedIntensity=0;
let currentSegment="intro";
let targetSegment="intro";
let scheduledSegment="intro";
let currentLoopStart=0;
let nextLoopTime=0;
let loopCounter=0;
let lastTargetChange=0;

const segmentCache=new Map();
const segmentLoads=new Map();
const activeSources=new Set();
const agentNodes=new Map();
const lastAgentLevels=new Map();
const visualTimeouts=new Map();

function setStatus(text){
 ui.status.innerHTML=`<i></i> ${text}`;
}

function renderAgents(){
 ui.agentGrid.innerHTML=AGENTS.map((agent,index)=>`
  <article class="agent-card" data-agent="${agent.id}" style="--agent-color:${agent.color}">
   <div class="agent-head">
    <div class="agent-avatar">${agent.emoji}</div>
    <div class="agent-copy">
     <span class="agent-name">${agent.name}</span>
     <span class="agent-role">${agent.role}</span>
    </div>
   </div>
   <p class="agent-description">${agent.description}</p>
   <div class="agent-status"><i></i><span>Inactif</span></div>
   <div class="agent-meter" aria-hidden="true">
    ${Array.from({length:14},(_,i)=>`<i style="animation-delay:-${((i*.09)+(index*.03)).toFixed(2)}s"></i>`).join("")}
   </div>
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
 const previous=lastAgentLevels.get(id)||0;
 const wasActive=previous>.06;
 const isActive=level>.06;
 lastAgentLevels.set(id,level);

 if(wasActive!==isActive){
  setAgentVisualState(id,"transition");
  if(visualTimeouts.has(id))clearTimeout(visualTimeouts.get(id));
  visualTimeouts.set(id,setTimeout(()=>setAgentVisualState(id,isActive?"active":"inactive"),380));
 }else{
  setAgentVisualState(id,isActive?"active":"inactive");
 }
}

async function loadManifest(){
 if(manifest)return manifest;
 const response=await fetch(MANIFEST_URL,{cache:"no-cache"});
 if(!response.ok)throw new Error("Manifest audio introuvable.");
 manifest=await response.json();
 return manifest;
}

function createAudioGraph(){
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)throw new Error("Web Audio API indisponible.");
 audioCtx=new AudioContextClass();
 masterGain=audioCtx.createGain();
 masterFilter=audioCtx.createBiquadFilter();
 compressor=audioCtx.createDynamicsCompressor();

 masterGain.gain.value=.76;
 masterFilter.type="lowpass";
 masterFilter.frequency.value=18000;
 masterFilter.Q.value=.65;
 compressor.threshold.value=-8;
 compressor.knee.value=14;
 compressor.ratio.value=3;
 compressor.attack.value=.004;
 compressor.release.value=.22;

 masterGain.connect(masterFilter).connect(compressor).connect(audioCtx.destination);

 AGENTS.forEach(agent=>{
  const gain=audioCtx.createGain();
  gain.gain.value=0;
  gain.connect(masterGain);
  agentNodes.set(agent.id,gain);
  lastAgentLevels.set(agent.id,0);
 });
}

async function decodeAudio(url){
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Audio introuvable : ${url}`);
 const arrayBuffer=await response.arrayBuffer();
 return audioCtx.decodeAudioData(arrayBuffer);
}

async function loadSegment(name){
 if(segmentCache.has(name))return segmentCache.get(name);
 if(segmentLoads.has(name))return segmentLoads.get(name);

 const loadPromise=(async()=>{
  const segment=manifest.segments[name];
  if(!segment)throw new Error(`Séquence inconnue : ${name}`);
  const entries=await Promise.all(AGENTS.map(async agent=>{
   const url=segment.files[agent.id];
   return [agent.id,await decodeAudio(url)];
  }));
  const buffers=new Map(entries);
  segmentCache.set(name,buffers);
  segmentLoads.delete(name);
  return buffers;
 })().catch(error=>{
  segmentLoads.delete(name);
  throw error;
 });

 segmentLoads.set(name,loadPromise);
 return loadPromise;
}

function pruneSegmentCache(){
 for(const name of [...segmentCache.keys()]){
  if(name!==currentSegment&&name!==targetSegment&&name!==scheduledSegment){
   segmentCache.delete(name);
  }
 }
}

function segmentAvailability(segment,agent){
 const db=manifest?.levels?.[segment]?.[agent]?.rms_db??-240;
 if(db<=-90)return 0;
 return clamp((db+75)/35);
}

function desiredAgentLevels(){
 const e=energy;
 const stopped=speedKmh<4;
 const turning=smoothed.turn;
 const transitioning=targetSegment!==currentSegment;

 return {
  pulse:smoothstep(.12,.34,e),
  clap:smoothstep(.20,.43,e),
  spark:smoothstep(.28,.58,e),
  sub:smoothstep(.10,.30,e),
  bounce:smoothstep(.22,.48,e),
  keys:stopped&&ui.idlePiano.checked?1:.54*(1-e)+.12,
  cloud:.78-.28*e,
  hook:smoothstep(.38,.67,e),
  motion:clamp(Math.max(smoothstep(.42,.70,e)*.68,turning*1.5,roadMode==="country"?.36:0)),
  guitar:smoothstep(.32,.58,e),
  rise:transitioning?1:clamp(smoothed.accel*1.25+smoothed.brake*.75),
  aura:.48+.28*(1-e)
 };
}

function applyAgentMix(){
 if(!audioCtx)return;
 const desired=desiredAgentLevels();
 const now=audioCtx.currentTime;

 AGENTS.forEach(agent=>{
  const availability=segmentAvailability(currentSegment,agent.id);
  let level=clamp(desired[agent.id]*availability);
  if(!ui.idlePiano.checked&&speedKmh<4&&["keys","cloud","aura"].includes(agent.id))level=0;
  const node=agentNodes.get(agent.id);
  node.gain.cancelScheduledValues(now);
  node.gain.setTargetAtTime(level,now,.22);
  updateAgentVisual(agent.id,level);
 });

 const brake=smoothed.brake;
 const cutoff=brake>.08?1200+(1-brake)*7200:9000+energy*9000;
 masterFilter.frequency.setTargetAtTime(cutoff,now,.12);
 masterGain.gain.setTargetAtTime(brake>.45?.58:.78,now,.14);
}

function scheduleSegment(name,when){
 const buffers=segmentCache.get(name);
 if(!buffers)return false;
 const token=generation;
 const changed=name!==scheduledSegment;

 AGENTS.forEach(agent=>{
  const buffer=buffers.get(agent.id);
  if(!buffer)return;
  const source=audioCtx.createBufferSource();
  source.buffer=buffer;
  source.connect(agentNodes.get(agent.id));
  source.start(when,0,LOOP_DURATION);
  source.stop(when+LOOP_DURATION+.04);
  activeSources.add(source);
  source.onended=()=>activeSources.delete(source);
 });

 if(changed){
  const transitionStart=Math.max(audioCtx.currentTime,when-.35);
  masterFilter.frequency.cancelScheduledValues(transitionStart);
  masterFilter.frequency.setValueAtTime(masterFilter.frequency.value,transitionStart);
  masterFilter.frequency.exponentialRampToValueAtTime(1800,when);
  masterFilter.frequency.exponentialRampToValueAtTime(15000,when+.65);
 }

 scheduledSegment=name;
 const delay=Math.max(0,(when-audioCtx.currentTime)*1000);
 setTimeout(()=>{
  if(!running||token!==generation)return;
  currentSegment=name;
  currentLoopStart=when;
  loopCounter++;
  updateSectionTimeline();
  applyAgentMix();
  pruneSegmentCache();
 },delay);
 return true;
}

function scheduler(){
 if(!running||!audioCtx)return;
 while(nextLoopTime<audioCtx.currentTime+SCHEDULE_AHEAD){
  let chosen=segmentCache.has(targetSegment)?targetSegment:currentSegment;
  if(!segmentCache.has(chosen))chosen="intro";
  if(!scheduleSegment(chosen,nextLoopTime))break;
  nextLoopTime+=LOOP_DURATION;
 }
}

function requestTargetSegment(name){
 if(!manifest?.segments?.[name])return;
 targetSegment=name;
 loadSegment(name).catch(error=>setStatus(error.message||"Chargement audio impossible."));
}

function updateDrivingMemory(){
 const now=performance.now();
 const dt=Math.min(1,(now-lastMemoryUpdate)/1000);
 lastMemoryUpdate=now;
 const profile=ROAD_PROFILES[roadMode];
 speedIntensity=clamp(speedKmh/profile.maxSpeed);
 const immediate=clamp(speedIntensity*.62+smoothed.accel*.22+smoothed.turn*.12-smoothed.brake*.20);
 shortMemory=lowPass(shortMemory,immediate,Math.min(.42,dt*.38));
 longMemory=lowPass(longMemory,shortMemory,Math.min(.09,dt*.045));
 const speedDelta=Math.abs(speedKmh-previousSpeed);
 const stable=speedKmh>8&&speedDelta<2.4&&smoothed.accel<.18&&smoothed.brake<.18?1:0;
 stableSpeedMemory=lowPass(stableSpeedMemory,stable,Math.min(.22,dt*.11));
 previousSpeed=speedKmh;
 energy=clamp(speedIntensity*.58+shortMemory*.18+longMemory*.12+smoothed.accel*.15+smoothed.turn*.08-smoothed.brake*.14);
}

function evaluateTargetSegment(){
 if(smoothed.brake>.48)return "breakdown";
 if(speedKmh<4)return ui.idlePiano.checked?"intro":"groove";
 if(speedIntensity>.78&&longMemory>.55)return loopCounter%2===0?"chorus":"finale";
 if(smoothed.accel>.34||shortMemory>.57)return "drive";
 if(speedIntensity>.34||stableSpeedMemory>.42)return "groove";
 return "intro";
}

function maybeUpdateTarget(){
 const candidate=evaluateTargetSegment();
 const now=performance.now();
 const holdTime=3200/Math.max(.5,Number(ui.responsiveness.value));
 if(candidate!==targetSegment&&now-lastTargetChange>holdTime){
  lastTargetChange=now;
  requestTargetSegment(candidate);
 }
}

function updateSectionTimeline(){
 document.querySelectorAll("[data-section]").forEach(node=>{
  node.classList.toggle("current",node.dataset.section===currentSegment);
 });
}

function modeLabel(){
 if(smoothed.brake>.42)return "Brake";
 if(energy>.72)return "Boost";
 if(smoothed.turn>.42)return "Curve";
 if(energy>.36)return "Drive";
 return "Cruise";
}

function updateUi(){
 const profile=ROAD_PROFILES[roadMode];
 const barPosition=audioCtx&&running?Math.floor((((audioCtx.currentTime-currentLoopStart)%LOOP_DURATION)+LOOP_DURATION)%LOOP_DURATION/BAR_DURATION)+1:1;
 const levels=desiredAgentLevels();
 const drums=[levels.pulse,levels.clap,levels.spark].filter(v=>v>.35).length;
 const bassLevel=Math.max(levels.sub,levels.bounce);

 ui.speed.textContent=Math.round(speedKmh);
 ui.speedMusic.textContent=`${Math.round(speedIntensity*100)}%`;
 ui.speedMusicTrack.style.width=`${Math.round(speedIntensity*100)}%`;
 ui.energy.textContent=`${Math.round(energy*100)}%`;
 ui.energyTrack.style.width=`${Math.round(energy*100)}%`;
 ui.section.textContent=SEGMENT_LABELS[currentSegment];
 ui.mode.textContent=modeLabel();
 ui.bar.textContent=`${barPosition} / 8`;
 ui.road.textContent=profile.label;
 ui.roadHelp.textContent=profile.help;

 ui.accel.value=smoothed.accel;
 ui.brake.value=smoothed.brake;
 ui.turn.value=smoothed.turn;
 ui.music.value=energy;
 ui.accelValue.value=smoothed.accel.toFixed(2);
 ui.brakeValue.value=smoothed.brake.toFixed(2);
 ui.turnValue.value=smoothed.turn.toFixed(2);
 ui.musicValue.value=energy.toFixed(2);

 ui.shortMemory.textContent=`${Math.round(shortMemory*100)}%`;
 ui.longMemory.textContent=`${Math.round(longMemory*100)}%`;
 ui.shortMemoryMeter.value=shortMemory;
 ui.longMemoryMeter.value=longMemory;

 ui.chord.textContent="Kalte Ohren";
 ui.bass.textContent=bassLevel>.68?"Pleine":bassLevel>.28?"Active":"Légère";
 ui.drum.textContent=drums>=3?"Complète":drums>=1?"Progressive":"Réduite";
 ui.arp.textContent=levels.hook>.55?"Présent":levels.hook>.12?"Discret":"Retiré";
 ui.filter.textContent=smoothed.brake>.20?"Fermé":"Ouvert";
 ui.variation.textContent=SEGMENT_LABELS[targetSegment];
 ui.idle.textContent=ui.idlePiano.checked?"Stems doux":"Silence à l’arrêt";
}

function updateEngine(){
 if(!running)return;
 updateDrivingMemory();
 maybeUpdateTarget();
 applyAgentMix();
 updateUi();
}

async function requestMotionPermission(){
 try{
  if(typeof DeviceMotionEvent==="undefined")return false;
  if(typeof DeviceMotionEvent.requestPermission==="function"){
   const result=await DeviceMotionEvent.requestPermission();
   if(result!=="granted")return false;
  }
  return true;
 }catch{
  return false;
 }
}

function handleMotion(event){
 if(!running||demoTimer||journeyTimer)return;
 const acceleration=event.acceleration||event.accelerationIncludingGravity;
 if(!acceleration)return;
 const x=Number(acceleration.x||0);
 const y=Number(acceleration.y||0);
 const rotation=event.rotationRate||{};
 const yaw=Math.abs(Number(rotation.alpha||0));

 if(calibrationActive){
  const magnitude=Math.hypot(x,y);
  if(magnitude>.25)calibrationSamples.push({x,y});
  if(calibrationSamples.length>=35)finishCalibration();
 }

 const longitudinal=x*forward.x+y*forward.y;
 const lateral=Math.abs(x*-forward.y+y*forward.x);
 const accelerationSensitivity=Number(ui.accelSensitivity.value);
 const turnSensitivity=Number(ui.turnSensitivity.value);
 smoothed.accel=lowPass(smoothed.accel,clamp(((longitudinal-.08)/1.8)*accelerationSensitivity));
 smoothed.brake=lowPass(smoothed.brake,clamp(((-longitudinal-.08)/1.8)*accelerationSensitivity));
 smoothed.turn=lowPass(smoothed.turn,clamp(Math.max(lateral/2.2,yaw/75)*turnSensitivity));
}

function beginCalibration(){
 calibrationSamples=[];
 calibrationActive=true;
 ui.calibrate.disabled=true;
 setStatus("Calibration : accélère doucement en ligne droite…");
 setTimeout(()=>{if(calibrationActive)finishCalibration();},7000);
}

function finishCalibration(){
 calibrationActive=false;
 if(calibrationSamples.length<5){
  setStatus("Calibration insuffisante. Recommence.");
  ui.calibrate.disabled=false;
  return;
 }
 const sx=calibrationSamples.reduce((sum,point)=>sum+point.x,0);
 const sy=calibrationSamples.reduce((sum,point)=>sum+point.y,0);
 const norm=Math.hypot(sx,sy)||1;
 forward={x:sx/norm,y:sy/norm};
 localStorage.setItem("drivepulse-forward",JSON.stringify(forward));
 ui.calibrate.disabled=false;
 setStatus("Calibration terminée.");
}

function startGps(){
 if(!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(({coords})=>{
  if(coords.speed!=null&&!demoTimer&&!journeyTimer)speedKmh=Math.max(0,coords.speed*3.6);
 },()=>setStatus("GPS indisponible : le moteur audio reste utilisable."),{enableHighAccuracy:true,maximumAge:500,timeout:10000});
}

function startDemo(){
 if(demoTimer){
  clearInterval(demoTimer);
  demoTimer=null;
  ui.demo.textContent="Simulation libre";
  setStatus("Simulation arrêtée.");
  return;
 }
 if(journeyTimer){clearInterval(journeyTimer);journeyTimer=null;}
 let phase=0;
 ui.demo.textContent="Arrêter la simulation";
 setStatus("Simulation musicale active.");
 demoTimer=setInterval(()=>{
  phase+=.075;
  speedKmh=Math.max(0,50+48*Math.sin(phase*.22));
  smoothed.accel=clamp((Math.sin(phase)+.15)*.72);
  smoothed.brake=clamp((-Math.sin(phase*.51)-.34)*.86);
  smoothed.turn=clamp(Math.abs(Math.sin(phase*.37))*.92);
 },100);
}

function startJourney(){
 if(journeyTimer){
  clearInterval(journeyTimer);
  journeyTimer=null;
  ui.journey.textContent="Scénario trajet complet";
  setStatus("Scénario arrêté.");
  return;
 }
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;ui.demo.textContent="Simulation libre";}
 let elapsed=0;
 ui.journey.textContent="Arrêter le scénario";
 setStatus("Scénario : ville → campagne → autoroute → freinage.");
 journeyTimer=setInterval(()=>{
  elapsed+=.1;
  let targetSpeed=0,acceleration=0,brake=0,turn=0;
  if(elapsed<8){targetSpeed=0;roadMode="city";}
  else if(elapsed<26){targetSpeed=(elapsed-8)/18*50;acceleration=.48;roadMode="city";}
  else if(elapsed<45){targetSpeed=50;turn=.10;}
  else if(elapsed<62){targetSpeed=50+(elapsed-45)/17*30;acceleration=.38;roadMode="country";}
  else if(elapsed<82){targetSpeed=80;turn=.32;}
  else if(elapsed<102){targetSpeed=80+(elapsed-82)/20*50;acceleration=.43;roadMode="highway";}
  else if(elapsed<126){targetSpeed=130;}
  else if(elapsed<138){targetSpeed=130-(elapsed-126)/12*125;brake=.76;}
  else{
   targetSpeed=0;
   clearInterval(journeyTimer);
   journeyTimer=null;
   ui.journey.textContent="Scénario trajet complet";
   setStatus("Scénario terminé.");
  }
  applyRoadMode(roadMode);
  speedKmh=Math.max(0,targetSpeed);
  smoothed.accel=lowPass(smoothed.accel,acceleration,.22);
  smoothed.brake=lowPass(smoothed.brake,brake,.22);
  smoothed.turn=lowPass(smoothed.turn,turn,.22);
 },100);
}

async function start(){
 if(running)return;
 try{
  generation++;
  setStatus("Chargement des stems CC BY…");

  // Sur iPhone, ces deux appels doivent être initiés directement par le clic.
  createAudioGraph();
  const resumePromise=audioCtx.resume();
  const motionPermissionPromise=requestMotionPermission();

  await loadManifest();
  await resumePromise;
  await loadSegment("intro");
  const motionGranted=await motionPermissionPromise;

  const saved=localStorage.getItem("drivepulse-forward");
  if(saved){
   try{forward=JSON.parse(saved);}catch{}
  }

  running=true;
  currentSegment="intro";
  targetSegment="intro";
  scheduledSegment="intro";
  nextLoopTime=audioCtx.currentTime+.30;
  currentLoopStart=nextLoopTime;
  scheduler();
  schedulerTimer=setInterval(scheduler,80);
  updateTimer=setInterval(updateEngine,140);

  if(motionGranted)window.addEventListener("devicemotion",handleMotion,{passive:true});
  startGps();

  ui.start.disabled=true;
  ui.calibrate.disabled=!motionGranted;
  ui.stop.disabled=false;
  ui.demo.disabled=false;
  ui.journey.disabled=false;
  setStatus(motionGranted?"Stems actifs. Calibre l’axe avant.":"Stems actifs. Capteurs Motion indisponibles.");
  updateEngine();
 }catch(error){
  console.error(error);
  setStatus(error.message||"Impossible de démarrer DrivePulse V8.");
  stop(false);
 }
}

function stop(updateStatus=true){
 generation++;
 running=false;
 calibrationActive=false;
 if(schedulerTimer)clearInterval(schedulerTimer);
 if(updateTimer)clearInterval(updateTimer);
 if(demoTimer)clearInterval(demoTimer);
 if(journeyTimer)clearInterval(journeyTimer);
 schedulerTimer=updateTimer=demoTimer=journeyTimer=null;

 if(watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);
 watchId=null;
 window.removeEventListener("devicemotion",handleMotion);

 activeSources.forEach(source=>{try{source.stop();}catch{}});
 activeSources.clear();
 if(audioCtx){audioCtx.close().catch(()=>{});}
 audioCtx=masterGain=masterFilter=compressor=null;
 agentNodes.clear();
 segmentCache.clear();
 segmentLoads.clear();
 AGENTS.forEach(agent=>setAgentVisualState(agent.id,"inactive"));

 ui.start.disabled=false;
 ui.calibrate.disabled=true;
 ui.stop.disabled=true;
 ui.demo.disabled=true;
 ui.journey.disabled=true;
 ui.demo.textContent="Simulation libre";
 ui.journey.textContent="Scénario trajet complet";
 if(updateStatus)setStatus("Arrêté.");
}

function applyRoadMode(mode){
 if(!ROAD_PROFILES[mode])return;
 roadMode=mode;
 localStorage.setItem("drivepulse-road-mode",mode);
 document.querySelectorAll(".road-mode").forEach(button=>button.classList.toggle("active",button.dataset.roadMode===mode));
 const profile=ROAD_PROFILES[mode];
 ui.road.textContent=profile.label;
 ui.roadHelp.textContent=profile.help;
}

const HELP_CONTENT={
 responsiveness:{
  title:"Réactivité musicale",
  text:"Détermine la rapidité avec laquelle DrivePulse demande une nouvelle séquence musicale. Les changements restent synchronisés sur une boucle de huit mesures.",
  recommendation:"Conseil : 1,0 pour commencer. Une valeur élevée rend les changements de séquence plus fréquents."
 },
 accelSensitivity:{
  title:"Sensibilité accélération",
  text:"Amplifie ou réduit les réactions de l’arrangement aux accélérations et aux freinages détectés par le téléphone.",
  recommendation:"Conseil : conserve 1,0 après la calibration, puis ajuste en voiture."
 },
 turnSensitivity:{
  title:"Sensibilité virage",
  text:"Contrôle l’influence des virages sur les percussions Motion et sur l’énergie musicale.",
  recommendation:"Conseil : 1,0 sur route normale ; 1,2 à 1,4 sur une route sinueuse."
 }
};

function openHelp(key){
 const item=HELP_CONTENT[key];
 if(!item)return;
 ui.helpTitle.textContent=item.title;
 ui.helpText.textContent=item.text;
 ui.helpRecommendation.textContent=item.recommendation;
 ui.helpModal.hidden=false;
}

function closeHelp(){ui.helpModal.hidden=true;}

function updateSettingValues(){
 ui.responsivenessValue.value=Number(ui.responsiveness.value).toFixed(1);
 ui.accelSensitivityValue.value=Number(ui.accelSensitivity.value).toFixed(2);
 ui.turnSensitivityValue.value=Number(ui.turnSensitivity.value).toFixed(2);
}

renderAgents();
applyRoadMode(roadMode);
updateSectionTimeline();
updateSettingValues();
setStatus("Prêt — stems Kalte Ohren chargés au démarrage.");

ui.start.addEventListener("click",start);
ui.stop.addEventListener("click",()=>stop(true));
ui.calibrate.addEventListener("click",beginCalibration);
ui.demo.addEventListener("click",startDemo);
ui.journey.addEventListener("click",startJourney);
ui.idlePiano.addEventListener("change",()=>{localStorage.setItem("drivepulse-idle-music",ui.idlePiano.checked?"1":"0");applyAgentMix();});
document.querySelectorAll(".road-mode").forEach(button=>button.addEventListener("click",()=>applyRoadMode(button.dataset.roadMode)));
document.querySelectorAll(".help-btn").forEach(button=>button.addEventListener("click",()=>openHelp(button.dataset.help)));
ui.closeHelp.addEventListener("click",closeHelp);
ui.helpModal.addEventListener("click",event=>{if(event.target===ui.helpModal)closeHelp();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHelp();});
[ui.responsiveness,ui.accelSensitivity,ui.turnSensitivity].forEach(input=>input.addEventListener("input",updateSettingValues));

const savedIdle=localStorage.getItem("drivepulse-idle-music");
if(savedIdle!==null)ui.idlePiano.checked=savedIdle==="1";

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
