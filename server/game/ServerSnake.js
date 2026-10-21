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
   * Validates and queues a direction change for the upcoming tick.
   * Enforces:
   * 1. Valid direction names
   * 2. No 180-degree immediate reversal into neck
   * 3. Max one accepted direction change per game tick
   */
  queueDirection(dirName) {
    if (!dirName || typeof dirName !== 'string') return false;
    const upper = dirName.trim().toUpperCase();

    // Must be one of the 4 valid directions
    if (!DIRECTIONS[upper]) return false;

    // Enforce max 1 direction change per tick
    if (this.hasInputThisTick) return false;

    // Prevent direct 180-degree self-reversal against current moving direction
    if (OPPOSITE_DIRECTIONS[this.direction] === upper) {
      return false;
    }

    this.pendingDirection = upper;
    this.hasInputThisTick = true;
    return true;
  }

  /**
   * Applies the queued direction at the start of a game tick
   */
  applyDirection() {
    this.direction = this.pendingDirection;
    this.hasInputThisTick = false;
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
