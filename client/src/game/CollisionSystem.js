/**
 * CollisionSystem - Detects collisions with walls and snake self
 */

import { GRID_SIZE } from './constants.js';

export class CollisionSystem {
  /**
   * Check if snake head struck an arena boundary
   */
  static checkWallCollision(head) {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true;
    }
    return false;
  }

  /**
   * Check if snake head struck any part of its own body
   */
  static checkSelfCollision(head, body) {
    // Body is segments slice(1)
    for (let i = 0; i < body.length; i++) {
      if (head.x === body[i].x && head.y === body[i].y) {
        return true;
      }
    }
    return false;
  }

  /**
   * Run full collision check on the snake
   */
  static evaluate(snake) {
    const head = snake.getHead();
    const body = snake.getBody();

    if (this.checkWallCollision(head)) {
      return { collided: true, reason: 'WALL' };
    }

    if (this.checkSelfCollision(head, body)) {
      return { collided: true, reason: 'SELF' };
    }

    return { collided: false, reason: null };
  }
}
