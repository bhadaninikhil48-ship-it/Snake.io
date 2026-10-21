/**
 * ServerFoodManager - Authoritative Server-Side Food Generator
 */

import { GRID_SIZE, FOOD_TYPES } from './constants.js';

export class ServerFoodManager {
  constructor() {
    this.currentFood = null;
    this.foodCount = 0;
  }

  /**
   * Spawns food strictly on an empty cell not occupied by any snake
   */
  spawn(snakes = []) {
    const totalCells = GRID_SIZE * GRID_SIZE;
    const occupied = new Set();

    for (const snake of snakes) {
      if (snake && Array.isArray(snake.segments)) {
        for (const seg of snake.segments) {
          occupied.add(`${seg.x},${seg.y}`);
        }
      }
    }

    if (occupied.size >= totalCells) {
      this.currentFood = null;
      return null;
    }

    let targetX = 0;
    let targetY = 0;
    let found = false;

    // Fast path: rejection sampling if > 40% board is free
    if (occupied.size < totalCells * 0.6) {
      let attempts = 0;
      while (!found && attempts < 150) {
        targetX = Math.floor(Math.random() * GRID_SIZE);
        targetY = Math.floor(Math.random() * GRID_SIZE);
        if (!occupied.has(`${targetX},${targetY}`)) {
          found = true;
        }
        attempts++;
      }
    }

    // Fallback: deterministic collection of empty coordinates
    if (!found) {
      const emptyCells = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          if (!occupied.has(`${x},${y}`)) {
            emptyCells.push({ x, y });
          }
        }
      }

      if (emptyCells.length === 0) {
        this.currentFood = null;
        return null;
      }

      const randomIdx = Math.floor(Math.random() * emptyCells.length);
      targetX = emptyCells[randomIdx].x;
      targetY = emptyCells[randomIdx].y;
    }

    this.foodCount++;
    const isSuper = this.foodCount > 0 && this.foodCount % 5 === 0 && Math.random() > 0.3;
    const type = isSuper ? FOOD_TYPES.SUPER : FOOD_TYPES.REGULAR;

    this.currentFood = {
      x: targetX,
      y: targetY,
      type: type.id,
      points: type.points,
      growth: type.growth,
      color: type.color,
    };

    return this.currentFood;
  }

  checkCollision(head) {
    if (!this.currentFood || !head) return null;
    if (head.x === this.currentFood.x && head.y === this.currentFood.y) {
      return this.currentFood;
    }
    return null;
  }

  toJSON() {
    return this.currentFood;
  }
}
