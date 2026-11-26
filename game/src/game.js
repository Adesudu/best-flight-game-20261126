// Ridgeline Run — the game itself: screens, missions, scoring, messages and
// the rules that turn flying into a result. One Game owns a Course, a Plane
// and the state machine between them.
import { MISSIONS, SCORE, COURSE } from './config.js';
import { Course } from './terrain.js';
import { Plane, EVENT_RING, EVENT_FUEL, EVENT_NEAR_MISS, EVENT_CRASH, EVENT_LANDED, EVENT_COURSE_END } from './plane.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_MISSIONS = 'missions';
export const SCREEN_COUNTDOWN = 'countdown';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_RESULTS = 'results';
export const SCREEN_OVER = 'over';

const SEG = COURSE.segmentLength;

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.missionIndex = 0;
    this.mission = MISSIONS[0];
    this.course = new Course(seed, this.mission);
    this.plane = new Plane(this.course);
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.elapsed = 0;
    this.countdown = 0;
    this.messages = [];
    this.resultTitle = '';
    this.resultScore = { rings: 0, timeBonus: 0, landing: 0 };
    this.crashTimer = 0;
    this.attract = new Plane(this.course);
    this.attract.z = 0;
    this.attract.speed = 110;
    this.attract.altitude = 90;
  }

  selectMission(index) {
    this.missionIndex = (index + MISSIONS.length) % MISSIONS.length;
    this.mission = MISSIONS[this.missionIndex];
    this.course = new Course(this.seed, this.mission);
    this.plane = new Plane(this.course);
    this.attract = new Plane(this.course);
    this.attract.speed = 110;
    this.attract.altitude = 90;
  }

  startMission() {
    this.course = new Course(this.seed, this.mission);
    this.plane = new Plane(this.course);
    this.elapsed = 0;
    this.messages = [];
    this.resultScore = { rings: 0, timeBonus: 0, landing: 0 };
    this.countdown = 3.2;
    this.screen = SCREEN_COUNTDOWN;
    this.say(`${this.mission.name} — ${this.mission.goal}`, '#7dffa8', 3.2);
  }

  say(text, color, ttl) {
    this.messages.push({ text, color: color || '#eef4ff', ttl: ttl || 2.2 });
    if (this.messages.length > 3) this.messages.shift();
  }

  heading() {
    const z = this.plane.z;
    const ahead = this.course.centerXAt(Math.min(z + 260, this.course.length - 1));
    const here = this.course.centerXAt(z);
    const deg = 90 - (Math.atan2(ahead - here, 260) * 180) / Math.PI;
    return ((Math.round(deg) % 360) + 360) % 360;
  }

  nextRingInfo() {
    const ring = this.course.nextRing(this.plane.z);
    if (!ring) return null;
    const ringZ = ring.segment * SEG;
    const ringX = this.course.centerXAt(ringZ) + ring.dx;
    const ringY = this.course.groundYAt(ringZ) + ring.dy;
    const planeY = this.course.groundYAt(this.plane.z) + this.plane.altitude;
    const dx = ringX - this.plane.x;
    const dy = ringY - planeY;
    const dz = ringZ - this.plane.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      kind: ring.kind,
      dist,
      screenX: 640 + clamp(dx * 0.35, -560, 560),
    };
  }

  resultLines() {
    const p = this.plane;
    const plainRings = p.ringsCollected - p.fuelRingsCollected;
    const lines = [
      ['Rings flown', `${plainRings} × ${SCORE.ring}  =  ${plainRings * SCORE.ring}`],
      ['Near misses', `${p.nearMisses} × ${SCORE.nearMiss}  =  ${p.nearMisses * SCORE.nearMiss}`],
      ['Fuel rings', `${p.fuelRingsCollected} × ${SCORE.fuelRing}  =  ${p.fuelRingsCollected * SCORE.fuelRing}`],
    ];
    if (this.resultScore.timeBonus > 0) lines.push(['Time bonus', `+ ${this.resultScore.timeBonus}`]);
    if (this.resultScore.landing > 0) lines.push(['Landing bonus', `+ ${this.resultScore.landing}`]);
    lines.push(['Distance flown', `${Math.round(p.distanceFlown).toLocaleString()} m`]);
    return lines;
  }

  finishMission(win, landed) {
    const p = this.plane;
    const target = this.mission.id === 'rings' ? p.ringsCollected >= this.mission.rings : true;
    const timeBonus = win ? Math.max(0, Math.round((300 - this.elapsed) * SCORE.timeBonusPerSecond * 0.1)) : 0;
    const landingBonus = landed ? SCORE.landing : 0;
    p.score += timeBonus + landingBonus;
    this.resultScore = { rings: p.ringsCollected * SCORE.ring, timeBonus, landing: landingBonus };
    this.resultTitle = win && target ? this.mission.winText : 'SORTIE COMPLETE';
    if (this.mission.id === 'rings' && p.ringsCollected < this.mission.rings) {
      this.resultTitle = `RINGS ${p.ringsCollected}/${this.mission.rings} — SO CLOSE`;
    }
    this.screen = SCREEN_RESULTS;
  }

  update(dt, input, sound) {
    this.time += dt;
    for (const m of this.messages) m.ttl -= dt;
    this.messages = this.messages.filter((m) => m.ttl > 0);

    if (this.screen === SCREEN_TITLE || this.screen === SCREEN_MISSIONS) {
      // Attract mode: the camera drifts down the valley on its own.
      this.attract.z += 46 * dt;
      if (this.attract.z > this.course.length - 4000) this.attract.z = 0;
      this.attract.altitude = 95 + Math.sin(this.time * 0.25) * 26;
      this.attract.bank = Math.sin(this.time * 0.4) * 0.22;
      this.attract.pitch = Math.cos(this.time * 0.3) * 0.05;
      this.attract.x = this.course.centerXAt(this.attract.z);
      return;
    }
    if (this.screen === SCREEN_COUNTDOWN) {
      this.countdown -= dt;
      if (this.countdown <= 0) this.screen = SCREEN_PLAY;
      return;
    }
    if (this.screen !== SCREEN_PLAY) return;

    this.elapsed += dt;
    const axis = input.axis();
    const events = this.plane.update(dt, axis, this.mission.fuelDrain);
    if (sound) sound.setEngine(this.plane.speed / 210, true);

    if (events & EVENT_RING) {
      this.say(`RING  +${SCORE.ring}`, '#ffd23e', 1.6);
      if (sound) sound.ring();
    }
    if (events & EVENT_FUEL) {
      this.say(`FUEL  +${SCORE.fuelRing}  •  TANK TOPPED UP`, '#3ddc78', 1.8);
      if (sound) sound.fuel();
    }
    if (events & EVENT_NEAR_MISS) {
      this.say(`NEAR MISS  +${SCORE.nearMiss}`, '#ffc46b', 1.4);
    }
    if (events & EVENT_CRASH) {
      this.plane.lives -= 1;
      if (sound) sound.crash();
      if (this.plane.lives > 0) {
        this.say(`CRASH — ${this.plane.lives} ${this.plane.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, '#ff6b5e', 2.4);
        this.plane.respawn();
      } else {
        this.screen = SCREEN_OVER;
        if (sound) sound.setEngine(0, false);
      }
      return;
    }
    if (events & EVENT_LANDED) {
      if (sound) sound.land();
      this.say('TOUCHDOWN — BEAUTIFUL LANDING', '#7dffa8', 2.6);
      this.finishMission(true, true);
      return;
    }
    if (events & EVENT_COURSE_END) {
      const win = this.mission.id !== 'rings' || this.plane.ringsCollected >= 6;
      this.finishMission(win, false);
    }
  }

  /** The plane the renderer follows: the real one in play, the attract one on menus. */
  get viewPlane() {
    return this.screen === SCREEN_TITLE || this.screen === SCREEN_MISSIONS ? this.attract : this.plane;
  }
}
