"use strict";
const $=id=>document.getElementById(id);
const ui={status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),
speed:$("speed"),accel:$("accelMeter"),brake:$("brakeMeter"),turn:$("turnMeter"),music:$("musicMeter"),
accelValue:$("accelValue"),brakeValue:$("brakeValue"),turnValue:$("turnValue"),musicValue:$("musicValue"),
mode:$("modeLabel"),bar:$("barLabel"),energy:$("energyLabel"),bassState:$("bassState"),drumState:$("drumState"),
melodyState:$("melodyState"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity"),
responsiveness:$("musicResponsiveness")};

const BPM=120,BEAT=60/BPM,BAR=4*BEAT,LOOP_BARS=8;
let running=false,watchId=null,speedKmh=0,calibrationSamples=[],calibrationActive=false;
let forward={x:0,y:1},smoothed={accel:0,brake:0,turn:0},audio=null,demoTimer=null,demoPhase=0;
let currentMode="cruise",lastTransitionBar=-1,compositionTimer=null;

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
async function buildAudio(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const ctx=new Ctx(),master=ctx.createGain(),filter=ctx.createBiquadFilter();
 master.gain.value=.72;filter.type="lowpass";filter.frequency.value=18000;
 master.connect(filter).connect(ctx.destination);
 const names=["ambient","bass_low","bass_high","drums_calm","drums_drive","drums_boost","melody_a","melody_b","transition"];
 const stems={};
 await Promise.all(names.map(async name=>{
  const buffer=await loadBuffer(ctx,`audio/synthwave/${name}.wav`);
  const source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=buffer;source.loop=true;gain.gain.value=0;
  source.connect(gain).connect(master);stems[name]={source,gain};
 }));
 const when=ctx.currentTime+.15;names.forEach(n=>stems[n].source.start(when));
 return {ctx,master,filter,stems,startTime:when};
}
function nextBarTime(){
 if(!audio)return 0;
 const elapsed=Math.max(0,audio.ctx.currentTime-audio.startTime);
 return audio.startTime+Math.ceil(elapsed/BAR)*BAR;
}
function currentBarIndex(){
 if(!audio)return 0;
 const elapsed=Math.max(0,audio.ctx.currentTime-audio.startTime);
 return Math.floor(elapsed/BAR)%LOOP_BARS;
}
function setGain(name,value,time=.08,at=null){
 if(!audio)return;
 const when=at??audio.ctx.currentTime;
 const g=audio.stems[name].gain.gain;
 g.cancelScheduledValues(when);
 g.setTargetAtTime(clamp(value),when,time);
}
function chooseMode(a,b,t){
 const response=Number(ui.responsiveness.value);
 if(b>.55)return "brake";
 if(a*response>.72)return "boost";
 if(t*response>.62)return "curve";
 if(speedKmh>55||a*response>.25)return "drive";
 return "cruise";
}
function scheduleComposition(a,b,t){
 if(!audio)return;
 const mode=chooseMode(a,b,t),when=nextBarTime(),barIndex=currentBarIndex();
 const melodyVariant=(barIndex%2===0)?"a":"b";

 if(mode!==currentMode && barIndex!==lastTransitionBar){
   setGain("transition",.7,.02,when);
   setTimeout(()=>setGain("transition",0,.12),500);
   lastTransitionBar=barIndex;
 }

 const speed=clamp(speedKmh/110);
 const energy=clamp(.15+speed*.4+a*.5+t*.18-b*.25);

 setGain("ambient", mode==="brake"?.28:.45,.12,when);
 setGain("bass_low", ["cruise","curve"].includes(mode)?.42:0,.08,when);
 setGain("bass_high", ["drive","boost"].includes(mode)?.65:0,.08,when);
 setGain("drums_calm", mode==="cruise"?.38:0,.08,when);
 setGain("drums_drive", ["drive","curve"].includes(mode)?.62:0,.08,when);
 setGain("drums_boost", mode==="boost"?.85:0,.08,when);
 setGain("melody_a", (mode==="curve"||mode==="drive")&&melodyVariant==="a"?.48:0,.08,when);
 setGain("melody_b", (mode==="curve"||mode==="boost")&&melodyVariant==="b"?.55:0,.08,when);

 const now=audio.ctx.currentTime;
 if(mode==="brake"){
   audio.filter.frequency.setTargetAtTime(900+b*1300,now,.08);
   audio.master.gain.setTargetAtTime(.48,now,.08);
 }else{
   audio.filter.frequency.setTargetAtTime(18000,now,.12);
   audio.master.gain.setTargetAtTime(.72,now,.12);
 }

 currentMode=mode;
 ui.mode.textContent={cruise:"Cruise",drive:"Drive",boost:"Boost",curve:"Curve",brake:"Brake"}[mode];
 ui.bar.textContent=`${barIndex+1} / ${LOOP_BARS}`;
 ui.energy.textContent=`${Math.round(energy*100)}%`;
 ui.bassState.textContent=["drive","boost"].includes(mode)?"Rapide":"Douce";
 ui.drumState.textContent=mode==="boost"?"Boost":mode==="drive"||mode==="curve"?"Drive":"Calme";
 ui.melodyState.textContent=mode==="curve"||mode==="boost"?(melodyVariant==="a"?"A":"B"):"Discrète";
 ui.music.value=energy;ui.musicValue.value=energy.toFixed(2);
}
function startCompositionClock(){
 compositionTimer=setInterval(()=>{
  if(!running)return;
  scheduleComposition(smoothed.accel,smoothed.brake,smoothed.turn);
 },250);
}
function startGps(){
 if(!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(({coords})=>{
  if(coords.speed!=null)speedKmh=Math.max(0,coords.speed*3.6);
  ui.speed.textContent=Math.round(speedKmh);
 },()=>setStatus("GPS indisponible, Motion actif"),{enableHighAccuracy:true,maximumAge:500,timeout:10000});
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
 smoothed.accel=lowPass(smoothed.accel,clamp(((longitudinal-.08)/1.8)*aSens));
 smoothed.brake=lowPass(smoothed.brake,clamp(((-longitudinal-.08)/1.8)*aSens));
 smoothed.turn=lowPass(smoothed.turn,clamp(Math.max(Math.abs(x*-forward.y+y*forward.x)/2.2,yaw/75)*tSens));
 render(smoothed.accel,smoothed.brake,smoothed.turn);
}
function render(a,b,t){
 ui.accel.value=a;ui.brake.value=b;ui.turn.value=t;
 ui.accelValue.value=a.toFixed(2);ui.brakeValue.value=b.toFixed(2);ui.turnValue.value=t.toFixed(2);
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
  demoPhase+=.08;speedKmh=52+48*Math.sin(demoPhase*.24);ui.speed.textContent=Math.max(0,Math.round(speedKmh));
  const a=clamp((Math.sin(demoPhase)+.15)*.72),b=clamp((-Math.sin(demoPhase*.5)-.3)*.9),tr=clamp(Math.abs(Math.sin(demoPhase*.37))*.95);
  smoothed={accel:a,brake:b,turn:tr};render(a,b,tr);
 },100);
}
async function start(){
 try{
  setStatus("Chargement du moteur musical…");await requestMotionPermission();audio=await buildAudio();await audio.ctx.resume();running=true;
  window.addEventListener("devicemotion",handleMotion,{passive:true});startGps();startCompositionClock();
  const saved=localStorage.getItem("drivepulse-forward");if(saved)forward=JSON.parse(saved);
  ui.start.disabled=true;ui.calibrate.disabled=false;ui.stop.disabled=false;ui.demo.disabled=false;
  setStatus(saved?"Actif avec calibration enregistrée":"Actif : calibre l’axe avant");
 }catch(err){setStatus(err.message||"Impossible de démarrer.");}
}
function stop(){
 running=false;calibrationActive=false;
 if(demoTimer)clearInterval(demoTimer);demoTimer=null;
 if(compositionTimer)clearInterval(compositionTimer);compositionTimer=null;
 window.removeEventListener("devicemotion",handleMotion);if(watchId!=null)navigator.geolocation.clearWatch(watchId);
 if(audio)audio.ctx.close();audio=null;
 ui.start.disabled=false;ui.calibrate.disabled=true;ui.stop.disabled=true;ui.demo.disabled=true;setStatus("Arrêté");
}
ui.start.addEventListener("click",start);ui.calibrate.addEventListener("click",beginCalibration);ui.stop.addEventListener("click",stop);ui.demo.addEventListener("click",startDemo);
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
