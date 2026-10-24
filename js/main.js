// Flow: intro -> scratch -> revealed. Replay returns to intro.

import { ScratchCard } from './scratch.js';
import { Fx } from './fx.js';
import { sound } from './sound.js';
import { nextAthensMidnight, splitDuration } from './countdown.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.querySelector('.stage');
const cardFloat = document.querySelector('.card-float');
const card = document.querySelector('.card');
const muteButton = document.querySelector('.mute');
const countdown = document.querySelector('.countdown');
const units = Object.fromEntries([...countdown.querySelectorAll('[data-unit]')].map((el) => [el.dataset.unit, el]));

const fx = new Fx(document.querySelector('.fx'), { reducedMotion });
const scratch = new ScratchCard(document.querySelector('.foil'), {
  onFirstScratch: () => stage.classList.add('has-scratched'),
  onScratch: ({ x, y, dx, dy, speed }) => {
    fx.flakes(x, y, dx, dy);
    sound.scratch(speed);
  },
  onScratchEnd: () => sound.scratchStop(),
  onReveal: reveal,
});

let countdownTimer = 0;

function setState(state) {
  stage.dataset.state = state;
  placeScene();
}

// Put the sun right behind the card and the horizon just under it,
// so the text below the card always sits on the dark floor.
function placeScene() {
  const rect = document.querySelector('.card-wrap').getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty('--horizon-y', `${Math.round(rect.bottom + 14)}px`);
  root.setProperty('--sun-x', `${Math.round(rect.left + rect.width / 2)}px`);
  root.setProperty('--sun-size', `${Math.round(rect.width * 1.25)}px`);
}

function open() {
  if (stage.dataset.state !== 'intro') return;
  sound.unlock();
  sound.open();
  document.body.classList.add('is-unlocked');
  settleCard();
  setState('scratch');
  scratch.enable();
}

// Freeze the floating card mid-motion, then ease it flat so the finger lines up with the foil.
function settleCard() {
  const pose = getComputedStyle(cardFloat).transform;
  cardFloat.style.transform = pose === 'none' ? '' : pose;
  cardFloat.style.animation = 'none';
  cardFloat.getBoundingClientRect();
  cardFloat.style.transition = 'transform .6s cubic-bezier(.2, .8, .2, 1)';
  cardFloat.style.transform = 'none';
}

function reveal() {
  sound.reveal();
  setState('revealed');
  const rect = card.getBoundingClientRect();
  fx.shatter(rect);
  fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  fx.rain(70, 3500);
  startCountdown();
}

function startCountdown() {
  stopCountdown();
  countdown.classList.remove('is-birthday');
  const target = nextAthensMidnight();
  const tick = () => {
    const left = target - Date.now();
    if (left <= 0) {
      stopCountdown();
      celebrateBirthday();
      return;
    }
    const parts = splitDuration(left);
    for (const unit of ['h', 'm', 's']) units[unit].textContent = String(parts[unit]).padStart(2, '0');
  };
  tick();
  countdownTimer = setInterval(tick, 250);
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = 0;
}

function celebrateBirthday() {
  countdown.classList.add('is-birthday');
  sound.birthday();
  const rect = countdown.getBoundingClientRect();
  fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 160);
  fx.rain(120, 5000);
}

function replay() {
  stopCountdown();
  fx.clear();
  resetTilt();
  stage.classList.remove('has-scratched');
  cardFloat.removeAttribute('style');
  scratch.reset();
  setState('intro');
}

// After the reveal the card tilts under the finger like a holo trading card.
function tilt(e) {
  if (stage.dataset.state !== 'revealed') return;
  const rect = card.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  card.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
  card.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
  card.style.setProperty('--gx', `${x * 100}%`);
  card.style.setProperty('--gy', `${y * 100}%`);
  card.classList.add('is-tilting');
}

function resetTilt() {
  card.classList.remove('is-tilting');
  for (const prop of ['--rx', '--ry', '--gx', '--gy']) card.style.removeProperty(prop);
}

document.querySelector('#open').addEventListener('click', open);
document.querySelector('#replay').addEventListener('click', replay);

// iOS suspends audio when the app is backgrounded; any touch on the card brings it back.
card.addEventListener('pointerdown', () => sound.unlock());
card.addEventListener('pointermove', tilt);
card.addEventListener('pointerleave', resetTilt);
card.addEventListener('pointerup', resetTilt);
card.addEventListener('pointercancel', resetTilt);

// Keyboard fallback: the card itself opens and reveals.
card.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  if (stage.dataset.state === 'intro') open();
  else if (stage.dataset.state === 'scratch') scratch.reveal();
});

muteButton.addEventListener('click', () => {
  const muted = !sound.muted;
  sound.setMuted(muted);
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Ενεργοποίηση ήχου' : 'Σίγαση ήχου');
});

// Draw the foil only once its fonts are in, and keep the page hidden until then
// so the prize never flashes on screen.
async function init() {
  const fonts = Promise.all([
    document.fonts.load('italic 800 40px "Advent Pro"', 'ΞΥΣΕ'),
    document.fonts.load('800 16px Manrope', 'ΔΩΡΟ'),
  ]);
  await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]).catch(() => {});
  scratch.init();
  placeScene();
  document.body.classList.add('is-ready');
}

window.addEventListener('resize', placeScene);
document.fonts.addEventListener('loadingdone', placeScene);

init();
