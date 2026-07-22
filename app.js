"use strict";
const $=id=>document.getElementById(id);
const ui={
 status:$("status"),start:$("startBtn"),calibrate:$("calibrateBtn"),stop:$("stopBtn"),demo:$("demoBtn"),
 speed:$("speed"),accel:$("accelMeter"),brake:$("brakeMeter"),turn:$("turnMeter"),music:$("musicMeter"),
 accelValue:$("accelValue"),brakeValue:$("brakeValue"),turnValue:$("turnValue"),musicValue:$("musicValue"),
 mode:$("modeLabel"),bar:$("barLabel"),energy:$("energyLabel"),chord:$("chordState"),bass:$("bassState"),
 drum:$("drumState"),arp:$("arpState"),filter:$("filterState"),variation:$("variationState"),idle:$("idleState"),idlePiano:$("idlePianoToggle"),
 road:$("roadState"),speedMusic:$("speedMusicState"),roadHelp:$("roadModeHelp"),
 section:$("sectionState"),shortMemory:$("shortMemoryState"),longMemory:$("longMemoryState"),
 journey:$("journeyBtn"),responsiveness:$("responsiveness"),accelSensitivity:$("accelSensitivity"),turnSensitivity:$("turnSensitivity"),
 responsivenessValue:$("responsivenessValue"),accelSensitivityValue:$("accelSensitivityValue"),turnSensitivityValue:$("turnSensitivityValue"),
 helpModal:$("helpModal"),helpTitle:$("helpTitle"),helpText:$("helpText"),helpRecommendation:$("helpRecommendation"),closeHelp:$("closeHelpBtn"),
 agentGrid:$("agentGrid"),speedMusicTrack:$("speedMusicTrack"),energyTrack:$("energyTrack"),
 shortMemoryMeter:$("shortMemoryMeter"),longMemoryMeter:$("longMemoryMeter")
};

const BPM=118,BEAT=60/BPM,BAR=BEAT*4,LOOP_BARS=8;
const CHORDS={
 Am:{name:"Am",root:57,notes:[57,60,64]},
 F:{name:"F",root:53,notes:[53,57,60]},
 C:{name:"C",root:48,notes:[48,52,55]},
 G:{name:"G",root:55,notes:[55,59,62]},
 Dm:{name:"Dm",root:50,notes:[50,53,57]},
 Em:{name:"Em",root:52,notes:[52,55,59]}
};
const PROGRESSIONS=[
 [CHORDS.Am,CHORDS.F,CHORDS.C,CHORDS.G],
 [CHORDS.Am,CHORDS.C,CHORDS.F,CHORDS.G],
 [CHORDS.F,CHORDS.C,CHORDS.G,CHORDS.Am],
 [CHORDS.Am,CHORDS.G,CHORDS.F,CHORDS.C],
 [CHORDS.Dm,CHORDS.F,CHORDS.C,CHORDS.G],
 [CHORDS.Am,CHORDS.Em,CHORDS.F,CHORDS.G]
];
let progressionIndex=0,lastProgressionIndex=-1;

