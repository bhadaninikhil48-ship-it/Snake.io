/**
 * GameLoop - Fixed timestep simulation loop powered by requestAnimationFrame
 * Decouples logic ticks from high-framerate visual rendering.
 */

export class GameLoop {
  constructor(onTick, onRender) {
    this.onTick = onTick;
    this.onRender = onRender;
    this.tickInterval = 100; // ms per grid movement step
    this.isRunning = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.frameId = null;

    this.loop = this.loop.bind(this);
  }

  setSpeed(intervalMs) {
    this.tickInterval = Math.max(30, intervalMs);
  }

  start() {
    if (this.isRunning) {
      return; // Prevent duplicate loops
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    // Calculate elapsed delta
    const delta = Math.min(currentTime - this.lastTime, 250); // Clamp to avoid spiral of death on tab switch
    this.lastTime = currentTime;
    this.accumulator += delta;

    // Execute logic ticks at fixed rate
    while (this.accumulator >= this.tickInterval) {
      this.onTick();
      this.accumulator -= this.tickInterval;
      if (!this.isRunning) break;
    }

    // Always render on every display refresh frame
    if (this.isRunning) {
      this.onRender(currentTime);
      this.frameId = requestAnimationFrame(this.loop);
    }
  }
}
