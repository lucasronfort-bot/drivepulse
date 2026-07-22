"use strict";
const $=id=>document.getElementById(id);
const ui={status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),
style:$("styleSelect"),quantize:$("quantizeToggle"),speed:$("speed"),accel:$("accelMeter"),brake:$("brakeMeter"),
turn:$("turnMeter"),music:$("musicMeter"),accelValue:$("accelValue"),brakeValue:$("brakeValue"),
turnValue:$("turnValue"),musicValue:$("musicValue"),drumState:$("drumState"),brakeState:$("brakeState"),
turnState:$("turnState"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity")};

const BPM=120,BEAT=60/BPM;
let running=false,watchId=null,speedKmh=0,calibrationSamples=[],calibrationActive=false;
let forward={x:0,y:1},smoothed={accel:0,brake:0,turn:0},audio=null,demoTimer=null,demoPhase=0;
let currentStyle="synthwave",pendingState=null,lastDrumState="ambient",lastAccentTime=0;

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const lowPass=(o,n,a=.12)=>o+a*(n-o);
const setStatus=t=>ui.status.textContent=t;

async function requestMotionPermission(){
 if(typeof DeviceMotionEvent==="undefined")throw new Error("Capteurs Motion indisponibles.");
 if(typeof DeviceMotionEvent.requestPermission==="function"){
  const r=await DeviceMotionEvent.requestPermission();
  if(r!=="granted")throw new Error("Accès Motion refusé.");
 }
}
async function loadBuffer(ctx,url){
 const r=await fetch(url);if(!r.ok)throw new Error("Audio introuvable : "+url);
 return await ctx.decodeAudioData(await r.arrayBuffer());
}
function nextBeatTime(ctx){
 const now=ctx.currentTime;
 return Math.ceil(now/BEAT)*BEAT;
}
async function buildAudio(style){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const ctx=new Ctx(),master=ctx.createGain(),filter=ctx.createBiquadFilter();
 master.gain.value=.72;filter.type="lowpass";filter.frequency.value=18000;
 master.connect(filter).connect(ctx.destination);
 const names=["ambient","bass","drums_light","drums_full","melody","accent"],stems={};
 await Promise.all(names.map(async name=>{
  const buffer=await loadBuffer(ctx,`audio/${style}/${name}.wav`);
  const source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=buffer;source.loop=true;gain.gain.value=0;
  source.connect(gain).connect(master);stems[name]={source,gain};
 }));
 const when=ctx.currentTime+.15;
 names.forEach(n=>stems[n].source.start(when));
 return {ctx,master,filter,stems,startTime:when};
}
function setGain(name,value,time=.12,at=null){
 if(!audio)return;
 const when=at??audio.ctx.currentTime;
 audio.stems[name].gain.gain.cancelScheduledValues(when);
 audio.stems[name].gain.gain.setTargetAtTime(clamp(value),when,time);
}
function startGps(){
 if(!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(({coords})=>{
  if(coords.speed!=null)speedKmh=Math.max(0,coords.speed*3.6);
  ui.speed.textContent=Math.round(speedKmh);
 },()=>setStatus("GPS indisponible, Motion actif"),{enableHighAccuracy:true,maximumAge:500,timeout:10000});
}
function applyMusicalState(a,b,t){
 if(!audio)return;
 const speed=clamp(speedKmh/100),intensity=clamp(.12+speed*.42+a*.48+t*.18-b*.22);
 let drumState="ambient";
 if(a>.65||speed>.75)drumState="full";
 else if(a>.22||speed>.30)drumState="light";

 const when=ui.quantize.checked?nextBeatTime(audio.ctx):audio.ctx.currentTime;
 setGain("ambient",.24+speed*.46,.12,when);
 setGain("bass",clamp(speed*.3+a*.78-b*.35),.12,when);
 setGain("drums_light",drumState==="light"?.72:0,.08,when);
 setGain("drums_full",drumState==="full"?.85:0,.08,when);
 setGain("melody",clamp(t*.88+a*.2),.10,when);

 const now=audio.ctx.currentTime;
 if(t>.72&&now-lastAccentTime>1.0){
   setGain("accent",.7,.02,when);
   setTimeout(()=>setGain("accent",0,.10),350);
   lastAccentTime=now;
 }
 if(b>.25){
   audio.filter.frequency.setTargetAtTime(900+b*1200,now,.08);
   audio.master.gain.setTargetAtTime(.45,now,.08);
 }else{
   audio.filter.frequency.setTargetAtTime(18000,now,.12);
   audio.master.gain.setTargetAtTime(.72,now,.12);
 }

 ui.music.value=intensity;ui.musicValue.value=intensity.toFixed(2);
 ui.drumState.textContent=drumState==="full"?"Pleine":drumState==="light"?"Légère":"Ambiance";
 ui.brakeState.textContent=b>.5?"Fort":b>.18?"Filtré":"Normal";
 ui.turnState.textContent=t>.7?"Accent":t>.25?"Mélodique":"Calme";
 lastDrumState=drumState;
}
function handleMotion(e){
 if(!running||demoTimer)return;
 const acc=e.acceleration||e.accelerationIncludingGravity;if(!acc)return;
 const x=Number(acc.x||0),y=Number(acc.y||0),rot=e.rotationRate||{},yaw=Math.abs(Number(rot.alpha||0));
 if(calibrationActive){
  const m=Math.hypot(x,y);if(m>.25)calibrationSamples.push({x,y});
  if(calibrationSamples.length>=35)finishCalibration();
 }
 const longitudinal=x*forward.x+y*forward.y;
 const aSens=Number(ui.accelSensitivity.value),tSens=Number(ui.turnSensitivity.value);
 const rawA=clamp(((longitudinal-.08)/1.8)*aSens);
 const rawB=clamp(((-longitudinal-.08)/1.8)*aSens);
 const rawT=clamp(Math.max(Math.abs(x*-forward.y+y*forward.x)/2.2,yaw/75)*tSens);
 smoothed.accel=lowPass(smoothed.accel,rawA);smoothed.brake=lowPass(smoothed.brake,rawB);smoothed.turn=lowPass(smoothed.turn,rawT);
 render(smoothed.accel,smoothed.brake,smoothed.turn);
}
function render(a,b,t){
 ui.accel.value=a;ui.brake.value=b;ui.turn.value=t;
 ui.accelValue.value=a.toFixed(2);ui.brakeValue.value=b.toFixed(2);ui.turnValue.value=t.toFixed(2);
 applyMusicalState(a,b,t);
}
function beginCalibration(){
 calibrationSamples=[];calibrationActive=true;setStatus("Calibration : accélère doucement en ligne droite…");ui.calibrate.disabled=true;
 setTimeout(()=>{if(calibrationActive)finishCalibration()},7000);
}
function finishCalibration(){
 calibrationActive=false;
 if(calibrationSamples.length<5){setStatus("Calibration insuffisante. Recommence.");ui.calibrate.disabled=false;return;}
 const sx=calibrationSamples.reduce((s,p)=>s+p.x,0),sy=calibrationSamples.reduce((s,p)=>s+p.y,0),norm=Math.hypot(sx,sy)||1;
 forward={x:sx/norm,y:sy/norm};localStorage.setItem("drivepulse-forward",JSON.stringify(forward));
 setStatus("Calibration terminée.");ui.calibrate.disabled=false;
}
function startDemo(){
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;ui.demo.textContent="Mode démonstration";setStatus("Mode conduite actif");return;}
 demoPhase=0;ui.demo.textContent="Arrêter la démonstration";setStatus("Démonstration automatique");
 demoTimer=setInterval(()=>{
  demoPhase+=.08;speedKmh=50+42*Math.sin(demoPhase*.28);ui.speed.textContent=Math.max(0,Math.round(speedKmh));
  const a=clamp((Math.sin(demoPhase)+.15)*.72),b=clamp((-Math.sin(demoPhase*.52)-.25)*.82),tr=clamp(Math.abs(Math.sin(demoPhase*.41))*.95);
  render(a,b,tr);
 },100);
}
async function start(){
 try{
  setStatus("Chargement des pistes…");await requestMotionPermission();
  currentStyle=ui.style.value;audio=await buildAudio(currentStyle);await audio.ctx.resume();running=true;
  window.addEventListener("devicemotion",handleMotion,{passive:true});startGps();
  const saved=localStorage.getItem("drivepulse-forward");if(saved)forward=JSON.parse(saved);
  ui.start.disabled=true;ui.calibrate.disabled=false;ui.stop.disabled=false;ui.demo.disabled=false;ui.style.disabled=true;
  setStatus(saved?"Actif avec calibration enregistrée":"Actif : calibre l’axe avant");
 }catch(err){setStatus(err.message||"Impossible de démarrer.");}
}
function stop(){
 running=false;calibrationActive=false;if(demoTimer)clearInterval(demoTimer);demoTimer=null;
 window.removeEventListener("devicemotion",handleMotion);if(watchId!=null)navigator.geolocation.clearWatch(watchId);
 if(audio)audio.ctx.close();audio=null;
 ui.start.disabled=false;ui.calibrate.disabled=true;ui.stop.disabled=true;ui.demo.disabled=true;ui.style.disabled=false;setStatus("Arrêté");
}
ui.start.addEventListener("click",start);ui.calibrate.addEventListener("click",beginCalibration);ui.stop.addEventListener("click",stop);ui.demo.addEventListener("click",startDemo);
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
