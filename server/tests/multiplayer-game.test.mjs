import { ServerSnake } from '../game/ServerSnake.js';
import { ServerFoodManager } from '../game/ServerFoodManager.js';
import { ServerCollisionSystem } from '../game/ServerCollisionSystem.js';
import { MultiplayerGame } from '../game/MultiplayerGame.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { handleMessage } from '../websocket/messageHandlers.js';
import {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  ERROR_CODES,
  ROOM_STATUS,
} from '../websocket/protocol.js';

console.log('=== STARTING MULTIPLAYER ENGINE & PROTOCOL TESTS (PHASE 3) ===');

function createMockSocket() {
  const messages = [];
  return {
    messages,
    readyState: 1, // OPEN
    OPEN: 1,
    send(data) {
      messages.push(JSON.parse(data));
    },
    getLastMessage() {
      return messages[messages.length - 1] || null;
    },
    findMessage(predicate) {
      return messages.find(predicate) || null;
    },
    clear() {
      messages.length = 0;
    },
  };
}

// TEST 1: Both snakes spawn at valid, non-overlapping positions
const p1Mock = { id: 'p_1', name: 'Alpha', color: '#00f3ff' };
const p2Mock = { id: 'p_2', name: 'Beta', color: '#ff007f' };
const game = new MultiplayerGame('ROOM1', p1Mock, p2Mock);

if (game.snake1.segments.length !== 4 || game.snake2.segments.length !== 4) {
  throw new Error('Initial snake lengths should be 4');
}
const p1Head = game.snake1.getHead();
const p2Head = game.snake2.getHead();
if (p1Head.x !== 7 || p1Head.y !== 15) throw new Error('Snake 1 spawn position mismatch');
if (p2Head.x !== 22 || p2Head.y !== 15) throw new Error('Snake 2 spawn position mismatch');

// Ensure no overlap between starting snakes
for (const s1 of game.snake1.segments) {
  for (const s2 of game.snake2.segments) {
    if (s1.x === s2.x && s1.y === s2.y) {
      throw new Error('Starting snakes overlap!');
    }
  }
}
console.log('✓ Test 1 Passed: Both snakes spawned at valid, non-overlapping positions');

// TEST 2: Match starts only when both players are ready
const rm = new RoomManager();
const ws1 = createMockSocket();
const ws2 = createMockSocket();
const rCreated = rm.createRoom('p_1', 'P1', ws1);
const rJoined = rm.joinRoom('p_2', rCreated.room.code, 'P2', ws2);

// Only P1 ready -> should fail to start
rm.setReady('p_1', true);
const startFail = rm.startMatch(rCreated.room.code, {});
if (startFail.success) throw new Error('Match should not start with only 1 player ready');

// Both ready -> should succeed
rm.setReady('p_2', true);
const startSuccess = rm.startMatch(rCreated.room.code, {});
if (!startSuccess.success || rCreated.room.status !== ROOM_STATUS.STARTING) {
  throw new Error('Match failed to start when both players ready');
}
console.log('✓ Test 2 Passed: Match starts only when both players are ready');

// TEST 3: Only one match loop runs per room
const secondStart = rm.startMatch(rCreated.room.code, {});
if (secondStart.success) {
  throw new Error('Duplicate match loop allowed on same room!');
}
startSuccess.game.destroy();
console.log('✓ Test 3 Passed: Only one match loop can run per room');

// TEST 4: Movement direction and single-tick advancement
const snake = new ServerSnake('p_test', 'Test', '#00f3ff', { x: 10, y: 10 }, 'RIGHT', 4);
const nextHead = snake.computeNextHead();
if (nextHead.x !== 11 || nextHead.y !== 10) throw new Error('Failed to compute next head');
const departedTail = snake.step(nextHead);
if (departedTail.x !== 7 || departedTail.y !== 10) throw new Error('Departed tail position mismatch');
if (snake.getHead().x !== 11 || snake.getHead().y !== 10) throw new Error('Step head mismatch');
console.log('✓ Test 4 Passed: Movement calculation & stepping verified');

