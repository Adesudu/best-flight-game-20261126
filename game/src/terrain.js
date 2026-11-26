// Ridgeline Run — the valley: a seeded course of segments the renderer draws
// far-to-near, with a river, a runway at each end, mountains on the flanks and
// rings to fly through. All of it is a pure function of the seed.
import { COURSE, SCORE } from './config.js';
import { makeRng, clamp } from './random.js';

const SEG = COURSE.segmentLength;

export class Course {
  constructor(seed, mission) {
    this.seed = seed;
    this.mission = mission;
    this.rng = makeRng(seed);
    this.count = COURSE.segmentCount;
    this.length = this.count * SEG;
    this.segments = [];
    this.rings = [];
    this.build();
  }

  build() {
    const rng = this.rng;
    // Smooth valley shape: a few sines each, so the course bends and climbs gently
    // and never faster than the plane can follow.
    const curveWave = rng.wave([
      { freq: 0.011, amp: 620, phase: rng.range(0, 6.28) },
      { freq: 0.027, amp: 260, phase: rng.range(0, 6.28) },
      { freq: 0.061, amp: 90, phase: rng.range(0, 6.28) },
    ]);
    const hillWave = rng.wave([
      { freq: 0.008, amp: 150, phase: rng.range(0, 6.28) },
      { freq: 0.021, amp: 70, phase: rng.range(0, 6.28) },
    ]);
    const mountainWave = rng.wave([
      { freq: 0.013, amp: 1, phase: rng.range(0, 6.28) },
      { freq: 0.031, amp: 0.5, phase: rng.range(0, 6.28) },
    ]);

    for (let i = 0; i < this.count; i += 1) {
      const centerX = curveWave(i);
      const groundY = 40 + hillWave(i);
      // Flank height: high where the mountain wave peaks, low near the river.
      const flank = clamp((mountainWave(i) + 0.6) / 1.4, 0, 1);
      const mountainH = 60 + flank * 260;
      const runway =
        i < COURSE.runwayStartSegments || i >= this.count - COURSE.runwayEndSegments;
      const trees = [];
      if (!runway && rng.chance(0.55)) {
        const n = rng.int(1, 3);
        for (let t = 0; t < n; t += 1) {
          trees.push({
            dx: (rng.chance(0.5) ? -1 : 1) * rng.range(340, 820),
            size: rng.range(14, 30),
          });
        }
      }
      this.segments.push({
        index: i,
        centerX,
        groundY,
        mountainH,
        flank,
        runway,
        trees,
        ring: null,
      });
    }

    this.placeRings();
  }

  placeRings() {
    const mission = this.mission;
    const totalRings = mission.rings;
    const fuelRings = mission.fuelRings;
    const spanStart = 14;
    const spanEnd = this.count - COURSE.runwayEndSegments - 8;
    const step = (spanEnd - spanStart) / totalRings;
    const fuelEvery = Math.max(2, Math.floor(totalRings / fuelRings));
    for (let r = 0; r < totalRings; r += 1) {
      const segIndex = Math.floor(spanStart + step * r + step * 0.5);
      const seg = this.segments[segIndex];
      const kind = (r + 1) % fuelEvery === 0 ? 'fuel' : 'ring';
      const ring = {
        segment: segIndex,
        dx: this.rng.range(-560, 560),
        dy: this.rng.range(46, 150),
        kind,
        taken: false,
        passed: false,
      };
      seg.ring = ring;
      this.rings.push(ring);
    }
  }

  segmentAt(z) {
    const i = Math.floor(z / SEG);
    return this.segments[clamp(i, 0, this.count - 1)];
  }

  segmentIndexAt(z) {
    return clamp(Math.floor(z / SEG), 0, this.count - 1);
  }

  /** Valley-centre x at distance z, linearly interpolated between segments. */
  centerXAt(z) {
    const i = clamp(Math.floor(z / SEG), 0, this.count - 2);
    const f = (z - i * SEG) / SEG;
    return this.segments[i].centerX + (this.segments[i + 1].centerX - this.segments[i].centerX) * f;
  }

  /** Valley-floor elevation at distance z, interpolated. */
  groundYAt(z) {
    const i = clamp(Math.floor(z / SEG), 0, this.count - 2);
    const f = (z - i * SEG) / SEG;
    return this.segments[i].groundY + (this.segments[i + 1].groundY - this.segments[i].groundY) * f;
  }

  /** Flank (mountain) height at distance z, interpolated. */
  flankAt(z) {
    const i = clamp(Math.floor(z / SEG), 0, this.count - 2);
    const f = (z - i * SEG) / SEG;
    return this.segments[i].mountainH + (this.segments[i + 1].mountainH - this.segments[i].mountainH) * f;
  }

  isRunwayAt(z) {
    return this.segmentAt(z).runway;
  }

  /**
   * Height of the ground directly under a point (x, z): the valley floor, rising
   * into the flanks once you leave the river's width.
   */
  groundUnder(x, z) {
    const centre = this.centerXAt(z);
    const lateral = Math.abs(x - centre);
    const floor = this.groundYAt(z);
    if (lateral <= COURSE.valleyHalfWidth) return floor;
    const over = lateral - COURSE.valleyHalfWidth;
    const rise = Math.min(over / 420, 1);
    return floor + this.flankAt(z) * rise * rise;
  }

  nextRing(z) {
    for (const ring of this.rings) {
      if (!ring.taken && ring.segment * SEG > z - SEG) return ring;
    }
    return null;
  }

  resetRings() {
    for (const ring of this.rings) {
      ring.taken = false;
      ring.passed = false;
    }
  }
}

export { SCORE };
