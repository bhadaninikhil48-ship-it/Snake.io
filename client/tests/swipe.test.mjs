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
if (!reverseLeft !== null && reverseLeft !== null) {
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

// 9. Test Real-Time PointerMove Instant Triggering
const moveController = new SwipeController({ minDistance: 25 });
moveController.handlePointerDown({ pointerId: 5, clientX: 100, clientY: 100 });

// Move by 10px (under threshold) -> should return null
const underThreshold = moveController.handlePointerMove({ pointerId: 5, clientX: 110, clientY: 100 }, 'UP');
if (underThreshold !== null) {
  throw new Error('Move under threshold unexpectedly triggered turn');
}

// Move by 30px (crosses 25px threshold) -> should return RIGHT immediately!
const overThreshold = moveController.handlePointerMove({ pointerId: 5, clientX: 130, clientY: 100 }, 'UP');
if (!overThreshold || overThreshold.name !== 'RIGHT') {
  throw new Error(`PointerMove over threshold failed to trigger: got ${overThreshold?.name}`);
}
console.log('✓ Test 9 Passed: handlePointerMove triggers immediately upon reaching distance threshold');

// 10. Test No Duplicate Turn on PointerUp when already dispatched
const upAfterMove = moveController.handlePointerUp({ pointerId: 5, clientX: 135, clientY: 100 }, 'UP');
if (upAfterMove !== null) {
  throw new Error('PointerUp unexpectedly dispatched duplicate turn after pointermove already fired');
}
console.log('✓ Test 10 Passed: PointerUp does not duplicate direction if move was already resolved');

// 11. Test Chained Multi-Turn Swiping in a Single Continuous Stroke
const chainedController = new SwipeController({ minDistance: 25 });
chainedController.handlePointerDown({ pointerId: 7, clientX: 100, clientY: 100 });

// Turn 1: Swipe RIGHT by moving 30px right
const turn1 = chainedController.handlePointerMove({ pointerId: 7, clientX: 130, clientY: 100 }, 'UP');
if (!turn1 || turn1.name !== 'RIGHT') {
  throw new Error(`Turn 1 failed: expected RIGHT, got ${turn1?.name}`);
}

// Continue dragging in same direction (pivot tracks finger)
chainedController.handlePointerMove({ pointerId: 7, clientX: 170, clientY: 100 }, 'UP');

// Turn 2: Without lifting finger, swipe DOWN by moving 35px down
const turn2 = chainedController.handlePointerMove({ pointerId: 7, clientX: 170, clientY: 135 }, 'UP');
if (!turn2 || turn2.name !== 'DOWN') {
  throw new Error(`Turn 2 failed: expected DOWN, got ${turn2?.name}`);
}

// Turn 3: Without lifting finger, swipe LEFT by moving 40px left
const turn3 = chainedController.handlePointerMove({ pointerId: 7, clientX: 130, clientY: 135 }, 'DOWN');
if (!turn3 || turn3.name !== 'LEFT') {
  throw new Error(`Turn 3 failed: expected LEFT, got ${turn3?.name}`);
}
chainedController.handlePointerUp({ pointerId: 7, clientX: 130, clientY: 135 });
console.log('✓ Test 11 Passed: Continuous multi-turn chained gestures succeed without lifting finger');

// 12. Test Reversal Rejection in Chained Gestures
chainedController.handlePointerDown({ pointerId: 8, clientX: 200, clientY: 200 });
// First turn: UP
const firstTurn = chainedController.handlePointerMove({ pointerId: 8, clientX: 200, clientY: 160 }, 'RIGHT');
if (!firstTurn || firstTurn.name !== 'UP') {
  throw new Error(`Initial turn failed: expected UP, got ${firstTurn?.name}`);
}
// Immediate reverse DOWN in same stroke should be rejected
const reverseTurn = chainedController.handlePointerMove({ pointerId: 8, clientX: 200, clientY: 210 }, 'RIGHT');
if (reverseTurn !== null) {
  throw new Error('Reversal against last dispatched turn in chained gesture was unexpectedly permitted');
}
chainedController.handlePointerUp({ pointerId: 8, clientX: 200, clientY: 210 });
console.log('✓ Test 12 Passed: Reversals against last dispatched direction are rejected in chained gestures');

// 13. Test TouchEvent Normalization & Fallback
const touchController = new SwipeController({ minDistance: 25 });
// Simulated touchstart with touches array
const touchStartStarted = touchController.handlePointerDown({
  touches: [{ clientX: 50, clientY: 50, identifier: 101 }],
});
if (!touchStartStarted || touchController.activePointerId !== 101) {
  throw new Error('TouchEvent touchstart failed to extract coords and identifier');
}
// Simulated touchmove with touches array
const touchMoveResult = touchController.handlePointerMove({
  touches: [{ clientX: 50, clientY: 90, identifier: 101 }],
}, 'RIGHT');
if (!touchMoveResult || touchMoveResult.name !== 'DOWN') {
  throw new Error(`TouchEvent touchmove failed: expected DOWN, got ${touchMoveResult?.name}`);
}
// Simulated touchend with changedTouches
touchController.handlePointerUp({
  changedTouches: [{ clientX: 50, clientY: 92, identifier: 101 }],
}, 'DOWN');
if (touchController.isSwiping) {
  throw new Error('TouchEvent touchend failed to clear swiping state');
}
console.log('✓ Test 13 Passed: TouchEvent fallback coordinate extraction and gesture resolution verified');

// 14. Test Fast Flick Resolution on PointerUp without intermediate move
const flickController = new SwipeController({ minDistance: 25 });
flickController.handlePointerDown({ pointerId: 9, clientX: 100, clientY: 100 });
const flickUp = flickController.handlePointerUp({ pointerId: 9, clientX: 55, clientY: 100 }, 'DOWN');
if (!flickUp || flickUp.name !== 'LEFT') {
  throw new Error(`Fast flick on pointerUp failed: expected LEFT, got ${flickUp?.name}`);
}
console.log('✓ Test 14 Passed: Fast flick on release without move triggers turn');

// 15. Test PointerCancel completely clears active gesture
flickController.handlePointerDown({ pointerId: 11, clientX: 100, clientY: 100 });
flickController.handlePointerCancel({ pointerId: 11 });
if (flickController.activePointerId !== null || flickController.isSwiping) {
  throw new Error('PointerCancel failed to reset activePointerId and isSwiping');
}
console.log('✓ Test 15 Passed: PointerCancel cleanly resets active gesture');

// 16. Test DOM Element Attach / Detach Cleanup & Interactive Filtering
const mockEvents = {};
const mockElement = {
  style: {},
  addEventListener: (name, fn) => { mockEvents[name] = fn; },
  removeEventListener: (name) => { delete mockEvents[name]; },
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  hasPointerCapture: () => false,
};

let dispatchedDir = null;
const detach = controller.attach(mockElement, (dir) => { dispatchedDir = dir; }, () => 'UP');

// Verify touchAction style applied
if (mockElement.style.touchAction !== 'none') {
  throw new Error('touchAction: none was not applied to element in attach');
}
// Verify cleanup removes listeners
detach();
if (Object.keys(mockEvents).length !== 0) {
  throw new Error('detach() failed to remove element event listeners');
}
console.log('✓ Test 16 Passed: DOM attach, touchAction enforcement, and cleanup verified');

console.log('=== ALL SWIPE CONTROLS UNIT TESTS PASSED! ===');
