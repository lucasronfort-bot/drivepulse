"use strict";
const $=id=>document.getElementById(id);
const ui={
 status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),
 speed:$("speed"),accel:$("accelMeter"),brake:$("brakeMeter"),turn:$("turnMeter"),music:$("musicMeter"),
 accelValue:$("accelValue"),brakeValue:$("brakeValue"),turnValue:$("turnValue"),musicValue:$("musicValue"),
 mode:$("modeLabel"),bar:$("barLabel"),energy:$("energyLabel"),chord:$("chordState"),bass:$("bassState"),
 drum:$("drumState"),arp:$("arpState"),filter:$("filterState"),variation:$("variationState"),idle:$("idleState"),
 responsiveness:$("responsiveness"),density:$("density"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity")
};

const BPM=118,BEAT=60/BPM,BAR=BEAT*4,LOOP_BARS=8;
const progression=[
 {name:"Am",root:57,notes:[57,60,64]},
 {name:"F",root:53,notes:[53,57,60]},
 {name:"C",root:48,notes:[48,52,55]},
 {name:"G",root:55,notes:[55,59,62]}
];

let running=false,watchId=null,demoTimer=null,schedulerTimer=null;
let speedKmh=0,demoPhase=0,calibrationActive=false,calibrationSamples=[];
let forward={x:0,y:1},smoothed={accel:0,brake:0,turn:0};
let audio=null,nextStepTime=0,stepIndex=0,currentMode="cruise",barCounter=0,variation=0;

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const lowPass=(oldV,newV,a=.12)=>oldV+a*(newV-oldV);
const midiToHz=m=>440*Math.pow(2,(m-69)/12);
const setStatus=t=>ui.status.textContent=t;

