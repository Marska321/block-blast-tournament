// Video-based interaction: the recorded board follows an authored sequence.
// Change these boundaries when replacing the source edit.
const CUTS = { holdStart: 2.4, holdEnd: 4.9, flavours: {
  gem: { start: 2.4, end: 4.9 },
  jelly: { start: 5.4, end: 7.9 },
  cupcake: { start: 8.4, end: 10.9 },
} };
const ad = document.querySelector('.ad');
const film = document.querySelector('#film');
const start = document.querySelector('#start');
const holdButton = document.querySelector('#hold-button');
const status = document.querySelector('#status');
const panels = [...document.querySelectorAll('.panel')];
const steps = [...document.querySelectorAll('.step-rail i')];
let state = 'ready', holding = false, segmentEnd = 0, selected = null, frame = 0;
let generation = 0, activePointer = null, resumeAfterVisibility = false;
const events = [];

function track(type, detail = {}) {
  const event = { type, ...detail, videoTime: Number(film.currentTime.toFixed(3)) };
  events.push(event);
  ad.dispatchEvent(new CustomEvent('playable:event', { bubbles: true, detail: event }));
}
function show(next, message = '') {
  state = next;
  ad.dataset.state = state;
  for (const panel of panels) panel.hidden = panel.id !== next;
  document.querySelector('#playing-note').hidden = next !== 'flavour';
  const completed = { ready: 0, intro: 0, hold: 1, auto: 1, choose: 2, flavour: 2, end: 3 }[state] || 0;
  steps.forEach((step, i) => step.classList.toggle('done', i < completed));
  if (message) status.textContent = message;
}
function focus(id) { document.getElementById(id).focus({ preventScroll: true }); }
function releaseHold() {
  holding = false;
  activePointer = null;
  ad.dataset.holding = 'false';
  if (state === 'hold') film.pause();
}
function fail() {
  generation++;
  releaseHold();
  film.pause();
  show('error', 'The video could not play. Try again or open Blok Blaster.');
  focus('retry');
}
async function play() {
  const attempt = generation;
  try { await film.play(); }
  catch (error) { if (attempt === generation && error.name !== 'AbortError') fail(); }
  // A release can happen while the browser is waiting for a buffered frame.
  if (state === 'hold' && !holding) film.pause();
}
function toChoice() {
  releaseHold();
  film.pause();
  film.currentTime = CUTS.holdEnd;
  show('choose', 'Choose Gem, Jelly, or Cupcake to see your favourite style.');
  track('choice_shown');
  document.querySelector('[data-flavour]').focus({ preventScroll: true });
}
function finish() {
  film.pause();
  releaseHold();
  show('end', 'Ready for more? Play Blok Blaster free in your browser.');
  track('complete', { flavour: selected });
  focus('cta');
}
function tick() {
  if (state === 'intro' && film.currentTime >= CUTS.holdStart) {
    film.pause(); film.currentTime = CUTS.holdStart;
    show('hold', 'Hold the button or hold Space to play. Release to pause.');
    track('hold_shown'); focus('hold-button');
  } else if ((state === 'hold' || state === 'auto') && film.currentTime >= CUTS.holdEnd) {
    toChoice();
  } else if (state === 'flavour' && film.currentTime >= segmentEnd) {
    finish();
  }
  ad.style.setProperty('--held', Math.min(1, Math.max(0, (film.currentTime - CUTS.holdStart) / (CUTS.holdEnd - CUTS.holdStart))));
  frame = requestAnimationFrame(tick);
}
function begin() {
  generation++;
  releaseHold(); film.pause(); film.currentTime = 0; selected = null;
  ad.style.setProperty('--held', 0);
  show('intro', 'Your little break is starting.'); track('start'); play();
}
function hold() {
  if (state !== 'hold' || holding) return;
  holding = true; ad.dataset.holding = 'true'; track('hold_start'); play();
}
start.addEventListener('click', begin);
document.querySelector('#replay').addEventListener('click', begin);
document.querySelector('#retry').addEventListener('click', () => {
  show('ready', 'Loading video.'); start.disabled = true;
  film.load();
});
holdButton.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || state !== 'hold') return;
  event.preventDefault(); holdButton.focus();
  activePointer = event.pointerId; holdButton.setPointerCapture(event.pointerId); hold();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  holdButton.addEventListener(name, event => {
    if (activePointer === event.pointerId) { track('hold_release'); releaseHold(); }
  });
}
holdButton.addEventListener('keydown', event => {
  if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); if (!event.repeat) hold(); }
});
holdButton.addEventListener('keyup', event => {
  if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); releaseHold(); }
});
holdButton.addEventListener('blur', releaseHold);
function watch() {
  if (state !== 'hold') return;
  releaseHold(); show('auto', 'Watching the gem style. Choose your flavour next.'); track('watch_instead'); play();
}
// Screen-reader generated clicks need an alternative to a sustained gesture.
holdButton.addEventListener('click', event => { if (event.detail === 0 && !holding) watch(); });
document.querySelector('#watch').addEventListener('click', watch);
for (const button of document.querySelectorAll('[data-flavour]')) {
  button.addEventListener('click', () => {
    if (state !== 'choose') return;
    selected = button.dataset.flavour;
    const cut = CUTS.flavours[selected]; segmentEnd = cut.end;
    film.currentTime = cut.start;
    show('flavour', `Showing the ${selected} style.`);
    document.querySelector('#playing-note').textContent = `${button.textContent.trim()}. A little more you.`;
    track('flavour_selected', { flavour: selected }); play();
  });
}
document.querySelector('#sound').addEventListener('click', event => {
  film.muted = !film.muted;
  event.currentTarget.textContent = film.muted ? 'Sound off' : 'Sound on';
  event.currentTarget.setAttribute('aria-label', film.muted ? 'Turn sound on' : 'Turn sound off');
  event.currentTarget.setAttribute('aria-pressed', String(!film.muted));
  track('sound', { enabled: !film.muted });
});
document.querySelector('#cta').addEventListener('click', () => track('cta_click', { flavour: selected }));
film.addEventListener('canplay', () => { start.disabled = false; start.textContent = 'Tap to play ↗'; });
film.addEventListener('error', fail);
film.addEventListener('ended', () => { if (state !== 'end') finish(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeAfterVisibility = ['intro', 'auto', 'flavour'].includes(state) && !film.paused;
    releaseHold(); film.pause();
  } else if (resumeAfterVisibility) { resumeAfterVisibility = false; play(); }
});
window.addEventListener('blur', () => { if (state === 'hold') releaseHold(); });
window.addEventListener('pagehide', () => { releaseHold(); film.pause(); cancelAnimationFrame(frame); });
window.addEventListener('pageshow', event => { if (event.persisted) { cancelAnimationFrame(frame); tick(); } });
// Local inspection only. No analytics leaves the page unless a host subscribes.
window.blokPlayable = { getState: () => ({ state, holding, selected, time: film.currentTime, paused: film.paused }), getEvents: () => structuredClone(events) };
if (film.readyState >= 3) { start.disabled = false; start.textContent = 'Tap to play ↗'; }
tick();