// TEST 5 & 6: Invalid direction input & 180-degree reversal rejection
if (snake.queueDirection('INVALID_DIR')) throw new Error('Invalid direction string accepted');
if (snake.queueDirection('LEFT')) throw new Error('180-degree instant reversal accepted');
if (!snake.queueDirection('UP')) throw new Error('Valid 90-degree turn was rejected');
// Test rate limit: second turn in same tick should be rejected
if (snake.queueDirection('DOWN')) throw new Error('Second turn in same tick was accepted');
snake.applyDirection();
if (snake.direction !== 'UP') throw new Error('Failed to apply valid queued direction');
console.log('✓ Tests 5 & 6 Passed: Invalid direction, reversal, and rate limits enforced');

// TEST 7: Food spawns on an empty cell
const foodMgr = new ServerFoodManager();
const s1 = new ServerSnake('p1', 'P1', '#00f3ff', { x: 5, y: 5 }, 'RIGHT', 4);
const s2 = new ServerSnake('p2', 'P2', '#ff007f', { x: 15, y: 15 }, 'LEFT', 4);
for (let i = 0; i < 50; i++) {
  const f = foodMgr.spawn([s1, s2]);
  if (f.x < 0 || f.x >= 30 || f.y < 0 || f.y >= 30) throw new Error('Food out of bounds');
  if (s1.occupies(f.x, f.y) || s2.occupies(f.x, f.y)) throw new Error('Food spawned on a snake segment');
}
console.log('✓ Test 7 Passed: Food strictly spawns on empty cells (50 iterations)');

// TEST 8: Food consumption increases score and length
foodMgr.currentFood = { x: 6, y: 5, growth: 1, points: 10, type: 'REGULAR' };
const foodPos = { x: 6, y: 5 };
s1.pendingGrowth = 0;
const hitFood = foodMgr.checkCollision(foodPos);
if (hitFood) {
  s1.grow(hitFood.growth);
  s1.addScore(hitFood.points);
}
const lenBefore = s1.getLength();
s1.step({ x: 6, y: 5 });
if (s1.getLength() !== lenBefore + 1 || s1.score === 0) {
  throw new Error('Snake did not grow or score after eating food');
}
console.log('✓ Test 8 Passed: Food consumption increases score and length');

// TEST 9: Wall collision detection
const wallHead = { x: -1, y: 15 };
if (!ServerCollisionSystem.isWallHit(wallHead)) throw new Error('Wall collision not detected');
const colResult = ServerCollisionSystem.evaluate(
  s1, s2,
  { x: -1, y: 10 },
  { x: 14, y: 15 }
);
if (!colResult.matchEnded || colResult.winnerId !== s2.playerId || colResult.s1Reason !== 'WALL_COLLISION') {
  throw new Error('Wall collision evaluation failed');
}
console.log('✓ Test 9 Passed: Wall collision ends appropriate player game');

// TEST 10: Self-collision detection
const selfSnake = new ServerSnake('p1', 'P1', '#00f3ff', { x: 5, y: 5 }, 'RIGHT', 5);
// Snake segments: (5,5), (4,5), (3,5), (2,5), (1,5)
const selfHead = { x: 3, y: 5 };
if (!ServerCollisionSystem.isSegmentHit(selfHead, selfSnake.segments, false, 1)) {
  throw new Error('Self collision was not detected');
}
console.log('✓ Test 10 Passed: Self collision detected');

// TEST 11: Snake-to-snake body collision
const oppHead = { x: s2.segments[1].x, y: s2.segments[1].y };
const oppCol = ServerCollisionSystem.evaluate(
  s1, s2,
  oppHead,
  { x: 10, y: 10 }
);
if (!oppCol.matchEnded || oppCol.winnerId !== s2.playerId) {
  throw new Error('Snake-to-snake collision did not award win to correct player');
}
console.log('✓ Test 11 Passed: Snake-to-snake body collision detected');

