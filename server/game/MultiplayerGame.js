/**
 * MultiplayerGame - Authoritative Match Manager & Simulation Loop
 */

import { ServerSnake } from './ServerSnake.js';
import { ServerFoodManager } from './ServerFoodManager.js';
import { ServerCollisionSystem } from './ServerCollisionSystem.js';
import {
  TICK_INTERVAL_MS,
  COUNTDOWN_SECONDS,
  MATCH_STATUS,
} from './constants.js';

export class MultiplayerGame {
  constructor(roomCode, player1, player2, callbacks = {}) {
    this.roomCode = roomCode;
    this.player1 = player1;
    this.player2 = player2;
    this.callbacks = {
      onCountdown: callbacks.onCountdown || (() => {}),
      onTick: callbacks.onTick || (() => {}),
      onMatchEnd: callbacks.onMatchEnd || (() => {}),
    };

    this.status = MATCH_STATUS.COUNTDOWN;
    this.tickCount = 0;
    this.countdownSeconds = COUNTDOWN_SECONDS;

    this.loopTimer = null;
    this.countdownTimer = null;
    this.isDestroyed = false;

    // 1. Spawn Player 1: Left side, facing RIGHT
    this.snake1 = new ServerSnake(
      player1.id,
      player1.name,
      player1.color || '#00f3ff',
      { x: 7, y: 15 },
      'RIGHT',
      4
    );

    // 2. Spawn Player 2: Right side, facing LEFT
    this.snake2 = new ServerSnake(
      player2.id,
      player2.name,
      player2.color || '#ff007f',
      { x: 22, y: 15 },
      'LEFT',
      4
    );

    // 3. Initialize Food Manager and spawn initial food
    this.foodManager = new ServerFoodManager();
    this.foodManager.spawn([this.snake1, this.snake2]);
  }

  /**
   * Starts the 3-second countdown before game begins
   */
  startCountdown() {
    this.stopLoop();
    this.status = MATCH_STATUS.COUNTDOWN;
    this.countdownSeconds = COUNTDOWN_SECONDS;

    // Send initial countdown state
    this.callbacks.onCountdown(this.countdownSeconds, this.getSnapshot());

    this.countdownTimer = setInterval(() => {
      if (this.isDestroyed) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }

      this.countdownSeconds--;
      this.callbacks.onCountdown(this.countdownSeconds, this.getSnapshot());

      if (this.countdownSeconds <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.startLoop();
      }
    }, 1000);
  }

  /**
   * Starts the authoritative 100ms simulation loop
   */
  startLoop() {
    if (this.loopTimer || this.isDestroyed) return;

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.status = MATCH_STATUS.ACTIVE;
    this.callbacks.onTick(this.getSnapshot());

    this.loopTimer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  /**
   * Stops simulation loop
   */
  stopLoop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  /**
   * Validates and queues direction input from a player
   */
  handleInput(playerId, direction) {
    if (this.status !== MATCH_STATUS.ACTIVE || this.isDestroyed) {
      return false;
    }

    if (playerId === this.snake1.playerId) {
      return this.snake1.queueDirection(direction);
    } else if (playerId === this.snake2.playerId) {
      return this.snake2.queueDirection(direction);
    }

    return false;
  }

  /**
   * Authoritative simulation tick
   */
  tick() {
    if (this.status !== MATCH_STATUS.ACTIVE || this.isDestroyed) return;

    this.tickCount++;

    // 1. Apply buffered input directions
    this.snake1.applyDirection();
    this.snake2.applyDirection();

    // 2. Compute next head positions
    const nextHead1 = this.snake1.computeNextHead();
    const nextHead2 = this.snake2.computeNextHead();

    // 3. Evaluate Collisions
    const col = ServerCollisionSystem.evaluate(
      this.snake1,
      this.snake2,
      nextHead1,
      nextHead2
    );

    // 4. Handle Match End if collision occurred
    if (col.matchEnded) {
      if (col.s1Eliminated) this.snake1.eliminate(col.s1Reason);
      if (col.s2Eliminated) this.snake2.eliminate(col.s2Reason);

      this.status = MATCH_STATUS.ENDED;
      this.stopLoop();

      const endResult = {
        winnerId: col.winnerId,
        isDraw: col.isDraw,
        reason: col.outcomeReason,
        finalScores: {
          [this.snake1.playerId]: this.snake1.score,
          [this.snake2.playerId]: this.snake2.score,
        },
      };

      this.callbacks.onMatchEnd(endResult);
      this.callbacks.onTick(this.getSnapshot(endResult));
      return;
    }

    // 5. Check Food Consumption
    let foodConsumed = false;

    const s1Food = this.foodManager.checkCollision(nextHead1);
    if (s1Food) {
      this.snake1.grow(s1Food.growth);
      this.snake1.addScore(s1Food.points);
      foodConsumed = true;
    }

    const s2Food = this.foodManager.checkCollision(nextHead2);
    if (s2Food) {
      this.snake2.grow(s2Food.growth);
      this.snake2.addScore(s2Food.points);
      foodConsumed = true;
    }

    // 6. Advance snakes
    this.snake1.step(nextHead1);
    this.snake2.step(nextHead2);

    // 7. Respawn food if consumed
    if (foodConsumed) {
      this.foodManager.spawn([this.snake1, this.snake2]);
    }

    // 8. Broadcast Game State
    this.callbacks.onTick(this.getSnapshot());
  }

  /**
   * Handle player disconnection during match
   */
  handleDisconnect(disconnectedPlayerId) {
    if (this.status === MATCH_STATUS.ENDED || this.isDestroyed) return;

    this.stopLoop();
    this.status = MATCH_STATUS.ENDED;

    const remainingPlayer =
      disconnectedPlayerId === this.snake1.playerId ? this.snake2 : this.snake1;

    const endResult = {
      winnerId: remainingPlayer.playerId,
      isDraw: false,
      reason: 'OPPONENT_DISCONNECTED',
      finalScores: {
        [this.snake1.playerId]: this.snake1.score,
        [this.snake2.playerId]: this.snake2.score,
      },
    };

    this.callbacks.onMatchEnd(endResult);
    this.callbacks.onTick(this.getSnapshot(endResult));
  }

  /**
   * Compiles authoritative state packet for broadcast
   */
  getSnapshot(extra = {}) {
    return {
      roomCode: this.roomCode,
      status: this.status,
      tick: this.tickCount,
      countdown: this.status === MATCH_STATUS.COUNTDOWN ? this.countdownSeconds : 0,
      p1: this.snake1.toJSON(),
      p2: this.snake2.toJSON(),
      food: this.foodManager.toJSON(),
      winnerId: extra.winnerId !== undefined ? extra.winnerId : null,
      isDraw: extra.isDraw !== undefined ? extra.isDraw : false,
      outcomeReason: extra.reason !== undefined ? extra.reason : null,
    };
  }

  destroy() {
    this.isDestroyed = true;
    this.stopLoop();
  }
}
