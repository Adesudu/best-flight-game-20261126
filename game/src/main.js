// Ridgeline Run — bootstrap: canvas, the fixed-step loop, input and sound wiring,
// and the ?shot= staging mode the screenshots are taken from.
import { VIEW, MISSIONS } from './config.js';
import { Game, SCREEN_TITLE, SCREEN_MISSIONS, SCREEN_COUNTDOWN, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_RESULTS, SCREEN_OVER } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new SoundFX();
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shotName = params.get('shot');
const game = new Game(seed);
// A handle for tests and the curious: window.__ridgeline.
window.__ridgeline = game;

function resize() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

// The attract plane is what the menu screens fly over; keep it inside the valley.
function renderFrame() {
  const w = VIEW.width;
  const h = VIEW.height;
  ctx.clearRect(0, 0, w, h);
  const plane = game.viewPlane;
  renderer.drawScene(ctx, w, h, { course: game.course, plane, time: game.time });
  if (game.screen === SCREEN_PLAY || game.screen === SCREEN_COUNTDOWN) {
    renderer.drawHUD(ctx, w, h, game);
    if (game.screen === SCREEN_COUNTDOWN) {
      renderer.drawCountdown(ctx, w, h, Math.max(1, Math.ceil(game.countdown)));
    }
  } else if (game.screen === SCREEN_TITLE) {
    renderer.drawTitle(ctx, w, h, game.time);
  } else if (game.screen === SCREEN_MISSIONS) {
    renderer.drawMissions(ctx, w, h, MISSIONS, game.missionIndex);
  } else if (game.screen === SCREEN_PAUSE) {
    renderer.drawHUD(ctx, w, h, game);
    renderer.drawPause(ctx, w, h);
  } else if (game.screen === SCREEN_RESULTS) {
    renderer.drawHUD(ctx, w, h, game);
    renderer.drawResults(ctx, w, h, game);
  } else if (game.screen === SCREEN_OVER) {
    renderer.drawGameOver(ctx, w, h, game);
  }
}

function handleKeys() {
  if (input.wasPressed('Enter')) {
    sound.ensure();
    if (game.screen === SCREEN_TITLE) game.screen = SCREEN_MISSIONS;
    else if (game.screen === SCREEN_MISSIONS) game.startMission();
    else if (game.screen === SCREEN_RESULTS || game.screen === SCREEN_OVER) game.screen = SCREEN_MISSIONS;
  }
  if (input.consumeClick()) {
    sound.ensure();
    if (game.screen === SCREEN_TITLE) game.screen = SCREEN_MISSIONS;
    else if (game.screen === SCREEN_MISSIONS) game.startMission();
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSE;
    else if (game.screen === SCREEN_PAUSE) game.screen = SCREEN_PLAY;
  }
  if (input.wasPressed('KeyM')) {
    sound.ensure();
    const muted = sound.toggleMute();
    game.say(muted ? 'SOUND OFF' : 'SOUND ON', '#9fb2cc', 1.2);
  }
  if (input.wasPressed('KeyR')) {
    if (game.screen === SCREEN_PLAY || game.screen === SCREEN_PAUSE || game.screen === SCREEN_RESULTS || game.screen === SCREEN_OVER) {
      game.startMission();
    }
  }
  if (game.screen === SCREEN_MISSIONS) {
    if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) game.selectMission(game.missionIndex - 1);
    if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) game.selectMission(game.missionIndex + 1);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleKeys();
  game.update(dt, input, sound);
  renderer.updateParticles(dt);
  renderFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Staging mode: build the named scene once, draw it, and stop. The
  // screenshot tool waits for window.__shotReady before capturing.
  const staged = stageShot(shotName, game);
  game.screen = staged.screen;
  renderFrame();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
