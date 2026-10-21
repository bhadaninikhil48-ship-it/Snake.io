/**
 * SwipeController - Touch and pointer gesture handler for 4-direction snake steering
 * Evaluates gestures on pointermove for instant response as soon as the threshold is met,
 * while supporting flicks on pointerup and chained turns in a single continuous stroke.
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
   * Records pointer down origin
   */
  handlePointerDown(e) {
    if (!e) return false;

    // Discard secondary pointers while a gesture is active
    if (this.activePointerId !== null) {
      return false;
    }

    this.activePointerId = e.pointerId !== undefined ? e.pointerId : 1;
    this.startX = e.clientX || 0;
    this.startY = e.clientY || 0;
    this.isSwiping = true;
    this.lastDispatchedDirection = null;
    this.hasDispatchedInCurrentStroke = false;
    return true;
  }

  /**
   * Evaluates gesture in real-time during pointer movement.
   * Dispatches immediately when threshold is reached without waiting for pointer release.
   */
  handlePointerMove(e, currentDirectionName = null) {
    if (!e || this.activePointerId === null || !this.isSwiping) {
      return null;
    }

    const pointerId = e.pointerId !== undefined ? e.pointerId : 1;
    if (pointerId !== this.activePointerId) {
      return null;
    }

    const currX = e.clientX || 0;
    const currY = e.clientY || 0;
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
   * Evaluates gesture on pointer release (e.g. quick flick where pointermove did not trigger)
   */
  handlePointerUp(e, currentDirectionName = null) {
    if (!e || this.activePointerId === null) {
      return null;
    }

    const pointerId = e.pointerId !== undefined ? e.pointerId : 1;
    if (pointerId !== this.activePointerId) {
      return null;
    }

    const endX = e.clientX || 0;
    const endY = e.clientY || 0;
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
    const pointerId = e && e.pointerId !== undefined ? e.pointerId : this.activePointerId;
    if (this.activePointerId === pointerId) {
      this.activePointerId = null;
      this.isSwiping = false;
      this.lastDispatchedDirection = null;
      this.hasDispatchedInCurrentStroke = false;
      return true;
    }
    return false;
  }

  /**
   * Attaches pointer gesture listeners to a DOM element
   *
   * @param {HTMLElement} element Target gameplay DOM element
   * @param {Function} onDirection Callback when a valid swipe direction is triggered
   * @param {Function} [getCurrentDirection] Optional getter returning current snake direction name
   * @returns {Function} Detach / cleanup function
   */
  attach(element, onDirection, getCurrentDirection = null) {
    if (!element) return () => {};

    const onDown = (e) => {
      if (e.isPrimary === false) return;
      const started = this.handlePointerDown(e);
      if (started) {
        try {
          element.setPointerCapture(e.pointerId);
        } catch {}
      }
    };

    const onMove = (e) => {
      if (this.activePointerId !== e.pointerId) return;
      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerMove(e, currentDir);
      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onUp = (e) => {
      if (this.activePointerId !== e.pointerId) return;
      const currentDir = typeof getCurrentDirection === 'function' ? getCurrentDirection() : null;
      const dir = this.handlePointerUp(e, currentDir);
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {}

      if (dir && typeof onDirection === 'function') {
        onDirection(dir);
      }
    };

    const onCancel = (e) => {
      if (this.activePointerId !== e.pointerId) return;
      this.handlePointerCancel(e);
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {}
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);

    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
    };
  }
}
