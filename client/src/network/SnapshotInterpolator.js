/**
 * SnapshotInterpolator - Smooth client-side visual interpolation
 * between authoritative server snapshots.
 */

export class SnapshotInterpolator {
  constructor(defaultTickInterval = 100) {
    this.defaultTickInterval = defaultTickInterval;
    this.prevSnapshot = null;
    this.currSnapshot = null;
    this.prevSnapshotTime = 0;
    this.currSnapshotTime = 0;
    this.tickInterval = defaultTickInterval;
  }

  /**
   * Resets all cached snapshots and timestamps
   */
  reset() {
    this.prevSnapshot = null;
    this.currSnapshot = null;
    this.prevSnapshotTime = 0;
    this.currSnapshotTime = 0;
    this.tickInterval = this.defaultTickInterval;
  }

  /**
   * Pushes a new authoritative server snapshot into the buffer
   */
  pushSnapshot(snapshot, receiveTime = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!snapshot) return;

    // Detect state discontinuity (e.g. status change, tick rewind, match restart)
    if (
      !this.currSnapshot ||
      snapshot.status !== this.currSnapshot.status ||
      (typeof snapshot.tick === 'number' && snapshot.tick <= this.currSnapshot.tick)
    ) {
      this.prevSnapshot = null;
      this.currSnapshot = snapshot;
      this.currSnapshotTime = receiveTime;
      this.prevSnapshotTime = receiveTime;
      this.tickInterval = this.defaultTickInterval;
      return;
    }

    // Adaptive tick interval estimation (smooths out small network jitter)
    if (this.currSnapshotTime > 0) {
      const delta = receiveTime - this.currSnapshotTime;
      if (delta >= 50 && delta <= 250) {
        this.tickInterval = this.tickInterval * 0.7 + delta * 0.3;
      }
    }

    this.prevSnapshot = this.currSnapshot;
    this.prevSnapshotTime = this.currSnapshotTime;
    this.currSnapshot = snapshot;
    this.currSnapshotTime = receiveTime;
  }

  /**
   * Calculates smooth interpolated positions for the current rendering frame
   */
  getInterpolatedState(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.currSnapshot) return null;
    if (!this.prevSnapshot) return this.currSnapshot;

    // Only interpolate active gameplay states
    if (this.currSnapshot.status !== 'ACTIVE' && this.currSnapshot.status !== 'COUNTDOWN') {
      return this.currSnapshot;
    }

    // Progression ratio: 0.0 (at previous snapshot) -> 1.0 (at current snapshot)
    const elapsed = Math.max(0, now - this.currSnapshotTime);
    const alpha = Math.min(1.0, elapsed / Math.max(30, this.tickInterval));

    // Clamped at 1.0: if updates pause, never extrapolate indefinitely into walls
    if (alpha >= 1.0) {
      return this.currSnapshot;
    }

    return {
      ...this.currSnapshot,
      p1: this.interpolateSnake(this.prevSnapshot.p1, this.currSnapshot.p1, alpha),
      p2: this.interpolateSnake(this.prevSnapshot.p2, this.currSnapshot.p2, alpha),
    };
  }

  /**
   * Interpolates segment positions for an individual snake
   */
  interpolateSnake(prevSnake, currSnake, alpha) {
    if (!currSnake) return null;
    if (!prevSnake || !prevSnake.segments || !currSnake.segments) {
      return currSnake;
    }

    // If snake was already eliminated before this tick, do not move it
    if (!prevSnake.isAlive && !currSnake.isAlive) {
      return currSnake;
    }

    const prevSegs = prevSnake.segments;
    const currSegs = currSnake.segments;

    if (prevSegs.length === 0 || currSegs.length === 0) {
      return currSnake;
    }

    // Discontinuity guard: if head jumped more than 2 grid cells (e.g. teleport), do not interpolate
    const headDist = Math.abs(currSegs[0].x - prevSegs[0].x) + Math.abs(currSegs[0].y - prevSegs[0].y);
    if (headDist > 2) {
      return currSnake;
    }

    const interpolatedSegments = currSegs.map((currSeg, i) => {
      let prevSeg;
      if (i < prevSegs.length) {
        prevSeg = prevSegs[i];
      } else {
        // Growth case: newly added segment emerges smoothly from previous tail position
        prevSeg = prevSegs[prevSegs.length - 1];
      }

      // Check distance for this segment
      const segDist = Math.abs(currSeg.x - prevSeg.x) + Math.abs(currSeg.y - prevSeg.y);
      if (segDist > 1.5) {
        return { x: currSeg.x, y: currSeg.y };
      }

      return {
        x: prevSeg.x + (currSeg.x - prevSeg.x) * alpha,
        y: prevSeg.y + (currSeg.y - prevSeg.y) * alpha,
      };
    });

    return {
      ...currSnake,
      segments: interpolatedSegments,
    };
  }
}
