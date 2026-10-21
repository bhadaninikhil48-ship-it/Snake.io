/**
 * InputManager - Handles keyboard inputs, input queue buffering, and control listeners
 */

import { DIRECTIONS, OPPOSITE_DIRECTIONS } from './constants.js';

export class InputManager {
  constructor(onPause, onRestart, onMute) {
    this.queue = [];
    this.maxQueueSize = 2; // Buffer up to 2 quick turns
    this.onPause = onPause;
    this.onRestart = onRestart;
    this.onMute = onMute;
    this.isListening = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  attach() {
    if (this.isListening) return;
    window.addEventListener('keydown', this.handleKeyDown);
    this.isListening = true;
  }

  detach() {
    if (!this.isListening) return;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.isListening = false;
    this.queue = [];
  }

  clearQueue() {
    this.queue = [];
  }

  handleKeyDown(e) {
    // Prevent default scrolling for game keys
    const gameKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyS', 'KeyA', 'KeyD',
      'Space', 'KeyP', 'KeyM', 'KeyR', 'Enter',
    ];

    if (gameKeys.includes(e.code)) {
      e.preventDefault();
    }

    // Toggle Pause
    if (e.code === 'Space' || e.code === 'KeyP') {
      if (this.onPause) this.onPause();
      return;
    }

    // Restart / Start
    if (e.code === 'KeyR' || e.code === 'Enter') {
      if (this.onRestart) this.onRestart();
      return;
    }

    // Mute
    if (e.code === 'KeyM') {
      if (this.onMute) this.onMute();
      return;
    }

    // Direction mapping
    let requestedDir = null;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        requestedDir = DIRECTIONS.UP;
        break;
      case 'ArrowDown':
      case 'KeyS':
        requestedDir = DIRECTIONS.DOWN;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        requestedDir = DIRECTIONS.LEFT;
        break;
      case 'ArrowRight':
      case 'KeyD':
        requestedDir = DIRECTIONS.RIGHT;
        break;
      default:
        break;
    }

    if (requestedDir) {
      this.pushDirection(requestedDir);
    }
  }

  pushDirection(dir) {
    if (this.queue.length >= this.maxQueueSize) {
      return;
    }

    // Don't push duplicate consecutive requests
    const last = this.queue[this.queue.length - 1];
    if (last && last.name === dir.name) {
      return;
    }

    this.queue.push(dir);
  }

  /**
   * Retrieves the next valid buffered direction
   */
  nextDirection(currentDirection) {
    while (this.queue.length > 0) {
      const candidate = this.queue.shift();
      // Ignore if direction is exact opposite of current moving direction
      if (OPPOSITE_DIRECTIONS[currentDirection.name] !== candidate.name && candidate.name !== currentDirection.name) {
        return candidate;
      }
    }
    return null;
  }
}
