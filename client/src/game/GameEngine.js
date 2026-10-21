/**
 * GameEngine - Central orchestrator for the Snake Clash single-player experience
 */

import { Snake } from './Snake.js';
import { FoodManager } from './FoodManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Renderer } from './Renderer.js';
import { InputManager } from './InputManager.js';
import { GameLoop } from './GameLoop.js';
import { soundManager } from './SoundManager.js';
import {
  GAME_STATES,
  SPEED_PRESETS,
  CELL_SIZE,
} from './constants.js';

export class GameEngine {
  constructor(onUpdate) {
    this.onUpdate = onUpdate || (() => {});
    
    // Core game components
    this.snake = new Snake(4);
    this.foodManager = new FoodManager();
    this.particleSystem = new ParticleSystem();
    this.renderer = new Renderer();

    // Canvas & Context
    this.canvas = null;
    this.ctx = null;

    // Game stats
    this.state = GAME_STATES.MENU;
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.isNewHighScore = false;
    this.deathReason = null;
    this.speedKey = 'NORMAL';

    // Loop & Input
    this.gameLoop = new GameLoop(
      () => this.tick(),
      (timestamp) => this.render(timestamp)
    );
    this.gameLoop.setSpeed(SPEED_PRESETS[this.speedKey].tickInterval);

    this.inputManager = new InputManager(
      () => this.togglePause(),
      () => this.handleActionKey(),
      () => this.toggleMute()
    );

    // Initial food spawn for menu background animation
    this.foodManager.spawn(this.snake);
  }

  loadHighScore() {
    try {
      const saved = localStorage.getItem('snake_clash_high_score');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }

  saveHighScore(newScore) {
    try {
      localStorage.setItem('snake_clash_high_score', newScore.toString());
    } catch {
      // Ignore storage errors
    }
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    if (canvas) {
      this.ctx = canvas.getContext('2d');
    }
  }

  setSpeedPreset(speedKey) {
    if (SPEED_PRESETS[speedKey]) {
      this.speedKey = speedKey;
      this.gameLoop.setSpeed(SPEED_PRESETS[speedKey].tickInterval);
      this.notify();
    }
  }

  toggleMute() {
    const muted = soundManager.toggleMute();
    this.notify();
    return muted;
  }

  handleActionKey() {
    if (this.state === GAME_STATES.GAME_OVER) {
      this.restartGame();
    } else if (this.state === GAME_STATES.MENU) {
      this.startGame();
    }
  }

  /**
   * Start fresh game from Menu or Game Over
   */
  startGame() {
    this.state = GAME_STATES.PLAYING;
    this.score = 0;
    this.isNewHighScore = false;
    this.deathReason = null;

    this.snake.reset();
    this.foodManager.reset();
    this.particleSystem.reset();

    this.foodManager.spawn(this.snake);
    this.inputManager.attach();
    this.inputManager.clearQueue();

    this.gameLoop.setSpeed(SPEED_PRESETS[this.speedKey].tickInterval);
    this.gameLoop.start();

    soundManager.playStart();
    this.notify();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) {
      this.state = GAME_STATES.PAUSED;
      this.gameLoop.stop();
      this.notify();
    } else if (this.state === GAME_STATES.PAUSED) {
      this.state = GAME_STATES.PLAYING;
      this.gameLoop.start();
      this.notify();
    }
  }

  goToMenu() {
    this.state = GAME_STATES.MENU;
    this.gameLoop.stop();
    this.inputManager.detach();

    this.snake.reset();
    this.foodManager.reset();
    this.particleSystem.reset();
    this.foodManager.spawn(this.snake);

    this.notify();
    this.renderSingleFrame();
  }

  /**
   * Manual direction injection (for touch controls or D-pad)
   */
  sendDirection(dir) {
    if (this.state === GAME_STATES.PLAYING) {
      this.inputManager.pushDirection(dir);
      this.renderSingleFrame();
    }
  }

  /**
   * Logic Tick: Movement, Collision, Food consumption
   */
  tick() {
    if (this.state !== GAME_STATES.PLAYING) return;

    // Check buffered input direction
    const nextDir = this.inputManager.nextDirection(this.snake.direction);
    if (nextDir) {
      this.snake.setDirection(nextDir);
    }

    // Advance snake
    const newHead = this.snake.step();
    if (!newHead) return;

    // Check collisions
    const collision = CollisionSystem.evaluate(this.snake);
    if (collision.collided) {
      this.handleGameOver(collision.reason);
      return;
    }

    // Check food collection
    const eatenFood = this.foodManager.checkCollision(newHead);
    if (eatenFood) {
      this.handleFoodEaten(eatenFood);
    }

    // Update particles
    this.particleSystem.update();

    this.notify();
  }

  handleFoodEaten(food) {
    this.snake.grow(food.type.growth);
    this.score += food.type.points;

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewHighScore = true;
      this.saveHighScore(this.highScore);
    }

    // Spawn sparks
    const fx = food.x * CELL_SIZE + CELL_SIZE / 2;
    const fy = food.y * CELL_SIZE + CELL_SIZE / 2;
    this.particleSystem.emitFoodSparks(fx, fy, food.type.color, food.type.id === 'SUPER' ? 24 : 14);

    // Audio cue
    if (food.type.id === 'SUPER') {
      soundManager.playSuperEat();
    } else {
      soundManager.playEat();
    }

    // Spawn new food
    this.foodManager.spawn(this.snake);
  }

  handleGameOver(reason) {
    this.state = GAME_STATES.GAME_OVER;
    this.deathReason = reason;
    this.snake.isAlive = false;

    // Emit explosion particles
    this.particleSystem.emitDeathExplosion(this.snake.segments, CELL_SIZE);
    soundManager.playDie();

    this.gameLoop.stop();
    this.notify();

    // Render death state and continue updating particles for half a second
    this.renderSingleFrame();
    this.runDeathParticleAnimation();
  }

  runDeathParticleAnimation() {
    let frames = 0;
    const animateDeath = () => {
      if (this.state !== GAME_STATES.GAME_OVER) return;
      this.particleSystem.update();
      this.renderSingleFrame();
      frames++;
      if (frames < 45 && this.particleSystem.particles.length > 0) {
        requestAnimationFrame(animateDeath);
      }
    };
    requestAnimationFrame(animateDeath);
  }

  render(timestamp) {
    if (!this.ctx) return;
    this.renderer.render(
      this.ctx,
      {
        snake: this.snake,
        food: this.foodManager.currentFood,
        particles: this.particleSystem,
        isGameOver: this.state === GAME_STATES.GAME_OVER,
        intendedDirection: this.inputManager.peekDirection()?.name,
      },
      timestamp
    );
  }

  renderSingleFrame() {
    this.render(performance.now());
  }

  notify() {
    this.onUpdate({
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      snakeLength: this.snake.getLength(),
      speedKey: this.speedKey,
      isNewHighScore: this.isNewHighScore,
      deathReason: this.deathReason,
      isMuted: soundManager.isMuted,
    });
  }

  destroy() {
    this.gameLoop.stop();
    this.inputManager.detach();
    this.canvas = null;
    this.ctx = null;
  }
}
