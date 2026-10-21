import { multiplayerClient } from '../src/network/MultiplayerClient.js';

console.log('=== STARTING CLIENT MATCHMAKING UNIT TESTS ===');

// Mock underlying websocket
const sent = [];
const mockWs = {
  readyState: 1, // OPEN
  send(data) {
    sent.push(JSON.parse(data));
  },
  close() {},
};

multiplayerClient.ws = mockWs;
multiplayerClient.status = 'CONNECTED';

// 1. Test joinMatchmaking sends JOIN_MATCHMAKING payload
await multiplayerClient.joinMatchmaking('CyberAce');
if (sent.length !== 1 || sent[0].type !== 'JOIN_MATCHMAKING' || sent[0].payload.playerName !== 'CyberAce') {
  throw new Error(`joinMatchmaking sent invalid payload: ${JSON.stringify(sent)}`);
}
console.log('✓ Test 1 Passed: joinMatchmaking formats and transmits JSON packet correctly');

// 2. Test cancelMatchmaking sends CANCEL_MATCHMAKING payload
sent.length = 0;
multiplayerClient.cancelMatchmaking();
if (sent.length !== 1 || sent[0].type !== 'CANCEL_MATCHMAKING') {
  throw new Error(`cancelMatchmaking sent invalid payload: ${JSON.stringify(sent)}`);
}
console.log('✓ Test 2 Passed: cancelMatchmaking transmits cancel packet correctly');

// 3. Test handleIncomingMessage for MATCHMAKING_QUEUED
let queuedEventReceived = null;
const unsub1 = multiplayerClient.on('matchmakingQueued', (payload) => {
  queuedEventReceived = payload;
});
multiplayerClient.handleIncomingMessage(JSON.stringify({
  type: 'MATCHMAKING_QUEUED',
  payload: { position: 1, queuedAt: 12345678 },
}));
if (!queuedEventReceived || queuedEventReceived.position !== 1) {
  throw new Error('matchmakingQueued event not dispatched to subscribers');
}
unsub1();
console.log('✓ Test 3 Passed: MATCHMAKING_QUEUED event dispatched properly');

// 4. Test handleIncomingMessage for MATCHMAKING_CANCELLED
let cancelledEventReceived = false;
const unsub2 = multiplayerClient.on('matchmakingCancelled', () => {
  cancelledEventReceived = true;
});
multiplayerClient.handleIncomingMessage(JSON.stringify({
  type: 'MATCHMAKING_CANCELLED',
  payload: {},
}));
if (!cancelledEventReceived) {
  throw new Error('matchmakingCancelled event not dispatched');
}
unsub2();
console.log('✓ Test 4 Passed: MATCHMAKING_CANCELLED event dispatched properly');

// 5. Test handleIncomingMessage for MATCH_FOUND updates currentRoom and emits matchFound
let matchFoundPayload = null;
let roomStatePayload = null;
const unsub3 = multiplayerClient.on('matchFound', (p) => { matchFoundPayload = p; });
const unsub4 = multiplayerClient.on('roomState', (p) => { roomStatePayload = p; });

const dummyRoom = { code: 'QM123', players: [{ id: 'p1', name: 'CyberAce' }, { id: 'p2', name: 'Rival' }] };
multiplayerClient.handleIncomingMessage(JSON.stringify({
  type: 'MATCH_FOUND',
  payload: { room: dummyRoom, opponent: { id: 'p2', name: 'Rival' } },
}));

if (!matchFoundPayload || matchFoundPayload.room.code !== 'QM123') {
  throw new Error('MATCH_FOUND did not emit payload correctly');
}
if (!roomStatePayload || multiplayerClient.currentRoom.code !== 'QM123') {
  throw new Error('MATCH_FOUND did not update currentRoom');
}
unsub3();
unsub4();
console.log('✓ Test 5 Passed: MATCH_FOUND updates currentRoom and notifies listeners');

console.log('=== ALL CLIENT MATCHMAKING TESTS PASSED! ===');
