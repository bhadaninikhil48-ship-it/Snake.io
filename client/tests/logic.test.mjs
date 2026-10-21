import { Snake } from '../src/game/Snake.js';
import { FoodManager } from '../src/game/FoodManager.js';
import { CollisionSystem } from '../src/game/CollisionSystem.js';
import { DIRECTIONS, GRID_SIZE } from '../src/game/constants.js';

console.log('--- STARTING SNAKE CLASH LOGIC VERIFICATION ---');

// 1. Test Snake Initialization & Movement
const snake = new Snake(4);
if (snake.getLength() !== 4) throw new Error('Snake length mismatch');
const initialHead = { ...snake.getHead() };
snake.step(); // moving RIGHT by default
const newHead = snake.getHead();
if (newHead.x !== initialHead.x + 1 || newHead.y !== initialHead.y) {
  throw new Error('Snake failed to step right correctly');
}
console.log('✓ Snake step and translation passed');

// 2. Test 180-degree reversal prevention
const accepted = snake.setDirection(DIRECTIONS.LEFT);
if (accepted) {
  throw new Error('Snake allowed illegal 180-degree reversal!');
}
console.log('✓ 180-degree instant reversal prevention passed');

// 3. Test Food Spawning (never on snake)
const foodManager = new FoodManager();
for (let i = 0; i < 50; i++) {
  const food = foodManager.spawn(snake);
  if (food.x < 0 || food.x >= GRID_SIZE || food.y < 0 || food.y >= GRID_SIZE) {
    throw new Error(`Food spawned out of arena bounds: ${food.x}, ${food.y}`);
  }
  if (snake.occupies(food.x, food.y, true)) {
    throw new Error('Food spawned directly on snake!');
  }
}
console.log('✓ Food bounds and non-overlapping spawning passed (50 iterations)');

// 4. Test Growth
const lengthBefore = snake.getLength();
snake.grow(1);
snake.step();
if (snake.getLength() !== lengthBefore + 1) {
  throw new Error('Snake did not grow after queued growth');
}
console.log('✓ Snake growth passed');

// 5. Test Wall Collision Detection
const headAtWall = { x: GRID_SIZE, y: 15 };
if (!CollisionSystem.checkWallCollision(headAtWall)) {
  throw new Error('Wall collision failed to detect boundary breach');
}
console.log('✓ Wall collision detection passed');

// 6. Test Self Collision Detection
const mockHead = { x: 5, y: 5 };
const mockBody = [{ x: 5, y: 6 }, { x: 5, y: 5 }];
if (!CollisionSystem.checkSelfCollision(mockHead, mockBody)) {
  throw new Error('Self collision detection failed');
}
console.log('✓ Self collision detection passed');

console.log('--- ALL LOGIC TESTS PASSED SUCCESSFULLY! ---');
