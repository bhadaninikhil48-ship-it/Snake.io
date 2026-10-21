/**
 * Snake Model - Handles snake segments, direction, and growth logic
 */

import { DIRECTIONS, OPPOSITE_DIRECTIONS, GRID_SIZE } from './constants.js';

export class Snake {
  constructor(initialLength = 4) {
    this.initialLength = initialLength;
    this.reset();
  }

  reset() {
    const midX = Math.floor(GRID_SIZE / 2);
    const midY = Math.floor(GRID_SIZE / 2);

    this.direction = DIRECTIONS.RIGHT;
    this.nextDirection = DIRECTIONS.RIGHT;
    this.segments = [];
    this.pendingGrowth = 0;
    this.isAlive = true;

    // Build initial snake horizontal facing right
    for (let i = 0; i < this.initialLength; i++) {
      this.segments.push({
        x: midX - i,
        y: midY,
      });
    }
  }

  /**
   * Set snake direction, preventing 180-degree immediate self-reversals
   */
  setDirection(newDir) {
    if (!newDir || !newDir.name) return false;

    // Prevent direct reversal (e.g., trying to go LEFT when currently moving RIGHT)
    if (OPPOSITE_DIRECTIONS[this.direction.name] === newDir.name) {
      return false;
    }

    this.nextDirection = newDir;
    return true;
  }

  /**
   * Step the snake forward by one grid unit
   */
  step() {
    if (!this.isAlive) return null;

    // Apply the buffered next direction
    this.direction = this.nextDirection;

    const head = this.getHead();
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    // Add new head
    this.segments.unshift(newHead);

    // If growing, don't pop tail
    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
    } else {
      this.segments.pop();
    }

    return newHead;
  }

  /**
   * Queue growth when food is eaten
   */
  grow(amount = 1) {
    this.pendingGrowth += amount;
  }

  getHead() {
    return this.segments[0];
  }

  getBody() {
    return this.segments.slice(1);
  }

  getLength() {
    return this.segments.length;
  }

  /**
   * Checks if a coordinate is occupied by any snake segment
   */
  occupies(x, y, includeHead = true) {
    const startIdx = includeHead ? 0 : 1;
    for (let i = startIdx; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.x === x && seg.y === y) {
        return true;
      }
    }
    return false;
  }
}
