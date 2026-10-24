// All sounds are synthesized with Web Audio, so there are no audio files to load.
// Browsers only allow audio after a tap, so unlock() runs from the "open" button.

let ctx = null;
let master = null;
let scratchGain = null;
let scratchFilter = null;
let scratchIdle = 0;
let muted = false;

const VOLUME = 0.9;

function noiseBuffer(seconds) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function voice(freq, start, { type = 'triangle', dur = 0.6, vol = 0.2, attack = 0.01, detune = 0, lowpass = 0 } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let node = osc;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    node = node.connect(filter);
  }
  node.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

// A detuned synth arpeggio, the "you won" sting.
function arpeggio(start, notes, gap) {
  notes.forEach((freq, i) => {
    const t = start + i * gap;
    voice(freq, t, { type: 'sawtooth', dur: 1.4, vol: 0.05, detune: -8, lowpass: 2600 });
    voice(freq, t, { type: 'sawtooth', dur: 1.4, vol: 0.05, detune: 8, lowpass: 2600 });
  });
}

function sparkles(start, count) {
  for (let i = 0; i < count; i++) {
    voice(2000 + Math.random() * 3000, start + i * 0.07, { type: 'sine', dur: 0.25, vol: 0.045 });
  }
}

export const sound = {
  get muted() {
    return muted;
  },

  unlock() {
    if (ctx) {
      ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    // Play even with the iPhone ringer switch on silent: the tap on "open" asked for it.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);

    // The scratch sound is filtered noise that runs constantly; its volume follows the finger.
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(2);
    noise.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 900;
    scratchFilter = ctx.createBiquadFilter();
    scratchFilter.type = 'bandpass';
    scratchFilter.frequency.value = 2600;
    scratchFilter.Q.value = 0.9;
    scratchGain = ctx.createGain();
    scratchGain.gain.value = 0;
    noise.connect(highpass).connect(scratchFilter).connect(scratchGain).connect(master);
    noise.start();
    ctx.resume();
  },

  // `speed` is finger speed in CSS pixels per millisecond.
  scratch(speed) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const level = Math.min(1, speed / 1.4);
    scratchGain.gain.setTargetAtTime(0.05 + level * 0.3, now, 0.03);
    scratchFilter.frequency.setTargetAtTime(1800 + level * 2200, now, 0.05);
    // A finger resting on the card sends no moves, so fall silent on our own.
    clearTimeout(scratchIdle);
    scratchIdle = setTimeout(() => sound.scratchStop(), 100);
  },

  scratchStop() {
    if (!ctx) return;
    clearTimeout(scratchIdle);
    scratchGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  },

  open() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = noiseBuffer(0.6);
    const sweep = ctx.createBiquadFilter();
    sweep.type = 'lowpass';
    sweep.frequency.setValueAtTime(400, t);
    sweep.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    whoosh.connect(sweep).connect(gain).connect(master);
    whoosh.start(t);
    voice(1046.5, t + 0.08, { type: 'sine', dur: 0.5, vol: 0.12 });
    voice(1568, t + 0.16, { type: 'sine', dur: 0.6, vol: 0.1 });
  },

  reveal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    voice(110, t, { type: 'sine', dur: 0.8, vol: 0.35, attack: 0.005 });
    arpeggio(t, [440, 554.37, 659.25, 880, 1108.73, 1318.51], 0.07);
    sparkles(t + 0.3, 10);
  },

  birthday() {
    if (!ctx) return;
    const t = ctx.currentTime;
    voice(98, t, { type: 'sine', dur: 1, vol: 0.35, attack: 0.005 });
    arpeggio(t, [392, 493.88, 587.33, 783.99], 0.09);
    arpeggio(t + 0.45, [523.25, 659.25, 783.99, 1046.5, 1318.51], 0.08);
    sparkles(t + 0.6, 14);
  },

  setMuted(value) {
    muted = value;
    if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05);
  },
};
