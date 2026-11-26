// Ridgeline Run — screenshot staging: each shot plays the real rules forward
// from a fresh world, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { COURSE } from './config.js';
import { Game, SCREEN_COUNTDOWN, SCREEN_PLAY, SCREEN_TITLE, SCREEN_RESULTS, SCREEN_OVER } from './game.js';
import { clamp } from './random.js';

const SEG = COURSE.segmentLength;
const STEP = 1 / 60;

/** Steer toward the next ring (or the valley centre) and hold its height. */
function autopilot(game, landing, gentle) {
  const plane = game.plane;
  const course = game.course;
  const ring = course.nextRing(plane.z);
  let targetX = course.centerXAt(plane.z + 400);
  let targetAlt = 85;
  if (ring) {
    const ringZ = ring.segment * SEG;
    const ahead = ringZ - plane.z;
    if (ahead < 2600) {
      targetX = course.centerXAt(ringZ) + ring.dx;
      targetAlt = ring.dy + 4;
    }
  }
  if (landing) {
    targetX = course.centerXAt(plane.z + 300);
    targetAlt = Math.max(26, plane.altitude - 14);
  }
  const steerGain = gentle ? 700 : 260;
  const pitchGain = gentle ? 110 : 55;
  const steer = clamp((targetX - plane.x) / steerGain, -1, 1);
  const pitch = clamp((targetAlt - plane.altitude) / pitchGain, -1, 1);
  const boost = !landing && plane.speed < 150;
  const brake = landing;
  return { steer, pitch, boost, brake };
}

/** Run the game forward `seconds` of simulated time with the autopilot. */
function simulate(game, seconds, landing, gentle) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen !== SCREEN_PLAY && game.screen !== SCREEN_COUNTDOWN) break;
    if (game.screen === SCREEN_COUNTDOWN) {
      game.countdown -= STEP;
      if (game.countdown <= 0) game.screen = SCREEN_PLAY;
      continue;
    }
    game.elapsed += STEP;
    const input = autopilot(game, landing, gentle);
    const events = game.plane.update(STEP, input, game.mission.fuelDrain);
    if (game.plane.crashed) {
      if (game.plane.lives > 0) {
        game.plane.lives -= 1;
        game.plane.respawn();
      } else {
        game.screen = SCREEN_OVER;
        break;
      }
    }
    if (game.plane.landed) {
      game.finishMission(true, true);
      break;
    }
    if (events & 64) {
      game.finishMission(true, false);
      break;
    }
  }
}

/** Run until the next ring is close (or the time cap), so it looms in frame. */
function simulateUntilRingClose(game, minSeconds, maxSeconds, closeDist) {
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen !== SCREEN_PLAY && game.screen !== SCREEN_COUNTDOWN) break;
    if (game.screen === SCREEN_COUNTDOWN) {
      game.countdown -= STEP;
      if (game.countdown <= 0) game.screen = SCREEN_PLAY;
      continue;
    }
    game.elapsed += STEP;
    const input = autopilot(game, false, false);
    const events = game.plane.update(STEP, input, game.mission.fuelDrain);
    if (game.plane.crashed) {
      if (game.plane.lives > 0) {
        game.plane.lives -= 1;
        game.plane.respawn();
      } else {
        game.screen = SCREEN_OVER;
        break;
      }
    }
    if (game.plane.landed) {
      game.finishMission(true, true);
      break;
    }
    if (events & 64) {
      game.finishMission(true, false);
      break;
    }
    const ring = game.course.nextRing(game.plane.z);
    if (ring && game.elapsed >= minSeconds) {
      const ringZ = ring.segment * SEG;
      if (ringZ - game.plane.z < closeDist) break;
    }
  }
}

/**
 * Set `game` to the named scene (start, play, land, end) and return the
 * screen to draw over it. Any other name is the title.
 */
export function stageShot(name, game) {
  if (name === 'play') {
    game.selectMission(0);
    game.startMission();
    game.screen = SCREEN_PLAY;
    // Fly until a ring looms close ahead, then settle the bank for the frame.
    simulateUntilRingClose(game, 12, 42, 950);
    simulate(game, 1.4, false, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'land') {
    game.selectMission(1);
    game.startMission();
    game.screen = SCREEN_PLAY;
    // Stage an approach: just short of the far runway, low and slow.
    const approachZ = (game.course.count - COURSE.runwayEndSegments - 3) * SEG;
    game.plane.z = approachZ;
    game.plane.x = game.course.centerXAt(approachZ);
    game.plane.altitude = 42;
    game.plane.speed = 86;
    game.plane.throttle = 0.5;
    simulate(game, 1.6, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    game.selectMission(0);
    game.startMission();
    game.screen = SCREEN_PLAY;
    simulate(game, 320, false);
    if (game.screen !== SCREEN_RESULTS && game.screen !== SCREEN_OVER) {
      // The autopilot ran out of valley without finishing: call it a sortie.
      game.finishMission(false, false);
    }
    return { screen: game.screen };
  }
  // start: the title over the runway, the plane sitting at the threshold.
  game.selectMission(0);
  game.attract.z = 0;
  game.attract.x = game.course.centerXAt(0);
  game.attract.altitude = 34;
  game.attract.speed = 0;
  game.attract.bank = 0;
  game.attract.pitch = 0;
  game.screen = SCREEN_TITLE;
  return { screen: SCREEN_TITLE };
}
