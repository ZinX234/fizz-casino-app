/**
 * Fizz Rush — input
 * ---------------------------------------------------------------------------
 * Keyboard, swipe and on-screen buttons all funnel into the same action queue,
 * with a short jump buffer and coyote time so the controls feel forgiving
 * without ever allowing extra jumps in the air.
 */

const KEY_MAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  Escape: 'pause',
  KeyP: 'pause',
  KeyR: 'restart',
};

export class InputController {
  constructor({ target, settings, onAction }) {
    this.target = target || window;
    this.settings = settings || {};
    this.onAction = onAction;
    this.queue = [];
    this.bufferTime = 0;
    this.attached = false;
    this.touchStart = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.held = new Set();
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    const el = this.target;
    if (el && el.addEventListener) {
      el.addEventListener('touchstart', this.onTouchStart, { passive: true });
      el.addEventListener('touchmove', this.onTouchMove, { passive: false });
      el.addEventListener('touchend', this.onTouchEnd, { passive: true });
      el.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    }
    window.addEventListener('blur', this.onKeyUp);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    const el = this.target;
    if (el && el.removeEventListener) {
      el.removeEventListener('touchstart', this.onTouchStart);
      el.removeEventListener('touchmove', this.onTouchMove);
      el.removeEventListener('touchend', this.onTouchEnd);
      el.removeEventListener('touchcancel', this.onTouchEnd);
    }
    this.held.clear();
    this.queue.length = 0;
  }

  onKeyDown(event) {
    if (!this.settings.keyboard) return;
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    this.held.add(action);
    this.trigger(action);
  }

  onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (action) this.held.delete(action);
  }

  onTouchStart(event) {
    if (!this.settings.touch) return;
    const t = event.changedTouches?.[0];
    if (!t) return;
    this.touchStart = { x: t.clientX, y: t.clientY, time: performance.now(), consumed: false };
  }

  onTouchMove(event) {
    if (!this.settings.touch || !this.touchStart || this.touchStart.consumed) return;
    const t = event.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    const threshold = this.settings.swipeThreshold || 26;
    // React as soon as the gesture is unambiguous — waiting for touchend costs
    // precious milliseconds at Extreme speeds.
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      this.touchStart.consumed = true;
      if (Math.abs(dx) > Math.abs(dy)) this.trigger(dx > 0 ? 'right' : 'left');
      else this.trigger(dy > 0 ? 'slide' : 'jump');
    }
  }

  onTouchEnd(event) {
    if (!this.settings.touch || !this.touchStart) return;
    const t = event.changedTouches?.[0];
    const start = this.touchStart;
    this.touchStart = null;
    if (start.consumed || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const threshold = this.settings.swipeThreshold || 26;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) this.trigger(dx > 0 ? 'right' : 'left');
      else this.trigger(dy > 0 ? 'slide' : 'jump');
    } else if (performance.now() - start.time < 320) {
      this.trigger('jump');
    }
  }

  /** Used by the on-screen buttons and by the game itself. */
  trigger(action) {
    if (!action) return;
    this.queue.push(action);
    if (action === 'jump') this.bufferTime = (this.settings.jumpBufferMs || 140) / 1000;
    this.onAction?.(action);
  }

  /** Actions collected since the last frame; the buffer only helps jumps. */
  drain() {
    const actions = this.queue.slice();
    this.queue.length = 0;
    return actions;
  }

  update(dt) {
    if (this.bufferTime > 0) this.bufferTime = Math.max(0, this.bufferTime - dt);
  }

  get bufferedJump() {
    return this.bufferTime > 0;
  }

  clearBuffer() {
    this.bufferTime = 0;
  }
}

export default InputController;