let running=false,watchId=null,demoTimer=null,journeyTimer=null,schedulerTimer=null;
let speedKmh=0,demoPhase=0,calibrationActive=false,calibrationSamples=[];
let forward={x:0,y:1},smoothed={accel:0,brake:0,turn:0};
let audio=null,nextStepTime=0,stepIndex=0,currentMode="cruise",barCounter=0,variation=0;
const SongSection={INTRO:"intro",GROOVE:"groove",BUILD:"build",CHORUS:"chorus",BREAKDOWN:"breakdown",REPRISE:"reprise"};
let songSection=SongSection.INTRO,targetSection=SongSection.INTRO,sectionBars=0;
let shortMemory=0,longMemory=0,stableSpeedMemory=0,lastSpeedSample=0,lastMemoryUpdate=performance.now();
let roadMode=localStorage.getItem("drivepulse-road-mode")||"city";
const ROAD_PROFILES={
 city:{label:"Ville",maxSpeed:50,driveAt:.28,boostAt:.78,help:"Référence 50 km/h"},
 country:{label:"Campagne",maxSpeed:80,driveAt:.32,boostAt:.82,help:"Référence 80 km/h"},
 highway:{label:"Autoroute",maxSpeed:130,driveAt:.36,boostAt:.86,help:"Référence 130 km/h"}
};

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
 // Fond harmonique permanent.
 if(stepInBar===0){
   chord.notes.forEach((m,i)=>{
     playTone(midiToHz(m-12),start,BAR*.96,"sine",.034,(i-1)*3);
     playTone(midiToHz(m),start,BAR*.90,"triangle",.016,(1-i)*2);
   });
 }

 const pianoEnabled=ui.idlePiano.checked;
 const nearlyStopped=speedKmh<8 && smoothed.accel<.18 && smoothed.brake<.35;

 if(!pianoEnabled || !nearlyStopped){
   // Mélodie minimale quand le piano à l'arrêt est désactivé ou que la voiture roule.
   const pattern=[0,null,1,null,2,null,1,null];
   const idx=pattern[stepInBar];
   if(idx!==null) playTone(midiToHz(chord.notes[idx]+12),start,.48,"triangle",.026);
   return;
 }

 // Solo de piano original, énergique et mélodique.
 // Codes utilisés : progressive house, piano EDM, montée émotionnelle,
 // syncopes légères et alternance grave/aigu.
 const phraseA=[0,1,2,1,0,2,1,2];
 const phraseB=[2,1,0,1,2,0,1,0];
 const phrase=(barIndex%2===0)?phraseA:phraseB;
 const degree=phrase[stepInBar];

 const base=chord.notes[degree]+12;
 const accent=(stepInBar===0||stepInBar===4);
 const high=(stepInBar===3||stepInBar===7);

 playElectricPiano(base,start,accent?.88:.62,accent?.09:.068);

 if(high){
   playElectricPiano(base+12,start+.03,.52,.046);
 }

 // Note d'appui basse pour donner davantage de corps à l'arrêt.
 if(stepInBar===0||stepInBar===4){
   playElectricPiano(chord.root-12,start,.72,.055);
 }

 // Réponse mélodique courte sur les contretemps.
 if(stepInBar===1||stepInBar===5){
   const responseNote=chord.notes[(degree+1)%3]+12;
   playElectricPiano(responseNote,start+BEAT/4,.40,.041);
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
function speedIntensity(){
 const profile=ROAD_PROFILES[roadMode];
 return clamp(speedKmh/profile.maxSpeed);
}
function modeFromDriving(a,b,t){
 const r=Number(ui.responsiveness.value);
 const s=speedIntensity();
 const profile=ROAD_PROFILES[roadMode];
 if(b>.5)return"brake";
 if(a*r>.72 || s>profile.boostAt)return"boost";
 if(t*r>.62)return"curve";
 if(s>profile.driveAt || a*r>.25)return"drive";
 return"cruise";
}
function computeEnergy(a,b,t){
 const s=speedIntensity();
 // La vitesse devient la composante dominante : même à allure constante,
 // la musique gagne en densité, en registre et en pulsation.
 return clamp(.22+s*.62+a*.18+t*.10-b*.18);
}


const MUSIC_AGENTS=[
 {id:"pulse",emoji:"🥁",name:"PULSE",role:"Kick",description:"Battement principal",color:"#ff5d67"},
 {id:"clap",emoji:"👏",name:"CLAP",role:"Claps & snare",description:"Rythme principal",color:"#a66cff"},
 {id:"spark",emoji:"✨",name:"SPARK",role:"Hi-hat & shaker",description:"Dynamique rythmique",color:"#ffc13d"},
 {id:"sub",emoji:"🎸",name:"SUB",role:"Basse profonde",description:"Fondations",color:"#25c5ff"},
 {id:"bounce",emoji:"🎸",name:"BOUNCE",role:"Basse rythmique",description:"Groove & mouvement",color:"#44dc72"},
 {id:"keys",emoji:"🎹",name:"KEYS",role:"Piano & accords",description:"Harmonie",color:"#f06ec7"},
 {id:"cloud",emoji:"☁️",name:"CLOUD",role:"Nappes & textures",description:"Atmosphère",color:"#36d8ea"},
 {id:"hook",emoji:"🎤",name:"HOOK",role:"Mélodie principale",description:"Thème actuel",color:"#dc65d9"},
 {id:"reply",emoji:"🔔",name:"REPLY",role:"Contrechant",description:"Réponses & variations",color:"#ff9a2f"},
 {id:"motion",emoji:"🪘",name:"MOTION",role:"Percussions",description:"Mouvement organique",color:"#ffad31"},
 {id:"voice",emoji:"🎙️",name:"VOICE",role:"Voix synthétique",description:"Textures vocales",color:"#37d6d3"},
 {id:"rise",emoji:"🌊",name:"RISE",role:"FX & impacts",description:"Transitions",color:"#a853f2"}
];

const activeAgents=new Set();
const agentVisualState=new Map();
let hookPatternIndex=0,replyPatternIndex=0,bassPatternIndex=0,phraseCycle=0;
let lastHookPattern=-1,lastReplyPattern=-1,lastBassPattern=-1;

const HOOK_PATTERNS=[
 [0,null,2,4,null,2,1,2],
 [4,2,null,0,2,null,4,7],
 [7,null,4,2,4,5,null,4],
 [0,4,7,null,9,7,5,4],
 [2,null,5,4,2,0,2,null],
 [7,9,null,11,9,7,4,5],
 [0,2,4,5,null,4,2,0],
 [4,null,7,9,7,null,5,2]
];
const REPLY_PATTERNS=[
 [7,9,7,5],
 [4,5,7,4],
 [9,7,4,2],
 [2,4,5,7],
 [11,9,7,5],
 [5,7,4,2]
];
const BASS_PATTERNS=[
 [0,2,4,6],
 [0,3,4,7],
 [0,2,5,6],
 [0,1,4,5,7],
 [0,2,3,6]
];

function chooseNonRepeating(length,lastIndex){
 let next=Math.floor(Math.random()*length);
 if(length>1&&next===lastIndex)next=(next+1+Math.floor(Math.random()*(length-1)))%length;
 return next;
}

function renderAgents(){
 ui.agentGrid.innerHTML=MUSIC_AGENTS.map((agent,index)=>`
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
      ${Array.from({length:14},(_,i)=>`<i style="animation-delay:-${((i*0.09)+(index*0.03)).toFixed(2)}s"></i>`).join("")}
    </div>
  </article>`).join("");
}

function setAgentVisualState(id,state){
 const card=ui.agentGrid.querySelector(`[data-agent="${id}"]`);
 if(!card)return;
 agentVisualState.set(id,state);
 card.classList.toggle("active",state==="active");
 card.classList.toggle("transition",state==="transition");
 const text=card.querySelector(".agent-status span");
 if(text)text.textContent=state==="active"?"Actif":state==="transition"?"En transition":"Inactif";
}

function syncAgentSet(nextSet){
 MUSIC_AGENTS.forEach(agent=>{
  const wasActive=activeAgents.has(agent.id);
  const willBeActive=nextSet.has(agent.id);

  if(willBeActive)activeAgents.add(agent.id);
  else activeAgents.delete(agent.id);

  if(wasActive!==willBeActive){
   setAgentVisualState(agent.id,"transition");
   window.setTimeout(()=>{
    if(activeAgents.has(agent.id)===willBeActive){
     setAgentVisualState(agent.id,willBeActive?"active":"inactive");
    }
   },360);
  }else{
   setAgentVisualState(agent.id,willBeActive?"active":"inactive");
  }
 });
}

function chooseAgentSet(energy){
 const next=new Set(["keys","cloud"]);

 if(speedKmh>2||songSection!==SongSection.INTRO)next.add("pulse");
 if(energy>.18||speedKmh>8)next.add("sub");
 if(energy>.26||songSection===SongSection.GROOVE)next.add("clap");
 if(energy>.30||stableSpeedMemory>.30)next.add("spark");
 if(energy>.38||songSection===SongSection.BUILD||songSection===SongSection.CHORUS)next.add("bounce");
 if(energy>.46||songSection===SongSection.BUILD||songSection===SongSection.CHORUS)next.add("hook");
 if(energy>.58&&songSection!==SongSection.BREAKDOWN)next.add("reply");
 if(smoothed.turn>.22||roadMode==="country")next.add("motion");
 if(songSection===SongSection.CHORUS&&sectionBars>=1)next.add("voice");
 if([SongSection.BUILD,SongSection.BREAKDOWN,SongSection.REPRISE].includes(songSection))next.add("rise");

 syncAgentSet(next);
}

function playKeysAgent(chord,time,stepInBar,energy){
 if(!activeAgents.has("keys"))return;
 if(stepInBar===0||stepInBar===4){
  const inversion=phraseCycle%3;
  chord.notes.forEach((note,i)=>{
   const shifted=note+12+(i<inversion?12:0);
   playElectricPiano(shifted,time+(i*.018),.42,.028+.016*energy);
  });
 }
 if(songSection===SongSection.CHORUS&&(stepInBar===2||stepInBar===6)){
  playElectricPiano(chord.notes[(stepInBar/2)%3]+24,time,.26,.032);
 }
}

function playBounceAgent(chord,time,stepInBar,boost){
 if(!activeAgents.has("bounce"))return;
 const pattern=BASS_PATTERNS[bassPatternIndex];
 if(pattern.includes(stepInBar)){
  const passing=stepInBar===7?2:0;
  playTone(midiToHz(chord.root-12+passing),time,.13,boost?"sawtooth":"square",boost?.050:.035);
 }
}

function playHookAgent(chord,time,stepInBar,energy){
 if(!activeAgents.has("hook"))return;
 const degree=HOOK_PATTERNS[hookPatternIndex][stepInBar];
 if(degree===null)return;
 const octave=songSection===SongSection.CHORUS?24:12;
 const note=chord.root+degree+octave;
 playTone(midiToHz(note),time,.18,songSection===SongSection.CHORUS?"sawtooth":"triangle",.018+.026*energy);
 if(songSection===SongSection.CHORUS&&stepInBar%4===0){
  playTone(midiToHz(note-12),time,.22,"triangle",.012+.010*energy);
 }
}

function playReplyAgent(chord,time,stepInBar,energy){
 if(!activeAgents.has("reply"))return;
 if(![1,3,5,7].includes(stepInBar))return;
 const pattern=REPLY_PATTERNS[replyPatternIndex];
 const degree=pattern[Math.floor(stepInBar/2)%pattern.length];
 playTone(midiToHz(chord.root+24+degree),time+.02,.12,"sine",.012+.012*energy);
}

function playMotionAgent(time,stepInBar,energy){
 if(!activeAgents.has("motion"))return;
 if(stepInBar===1||stepInBar===5)playHat(time+.03,.024+.020*energy);
 if(stepInBar===3||stepInBar===7)playTone(165+(stepInBar*7),time,.075,"square",.007+.007*energy);
}

function playVoiceAgent(chord,time,stepInBar,energy){
 if(!activeAgents.has("voice"))return;
 if(stepInBar!==2&&stepInBar!==6)return;
 const root=midiToHz(chord.root+24+(stepInBar===6?7:4));
 playTone(root,time,.32,"sine",.011+.010*energy);
 playTone(root*1.5,time+.025,.25,"triangle",.006+.006*energy);
 playTone(root*2,time+.045,.18,"sine",.003+.004*energy);
}

function playRiseAgent(chord,time,stepInBar){
 if(!activeAgents.has("rise"))return;
 if(songSection===SongSection.BUILD&&stepInBar>=4){
  playTone(midiToHz(chord.root+24+stepInBar),time,.095,"sine",.005+.0018*stepInBar);
 }
 if(songSection===SongSection.REPRISE&&stepInBar===0){
  playTone(midiToHz(chord.root+12),time,.55,"triangle",.034);
 }
}

function updateSectionTimeline(){
 document.querySelectorAll("[data-section]").forEach(node=>{
  node.classList.toggle("current",node.dataset.section===songSection);
 });
}

renderAgents();
MUSIC_AGENTS.forEach(agent=>setAgentVisualState(agent.id,"inactive"));

function updateDrivingMemory(){
 const now=performance.now();
 const dt=Math.min(1,(now-lastMemoryUpdate)/1000);
 lastMemoryUpdate=now;

 const s=speedIntensity();
 const immediate=clamp(
   s*.58+
   smoothed.accel*.24+
   smoothed.turn*.12-
   smoothed.brake*.18
 );

 shortMemory=lowPass(shortMemory,immediate,Math.min(.45,dt*.32));
 longMemory=lowPass(longMemory,shortMemory,Math.min(.10,dt*.035));

 const speedDelta=Math.abs(speedKmh-lastSpeedSample);
 const stableTarget=speedKmh>8 && speedDelta<2.5 && smoothed.accel<.18 && smoothed.brake<.18 ? 1 : 0;
 stableSpeedMemory=lowPass(stableSpeedMemory,stableTarget,Math.min(.25,dt*.10));
 lastSpeedSample=speedKmh;
}

function evaluateSongSection(){
 const s=speedIntensity();

 if(smoothed.brake>.56) return SongSection.BREAKDOWN;
 if(songSection===SongSection.BREAKDOWN && speedKmh>10 && smoothed.brake<.2) return SongSection.REPRISE;
 if(smoothed.accel>.48 || (shortMemory>.70 && longMemory<.62)) return SongSection.BUILD;
 if((s>.70 && stableSpeedMemory>.45) || longMemory>.73) return SongSection.CHORUS;
 if(speedKmh>8 || s>.15) return SongSection.GROOVE;
 return SongSection.INTRO;
}

function sectionLabel(section){
 return {
   intro:"Intro",
   groove:"Groove",
   build:"Montée",
   chorus:"Refrain",
   breakdown:"Respiration",
   reprise:"Reprise"
 }[section];
}

function applySectionTransition(){
 targetSection=evaluateSongSection();

 const minBars={
   intro:2,
   groove:4,
   build:2,
   chorus:4,
   breakdown:2,
   reprise:2
 }[songSection];

 if(targetSection!==songSection && sectionBars>=minBars){
   songSection=targetSection;
   sectionBars=0;
   playTransitionAccent(audio.ctx.currentTime+.02,songSection);
 }else{
   sectionBars++;
 }
}

function playTransitionAccent(start,section){
 if(section===SongSection.BUILD || section===SongSection.CHORUS){
   playKick(start,.9);
   playTone(110,start,.42,"sawtooth",.05);
   playTone(220,start+.08,.32,"triangle",.035);
 }else if(section===SongSection.BREAKDOWN){
   playTone(146.83,start,.8,"sine",.055);
 }else if(section===SongSection.REPRISE){
   playKick(start,.7);
   playSnare(start+.12,.25);
 }
}

function sectionMultipliers(){
 return {
   intro:{rhythm:.45,melody:.70,filter:.72},
   groove:{rhythm:.82,melody:.82,filter:.88},
   build:{rhythm:1.05,melody:1.05,filter:1.0},
   chorus:{rhythm:1.22,melody:1.18,filter:1.0},
   breakdown:{rhythm:.24,melody:.62,filter:.42},
   reprise:{rhythm:.92,melody:.92,filter:.82}
 }[songSection];
}

function scheduleStep(time){
 const a=smoothed.accel,b=smoothed.brake,t=smoothed.turn;
 currentMode=modeFromDriving(a,b,t);
 updateDrivingMemory();

 const speedDrive=speedIntensity();
 const energy=computeEnergy(a,b,t);
 const sectionMix=sectionMultipliers();
 const barIndex=Math.floor(stepIndex/8)%LOOP_BARS;
 const stepInBar=stepIndex%8;

 if(stepInBar===0&&barIndex===0){
  lastProgressionIndex=progressionIndex;
  progressionIndex=chooseNonRepeating(PROGRESSIONS.length,lastProgressionIndex);
 }
 const progression=PROGRESSIONS[progressionIndex];
 const chord=progression[Math.floor(barIndex/2)%progression.length];

 playIdleBed(chord,time,stepInBar,barIndex);

 if(stepInBar===0){
  applySectionTransition();

  phraseCycle++;
  lastHookPattern=hookPatternIndex;
  lastReplyPattern=replyPatternIndex;
  lastBassPattern=bassPatternIndex;
  hookPatternIndex=chooseNonRepeating(HOOK_PATTERNS.length,lastHookPattern);
  replyPatternIndex=chooseNonRepeating(REPLY_PATTERNS.length,lastReplyPattern);
  bassPatternIndex=chooseNonRepeating(BASS_PATTERNS.length,lastBassPattern);

  chooseAgentSet(energy);

  if(activeAgents.has("cloud")){
   playPad(chord.notes,time,BAR*.92,Math.max(.42,energy)*sectionMix.melody);
  }

  barCounter=barIndex;
  variation=(phraseCycle+Math.floor(energy*4))%4;
 }

 const boost=currentMode==="boost";

 if(activeAgents.has("sub")){
  const subPattern=boost?[0,1,2,3,4,5,6,7]:
   speedDrive>.60?[0,2,3,4,6,7]:
   speedDrive>.22?[0,2,4,6]:[0,4];
  if(subPattern.includes(stepInBar)){
   const octaveJump=boost&&stepInBar===7?12:0;
   playBass(chord.root+octaveJump,time,boost);
  }
 }

 playBounceAgent(chord,time,stepInBar,boost);

 if(currentMode!=="brake"){
  const kickLevel=.44+speedDrive*.38+(boost?.12:0);
  const kickPattern=songSection===SongSection.CHORUS?[0,2,4,6]:
   songSection===SongSection.BUILD?[0,3,4,6]:
   [0,4];

  if(activeAgents.has("pulse")&&kickPattern.includes(stepInBar)){
   playKick(time,kickLevel*sectionMix.rhythm);
  }

  if(activeAgents.has("clap")&&(stepInBar===2||stepInBar===6)){
   playSnare(time,(.20+speedDrive*.18)*sectionMix.rhythm);
  }

  if(activeAgents.has("spark")){
   const denseHat=songSection===SongSection.CHORUS||songSection===SongSection.BUILD||speedDrive>.62;
   if(denseHat||stepInBar%2===1){
    playHat(time,(.038+speedDrive*.052)*sectionMix.rhythm);
   }
  }
 }

 const arpEnabled=songSection!==SongSection.BREAKDOWN&&
  (speedDrive>.28||currentMode==="curve"||currentMode==="boost");
 if(arpEnabled){
  const arpOrders=[
   [0,1,2,1,0,1,2,1],
   [2,1,0,1,2,1,0,1],
   [0,2,1,2,0,2,1,2],
   [1,2,1,0,1,2,1,0]
  ];
  const order=arpOrders[variation%arpOrders.length];
  const note=chord.notes[order[stepInBar]]+(songSection===SongSection.CHORUS?24:12);
  playTone(midiToHz(note),time,.11,currentMode==="boost"?"square":"triangle",currentMode==="boost"?.044:.030);
 }

 playKeysAgent(chord,time,stepInBar,energy);
 playHookAgent(chord,time,stepInBar,energy);
 playReplyAgent(chord,time,stepInBar,energy);
 playMotionAgent(time,stepInBar,energy);
 playVoiceAgent(chord,time,stepInBar,energy);
 playRiseAgent(chord,time,stepInBar);

 const now=audio.ctx.currentTime;
 if(currentMode==="brake"){
  audio.filter.frequency.setTargetAtTime(850+b*900,now,.06);
  audio.master.gain.setTargetAtTime(.43,now,.06);
 }else{
  audio.filter.frequency.setTargetAtTime((4300+energy*11800)*sectionMix.filter,now,.12);
  audio.master.gain.setTargetAtTime(speedKmh<8?.72:.64,now,.12);
 }

 updateUi(chord,energy,barIndex,speedDrive);
 stepIndex++;
}
function scheduler(){
 while(nextStepTime<audio.ctx.currentTime+.12){
   scheduleStep(nextStepTime);
   nextStepTime+=BEAT/2;
 }
}
function updateUi(chord,energy,barIndex,speedDrive){
 ui.mode.textContent={cruise:"Cruise",drive:"Drive",boost:"Boost",curve:"Curve",brake:"Brake"}[currentMode];
 ui.bar.textContent=`${barIndex+1} / ${LOOP_BARS}`;
 ui.energy.textContent=`${Math.round(energy*100)}%`;
 ui.chord.textContent=chord.name;
 ui.bass.textContent=currentMode==="boost"?"Rapide":currentMode==="drive"?"Rythmée":"Douce";
 ui.drum.textContent=currentMode==="boost"?"Pleine":currentMode==="drive"||currentMode==="curve"?"Active":"Calme";
 ui.arp.textContent=currentMode==="boost"?"Dense":currentMode==="curve"?"Présent":"Discret";
 ui.filter.textContent=currentMode==="brake"?"Fermé":"Ouvert";
 ui.variation.textContent=variation===0?"A":"B";
 ui.idle.textContent=ui.idlePiano.checked&&speedKmh<8?"Solo piano":"Fond synthétique";
 ui.road.textContent=ROAD_PROFILES[roadMode].label;
 ui.speedMusic.textContent=`${Math.round(speedDrive*100)}%`;
 ui.section.textContent=sectionLabel(songSection);
 ui.shortMemory.textContent=`${Math.round(shortMemory*100)}%`;
 ui.longMemory.textContent=`${Math.round(longMemory*100)}%`;
 ui.shortMemoryMeter.value=shortMemory;
 ui.longMemoryMeter.value=longMemory;
 ui.speedMusicTrack.style.width=`${Math.round(speedDrive*100)}%`;
 ui.energyTrack.style.width=`${Math.round(energy*100)}%`;
 ui.music.value=energy;ui.musicValue.value=energy.toFixed(2);
 updateSectionTimeline();
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

function startJourneyScenario(){
 if(journeyTimer){
   clearInterval(journeyTimer);
   journeyTimer=null;
   ui.journey.textContent="Scénario trajet complet";
   setStatus("Scénario arrêté");
   return;
 }
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;}
 let elapsed=0;
 ui.journey.textContent="Arrêter le scénario";
 setStatus("Scénario : arrêt → ville → campagne → autoroute → freinage");

 journeyTimer=setInterval(()=>{
   elapsed+=.1;
   let targetSpeed=0,a=0,b=0,t=0;

   if(elapsed<8){
     targetSpeed=0;
   }else if(elapsed<25){
     targetSpeed=(elapsed-8)/17*50;
     a=.48;
     roadMode="city";
   }else if(elapsed<42){
     targetSpeed=48;
     t=.12;
   }else if(elapsed<58){
     targetSpeed=50+(elapsed-42)/16*30;
     a=.38;
     roadMode="country";
   }else if(elapsed<78){
     targetSpeed=80;
     t=.26;
   }else if(elapsed<98){
     targetSpeed=80+(elapsed-78)/20*50;
     a=.42;
     roadMode="highway";
   }else if(elapsed<120){
     targetSpeed=130;
   }else if(elapsed<130){
     targetSpeed=130-(elapsed-120)/10*110;
     b=.72;
   }else{
     targetSpeed=0;
     clearInterval(journeyTimer);
     journeyTimer=null;
     ui.journey.textContent="Scénario trajet complet";
     setStatus("Scénario terminé");
   }

   applyRoadMode(roadMode);
   speedKmh=Math.max(0,targetSpeed);
   smoothed.accel=lowPass(smoothed.accel,a,.22);
   smoothed.brake=lowPass(smoothed.brake,b,.22);
   smoothed.turn=lowPass(smoothed.turn,t,.22);
   ui.speed.textContent=Math.round(speedKmh);
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
  ui.start.disabled=true;ui.calibrate.disabled=false;ui.stop.disabled=false;ui.demo.disabled=false;ui.journey.disabled=false;
  syncAgentSet(new Set(["keys","cloud"]));
  updateSectionTimeline();
  setStatus(saved?"Actif avec calibration enregistrée":"Actif : calibre l’axe avant");
 }catch(err){setStatus(err.message||"Impossible de démarrer.");}
}
function stop(){
 running=false;calibrationActive=false;
 if(demoTimer)clearInterval(demoTimer);demoTimer=null;
 if(journeyTimer)clearInterval(journeyTimer);journeyTimer=null;
 if(schedulerTimer)clearInterval(schedulerTimer);schedulerTimer=null;
 window.removeEventListener("devicemotion",handleMotion);
 if(watchId!=null)navigator.geolocation.clearWatch(watchId);
 if(audio)audio.ctx.close();audio=null;
 ui.start.disabled=false;ui.calibrate.disabled=true;ui.stop.disabled=true;ui.demo.disabled=true;ui.journey.disabled=true;
 activeAgents.clear();
 MUSIC_AGENTS.forEach(agent=>setAgentVisualState(agent.id,"inactive"));
 setStatus("Arrêté");
}

function applyRoadMode(mode){
 if(!ROAD_PROFILES[mode])return;
 roadMode=mode;
 localStorage.setItem("drivepulse-road-mode",mode);
 document.querySelectorAll(".road-mode").forEach(btn=>{
   btn.classList.toggle("active",btn.dataset.roadMode===mode);
 });
 ui.roadHelp.textContent=ROAD_PROFILES[mode].help;
 ui.road.textContent=ROAD_PROFILES[mode].label;
}
document.querySelectorAll(".road-mode").forEach(btn=>{
 btn.addEventListener("click",()=>applyRoadMode(btn.dataset.roadMode));
});
applyRoadMode(roadMode);


const HELP_CONTENT={
 responsiveness:{
   title:"Réactivité musicale",
   text:"Détermine la vitesse à laquelle DrivePulse réagit aux changements de conduite. Une valeur élevée déclenche plus facilement les modes Drive, Boost ou Curve. Une valeur basse rend les transitions plus progressives.",
   recommendation:"Conseil : commence à 1,0. Monte vers 1,3 si la musique te semble trop lente à réagir."
 },
 accelSensitivity:{
   title:"Sensibilité accélération",
   text:"Ajuste la sensibilité du téléphone aux accélérations et aux freinages. Une valeur élevée amplifie les réactions musicales aux mouvements longitudinaux du véhicule.",
   recommendation:"Conseil : garde 1,0 après calibration. Réduis la valeur si les réactions sont trop brusques ou augmente-la si elles sont trop faibles."
 },
 turnSensitivity:{
   title:"Sensibilité virage",
   text:"Ajuste la sensibilité aux virages et aux changements de direction. Une valeur élevée fait apparaître plus facilement les arpèges, accents et variations associés aux courbes.",
   recommendation:"Conseil : 1,0 est le meilleur point de départ. Sur une route sinueuse, essaie 1,2 à 1,4."
 }
};

function updateSettingValues(){
 ui.responsivenessValue.value=Number(ui.responsiveness.value).toFixed(1);
 ui.accelSensitivityValue.value=Number(ui.accelSensitivity.value).toFixed(2);
 ui.turnSensitivityValue.value=Number(ui.turnSensitivity.value).toFixed(2);
}

function openHelp(key){
 const item=HELP_CONTENT[key];
 if(!item)return;
 ui.helpTitle.textContent=item.title;
 ui.helpText.textContent=item.text;
 ui.helpRecommendation.textContent=item.recommendation;
 ui.helpModal.hidden=false;
}

function closeHelp(){
 ui.helpModal.hidden=true;
}

document.querySelectorAll(".help-btn").forEach(btn=>{
 btn.addEventListener("click",()=>openHelp(btn.dataset.help));
});
ui.closeHelp.addEventListener("click",closeHelp);
ui.helpModal.addEventListener("click",e=>{
 if(e.target===ui.helpModal)closeHelp();
});
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!ui.helpModal.hidden)closeHelp();
});
[ui.responsiveness,ui.accelSensitivity,ui.turnSensitivity].forEach(input=>{
 input.addEventListener("input",updateSettingValues);
});
updateSettingValues();

ui.start.addEventListener("click",start);
ui.calibrate.addEventListener("click",beginCalibration);
ui.stop.addEventListener("click",stop);
ui.demo.addEventListener("click",startDemo);
ui.journey.addEventListener("click",startJourneyScenario);
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});

ui.idlePiano.checked=localStorage.getItem("drivepulse-idle-piano")!=="off";
ui.idlePiano.addEventListener("change",()=>{
 localStorage.setItem("drivepulse-idle-piano",ui.idlePiano.checked?"on":"off");
});
