// Original synthesized music and sound effects for the Mafia game (Web Audio API, no files, no copyrighted material).
// Every student keeps their own settings in this browser: music on/off, effects on/off, volume.
const KEY = 'mafiaAudio';
const load = () => { try { return { music: true, sfx: true, vol: 0.6, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { music: true, sfx: true, vol: 0.6 }; } };
let S = load(), ctx = null, master = null, musicBus = null, sfxBus = null, scene = null, timer = null, step = 0, nextT = 0;
const subs = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} subs.forEach((f) => f({ ...S })); };
export const settings = () => ({ ...S });
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = S.vol; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = S.music ? 0.5 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = S.sfx ? 0.9 : 0; sfxBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export const unlock = () => { ensure(); };

function tone(t, f, dur, type = 'sine', vol = 0.2, bus = musicBus, attack = 0.02, slideTo = null) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol = 0.1, hp = 6000, bus = musicBus) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t);
}
const pad = (t, notes, dur, vol = 0.07, type = 'triangle') => notes.forEach((m, i) => { tone(t, hz(m), dur, type, vol, musicBus, dur * 0.35); tone(t, hz(m) * 1.004, dur, 'sine', vol * 0.7, musicBus, dur * 0.4); });

// each scene: { bpm, play(stepIndex, time, beat) } — one step = one beat
const SCENES = {
  lobby: { bpm: 70, play: (i, t, b) => { // calm and mysterious: A minor pads + sparse bell notes
    const ch = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59]][Math.floor(i / 4) % 4];
    if (i % 4 === 0) pad(t, ch, b * 4.2, 0.06);
    const bells = [76, 79, 81, 72, 83]; if (i % 2 === 1 && Math.random() < 0.6) tone(t, hz(bells[Math.floor(Math.random() * 5)]), b * 2.5, 'sine', 0.05);
  } },
  night: { bpm: 56, play: (i, t, b) => { // suspense: low drone, heartbeat, distant dissonance
    if (i % 8 === 0) { tone(t, hz(33), b * 8.3, 'sawtooth', 0.045, musicBus, 1.2); tone(t, hz(40), b * 8.3, 'sine', 0.08, musicBus, 1.5); }
    if (i % 2 === 0) { tone(t, 55, 0.18, 'sine', 0.22, musicBus, 0.005, 38); tone(t + 0.22, 52, 0.16, 'sine', 0.14, musicBus, 0.005, 36); }
    if (i % 8 === 5) { tone(t, hz(81), b * 3, 'sine', 0.035, musicBus, 0.6); tone(t, hz(87), b * 3, 'sine', 0.03, musicBus, 0.8); }
  } },
  day: { bpm: 84, play: (i, t, b) => { // soft discussion background
    const ch = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]][Math.floor(i / 4) % 4];
    if (i % 4 === 0) pad(t, ch.slice(0, 3), b * 4, 0.045);
    tone(t, hz(ch[i % 4] + 12), b * 1.4, 'triangle', 0.045, musicBus, 0.01);
  } },
  vote: { bpm: 126, play: (i, t, b) => { // exciting countdown: pulse bass, hats, rising arpeggio
    const root = [45, 45, 48, 43][Math.floor(i / 8) % 4];
    tone(t, hz(root), b * 0.9, 'sawtooth', 0.07, musicBus, 0.005);
    if (i % 2 === 0) tone(t, 70, 0.14, 'sine', 0.25, musicBus, 0.003, 40);
    noise(t + b / 2, 0.05, 0.05);
    tone(t, hz(root + 24 + [0, 3, 7, 10][i % 4]), b * 0.5, 'square', 0.025, musicBus, 0.005);
  } },
  win: { bpm: 132, play: (i, t, b) => { // victory: bright major arpeggios and chord stabs
    const arp = [72, 76, 79, 84, 79, 76, 72, 67], root = [60, 65, 67, 60][Math.floor(i / 8) % 4];
    tone(t, hz(arp[i % 8] + (Math.floor(i / 8) % 4 === 1 ? 5 : 0)), b * 0.8, 'triangle', 0.09, musicBus, 0.005);
    if (i % 4 === 0) { [0, 4, 7].forEach((x) => tone(t, hz(root + x), b * 1.8, 'square', 0.03, musicBus, 0.01)); noise(t, 0.08, 0.06, 4000); }
  } },
};

function pump() {
  if (!ctx || !scene) return;
  const sc = SCENES[scene], beat = 60 / sc.bpm;
  while (nextT < ctx.currentTime + 0.35) { try { sc.play(step, nextT, beat); } catch {} step++; nextT += beat; }
}
export function playMusic(name) {
  if (name === scene) return;
  scene = name; step = 0;
  if (timer) { clearInterval(timer); timer = null; }
  if (!name) return;
  if (!ensure()) return;
  nextT = ctx.currentTime + 0.1; pump(); timer = setInterval(pump, 120);
}
export function stopAll() { scene = null; if (timer) { clearInterval(timer); timer = null; } }

export function sfx(name) {
  if (!S.sfx || !ensure()) return; const t = ctx.currentTime + 0.01;
  if (name === 'click') { tone(t, 720, 0.07, 'triangle', 0.18, sfxBus, 0.003, 520); }
  else if (name === 'tick') { tone(t, 980, 0.06, 'square', 0.1, sfxBus, 0.002); }
  else if (name === 'night') { tone(t, 660, 1.1, 'sine', 0.2, sfxBus, 0.02, 165); tone(t + 0.1, 440, 1.1, 'triangle', 0.1, sfxBus, 0.02, 110); }
  else if (name === 'day') { [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.1, hz(m), 0.6, 'triangle', 0.15, sfxBus, 0.01)); }
  else if (name === 'vote') { tone(t, hz(88), 0.25, 'sine', 0.2, sfxBus, 0.004); tone(t + 0.16, hz(95), 0.4, 'sine', 0.2, sfxBus, 0.004); }
  else if (name === 'win') { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => { tone(t + i * 0.11, hz(m), 0.5, 'square', 0.1, sfxBus, 0.005); tone(t + i * 0.11, hz(m - 12), 0.5, 'triangle', 0.1, sfxBus, 0.005); }); noise(t + 0.7, 0.4, 0.08, 3000, sfxBus); }
  else if (name === 'lose') { [64, 60, 57, 52].forEach((m, i) => tone(t + i * 0.2, hz(m), 0.6, 'sawtooth', 0.09, sfxBus, 0.01)); }
  else if (name === 'error') { tone(t, 180, 0.2, 'sawtooth', 0.12, sfxBus, 0.005); }
  else if (name === 'msg') { tone(t, hz(84), 0.12, 'sine', 0.08, sfxBus, 0.003); }
}

export function setMusic(on) { S.music = !!on; if (musicBus) musicBus.gain.setTargetAtTime(S.music ? 0.5 : 0, ctx.currentTime, 0.05); save(); }
export function setSfx(on) { S.sfx = !!on; if (sfxBus) sfxBus.gain.setTargetAtTime(S.sfx ? 0.9 : 0, ctx.currentTime, 0.05); save(); }
export function setVolume(v) { S.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.setTargetAtTime(S.vol, ctx.currentTime, 0.05); save(); }
