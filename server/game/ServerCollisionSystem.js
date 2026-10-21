/**
 * ServerCollisionSystem - Authoritative Collision Detection & Simultaneous Resolution
 */

import { GRID_SIZE } from './constants.js';

export class ServerCollisionSystem {
  /**
   * Check if head coordinate hit an arena outer wall
   */
  static isWallHit(head) {
    return head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
  }

  /**
   * Check if head coordinate hits snake segments
   * @param {Object} head {x, y}
   * @param {Array} segments Snake segment array
   * @param {boolean} tailWillDepart True if snake will pop tail this tick
   * @param {number} startIdx Start index (1 for self to skip current head, 0 for opponent)
   */
  static isSegmentHit(head, segments, tailWillDepart, startIdx = 0) {
    if (!segments || segments.length === 0) return false;
    const endIdx = tailWillDepart ? segments.length - 1 : segments.length;

    for (let i = startIdx; i < endIdx; i++) {
      const seg = segments[i];
      if (seg.x === head.x && seg.y === head.y) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluates all collisions between two snakes moving into nextHead1 and nextHead2.
   *
   * @param {ServerSnake} snake1
   * @param {ServerSnake} snake2
   * @param {Object} nextHead1
   * @param {Object} nextHead2
   * @returns {Object} Evaluation summary
   */
  static evaluate(snake1, snake2, nextHead1, nextHead2) {
    const tail1WillDepart = snake1.pendingGrowth === 0;
    const tail2WillDepart = snake2.pendingGrowth === 0;

    let s1Wall = false;
    let s2Wall = false;
    let s1Self = false;
    let s2Self = false;
    let s1HitS2 = false;
    let s2HitS1 = false;
    let headToHead = false;

    // 1. Wall Collisions
    if (this.isWallHit(nextHead1)) s1Wall = true;
    if (this.isWallHit(nextHead2)) s2Wall = true;

    // 2. Head-to-Head Collision
    if (nextHead1.x === nextHead2.x && nextHead1.y === nextHead2.y) {
      headToHead = true;
    }

    // 3. Self Collisions
    if (!s1Wall && this.isSegmentHit(nextHead1, snake1.segments, tail1WillDepart, 1)) {
      s1Self = true;
    }
    if (!s2Wall && this.isSegmentHit(nextHead2, snake2.segments, tail2WillDepart, 1)) {
      s2Self = true;
    }

    // 4. Opponent Body Collisions
    if (!s1Wall && !headToHead && this.isSegmentHit(nextHead1, snake2.segments, tail2WillDepart, 0)) {
      s1HitS2 = true;
    }
    if (!s2Wall && !headToHead && this.isSegmentHit(nextHead2, snake1.segments, tail1WillDepart, 0)) {
      s2HitS1 = true;
    }

    // Determine Eliminations
    const s1Eliminated = s1Wall || s1Self || s1HitS2 || headToHead;
    const s2Eliminated = s2Wall || s2Self || s2HitS1 || headToHead;

    let s1Reason = null;
    if (s1Wall) s1Reason = 'WALL_COLLISION';
    else if (s1Self) s1Reason = 'SELF_COLLISION';
    else if (headToHead) s1Reason = 'HEAD_TO_HEAD_COLLISION';
    else if (s1HitS2) s1Reason = 'OPPONENT_BODY_COLLISION';

    let s2Reason = null;
    if (s2Wall) s2Reason = 'WALL_COLLISION';
    else if (s2Self) s2Reason = 'SELF_COLLISION';
    else if (headToHead) s2Reason = 'HEAD_TO_HEAD_COLLISION';
    else if (s2HitS1) s2Reason = 'OPPONENT_BODY_COLLISION';

    // Outcome determination
    let matchEnded = false;
    let isDraw = false;
    let winnerId = null;
    let outcomeReason = null;

    if (s1Eliminated && s2Eliminated) {
      matchEnded = true;
      isDraw = true;
      winnerId = null;
      outcomeReason = headToHead ? 'MUTUAL_HEAD_COLLISION' : 'SIMULTANEOUS_COLLISION';
    } else if (s1Eliminated) {
      matchEnded = true;
      isDraw = false;
      winnerId = snake2.playerId;
      outcomeReason = s1Reason;
    } else if (s2Eliminated) {
      matchEnded = true;
      isDraw = false;
      winnerId = snake1.playerId;
      outcomeReason = s2Reason;
    }

    return {
      s1Eliminated,
      s1Reason,
      s2Eliminated,
      s2Reason,
      matchEnded,
      isDraw,
      winnerId,
      outcomeReason,
    };
  }
}
