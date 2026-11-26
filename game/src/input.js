// Ridgeline Run — input: keyboard and mouse, both steering the same plane.
// Keyboard arrows/WASD bank and pitch; Shift boosts, Space brakes; the mouse
// steers by where it sits on the screen, for players who prefer it.
import { KEYS } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseActive = false;
    this.pressed = new Set();
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = (e.clientY - rect.top) / rect.height;
      this.mouseActive = true;
    });
    canvas.addEventListener('mousedown', () => {
      this.pressed.add('MouseClick');
    });
  }

  down(group) {
    return KEYS[group].some((code) => this.keys.has(code));
  }

  /** True once for a key pressed since the last call (consumed). */
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  consumeClick() {
    return this.wasPressed('MouseClick');
  }

  /** Steering and pitch from keys, or from the mouse when it has moved. */
  axis() {
    let steer = 0;
    let pitch = 0;
    if (this.down('left')) steer -= 1;
    if (this.down('right')) steer += 1;
    if (this.down('up')) pitch += 1;
    if (this.down('down')) pitch -= 1;
    if (steer === 0 && pitch === 0 && this.mouseActive) {
      steer = (this.mouseX - 0.5) * 2;
      pitch = (0.5 - this.mouseY) * 2;
      const dead = 0.12;
      if (Math.abs(steer) < dead) steer = 0;
      if (Math.abs(pitch) < dead) pitch = 0;
    }
    return {
      steer: Math.max(-1, Math.min(1, steer)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      boost: this.down('boost'),
      brake: this.down('brake'),
    };
  }
}