async function requestMotionPermission(){
 if(typeof DeviceMotionEvent==="undefined")throw new Error("Capteurs Motion indisponibles.");
 if(typeof DeviceMotionEvent.requestPermission==="function"){
  const r=await DeviceMotionEvent.requestPermission();
  if(r!=="granted")throw new Error("Accès Motion refusé.");
 }
}
function createAudio(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const ctx=new Ctx();
 const master=ctx.createGain(),filter=ctx.createBiquadFilter(),compressor=ctx.createDynamicsCompressor();
 const delay=ctx.createDelay(1),feedback=ctx.createGain(),wet=ctx.createGain(),dry=ctx.createGain();

 master.gain.value=.62;
 filter.type="lowpass";filter.frequency.value=15000;filter.Q.value=.7;
 compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.25;
 delay.delayTime.value=.28;feedback.gain.value=.22;wet.gain.value=.16;dry.gain.value=.9;

 master.connect(filter);
 filter.connect(dry).connect(compressor);
 filter.connect(delay).connect(wet).connect(compressor);
 delay.connect(feedback).connect(delay);
 compressor.connect(ctx.destination);

 return {ctx,master,filter,delay,feedback,wet,dry};
}
function envGain(start,attack,decay,peak=.3){
 const g=audio.ctx.createGain();
 g.gain.setValueAtTime(.0001,start);
 g.gain.exponentialRampToValueAtTime(Math.max(.001,peak),start+attack);
 g.gain.exponentialRampToValueAtTime(.0001,start+attack+decay);
 g.connect(audio.master);
 return g;
}
function playTone(freq,start,dur,type="sine",gain=.2,detune=0){
 const o=audio.ctx.createOscillator(),g=envGain(start,.01,dur,gain);
 o.type=type;o.frequency.setValueAtTime(freq,start);o.detune.value=detune;
 o.connect(g);o.start(start);o.stop(start+dur+.05);
}
function playElectricPiano(midi,start,dur=.7,gain=.055){
 const freq=midiToHz(midi);
 playTone(freq,start,dur,"sine",gain);
 playTone(freq*2,start,dur*.72,"sine",gain*.24,3);
 playTone(freq*3,start,dur*.45,"sine",gain*.10,-3);
}
function playIdleBed(chord,start,stepInBar,barIndex){
 // Fond permanent, même véhicule arrêté.
 if(stepInBar===0){
   chord.notes.forEach((m,i)=>{
     playTone(midiToHz(m-12),start,BAR*.96,"sine",.028,(i-1)*3);
     playTone(midiToHz(m),start,BAR*.90,"triangle",.012,(1-i)*2);
   });
 }
 // Petite mélodie lente : piano électrique sur une mesure, synthé doux sur la suivante.
 const pianoPattern=[0,null,1,null,2,null,1,null];
 const synthPattern=[2,null,1,null,0,null,1,null];
 const pattern=barIndex%2===0?pianoPattern:synthPattern;
 const noteIndex=pattern[stepInBar];
 if(noteIndex!==null){
   const midi=chord.notes[noteIndex]+12;
   if(barIndex%2===0) playElectricPiano(midi,start,.65,.05);
   else {
     playTone(midiToHz(midi),start,.55,"triangle",.035);
     playTone(midiToHz(midi+12),start,.38,"sine",.012,4);
   }
 }
}
function playPad(notes,start,dur,intensity){
 notes.forEach((m,i)=>{
  playTone(midiToHz(m-12),start,dur,"sine",.035+.018*intensity,(i-1)*4);
  playTone(midiToHz(m),start,dur,"triangle",.018+.01*intensity,(i-1)*-3);
 });
}
function playBass(midi,start,boost){
 playTone(midiToHz(midi-24),start,.18,boost?"sawtooth":"triangle",boost?.11:.075);
}
function playKick(start,amount=.7){
 const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();
 o.type="sine";o.frequency.setValueAtTime(130,start);o.frequency.exponentialRampToValueAtTime(42,start+.12);
 g.gain.setValueAtTime(amount,start);g.gain.exponentialRampToValueAtTime(.001,start+.18);
 o.connect(g).connect(audio.master);o.start(start);o.stop(start+.2);
}
function noiseBuffer(){
 const b=audio.ctx.createBuffer(1,audio.ctx.sampleRate*.2,audio.ctx.sampleRate);
 const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;
}
function playSnare(start,amount=.25){
 const s=audio.ctx.createBufferSource(),g=audio.ctx.createGain(),f=audio.ctx.createBiquadFilter();
 s.buffer=noiseBuffer();f.type="highpass";f.frequency.value=1400;
 g.gain.setValueAtTime(amount,start);g.gain.exponentialRampToValueAtTime(.001,start+.12);
 s.connect(f).connect(g).connect(audio.master);s.start(start);s.stop(start+.13);
}
function playHat(start,amount=.06){
 const s=audio.ctx.createBufferSource(),g=audio.ctx.createGain(),f=audio.ctx.createBiquadFilter();
 s.buffer=noiseBuffer();f.type="highpass";f.frequency.value=6000;
 g.gain.setValueAtTime(amount,start);g.gain.exponentialRampToValueAtTime(.001,start+.035);
 s.connect(f).connect(g).connect(audio.master);s.start(start);s.stop(start+.04);
}
function modeFromDriving(a,b,t){
 const r=Number(ui.responsiveness.value);
 if(b>.5)return"brake";
 if(a*r>.72)return"boost";
 if(t*r>.62)return"curve";
 if(speedKmh>55||a*r>.25)return"drive";
 return"cruise";
}
function computeEnergy(a,b,t){
 return clamp(.1+clamp(speedKmh/110)*.35+a*.48+t*.18-b*.25);
}
function scheduleStep(time){
 const a=smoothed.accel,b=smoothed.brake,t=smoothed.turn;
 currentMode=modeFromDriving(a,b,t);
 const energy=computeEnergy(a,b,t);
 const density=Number(ui.density.value);
 const barIndex=Math.floor(stepIndex/8)%LOOP_BARS;
 const stepInBar=stepIndex%8;
 const chord=progression[Math.floor(barIndex/2)%progression.length];

 playIdleBed(chord,time,stepInBar,barIndex);

 if(stepInBar===0){
   playPad(chord.notes,time,BAR*.92,Math.max(.35,energy));
   barCounter=barIndex;
   variation=(barIndex+Math.floor(energy*3))%2;
 }

 const boost=currentMode==="boost";
 const bassPattern=boost?[0,1,2,3,4,5,6,7]:currentMode==="drive"?[0,2,4,6]:[0,4];
 if(bassPattern.includes(stepInBar)){
   const octaveJump=boost&&stepInBar===7?12:0;
   playBass(chord.root+octaveJump,time,boost);
 }

 if(currentMode!=="brake"){
   if(stepInBar===0||stepInBar===4)playKick(time,currentMode==="boost"?.85:currentMode==="drive"?.68:.42);
   if((currentMode==="drive"||currentMode==="boost"||currentMode==="curve")&&(stepInBar===2||stepInBar===6))playSnare(time,currentMode==="boost"?.32:.22);
   if(currentMode==="boost"||currentMode==="drive"){
     if(stepInBar%2===0||density>1.1)playHat(time,currentMode==="boost"?.08:.055);
   }
 }

 const arpEnabled=currentMode==="curve"||currentMode==="boost"||(currentMode==="drive"&&density>1);
 if(arpEnabled){
   const arpOrder=variation===0?[0,1,2,1,0,1,2,1]:[2,1,0,1,2,1,0,1];
   const note=chord.notes[arpOrder[stepInBar]]+12;
   playTone(midiToHz(note),time,.12,currentMode==="boost"?"square":"triangle",currentMode==="boost"?.055:.04);
 }

 const now=audio.ctx.currentTime;
 if(currentMode==="brake"){
   audio.filter.frequency.setTargetAtTime(850+b*900,now,.06);
   audio.master.gain.setTargetAtTime(.42,now,.06);
 }else{
   audio.filter.frequency.setTargetAtTime(5500+energy*11000,now,.12);
   audio.master.gain.setTargetAtTime(.62,now,.12);
 }

 updateUi(chord,energy,barIndex);
 stepIndex++;
}
function scheduler(){
 while(nextStepTime<audio.ctx.currentTime+.12){
   scheduleStep(nextStepTime);
   nextStepTime+=BEAT/2;
 }
}
function updateUi(chord,energy,barIndex){
 ui.mode.textContent={cruise:"Cruise",drive:"Drive",boost:"Boost",curve:"Curve",brake:"Brake"}[currentMode];
 ui.bar.textContent=`${barIndex+1} / ${LOOP_BARS}`;
 ui.energy.textContent=`${Math.round(energy*100)}%`;
 ui.chord.textContent=chord.name;
 ui.bass.textContent=currentMode==="boost"?"Rapide":currentMode==="drive"?"Rythmée":"Douce";
 ui.drum.textContent=currentMode==="boost"?"Pleine":currentMode==="drive"||currentMode==="curve"?"Active":"Calme";
 ui.arp.textContent=currentMode==="boost"?"Dense":currentMode==="curve"?"Présent":"Discret";
 ui.filter.textContent=currentMode==="brake"?"Fermé":"Ouvert";
 ui.variation.textContent=variation===0?"A":"B";
 ui.idle.textContent=barIndex%2===0?"Piano électrique":"Synthé doux";
 ui.music.value=energy;ui.musicValue.value=energy.toFixed(2);
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
 renderMotion();
}
function renderMotion(){
 const {accel:a,brake:b,turn:t}=smoothed;
 ui.accel.value=a;ui.brake.value=b;ui.turn.value=t;
 ui.accelValue.value=a.toFixed(2);ui.brakeValue.value=b.toFixed(2);ui.turnValue.value=t.toFixed(2);
}
function beginCalibration(){
 calibrationSamples=[];calibrationActive=true;ui.calibrate.disabled=true;
 setStatus("Calibration : accélère doucement en ligne droite…");
 setTimeout(()=>{if(calibrationActive)finishCalibration()},7000);
}
function finishCalibration(){
 calibrationActive=false;
 if(calibrationSamples.length<5){setStatus("Calibration insuffisante. Recommence.");ui.calibrate.disabled=false;return;}
 const sx=calibrationSamples.reduce((s,p)=>s+p.x,0),sy=calibrationSamples.reduce((s,p)=>s+p.y,0),norm=Math.hypot(sx,sy)||1;
 forward={x:sx/norm,y:sy/norm};
 localStorage.setItem("drivepulse-forward",JSON.stringify(forward));
 setStatus("Calibration terminée.");ui.calibrate.disabled=false;
}
function startDemo(){
 if(demoTimer){
   clearInterval(demoTimer);demoTimer=null;ui.demo.textContent="Mode démonstration";setStatus("Mode conduite actif");return;
 }
 demoPhase=0;ui.demo.textContent="Arrêter la démonstration";setStatus("Démonstration automatique");
 demoTimer=setInterval(()=>{
   demoPhase+=.08;
   speedKmh=Math.max(0,50+48*Math.sin(demoPhase*.24));ui.speed.textContent=Math.round(speedKmh);
   smoothed.accel=clamp((Math.sin(demoPhase)+.15)*.72);
   smoothed.brake=clamp((-Math.sin(demoPhase*.5)-.3)*.9);
   smoothed.turn=clamp(Math.abs(Math.sin(demoPhase*.37))*.95);
   renderMotion();
 },100);
}
async function start(){
 try{
  setStatus("Initialisation du moteur génératif…");
  await requestMotionPermission();
  audio=createAudio();await audio.ctx.resume();
  running=true;stepIndex=0;nextStepTime=audio.ctx.currentTime+.12;
  schedulerTimer=setInterval(scheduler,25);
  window.addEventListener("devicemotion",handleMotion,{passive:true});
  startGps();
  const saved=localStorage.getItem("drivepulse-forward");if(saved)forward=JSON.parse(saved);
  ui.start.disabled=true;ui.calibrate.disabled=false;ui.stop.disabled=false;ui.demo.disabled=false;
  setStatus(saved?"Actif avec calibration enregistrée":"Actif : calibre l’axe avant");
 }catch(err){setStatus(err.message||"Impossible de démarrer.");}
}
function stop(){
 running=false;calibrationActive=false;
 if(demoTimer)clearInterval(demoTimer);demoTimer=null;
 if(schedulerTimer)clearInterval(schedulerTimer);schedulerTimer=null;
 window.removeEventListener("devicemotion",handleMotion);
 if(watchId!=null)navigator.geolocation.clearWatch(watchId);
 if(audio)audio.ctx.close();audio=null;
 ui.start.disabled=false;ui.calibrate.disabled=true;ui.stop.disabled=true;ui.demo.disabled=true;
 setStatus("Arrêté");
}
ui.start.addEventListener("click",start);
ui.calibrate.addEventListener("click",beginCalibration);
ui.stop.addEventListener("click",stop);
ui.demo.addEventListener("click",startDemo);
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
