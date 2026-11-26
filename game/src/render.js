// Ridgeline Run — rendering: a pseudo-3D chase view over a seeded valley, the
// aircraft drawn as a vector sprite, and lit instruments for the HUD. Everything
// is drawn with the 2D canvas API; no image, font or sound is fetched.
import { COURSE, PALETTE, VIEW } from './config.js';
import { clamp, lerp } from './random.js';

const SEG = COURSE.segmentLength;

/** Project a world point into screen space; null when behind the camera. */
function project(camX, camY, camZ, worldX, worldY, worldZ, w, h, horizonY) {
  const dz = worldZ - camZ;
  if (dz <= 1) return null;
  const scale = COURSE.cameraDepth / dz;
  return {
    x: w / 2 + scale * (worldX - camX) * (w / 2),
    y: horizonY - scale * (worldY - camY) * (h / 2),
    scale,
  };
}

/** Blend two #rrggbb colours toward `to` by t (0..1). */
function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function poly(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.clouds = [];
    for (let i = 0; i < 16; i += 1) {
      this.clouds.push({
        x: (i * 197.3) % 1,
        y: 0.04 + ((i * 37.7) % 1) * 0.22,
        s: 0.5 + ((i * 53.1) % 1) * 0.9,
        v: 0.004 + ((i * 11.3) % 1) * 0.008,
      });
    }
    this.particles = [];
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.7, color });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (0.7 - p.life) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The whole scene for one frame. `view` carries course, plane, mission, time. */
  drawScene(ctx, w, h, view) {
    const { course, plane, time } = view;
    const camX = plane.x;
    const camY = course.groundYAt(plane.z) + plane.altitude + COURSE.cameraHeight;
    const camZ = plane.z;
    const horizonY = h * 0.5 + plane.pitch * h * 0.55;
    const shakeX = plane.shake > 0 ? (Math.random() - 0.5) * plane.shake * 14 : 0;
    const shakeY = plane.shake > 0 ? (Math.random() - 0.5) * plane.shake * 10 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawSky(ctx, w, h, horizonY, camX, time);
    this.drawTerrain(ctx, w, h, view, camX, camY, camZ, horizonY);
    this.drawPlaneShadow(ctx, w, h, view, camX, camY, camZ, horizonY);
    this.drawPlane(ctx, w, h, plane, time);
    this.drawParticles(ctx);
    ctx.restore();
  }

  drawSky(ctx, w, h, horizonY, camX, time) {
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, Math.max(horizonY + 2, 1));

    // Sun with a warm glow.
    const sx = w * 0.78;
    const sy = horizonY - h * 0.3;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 150, sy - 150, 300, 300);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Two parallax mountain layers on the horizon.
    this.drawRidge(ctx, w, horizonY, camX, 0.03, 0.16, '#5d5170', 0.9);
    this.drawRidge(ctx, w, horizonY, camX, 0.07, 0.1, '#4a4260', 1);

    // Drifting clouds.
    ctx.fillStyle = 'rgba(255,244,230,0.85)';
    for (const c of this.clouds) {
      const cx = (((c.x + time * c.v * 0.02 - camX * 0.00002) % 1) + 1) % 1 * (w + 320) - 160;
      const cy = c.y * h;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 44 * s, cy + 6 * s, 46 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 48 * s, cy + 8 * s, 40 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRidge(ctx, w, horizonY, camX, parallax, heightFrac, color, alpha) {
    const h = horizonY;
    const base = h + 2;
    const amp = (this.canvas.height * heightFrac) / 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4, base);
    for (let x = -4; x <= w + 4; x += 14) {
      const t = (x + camX * parallax) * 0.006;
      const y = base - (Math.sin(t * 1.7) * 0.5 + Math.sin(t * 4.3 + 1.3) * 0.3 + Math.sin(t * 9.1 + 4.1) * 0.2) * amp - amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 4, base);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawTerrain(ctx, w, h, view, camX, camY, camZ, horizonY) {
    const { course, plane } = view;
    const baseIndex = course.segmentIndexAt(camZ);
    const farIndex = Math.min(course.count - 1, baseIndex + COURSE.drawDistance);
    for (let i = farIndex; i >= baseIndex; i -= 1) {
      const seg = course.segments[i];
      const next = course.segments[Math.min(i + 1, course.count - 1)];
      // The near edge is clamped just ahead of the camera so the ground fills
      // the bottom of the frame even on a low approach, never behind it.
      const zNear = Math.max(i * SEG, camZ + 2);
      const zFar = (i + 1) * SEG;
      const pNear = project(camX, camY, camZ, seg.centerX, seg.groundY, zNear, w, h, horizonY);
      const pFar = project(camX, camY, camZ, next.centerX, next.groundY, zFar, w, h, horizonY);
      if (!pFar) continue;
      const yNear = pNear ? pNear.y : h + 60;
      const yFar = pFar.y;
      if (yFar > h + 40 && yNear > h + 40) continue;
      const depth = (i - baseIndex) / COURSE.drawDistance;
      const fog = clamp(depth * 1.15, 0, 0.85);

      // Ground band: altitude tints it from grass to rock to snow, and every
      // fifth segment is a golden field, so the valley reads as farmland.
      let ground = i % 2 === 0 ? PALETTE.groundA : PALETTE.groundB;
      if ((i * 7) % 5 === 0) ground = '#8a7a3f';
      if (seg.groundY > 165) ground = i % 2 === 0 ? PALETTE.snowA : PALETTE.snowB;
      else if (seg.groundY > 120) ground = i % 2 === 0 ? PALETTE.rockA : PALETTE.rockB;
      poly(ctx, [[0, yNear], [w, yNear], [w, yFar], [0, yFar]], mix(ground, PALETTE.fog, fog));

      // The river (or the runway at either end of the course).
      const nearL = project(camX, camY, camZ, seg.centerX - COURSE.riverHalfWidth, seg.groundY, zNear, w, h, horizonY);
      const nearR = project(camX, camY, camZ, seg.centerX + COURSE.riverHalfWidth, seg.groundY, zNear, w, h, horizonY);
      const farL = project(camX, camY, camZ, next.centerX - COURSE.riverHalfWidth, next.groundY, zFar, w, h, horizonY);
      const farR = project(camX, camY, camZ, next.centerX + COURSE.riverHalfWidth, next.groundY, zFar, w, h, horizonY);
      if (nearL && nearR && farL && farR) {
        if (seg.runway) {
          poly(ctx, [[nearL.x, nearL.y], [nearR.x, nearR.y], [farR.x, farR.y], [farL.x, farL.y]], mix(PALETTE.runway, PALETTE.fog, fog));
          if (i % 2 === 0) {
            const cL = project(camX, camY, camZ, seg.centerX - 6, seg.groundY, zNear, w, h, horizonY);
            const cR = project(camX, camY, camZ, seg.centerX + 6, seg.groundY, zNear, w, h, horizonY);
            const cFL = project(camX, camY, camZ, next.centerX - 6, next.groundY, zFar, w, h, horizonY);
            const cFR = project(camX, camY, camZ, next.centerX + 6, next.groundY, zFar, w, h, horizonY);
            if (cL && cR && cFL && cFR) poly(ctx, [[cL.x, cL.y], [cR.x, cR.y], [cFR.x, cFR.y], [cFL.x, cFL.y]], mix(PALETTE.runwayLine, PALETTE.fog, fog));
          }
        } else {
          const river = i % 2 === 0 ? PALETTE.riverA : PALETTE.riverB;
          poly(ctx, [[nearL.x, nearL.y], [nearR.x, nearR.y], [farR.x, farR.y], [farL.x, farL.y]], mix(river, PALETTE.fog, fog));
        }
      }

      // Flank mountains: triangles rising on both sides where the flank is
      // high, so the valley feels enclosed along the whole course.
      if (seg.flank > 0.22) {
        for (const side of [-1, 1]) {
          const baseX = seg.centerX + side * (COURSE.valleyHalfWidth + 260);
          const apexX = seg.centerX + side * (COURSE.valleyHalfWidth + 700);
          const apexY = seg.groundY + seg.mountainH * 1.55;
          const a = project(camX, camY, camZ, apexX, apexY, zFar, w, h, horizonY);
          const b1 = project(camX, camY, camZ, baseX, seg.groundY, zFar, w, h, horizonY);
          const b2 = project(camX, camY, camZ, apexX + side * 520, seg.groundY, zFar, w, h, horizonY);
          if (a && b1 && b2) {
            poly(ctx, [[b1.x, b1.y], [a.x, a.y], [b2.x, b2.y]], mix(PALETTE.rockA, PALETTE.fog, fog));
            const cap = 0.62;
            const cx1 = lerp(b1.x, a.x, cap);
            const cy1 = lerp(b1.y, a.y, cap);
            const cx2 = lerp(b2.x, a.x, cap);
            const cy2 = lerp(b2.y, a.y, cap);
            poly(ctx, [[cx1, cy1], [a.x, a.y], [cx2, cy2]], mix(PALETTE.snowA, PALETTE.fog, fog));
          }
        }
      }

      // Trees: small dark triangles on the banks.
      for (const tree of seg.trees) {
        const tx = seg.centerX + tree.dx;
        const tp = project(camX, camY, camZ, tx, seg.groundY, zFar, w, h, horizonY);
        if (!tp) continue;
        const th = Math.max(1, tp.scale * tree.size * (h / 2));
        if (th < 1.5) continue;
        poly(ctx, [[tp.x - th * 0.45, tp.y], [tp.x, tp.y - th], [tp.x + th * 0.45, tp.y]], mix('#2f4a26', PALETTE.fog, fog));
      }

      // Rings: glowing hoops floating above the valley floor.
      if (seg.ring && !seg.ring.taken) {
        const ring = seg.ring;
        const rx = seg.centerX + ring.dx;
        const ry = seg.groundY + ring.dy;
        const rp = project(camX, camY, camZ, rx, ry, zFar, w, h, horizonY);
        if (rp) {
          const radius = Math.max(2, rp.scale * 30 * (w / 2));
          const color = ring.kind === 'fuel' ? PALETTE.ringFuel : PALETTE.ring;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2, radius * 0.14);
          ctx.shadowColor = color;
          ctx.shadowBlur = radius * 0.5;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.lineWidth = Math.max(1, radius * 0.05);
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, radius * 0.86, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          if (ring.kind === 'fuel') {
            ctx.fillStyle = '#eafff0';
            ctx.font = `bold ${Math.max(9, radius * 0.42)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('F', rp.x, rp.y);
          }
        }
      }
    }
  }

  drawPlaneShadow(ctx, w, h, view, camX, camY, camZ, horizonY) {
    const { course, plane } = view;
    const aheadZ = plane.z + 130;
    const groundY = course.groundYAt(aheadZ);
    const p = project(camX, camY, camZ, plane.x, groundY, aheadZ, w, h, horizonY);
    if (!p) return;
    const spread = clamp(1 - plane.altitude / 320, 0.15, 1);
    ctx.save();
    ctx.globalAlpha = 0.28 * spread;
    ctx.fillStyle = '#101018';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 52 * spread + 8, 10 * spread + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The aircraft, drawn from behind and slightly above, banking with the stick. */
  drawPlane(ctx, w, h, plane, time) {
    const cx = w / 2;
    const cy = h * 0.6 - plane.pitch * h * 0.22;
    const s = 1;
    const prop = Math.sin(time * 42) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank);
    ctx.scale(s, s);
    // Speed streaks behind the wings at high speed.
    if (plane.speed > 165) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (const off of [-86, -52, 52, 86]) {
        ctx.beginPath();
        ctx.moveTo(off, -18);
        ctx.lineTo(off, -18 - 26 - prop * 22);
        ctx.stroke();
      }
    }
    // Wings.
    ctx.fillStyle = PALETTE.planeWing;
    poly(ctx, [[-118, 6], [-16, -6], [-16, 14], [-118, 22]], PALETTE.planeWing);
    poly(ctx, [[16, -6], [118, 6], [118, 22], [16, 14]], PALETTE.planeWing);
    // Red wingtips with navigation lights.
    poly(ctx, [[-118, 6], [-96, 2], [-96, 18], [-118, 22]], PALETTE.planeBody);
    poly(ctx, [[96, 2], [118, 6], [118, 22], [96, 18]], PALETTE.planeBody);
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-118, 13, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(118, 13, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Fuselage, seen from the tail: tapered body with a dark canopy.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-13, -34);
    ctx.quadraticCurveTo(0, -44, 13, -34);
    ctx.lineTo(17, 26);
    ctx.quadraticCurveTo(0, 34, -17, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d2b3a';
    ctx.beginPath();
    ctx.ellipse(0, -26, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin and stabiliser.
    ctx.fillStyle = PALETTE.planeTrim;
    poly(ctx, [[-4, -34], [0, -62], [5, -34]], PALETTE.planeTrim);
    poly(ctx, [[-34, -30], [-8, -36], [-8, -26], [-34, -22]], PALETTE.planeTrim);
    poly(ctx, [[8, -36], [34, -30], [34, -22], [8, -26]], PALETTE.planeTrim);
    // Engine cowling glow and a spinning prop disc over the nose.
    ctx.fillStyle = 'rgba(255, 210, 120, 0.85)';
    ctx.beginPath();
    ctx.arc(0, -30, 4 + prop, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- HUD and screens -------------------------------------------------

  panel(ctx, x, y, pw, ph) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.strokeStyle = 'rgba(160, 190, 230, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
    ctx.stroke();
  }

  drawHUD(ctx, w, h, game) {
    const plane = game.plane;
    const mission = game.mission;
    const knots = Math.round(plane.speed * 1.944);
    const feet = Math.round(plane.altitude * 3.281);
    const heading = Math.round(game.heading());
    ctx.textBaseline = 'alphabetic';

    // Top-left: speed, altitude, heading — the lit instruments.
    this.panel(ctx, 16, 14, 218, 92);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPEED', 30, 34);
    ctx.fillText('ALTITUDE', 30, 62);
    ctx.fillText('HEADING', 30, 90);
    ctx.fillStyle = PALETTE.hudGreen;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${knots} KT`, 220, 36);
    ctx.fillText(`${feet.toLocaleString()} FT`, 220, 64);
    ctx.fillText(`${String(heading).padStart(3, '0')}°`, 220, 92);

    // Top-centre: compass strip.
    const compassW = 260;
    const cx = w / 2;
    this.panel(ctx, cx - compassW / 2, 14, compassW, 30);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - compassW / 2, 14, compassW, 30, 10);
    ctx.clip();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((heading + d) % 360 + 360) % 360;
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.globalAlpha = 1 - Math.abs(d) / 75;
      ctx.fillText(label, cx + d * 2.1, 34);
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 14);
    ctx.lineTo(cx + 6, 14);
    ctx.lineTo(cx, 24);
    ctx.closePath();
    ctx.fill();

    // Top-right: score, rings, time, mission.
    this.panel(ctx, w - 234, 14, 218, 92);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', w - 220, 34);
    ctx.fillText(mission.id === 'rings' ? 'RINGS' : 'RINGS', w - 220, 62);
    ctx.fillText('TIME', w - 220, 90);
    ctx.fillStyle = PALETTE.hudGreen;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(plane.score), w - 30, 36);
    ctx.fillText(`${plane.ringsCollected}/${mission.rings}`, w - 30, 64);
    const t = Math.floor(game.elapsed);
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w - 30, 92);

    // Bottom-left: fuel and throttle.
    this.panel(ctx, 16, h - 78, 240, 62);
    this.bar(ctx, 30, h - 58, 212, 12, plane.fuel / 100, plane.fuel < 25 ? PALETTE.hudRed : plane.fuel < 50 ? PALETTE.hudAmber : PALETTE.hudGreen, 'FUEL');
    this.bar(ctx, 30, h - 32, 212, 12, plane.speed / 210, '#7db4ff', 'THROTTLE');
    if (plane.engineOut) {
      ctx.fillStyle = PALETTE.hudRed;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ENGINE OUT — GLIDE!', 30, h - 84);
    }

    // Bottom-right: attitude indicator and lives.
    this.attitude(ctx, w - 84, h - 84, 46, plane);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('LIVES', w - 150, h - 44);
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(w - 140 + i * 26, h - 30);
      ctx.fillStyle = i < plane.lives ? PALETTE.planeBody : 'rgba(120,130,150,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(10, 4);
      ctx.lineTo(0, 1);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Next-ring pointer.
    const ring = game.nextRingInfo();
    if (ring) {
      const dx = ring.screenX - w / 2;
      const arrowX = clamp(w / 2 + dx * 0.9, 90, w - 90);
      ctx.fillStyle = ring.kind === 'fuel' ? PALETTE.ringFuel : PALETTE.ring;
      ctx.beginPath();
      ctx.moveTo(arrowX, 122);
      ctx.lineTo(arrowX - 9, 136);
      ctx.lineTo(arrowX + 9, 136);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ring.kind === 'fuel' ? 'FUEL' : 'RING'} ${Math.round(ring.dist)}m`, arrowX, 154);
    }

    // Messages.
    let my = 176;
    ctx.textAlign = 'center';
    for (const m of game.messages) {
      ctx.globalAlpha = clamp(m.ttl, 0, 1);
      ctx.fillStyle = m.color;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(m.text, w / 2, my);
      my += 30;
    }
    ctx.globalAlpha = 1;

    // Warnings.
    if (plane.fuel < 25 && !plane.engineOut && Math.floor(game.time * 2) % 2 === 0) {
      ctx.fillStyle = PALETTE.hudRed;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('LOW FUEL', w / 2, h - 108);
    }
    if (plane.altitude < 34 && plane.pitch < 0 && !plane.landed) {
      ctx.fillStyle = PALETTE.hudRed;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('PULL UP', w / 2, h - 108);
    }
  }

  bar(ctx, x, y, bw, bh, frac, color, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, bw * clamp(frac, 0, 1), bh);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);
  }

  attitude(ctx, cx, cy, r, plane) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,230,0.4)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-plane.bank);
    const pitchOff = clamp(plane.pitch * 90, -r, r);
    ctx.fillStyle = '#3f6db3';
    ctx.fillRect(-r, -r + pitchOff, r * 2, r);
    ctx.fillStyle = '#c98d4b';
    ctx.fillRect(-r, pitchOff, r * 2, r);
    ctx.strokeStyle = '#eef4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, pitchOff);
    ctx.lineTo(r, pitchOff);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 7);
    ctx.closePath();
    ctx.fill();
  }

  centreText(ctx, w, y, text, size, color, sub) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.fillText(text, w / 2, y);
    if (sub) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(sub, w / 2, y + 30);
    }
  }

  drawTitle(ctx, w, h, time) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.45)';
    ctx.fillRect(0, 0, w, h);
    this.centreText(ctx, w, h * 0.32, 'RIDGELINE RUN', 72, '#ffd23e');
    this.centreText(ctx, w, h * 0.32 + 44, 'A bush-plane run down a mountain valley — rings, fuel and one far runway.', 18, PALETTE.hudText);
    const pulse = 0.65 + Math.sin(time * 3) * 0.35;
    ctx.globalAlpha = pulse;
    this.centreText(ctx, w, h * 0.52, 'PRESS ENTER OR CLICK TO FLY', 24, PALETTE.hudGreen);
    ctx.globalAlpha = 1;
    this.centreText(ctx, w, h * 0.62, 'Steer ← → or A / D   •   Climb / descend ↑ ↓ or W / S   •   Boost SHIFT   •   Brake SPACE', 15, PALETTE.hudDim);
    this.centreText(ctx, w, h * 0.62 + 26, 'Mouse steers too.  M mutes, P pauses, R restarts.', 15, PALETTE.hudDim);
  }

  drawMissions(ctx, w, h, missions, selected) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
    ctx.fillRect(0, 0, w, h);
    this.centreText(ctx, w, 108, 'CHOOSE YOUR SORTIE', 40, '#ffd23e');
    const cardW = 320;
    const cardH = 250;
    const gap = 28;
    const totalW = cardW * 3 + gap * 2;
    let x = (w - totalW) / 2;
    const y = 168;
    missions.forEach((m, i) => {
      const hot = i === selected;
      ctx.fillStyle = hot ? 'rgba(255, 210, 62, 0.16)' : PALETTE.hudPanel;
      ctx.strokeStyle = hot ? '#ffd23e' : 'rgba(160,190,230,0.35)';
      ctx.lineWidth = hot ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(m.tag, x + cardW / 2, y + 34);
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(m.name, x + cardW / 2, y + 72);
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '15px system-ui, sans-serif';
      this.wrapText(ctx, m.blurb, x + 22, y + 104, cardW - 44, 22);
      ctx.fillStyle = PALETTE.hudGreen;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(m.goal, x + cardW / 2, y + cardH - 24);
      x += cardW + gap;
    });
    this.centreText(ctx, w, y + cardH + 46, '← → to choose, ENTER to fly', 16, PALETTE.hudDim);
  }

  wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x + maxW / 2, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x + maxW / 2, yy);
  }

  drawCountdown(ctx, w, h, n) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.3)';
    ctx.fillRect(0, 0, w, h);
    this.centreText(ctx, w, h * 0.5, String(n), 110, '#ffd23e');
  }

  drawPause(ctx, w, h) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.6)';
    ctx.fillRect(0, 0, w, h);
    this.centreText(ctx, w, h * 0.46, 'PAUSED', 56, PALETTE.hudText, 'Press P to keep flying — R restarts the sortie.');
  }

  drawResults(ctx, w, h, game) {
    const plane = game.plane;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.62)';
    ctx.fillRect(0, 0, w, h);
    const title = game.resultTitle;
    this.centreText(ctx, w, 150, title, 52, '#ffd23e');
    const lines = game.resultLines();
    let y = 230;
    ctx.textAlign = 'center';
    for (const [label, value] of lines) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(label, w / 2 - 120, y);
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(value, w / 2 + 40, y);
      ctx.textAlign = 'center';
      y += 38;
    }
    this.centreText(ctx, w, y + 30, `TOTAL SCORE  ${plane.score}`, 30, PALETTE.hudGreen);
    this.centreText(ctx, w, y + 76, 'ENTER for missions  •  R to fly again', 16, PALETTE.hudDim);
  }

  drawGameOver(ctx, w, h, game) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.66)';
    ctx.fillRect(0, 0, w, h);
    this.centreText(ctx, w, 220, 'OUT OF LIVES', 56, PALETTE.hudRed);
    this.centreText(ctx, w, 268, 'The valley keeps its secrets — for now.', 18, PALETTE.hudText);
    this.centreText(ctx, w, 340, `SCORE  ${game.plane.score}   •   RINGS  ${game.plane.ringsCollected}`, 24, PALETTE.hudGreen);
    this.centreText(ctx, w, 420, 'Press R to try again, ENTER for missions', 16, PALETTE.hudDim);
  }
}

export { VIEW };
