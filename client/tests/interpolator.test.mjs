import { SnapshotInterpolator } from '../src/network/SnapshotInterpolator.js';

console.log('=== STARTING SNAPSHOT INTERPOLATOR UNIT TESTS ===');

const interpolator = new SnapshotInterpolator(100);

// 1. Initial snapshot has no previous state -> returns current directly
const snap0 = {
  status: 'ACTIVE',
  tick: 0,
  p1: {
    isAlive: true,
    segments: [{ x: 7, y: 15 }, { x: 6, y: 15 }, { x: 5, y: 15 }, { x: 4, y: 15 }],
  },
  p2: {
    isAlive: true,
    segments: [{ x: 22, y: 15 }, { x: 23, y: 15 }, { x: 24, y: 15 }, { x: 25, y: 15 }],
  },
};

interpolator.pushSnapshot(snap0, 1000);
const state0 = interpolator.getInterpolatedState(1000);
if (state0.p1.segments[0].x !== 7 || state0.p1.segments[0].y !== 15) {
  throw new Error('Initial snapshot should not interpolate without previous state');
}
console.log('✓ Test 1 Passed: Initial snapshot directly returned without ghost interpolation');

// 2. Next tick arrives 100ms later (both snakes moved 1 unit)
const snap1 = {
  status: 'ACTIVE',
  tick: 1,
  p1: {
    isAlive: true,
    segments: [{ x: 8, y: 15 }, { x: 7, y: 15 }, { x: 6, y: 15 }, { x: 5, y: 15 }],
  },
  p2: {
    isAlive: true,
    segments: [{ x: 21, y: 15 }, { x: 22, y: 15 }, { x: 23, y: 15 }, { x: 24, y: 15 }],
  },
};
interpolator.pushSnapshot(snap1, 1100);

// At elapsed = 50ms (alpha = 0.5)
const midState = interpolator.getInterpolatedState(1150);
const p1MidHead = midState.p1.segments[0];
const p2MidHead = midState.p2.segments[0];

if (Math.abs(p1MidHead.x - 7.5) > 0.001 || p1MidHead.y !== 15) {
  throw new Error(`P1 head should be at 7.5, got ${p1MidHead.x}`);
}
if (Math.abs(p2MidHead.x - 21.5) > 0.001 || p2MidHead.y !== 15) {
  throw new Error(`P2 head should be at 21.5, got ${p2MidHead.x}`);
}
console.log('✓ Test 2 Passed: 50% midpoint smoothly interpolated to sub-pixel coordinates (7.5, 21.5)');

// 3. At elapsed = 100ms (alpha = 1.0) -> exactly matches snapshot 1
const endState = interpolator.getInterpolatedState(1200);
if (endState.p1.segments[0].x !== 8 || endState.p2.segments[0].x !== 21) {
  throw new Error('Alpha = 1.0 should reach exact current snapshot coordinates');
}
console.log('✓ Test 3 Passed: 100% completion matches authoritative server positions');

// 4. Overdue packets (elapsed = 300ms) -> clamped to 1.0, NO indefinite extrapolation into walls!
const overdueState = interpolator.getInterpolatedState(1400);
if (overdueState.p1.segments[0].x !== 8) {
  throw new Error(`Overdue state extrapolated past current position: ${overdueState.p1.segments[0].x}`);
}
console.log('✓ Test 4 Passed: No over-extrapolation past snapshot boundary when packets are late');

// 5. Growth interpolation: snake grows from length 4 to 5
const snap2 = {
  status: 'ACTIVE',
  tick: 2,
  p1: {
    isAlive: true,
    segments: [{ x: 9, y: 15 }, { x: 8, y: 15 }, { x: 7, y: 15 }, { x: 6, y: 15 }, { x: 5, y: 15 }],
  },
  p2: {
    isAlive: true,
    segments: [{ x: 20, y: 15 }, { x: 21, y: 15 }, { x: 22, y: 15 }, { x: 23, y: 15 }],
  },
};
interpolator.pushSnapshot(snap2, 1200);
const growthMid = interpolator.getInterpolatedState(1250);
if (growthMid.p1.segments.length !== 5) {
  throw new Error('Grown snake should have 5 segments during interpolation');
}
// Tail was at 5, new segment emerges smoothly
if (growthMid.p1.segments[4].x !== 5) {
  throw new Error('Tail should stay anchored during growth');
}
console.log('✓ Test 5 Passed: Snake growth handled smoothly without visual teleportation');

// 6. Match restart / tick rewind resets interpolator
const snapRestart = {
  status: 'ACTIVE',
  tick: 0, // rewind
  p1: { isAlive: true, segments: [{ x: 7, y: 15 }] },
};
interpolator.pushSnapshot(snapRestart, 2000);
if (interpolator.prevSnapshot !== null) {
  throw new Error('Tick rewind did not reset previous snapshot');
}
console.log('✓ Test 6 Passed: State discontinuity cleanly resets interpolation buffer');

// 7. Dead snake remains stationary
const deadSnap = {
  status: 'ACTIVE',
  tick: 1,
  p1: { isAlive: false, segments: [{ x: 0, y: 0 }] },
};
interpolator.pushSnapshot(deadSnap, 2100);
const deadState = interpolator.getInterpolatedState(2150);
if (deadState.p1.segments[0].x !== 0) {
  throw new Error('Dead snake moved unexpectedly');
}
console.log('✓ Test 7 Passed: Dead snake remains stationary at collision site');

// 8. Reset method clears state
interpolator.reset();
if (interpolator.currSnapshot !== null || interpolator.prevSnapshot !== null) {
  throw new Error('Reset failed to clear snapshot references');
}
console.log('✓ Test 8 Passed: Reset method completely flushes buffer');

console.log('=== ALL SNAPSHOT INTERPOLATOR TESTS PASSED! ===');
