import { MultiplayerSoundController } from '../src/network/MultiplayerSoundController.js';

console.log('=== STARTING MULTIPLAYER SOUND SYSTEM UNIT TESTS ===');

// Mock SoundManager to track calls
function createMockSoundManager() {
  const calls = [];
  return {
    calls,
    isMuted: false,
    playEat() { calls.push('playEat'); },
    playSuperEat() { calls.push('playSuperEat'); },
    playDie() { calls.push('playDie'); },
    playStart() { calls.push('playStart'); },
    playCountdown(sec) { calls.push(`playCountdown:${sec}`); },
    playVictory() { calls.push('playVictory'); },
    playDefeat() { calls.push('playDefeat'); },
    playDraw() { calls.push('playDraw'); },
    playClick() { calls.push('playClick'); },
    clear() { calls.length = 0; },
  };
}

const mockSound = createMockSoundManager();
const controller = new MultiplayerSoundController(mockSound);

// 1. Test Countdown Deduplication
controller.onCountdown(3);
controller.onCountdown(3); // duplicate packet
controller.onCountdown(3); // duplicate packet
if (mockSound.calls.length !== 1 || mockSound.calls[0] !== 'playCountdown:3') {
  throw new Error(`Countdown did not deduplicate: ${JSON.stringify(mockSound.calls)}`);
}
controller.onCountdown(2);
if (mockSound.calls.length !== 2 || mockSound.calls[1] !== 'playCountdown:2') {
  throw new Error('New countdown tick failed to play');
}
console.log('✓ Test 1 Passed: Countdown deduplication prevents repeated beeps');

// 2. Test Transition from COUNTDOWN to ACTIVE
mockSound.clear();
controller.onGameState({ status: 'COUNTDOWN', countdown: 1 });
controller.onGameState({ status: 'ACTIVE', p1: { score: 0, isAlive: true }, p2: { score: 0, isAlive: true } });
if (!mockSound.calls.includes('playStart')) {
  throw new Error('Transition from COUNTDOWN to ACTIVE did not play start cue');
}
console.log('✓ Test 2 Passed: Transition from COUNTDOWN to ACTIVE plays start cue');

// 3. Test Food Consumption (Regular +10 & Quantum +30)
mockSound.clear();
// Repeated identical packet -> NO SOUND
controller.onGameState({ status: 'ACTIVE', p1: { score: 0, isAlive: true }, p2: { score: 0, isAlive: true } });
if (mockSound.calls.length !== 0) {
  throw new Error('Identical score state played sound unexpectedly');
}

// Player 1 eats regular food (+10)
controller.onGameState({ status: 'ACTIVE', p1: { score: 10, isAlive: true }, p2: { score: 0, isAlive: true } });
if (mockSound.calls.length !== 1 || mockSound.calls[0] !== 'playEat') {
  throw new Error(`Regular food did not trigger playEat: ${JSON.stringify(mockSound.calls)}`);
}

// Repeated packet with score 10 -> NO SOUND
controller.onGameState({ status: 'ACTIVE', p1: { score: 10, isAlive: true }, p2: { score: 0, isAlive: true } });
if (mockSound.calls.length !== 1) {
  throw new Error('Repeated score packet replayed eat sound');
}

// Player 2 eats Quantum Super Food (+30)
mockSound.clear();
controller.onGameState({ status: 'ACTIVE', p1: { score: 10, isAlive: true }, p2: { score: 30, isAlive: true } });
if (mockSound.calls.length !== 1 || mockSound.calls[0] !== 'playSuperEat') {
  throw new Error(`Super food did not trigger playSuperEat: ${JSON.stringify(mockSound.calls)}`);
}
console.log('✓ Test 3 Passed: Regular and Quantum food consumption correctly distinguished & deduplicated');

// 4. Test Snake Collision / Elimination
mockSound.clear();
// Player 2 crashes (isAlive: false)
controller.onGameState({ status: 'ACTIVE', p1: { score: 10, isAlive: true }, p2: { score: 30, isAlive: false } });
if (mockSound.calls.length !== 1 || mockSound.calls[0] !== 'playDie') {
  throw new Error(`Death did not trigger playDie: ${JSON.stringify(mockSound.calls)}`);
}

// Next tick with Player 2 still dead -> NO DUPLICATE SOUND
controller.onGameState({ status: 'ACTIVE', p1: { score: 10, isAlive: true }, p2: { score: 30, isAlive: false } });
if (mockSound.calls.length !== 1) {
  throw new Error('Repeated dead state triggered duplicate death sound');
}
console.log('✓ Test 4 Passed: Snake elimination sound plays once and does not repeat');

// 5. Test Match End Sound Selection (Victory, Defeat, Draw)
mockSound.clear();
controller.reset();
controller.onMatchEnd({ winnerId: 'p_my_id', isDraw: false }, 'p_my_id');
if (mockSound.calls[0] !== 'playVictory') {
  throw new Error('Victory did not trigger playVictory');
}

// Duplicate match end event -> NO DUPLICATE SOUND
controller.onMatchEnd({ winnerId: 'p_my_id', isDraw: false }, 'p_my_id');
if (mockSound.calls.length !== 1) {
  throw new Error('Duplicate match end played sound twice');
}

// Test Defeat
mockSound.clear();
controller.reset();
controller.onMatchEnd({ winnerId: 'p_enemy', isDraw: false }, 'p_my_id');
if (mockSound.calls[0] !== 'playDefeat') {
  throw new Error('Defeat did not trigger playDefeat');
}

// Test Draw
mockSound.clear();
controller.reset();
controller.onMatchEnd({ winnerId: null, isDraw: true }, 'p_my_id');
if (mockSound.calls[0] !== 'playDraw') {
  throw new Error('Draw did not trigger playDraw');
}
console.log('✓ Test 5 Passed: Match end sounds (Victory, Defeat, Draw) properly selected and deduplicated');

// 6. Test Reset functionality
controller.reset();
if (controller.lastCountdown !== null || controller.hasPlayedMatchEnd !== false) {
  throw new Error('Reset failed to clear controller state');
}
console.log('✓ Test 6 Passed: Controller reset clears all state flags');

console.log('=== ALL MULTIPLAYER SOUND TESTS PASSED! ===');