// TEST 12: Simultaneous head-to-head collision produces a DRAW
const h2hCol = ServerCollisionSystem.evaluate(
  s1, s2,
  { x: 12, y: 12 },
  { x: 12, y: 12 }
);
if (!h2hCol.matchEnded || !h2hCol.isDraw || h2hCol.winnerId !== null) {
  throw new Error('Head-to-head simultaneous collision should be a DRAW');
}
console.log('✓ Test 12 Passed: Simultaneous head-to-head collision resolves to DRAW');

// TEST 13: Simultaneous input is handled consistently and deterministically
const simGame = new MultiplayerGame('ROOM_SIM', p1Mock, p2Mock);
simGame.status = 'ACTIVE';
simGame.handleInput(p1Mock.id, 'UP');
simGame.handleInput(p2Mock.id, 'DOWN');
simGame.tick();
if (simGame.snake1.direction !== 'UP' || simGame.snake2.direction !== 'DOWN') {
  throw new Error('Simultaneous inputs were not applied correctly');
}
simGame.destroy();
console.log('✓ Test 13 Passed: Simultaneous input handled consistently');

// TEST 14: Game state is broadcast only to matching room
const rmBroadcast = new RoomManager();
const wsA1 = createMockSocket();
const wsB1 = createMockSocket();
const roomA = rmBroadcast.createRoom('pA', 'Alpha', wsA1).room;
const roomB = rmBroadcast.createRoom('pB', 'Beta', wsB1).room;
handleMessage(wsA1, JSON.stringify({ type: CLIENT_MESSAGES.INPUT, payload: { direction: 'UP' } }), 'pA', rmBroadcast);
if (wsB1.messages.some((m) => m.type === SERVER_MESSAGES.GAME_STATE)) {
  throw new Error('Room B received message from Room A!');
}
console.log('✓ Test 14 Passed: Rooms strictly isolated from cross-broadcasts');

// TEST 15 & 16: Input before match start & after match end rejected
const testGame = new MultiplayerGame('ROOM_G', p1Mock, p2Mock);
if (testGame.handleInput(p1Mock.id, 'UP')) throw new Error('Input before match start accepted');
testGame.status = 'ENDED';
if (testGame.handleInput(p1Mock.id, 'UP')) throw new Error('Input after match end accepted');
testGame.destroy();
console.log('✓ Tests 15 & 16 Passed: Input before start & after end rejected');

// TEST 17: Disconnect during a match awards win to remaining player
let endResultReceived = null;
const dcGame = new MultiplayerGame('ROOM_DC', p1Mock, p2Mock, {
  onMatchEnd: (res) => { endResultReceived = res; },
});
dcGame.status = 'ACTIVE';
dcGame.handleDisconnect(p1Mock.id);
if (!endResultReceived || endResultReceived.winnerId !== p2Mock.id || endResultReceived.reason !== 'OPPONENT_DISCONNECTED') {
  throw new Error('Disconnect during match did not award win to remaining player');
}
dcGame.destroy();
console.log('✓ Test 17 Passed: Disconnect during match handled correctly');

// TEST 18: Room cleanup stops its game loop
const cleanupRm = new RoomManager();
const cWs1 = createMockSocket();
const cWs2 = createMockSocket();
const cRoom = cleanupRm.createRoom('cp1', 'CP1', cWs1).room;
cleanupRm.joinRoom('cp2', cRoom.code, 'CP2', cWs2);
cleanupRm.setReady('cp1', true);
cleanupRm.setReady('cp2', true);
const cStart = cleanupRm.startMatch(cRoom.code, {});
if (!cRoom.game || !cRoom.game.countdownTimer) {
  throw new Error('Game was not started properly');
}
cleanupRm.leaveRoom('cp1');
if (cRoom.game !== null) {
  throw new Error('Leaving room did not destroy the active game');
}
console.log('✓ Test 18 Passed: Room cleanup terminates active game loop');

console.log('=== ALL 18 PHASE 3 MULTIPLAYER TESTS PASSED! ===');
