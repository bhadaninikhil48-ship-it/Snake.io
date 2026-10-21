/**
 * SwipeController - Touch and pointer gesture handler for 4-direction snake steering
 * Evaluates gestures on pointermove / touchmove for instant response as soon as threshold is met,
 * while supporting flicks on pointerup / touchend and chained turns in a single continuous stroke.
 * Built for cross-browser reliability on real Android and iOS mobile devices.
 */

import { DIRECTIONS, OPPOSITE_DIRECTIONS } from './constants.js';

export class SwipeController {
  /**
   * @param {Object} options
   * @param {number} [options.minDistance=25] Minimum gesture displacement in pixels to trigger a turn
   */
  constructor(options = {}) {
    this.minDistance = typeof options.minDistance === 'number' ? options.minDistance : 25;
    this.activePointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.isSwiping = false;
    this.lastDispatchedDirection = null;
    this.hasDispatchedInCurrentStroke = false;
  }

  /**
   * Normalizes coordinates from PointerEvent or TouchEvent
   */
  _extractCoords(e) {
    if (!e) return null;
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId !== undefined ? e.pointerId : 1,
      };
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (touch && typeof touch.clientX === 'number') {
      return {
        x: touch.clientX,
        y: touch.clientY,
        id: touch.identifier !== undefined ? touch.identifier : 1,
      };
    }
    return null;
  }

  /**
   * Evaluates delta displacement and determines selected direction
   *
   * @param {number} dx Horizontal displacement (endX - startX)
   * @param {number} dy Vertical displacement (endY - startY)
   * @param {string|null} currentDirectionName Current moving direction name ('UP'|'DOWN'|'LEFT'|'RIGHT')
   * @returns {Object|null} Direction object from DIRECTIONS or null if invalid/rejected
   */
  resolveSwipe(dx, dy, currentDirectionName = null) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // 1. Ignore gestures shorter than the threshold
    if (Math.max(absX, absY) < this.minDistance) {
      return null;
    }

    // 2. Determine dominant axis
    let selectedDirName = null;
    if (absX > absY) {
      // Horizontal dominant
      selectedDirName = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      // Vertical dominant (or equal)
      selectedDirName = dy > 0 ? 'DOWN' : 'UP';
    }

    // 3. Respect rule against reversing directly into opposite direction
    if (currentDirectionName) {
      const opp = OPPOSITE_DIRECTIONS[currentDirectionName];
      if (selectedDirName === opp || selectedDirName === currentDirectionName) {
        return null;
      }
    }

    return DIRECTIONS[selectedDirName] || null;
  }

  /**
   * Records pointer or touch down origin
   */
  handlePointerDown(e) {
    if (!e) return false;

    // Discard secondary pointers while a gesture is already active
    if (this.activePointerId !== null) {
      return false;
    }

    const coords = this._extractCoords(e);
    if (!coords) return false;

    this.activePointerId = coords.id;
    this.startX = coords.x;
    this.startY = coords.y;
    this.isSwiping = true;
    this.lastDispatchedDirection = null;
    this.hasDispatchedInCurrentStroke = false;
    return true;
  }

  /**
   * Evaluates gesture in real-time during movement.
   * Dispatches immediately when threshold is reached without waiting for pointer release.
   */
  handlePointerMove(e, currentDirectionName = null) {
    if (!e || this.activePointerId === null || !this.isSwiping) {
      return null;
    }

    const coords = this._extractCoords(e);
    if (!coords || coords.id !== this.activePointerId) {
      return null;
    }

    const currX = coords.x;
    const currY = coords.y;
    const dx = currX - this.startX;
    const dy = currY - this.startY;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < this.minDistance) {
      return null;
    }

    const effectiveDir = this.lastDispatchedDirection || currentDirectionName;
    const dir = this.resolveSwipe(dx, dy, effectiveDir);

    if (dir) {
      // Valid turn triggered! Set new pivot and record direction
      this.startX = currX;
      this.startY = currY;
      this.lastDispatchedDirection = dir.name;
      this.hasDispatchedInCurrentStroke = true;
      return dir;
    }

    // If gesture moved significantly in the SAME direction as effectiveDir,
    // advance the pivot along with the finger so subsequent perpendicular turns
    // trigger promptly without having to counteract the prior distance.
    let movingDir = null;
    if (absX > absY) {
      movingDir = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      movingDir = dy > 0 ? 'DOWN' : 'UP';
    }

    if (movingDir === effectiveDir) {
      this.startX = currX;
      this.startY = currY;
    }

    return null;
  }

  /**
   * Evaluates gesture on release (e.g. quick flick where pointermove did not trigger)
   */
  handlePointerUp(e, currentDirectionName = null) {
    if (!e || this.activePointerId === null) {
      return null;
    }

    const coords = this._extractCoords(e);
    const pointerId = coords ? coords.id : (e.pointerId !== undefined ? e.pointerId : this.activePointerId);
    if (pointerId !== this.activePointerId) {
      return null;
    }

    const endX = coords ? coords.x : (e.clientX || 0);
    const endY = coords ? coords.y : (e.clientY || 0);
    const dx = endX - this.startX;
    const dy = endY - this.startY;
    const effectiveDir = this.lastDispatchedDirection || currentDirectionName;

    // Reset gesture state
    this.activePointerId = null;
    this.isSwiping = false;
    this.lastDispatchedDirection = null;
    this.hasDispatchedInCurrentStroke = false;

    return this.resolveSwipe(dx, dy, effectiveDir);
  }

  /**
   * Safely cancels gesture without triggering turn
   */
  handlePointerCancel(e) {
    const coords = e ? this._extractCoords(e) : null;
    const pointerId = coords ? coords.id : (e && e.pointerId !== undefined ? e.pointerId : this.activePointerId);
    if (this.activePointerId === null || this.activePointerId === pointerId) {
      this.activePointerId = null;
      this.isSwiping = false;
      this.lastDispatchedDirection = null;
      this.hasDispatchedInCurrentStroke = false;
      return true;
    }
    return false;
  }

  /**
   * Attaches pointer and touch gesture listeners to a DOM element.
   * Uses Pointer Events with automatic Touch Event fallback for universal mobile support.
   *
   * @param {HTMLElement} element Target gameplay DOM element
   * @param {Function} onDirection Callback when a valid swipe direction is triggered
   * @param {Function} [getCurrentDirection] Optional getter returning current snake direction name
   * @returns {Function} Detach / cleanup function
   */
  attach(element, onDirection, getCurrentDirection = null) {
    if (!element) return () => {};

    // Ensure CSS touchAction is applied to target
    try {
      element.style.touchAction = 'none';
    } catch {}

    const isInteractive = (target) => {
      return !!(
        target &&
        typeof target.closest === 'function' &&
        target.closest('button, a, input, select, textarea, .modal-card, .menu-overlay')
      );
    };

    let pointerSystemActive = false;

    // --- Pointer Events Handlers ---
    const onDown = (e) => {
      if (e.isPrimary === false) return;
      if (isInteractive(e.target)) return;

      pointerSystemActive = true;
      const started = this.handlePointerDown(e);
      if (started) {
        if (e.cancelable && e.pointerType === 'touch') {
          e.preventDefault();
        }
        try {
          if (element.setPointerCapture) {
            element.setPointerCapture(e.pointerId);
          }
        } catch {}
      }
    };

    const onMove = (e) => {
      if (e._swipeProcessed) return;
      e._swipeProcessed = true;

      if (this.activePointerId !== e.pointerId) return;
      if (e.cancelable && e.pointerType === 'touch') {
        e.preventDefault();
      }

      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerMove(e, currentDir);
      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onUp = (e) => {
      if (e._swipeProcessed) return;
      e._swipeProcessed = true;

      if (this.activePointerId !== e.pointerId) return;
      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerUp(e, currentDir);
      try {
        if (element.hasPointerCapture && element.hasPointerCapture(e.pointerId)) {
          element.releasePointerCapture(e.pointerId);
        }
      } catch {}

      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onCancel = (e) => {
      if (e._swipeProcessed) return;
      e._swipeProcessed = true;

      if (this.activePointerId !== e.pointerId) return;
      this.handlePointerCancel(e);
      try {
        if (element.hasPointerCapture && element.hasPointerCapture(e.pointerId)) {
          element.releasePointerCapture(e.pointerId);
        }
      } catch {}
    };

    const onLostCapture = (e) => {
      if (this.activePointerId === e.pointerId) {
        this.handlePointerCancel(e);
      }
    };

    // --- Touch Events Fallback (for older WebViews or devices where Pointer Capture fails) ---
    const onTouchStart = (e) => {
      if (pointerSystemActive) return;
      if (isInteractive(e.target)) return;

      const started = this.handlePointerDown(e);
      if (started && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchMove = (e) => {
      if (pointerSystemActive) return;
      if (!this.isSwiping) return;
      if (e.cancelable) {
        e.preventDefault();
      }

      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerMove(e, currentDir);
      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onTouchEnd = (e) => {
      if (pointerSystemActive) return;
      if (!this.isSwiping) return;

      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerUp(e, currentDir);
      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onTouchCancel = (e) => {
      if (pointerSystemActive) return;
      this.handlePointerCancel(e);
    };

    // Attach Pointer Events
    element.addEventListener('pointerdown', onDown, { passive: false });
    element.addEventListener('pointermove', onMove, { passive: false });
    element.addEventListener('pointerup', onUp, { passive: true });
    element.addEventListener('pointercancel', onCancel, { passive: true });
    element.addEventListener('lostpointercapture', onLostCapture, { passive: true });

    // Window listeners ensure gestures ending outside bounds are safely resolved
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onCancel, { passive: true });
    }

    // Attach Touch Event fallback
    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchCancel, { passive: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
      element.removeEventListener('lostpointercapture', onLostCapture);

      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      }

      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchCancel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('touchend', onTouchEnd);
      }
    };
  }
}
