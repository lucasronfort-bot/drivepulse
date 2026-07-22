
"use strict";

const $ = (id) => document.getElementById(id);
const ui = {
  status: $("status"), start: $("startBtn"), calibrate: $("calibrateBtn"), stop: $("stopBtn"),
  speed: $("speed"), accel: $("accelMeter"), brake: $("brakeMeter"), turn: $("turnMeter"),
  music: $("musicMeter"), accelValue: $("accelValue"), brakeValue: $("brakeValue"),
  turnValue: $("turnValue"), musicValue: $("musicValue")
};

let running = false;
let watchId = null;
let speedKmh = 0;
let calibrationSamples = [];
let calibrationActive = false;
let forward = { x: 0, y: 1 };
let smoothed = { accel: 0, brake: 0, turn: 0 };
let audio = null;

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lowPass = (oldV, newV, alpha = 0.12) => oldV + alpha * (newV - oldV);

function setStatus(text) { ui.status.textContent = text; }

async function requestMotionPermission() {
  if (typeof DeviceMotionEvent === "undefined") throw new Error("Capteurs Motion indisponibles.");
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    const result = await DeviceMotionEvent.requestPermission();
    if (result !== "granted") throw new Error("Accès Motion refusé.");
  }
}

function startGps() {
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      speedKmh = coords.speed == null ? speedKmh : Math.max(0, coords.speed * 3.6);
      ui.speed.textContent = Math.round(speedKmh);
    },
    () => setStatus("GPS indisponible, capteurs Motion actifs"),
    { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 }
  );
}

function buildAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();

  const master = ctx.createGain();
  master.gain.value = 0.28;
  master.connect(ctx.destination);

  const pad = ctx.createOscillator();
  const padGain = ctx.createGain();
  pad.type = "sine"; pad.frequency.value = 110; padGain.gain.value = 0.08;
  pad.connect(padGain).connect(master); pad.start();

  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  pulse.type = "triangle"; pulse.frequency.value = 220; pulseGain.gain.value = 0;
  pulse.connect(pulseGain).connect(master); pulse.start();

  const lead = ctx.createOscillator();
  const leadGain = ctx.createGain();
  lead.type = "sine"; lead.frequency.value = 330; leadGain.gain.value = 0;
  lead.connect(leadGain).connect(master); lead.start();

  return { ctx, master, pad, padGain, pulse, pulseGain, lead, leadGain };
}

function updateAudio(accel, brake, turn) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const speedIntensity = clamp(speedKmh / 90);
  const intensity = clamp(0.15 + speedIntensity * 0.4 + accel * 0.45 + turn * 0.2 - brake * 0.25);

  audio.pad.frequency.setTargetAtTime(100 + speedIntensity * 45, now, 0.12);
  audio.padGain.gain.setTargetAtTime(0.05 + intensity * 0.08, now, 0.12);
  audio.pulse.frequency.setTargetAtTime(180 + accel * 180 + speedIntensity * 80, now, 0.08);
  audio.pulseGain.gain.setTargetAtTime(clamp(accel * 0.16 + speedIntensity * 0.05), now, 0.1);
  audio.lead.frequency.setTargetAtTime(280 + turn * 220, now, 0.08);
  audio.leadGain.gain.setTargetAtTime(turn * 0.11, now, 0.1);
  audio.master.gain.setTargetAtTime(brake > 0.45 ? 0.18 : 0.28, now, 0.12);

  ui.music.value = intensity;
  ui.musicValue.value = intensity.toFixed(2);
}

function handleMotion(event) {
  if (!running) return;
  const a = event.acceleration || event.accelerationIncludingGravity;
  if (!a) return;

  const x = Number(a.x || 0);
  const y = Number(a.y || 0);
  const rotation = event.rotationRate || {};
  const yawRate = Math.abs(Number(rotation.alpha || 0));

  if (calibrationActive) {
    const magnitude = Math.hypot(x, y);
    if (magnitude > 0.25) calibrationSamples.push({ x, y });
    if (calibrationSamples.length >= 35) finishCalibration();
  }

  const longitudinal = x * forward.x + y * forward.y;
  const rawAccel = clamp((longitudinal - 0.08) / 1.8);
  const rawBrake = clamp((-longitudinal - 0.08) / 1.8);
  const rawTurn = clamp(Math.max(Math.abs(x * -forward.y + y * forward.x) / 2.2, yawRate / 75));

  smoothed.accel = lowPass(smoothed.accel, rawAccel);
  smoothed.brake = lowPass(smoothed.brake, rawBrake);
  smoothed.turn = lowPass(smoothed.turn, rawTurn);

  ui.accel.value = smoothed.accel;
  ui.brake.value = smoothed.brake;
  ui.turn.value = smoothed.turn;
  ui.accelValue.value = smoothed.accel.toFixed(2);
  ui.brakeValue.value = smoothed.brake.toFixed(2);
  ui.turnValue.value = smoothed.turn.toFixed(2);

  updateAudio(smoothed.accel, smoothed.brake, smoothed.turn);
}

function beginCalibration() {
  calibrationSamples = [];
  calibrationActive = true;
  setStatus("Calibration : accélère doucement en ligne droite…");
  ui.calibrate.disabled = true;
  setTimeout(() => {
    if (calibrationActive) finishCalibration();
  }, 7000);
}

function finishCalibration() {
  calibrationActive = false;
  if (calibrationSamples.length < 5) {
    setStatus("Calibration insuffisante : recommence avec une accélération douce.");
    ui.calibrate.disabled = false;
    return;
  }
  const sx = calibrationSamples.reduce((s, p) => s + p.x, 0);
  const sy = calibrationSamples.reduce((s, p) => s + p.y, 0);
  const norm = Math.hypot(sx, sy) || 1;
  forward = { x: sx / norm, y: sy / norm };
  localStorage.setItem("drivepulse-forward", JSON.stringify(forward));
  setStatus("Calibration terminée. DrivePulse est actif.");
  ui.calibrate.disabled = false;
}

async function start() {
  try {
    await requestMotionPermission();
    audio = buildAudio();
    await audio.ctx.resume();
    running = true;
    window.addEventListener("devicemotion", handleMotion, { passive: true });
    startGps();

    const saved = localStorage.getItem("drivepulse-forward");
    if (saved) forward = JSON.parse(saved);

    ui.start.disabled = true;
    ui.calibrate.disabled = false;
    ui.stop.disabled = false;
    setStatus(saved ? "Actif avec calibration enregistrée" : "Actif : calibre l’axe avant");
  } catch (err) {
    setStatus(err.message || "Impossible de démarrer.");
  }
}

function stop() {
  running = false;
  calibrationActive = false;
  window.removeEventListener("devicemotion", handleMotion);
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  if (audio) audio.ctx.close();
  audio = null;
  ui.start.disabled = false;
  ui.calibrate.disabled = true;
  ui.stop.disabled = true;
  setStatus("Arrêté");
}

ui.start.addEventListener("click", start);
ui.calibrate.addEventListener("click", beginCalibration);
ui.stop.addEventListener("click", stop);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
