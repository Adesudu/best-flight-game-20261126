// Ridgeline Run — the aircraft: position, speed, throttle, fuel, lives and the
// collision rules. The plane flies the course; the camera sits just behind it.
import { COURSE, PLANE, SCORE } from './config.js';
import { clamp as clampNum, damp } from './random.js';

const SEG = COURSE.segmentLength;

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_FUEL = 2;
export const EVENT_NEAR_MISS = 4;
export const EVENT_CRASH = 8;
export const EVENT_LANDED = 16;
export const EVENT_CHECKPOINT = 32;
export const EVENT_COURSE_END = 64;

export class Plane {
  constructor(course) {
    this.course = course;
    this.reset(0);
  }

  reset(z) {
    const course = this.course;
    this.z = z;
    this.x = course.centerXAt(z);
    this.altitude = 26;
    this.speed = 0;
    this.throttle = 0.62;
    this.bank = 0;
    this.pitch = 0;
    this.fuel = PLANE.fuelCapacity;
    this.lives = PLANE.lives;
    this.score = 0;
    this.ringsCollected = 0;
    this.fuelRingsCollected = 0;
    this.nearMisses = 0;
    this.checkpointZ = 0;
    this.checkpointScore = 0;
    this.engineOut = false;
    this.landed = false;
    this.crashed = false;
    this.distanceFlown = 0;
    this.time = 0;
    this.shake = 0;
  }

  /** Respawn after a crash at the last checkpoint, keeping the score it held then. */
  respawn() {
    const course = this.course;
    this.z = this.checkpointZ;
    this.x = course.centerXAt(this.z);
    this.altitude = 60;
    this.speed = PLANE.cruiseSpeed * 0.55;
    this.throttle = 0.62;
    this.bank = 0;
    this.pitch = 0;
    this.fuel = Math.max(this.fuel, 34);
    this.engineOut = false;
    this.crashed = false;
    this.landed = false;
    this.shake = 0;
  }

  /**
   * Advance the plane one step. `input` is { steer: -1..1, pitch: -1..1,
   * boost, brake } and `fuelDrain` scales the mission's thirst.
   * Returns a bitmask of events (EVENT_*).
   */
  update(dt, input, fuelDrain) {
    let events = EVENT_NONE;
    if (this.landed || this.crashed) return events;
    this.time += dt;

    // Throttle: boost pushes toward max speed, brake toward a slow crawl,
    // otherwise the throttle setting holds cruise.
    const targetSpeed = input.boost
      ? PLANE.maxSpeed
      : input.brake
        ? PLANE.minSpeed
        : PLANE.cruiseSpeed * (0.55 + this.throttle * 0.6);
    const accel = input.boost ? PLANE.boostAccel : input.brake ? PLANE.brakeAccel : PLANE.accel;
    this.speed = damp(this.speed, this.engineOut ? 0 : targetSpeed, accel / PLANE.maxSpeed, dt);
    this.speed = clampNum(this.speed, 0, PLANE.maxSpeed);

    // Steering: bank follows the stick, and the plane slides sideways with it.
    const targetBank = input.steer * PLANE.maxBank;
    this.bank = damp(this.bank, targetBank, 5.5, dt);
    const turnAuthority = 0.35 + 0.65 * (this.speed / PLANE.maxSpeed);
    this.x += this.bank * PLANE.steerRate * turnAuthority * dt;

    // Pitch: up on the stick climbs, down descends; climbing bleeds a little speed.
    const targetPitch = input.pitch * PLANE.maxPitch;
    this.pitch = damp(this.pitch, targetPitch, 4.5, dt);
    const climb = this.pitch > 0 ? PLANE.climbRate : PLANE.sinkRate;
    this.altitude += this.pitch * climb * dt;
    if (this.pitch > 0.12) this.speed -= this.pitch * 26 * dt;

    // Fuel: cruise burns steadily, boost burns more, and an empty tank kills the engine.
    const burn = PLANE.fuelDrain * fuelDrain * (input.boost ? PLANE.fuelBoostDrain : 1);
    this.fuel -= burn * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.engineOut = true;
    }
    if (this.engineOut) {
      // No power: the nose drops and the plane glides down.
      this.altitude -= 26 * dt;
      this.pitch = damp(this.pitch, -0.12, 3, dt);
    }

    const prevZ = this.z;
    this.z += this.speed * dt;
    this.distanceFlown += this.speed * dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);

    // Rings: crossing a ring's plane scores it when the plane is inside the hoop.
    for (const ring of this.course.rings) {
      if (ring.taken || ring.passed) continue;
      const ringZ = ring.segment * SEG;
      if (prevZ < ringZ && this.z >= ringZ) {
        ring.passed = true;
        const ringX = this.course.centerXAt(ringZ) + ring.dx;
        const ringY = this.course.groundYAt(ringZ) + ring.dy;
        const planeY = this.course.groundYAt(this.z) + this.altitude;
        const dx = this.x - ringX;
        const dy = planeY - ringY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= PLANE.ringRadius) {
          ring.taken = true;
          this.ringsCollected += 1;
          if (ring.kind === 'fuel') {
            this.fuelRingsCollected += 1;
            this.fuel = clampNum(this.fuel + PLANE.fuelRingRefill, 0, PLANE.fuelCapacity);
            this.score += SCORE.fuelRing;
            events |= EVENT_FUEL;
          } else {
            this.score += SCORE.ring;
            events |= EVENT_RING;
          }
          this.checkpointZ = ringZ;
          this.checkpointScore = this.score;
          events |= EVENT_CHECKPOINT;
        } else if (dist <= PLANE.nearMissRadius) {
          this.nearMisses += 1;
          this.score += SCORE.nearMiss;
          events |= EVENT_NEAR_MISS;
        }
      }
    }

    // Ground and flanks: the valley floor and the mountains are solid.
    const ground = this.course.groundUnder(this.x, this.z);
    const terrainY = this.course.groundYAt(this.z);
    const heightAboveGround = terrainY + this.altitude - ground;
    const onRunway = this.course.isRunwayAt(this.z);
    if (heightAboveGround <= PLANE.groundClearance) {
      if (onRunway && this.speed < 95 && Math.abs(this.bank) < 0.28 && this.altitude < 16) {
        this.landed = true;
        this.altitude = Math.max(this.altitude, 2);
        events |= EVENT_LANDED;
      } else {
        this.crashed = true;
        this.shake = 1;
        events |= EVENT_CRASH;
      }
    }

    // Ceiling: the sky has a limit, gently.
    if (this.altitude > 420) {
      this.altitude = 420;
      this.pitch = Math.min(this.pitch, 0);
    }
    if (this.altitude < 0) this.altitude = 0;

    // Course end: the valley runs out at the far runway.
    if (this.z >= this.course.length - SEG) {
      events |= EVENT_COURSE_END;
    }
    return events;
  }
}
