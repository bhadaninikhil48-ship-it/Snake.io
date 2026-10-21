/**
 * ServerSnake - Authoritative Server-Side Snake Model
 */

import { DIRECTIONS, OPPOSITE_DIRECTIONS } from './constants.js';

export class ServerSnake {
  constructor(playerId, name, color, initialHead, initialDirection, initialLength = 4) {
    this.playerId = playerId;
    this.name = name;
    this.color = color;
    this.direction = initialDirection; // 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
    this.pendingDirection = initialDirection;
    this.hasInputThisTick = false;
    this.inputQueue = [];
    this.maxQueueSize = 2; // Buffer up to 2 quick turns
    this.score = 0;
    this.pendingGrowth = 0;
    this.isAlive = true;
    this.eliminationReason = null;

    // Build initial straight horizontal segment array
    const dirVector = DIRECTIONS[initialDirection];
    this.segments = [];
    for (let i = 0; i < initialLength; i++) {
      this.segments.push({
        x: initialHead.x - dirVector.x * i,
        y: initialHead.y - dirVector.y * i,
      });
    }
  }

  /**
   * Validates and queues a direction change for the upcoming ticks.
   * Enforces:
   * 1. Valid direction names
   * 2. No 180-degree immediate reversal into current direction or last queued turn
   * 3. Max buffer of 2 rapid turns to prevent lost inputs on quick cornering
   */
  queueDirection(dirName) {
    if (!dirName || typeof dirName !== 'string') return false;
    const upper = dirName.trim().toUpperCase();

    // Must be one of the 4 valid directions
    if (!DIRECTIONS[upper]) return false;

    // Reject if buffer is full
    if (this.inputQueue.length >= this.maxQueueSize) {
      return false;
    }

    // Evaluate reversal and redundancy against the last queued direction (or current direction)
    const referenceDirection = this.inputQueue.length > 0
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.direction;

    // Prevent direct 180-degree self-reversal or duplicate input
    if (OPPOSITE_DIRECTIONS[referenceDirection] === upper || referenceDirection === upper) {
      return false;
    }

    this.inputQueue.push(upper);
    this.pendingDirection = upper;
    this.hasInputThisTick = true;
    return true;
  }

  /**
   * Applies the next queued direction at the start of a game tick
   */
  applyDirection() {
    while (this.inputQueue.length > 0) {
      const candidate = this.inputQueue.shift();
      if (OPPOSITE_DIRECTIONS[this.direction] !== candidate && candidate !== this.direction) {
        this.direction = candidate;
        break;
      }
    }
    this.pendingDirection = this.inputQueue[0] || this.direction;
    this.hasInputThisTick = this.inputQueue.length > 0;
  }

  /**
   * Returns where the head will land on the next step
   */
  computeNextHead() {
    const head = this.getHead();
    const vec = DIRECTIONS[this.direction];
    return {
      x: head.x + vec.x,
      y: head.y + vec.y,
    };
  }

  /**
   * Advances the snake by adding the new head.
   * If growing, keeps tail. If not, removes tail and returns departed tail coordinate.
   */
  step(newHead) {
    this.segments.unshift(newHead);

    let departedTail = null;
    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
    } else {
      departedTail = this.segments.pop();
    }

    return departedTail;
  }

  grow(amount = 1) {
    this.pendingGrowth += amount;
  }

  addScore(points) {
    this.score += points;
  }

  getHead() {
    return this.segments[0];
  }

  getBody(excludeTail = false) {
    if (excludeTail) {
      return this.segments.slice(1, -1);
    }
    return this.segments.slice(1);
  }

  getLength() {
    return this.segments.length;
  }

  /**
   * Checks if coordinate is occupied by this snake
   */
  occupies(x, y, includeHead = true, excludeTail = false) {
    const startIdx = includeHead ? 0 : 1;
    const endIdx = excludeTail ? this.segments.length - 1 : this.segments.length;

    for (let i = startIdx; i < endIdx; i++) {
      const seg = this.segments[i];
      if (seg.x === x && seg.y === y) {
        return true;
      }
    }
    return false;
  }

  eliminate(reason) {
    this.isAlive = false;
    this.eliminationReason = reason;
  }

  toJSON() {
    return {
      id: this.playerId,
      name: this.name,
      color: this.color,
      segments: this.segments,
      direction: this.direction,
      score: this.score,
      length: this.segments.length,
      isAlive: this.isAlive,
      eliminationReason: this.eliminationReason,
    };
  }
}
