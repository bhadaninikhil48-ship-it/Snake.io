/**
 * Unit Test Suite for Swipe Controls (SwipeController)
 */

import { SwipeController } from '../src/game/SwipeController.js';

console.log('=== STARTING SWIPE CONTROLS UNIT TESTS ===');

const controller = new SwipeController({ minDistance: 25 });

// 1. Test Swipe Right (dx: 40, dy: 5)
const rightResult = controller.resolveSwipe(40, 5, 'UP');
if (!rightResult || rightResult.name !== 'RIGHT') {
  throw new Error(`Swipe right failed: expected RIGHT, got ${rightResult?.name}`);
}
console.log('✓ Test 1 Passed: Horizontal-dominant positive dx triggers RIGHT');

// 2. Test Swipe Left (dx: -50, dy: 10)
const leftResult = controller.resolveSwipe(-50, 10, 'UP');
if (!leftResult || leftResult.name !== 'LEFT') {
  throw new Error(`Swipe left failed: expected LEFT, got ${leftResult?.name}`);
}
console.log('✓ Test 2 Passed: Horizontal-dominant negative dx triggers LEFT');

// 3. Test Swipe Up (dx: 4, dy: -60)
const upResult = controller.resolveSwipe(4, -60, 'LEFT');
if (!upResult || upResult.name !== 'UP') {
  throw new Error(`Swipe up failed: expected UP, got ${upResult?.name}`);
}
console.log('✓ Test 3 Passed: Vertical-dominant negative dy triggers UP');

// 4. Test Swipe Down (dx: -5, dy: 45)
const downResult = controller.resolveSwipe(-5, 45, 'LEFT');
if (!downResult || downResult.name !== 'DOWN') {
  throw new Error(`Swipe down failed: expected DOWN, got ${downResult?.name}`);
}
console.log('✓ Test 4 Passed: Vertical-dominant positive dy triggers DOWN');

// 5. Test Short Swipes below threshold (20px < 25px threshold)
const shortX = controller.resolveSwipe(20, 5);
const shortY = controller.resolveSwipe(5, -24);
if (shortX !== null || shortY !== null) {
  throw new Error(`Short swipe below threshold was not ignored: x=${shortX}, y=${shortY}`);
}
console.log('✓ Test 5 Passed: Gestures shorter than minimum threshold (25px) are ignored');

// 6. Test 180-degree Reversal Restrictions
// If moving RIGHT, a swipe LEFT must be rejected
const reverseLeft = controller.resolveSwipe(-50, 0, 'RIGHT');
if (reverseLeft !== null) {
  throw new Error('Reversal check failed: allowed LEFT while moving RIGHT');
}
// If moving UP, a swipe DOWN must be rejected
const reverseDown = controller.resolveSwipe(0, 50, 'UP');
if (reverseDown !== null) {
  throw new Error('Reversal check failed: allowed DOWN while moving UP');
}
// If moving DOWN, a swipe UP must be rejected
const reverseUp = controller.resolveSwipe(0, -50, 'DOWN');
if (reverseUp !== null) {
  throw new Error('Reversal check failed: allowed UP while moving DOWN');
}
// If moving LEFT, a swipe RIGHT must be rejected
const reverseRight = controller.resolveSwipe(50, 0, 'LEFT');
if (reverseRight !== null) {
  throw new Error('Reversal check failed: allowed RIGHT while moving LEFT');
}
// Same direction swipe also returns null (no-op)
const sameDir = controller.resolveSwipe(50, 0, 'RIGHT');
if (sameDir !== null) {
  throw new Error('Same direction check failed: allowed redundant turn request');
}
console.log('✓ Test 6 Passed: 180-degree immediate reversal into opposite direction is blocked');

// 7. Test Pointer Lifecycle & Cancellation
controller.handlePointerDown({ pointerId: 10, clientX: 100, clientY: 100 });
if (!controller.isSwiping || controller.activePointerId !== 10) {
  throw new Error('PointerDown failed to initiate swipe tracking');
}

// Cancel gesture
controller.handlePointerCancel({ pointerId: 10 });
if (controller.isSwiping || controller.activePointerId !== null) {
  throw new Error('PointerCancel failed to reset gesture state');
}

// Ensure pointerUp after cancel does nothing
const cancelledUp = controller.handlePointerUp({ pointerId: 10, clientX: 180, clientY: 100 });
if (cancelledUp !== null) {
  throw new Error('Cancelled gesture unexpectedly returned direction on pointerUp');
}
console.log('✓ Test 7 Passed: Gesture cancellation safely resets state without triggering turn');

// 8. Test Multiple Simultaneous Pointers (discard secondary touches)
controller.handlePointerDown({ pointerId: 1, clientX: 50, clientY: 50 });
// Secondary pointer tries to start gesture
const secondaryStarted = controller.handlePointerDown({ pointerId: 2, clientX: 200, clientY: 200 });
if (secondaryStarted !== false) {
  throw new Error('Secondary pointer unexpectedly allowed to override active swipe');
}
// Release primary pointer
const primaryResult = controller.handlePointerUp({ pointerId: 1, clientX: 120, clientY: 50 }, 'UP');
if (!primaryResult || primaryResult.name !== 'RIGHT') {
  throw new Error('Primary pointer failed to resolve swipe direction');
}
console.log('✓ Test 8 Passed: Secondary pointer during active gesture is ignored safely');

console.log('=== ALL SWIPE CONTROLS UNIT TESTS PASSED! ===');
