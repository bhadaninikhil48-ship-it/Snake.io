/**
 * FoodManager - Spawns and manages food on the grid avoiding snake collisions
 */

import { GRID_SIZE, FOOD_TYPES } from './constants.js';

export class FoodManager {
  constructor() {
    this.currentFood = null;
    this.foodEatenCount = 0;
  }

  reset() {
    this.currentFood = null;
    this.foodEatenCount = 0;
  }

  /**
   * Spawns food at a strictly valid, unoccupied position.
   * Prevents food from ever appearing inside the snake.
   */
  spawn(snake) {
    const totalCells = GRID_SIZE * GRID_SIZE;
    const occupiedCount = snake.getLength();

    // Board is completely full (win condition!)
    if (occupiedCount >= totalCells) {
      this.currentFood = null;
      return null;
    }

    let targetX = 0;
    let targetY = 0;

    // Fast path: if board has plenty of space (> 40% free), use rejection sampling
    if (occupiedCount < totalCells * 0.6) {
      let attempts = 0;
      let valid = false;

      while (!valid && attempts < 100) {
        targetX = Math.floor(Math.random() * GRID_SIZE);
        targetY = Math.floor(Math.random() * GRID_SIZE);
        attempts++;

        if (!snake.occupies(targetX, targetY, true)) {
          valid = true;
        }
      }

      if (!valid) {
        // Fallback to deterministic empty cell search
        const emptyCell = this.findRandomEmptyCell(snake);
        if (emptyCell) {
          targetX = emptyCell.x;
          targetY = emptyCell.y;
        }
      }
    } else {
      // Deterministic empty cell collection when snake is long
      const emptyCell = this.findRandomEmptyCell(snake);
      if (emptyCell) {
        targetX = emptyCell.x;
        targetY = emptyCell.y;
      }
    }

    // Every 5th food has a 50% chance to be a Super Quantum Core
    const isSuper = this.foodEatenCount > 0 && this.foodEatenCount % 5 === 0 && Math.random() > 0.3;
    const type = isSuper ? FOOD_TYPES.SUPER : FOOD_TYPES.REGULAR;

    this.currentFood = {
      x: targetX,
      y: targetY,
      type,
      id: Math.random().toString(36).substring(2, 9),
      spawnTime: performance.now(),
    };

    return this.currentFood;
  }

  /**
   * Finds all vacant coordinates and picks one randomly
   */
  findRandomEmptyCell(snake) {
    const emptyCells = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!snake.occupies(x, y, true)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
  }

  /**
   * Check if snake head is on current food
   */
  checkCollision(head) {
    if (!this.currentFood) return null;
    if (head.x === this.currentFood.x && head.y === this.currentFood.y) {
      const consumed = this.currentFood;
      this.foodEatenCount++;
      return consumed;
    }
    return null;
  }
}
