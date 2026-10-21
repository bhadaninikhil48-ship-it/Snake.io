import { RoomManager } from '../rooms/RoomManager.js';
import { handleMessage } from '../websocket/messageHandlers.js';
import {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  ERROR_CODES,
  MAX_PLAYERS_PER_ROOM,
} from '../websocket/protocol.js';

console.log('=== STARTING ROOM & PROTOCOL UNIT TESTS ===');

// Mock WebSocket factory
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
    clear() {
      messages.length = 0;
    },
  };
}

// 1. Room Creation
const roomManager = new RoomManager();
const ws1 = createMockSocket();
const p1Id = 'p_test1';

const createResult = roomManager.createRoom(p1Id, 'CyberAce', ws1);
if (!createResult.success) throw new Error('Failed to create room');
const room = createResult.room;
if (room.players.length !== 1) throw new Error('Room should have 1 player initially');
if (room.hostId !== p1Id) throw new Error('Host ID mismatch');
if (room.players[0].name !== 'CyberAce') throw new Error('Player name mismatch');
console.log('✓ Room creation passed (Code:', room.code, ')');

// 2. Room Joining
const ws2 = createMockSocket();
const p2Id = 'p_test2';
const joinResult = roomManager.joinRoom(p2Id, room.code, 'NeonPilot', ws2);
if (!joinResult.success) throw new Error(`Failed to join room: ${joinResult.message}`);
if (room.players.length !== 2) throw new Error('Room should now have 2 players');
if (room.players[1].color !== '#ff007f') throw new Error('Player 2 should receive pink color');
console.log('✓ Player 2 join passed');

// 3. Reject 3rd Player (Room Full)
const ws3 = createMockSocket();
const p3Id = 'p_test3';
const fullResult = roomManager.joinRoom(p3Id, room.code, 'ThirdPlayer', ws3);
if (fullResult.success || fullResult.error !== ERROR_CODES.ROOM_FULL) {
  throw new Error('Server should reject 3rd player with ROOM_FULL');
}
console.log('✓ Max player capacity (2) rejection passed');

// 4. Reject Non-existent Room
const invalidResult = roomManager.joinRoom(p3Id, 'FAKEX', 'Player', ws3);
if (invalidResult.success || invalidResult.error !== ERROR_CODES.ROOM_NOT_FOUND) {
  throw new Error('Server should reject nonexistent room code');
}
console.log('✓ Invalid room code rejection passed');

// 5. Ready Toggle
const readyResult = roomManager.setReady(p2Id, true);
if (!readyResult.success || !room.players[1].isReady) {
  throw new Error('Failed to set ready state');
}
console.log('✓ Ready state toggle passed');

// 6. Two Separate Rooms Isolation
const roomManager2 = new RoomManager();
const wsA1 = createMockSocket();
const wsB1 = createMockSocket();
const roomA = roomManager2.createRoom('p_A1', 'Alpha', wsA1).room;
const roomB = roomManager2.createRoom('p_B1', 'Beta', wsB1).room;

if (roomA.code === roomB.code) throw new Error('Room codes should be unique');
if (roomA.players[0].id === roomB.players[0].id) throw new Error('Player IDs should be separate');
console.log('✓ Two rooms isolation verified');

// 7. Player Leave & Host Migration
const leaveResult1 = roomManager.leaveRoom(p1Id);
if (!leaveResult1.success || leaveResult1.roomDeleted) {
  throw new Error('Room should not be deleted when 1 player still remains');
}
if (room.hostId !== p2Id) {
  throw new Error('Host should have migrated to remaining Player 2');
}
console.log('✓ Host migration on leave passed');

// 8. Room Deletion on Last Player Leave
const leaveResult2 = roomManager.leaveRoom(p2Id);
if (!leaveResult2.roomDeleted || roomManager.rooms.has(room.code)) {
  throw new Error('Empty room was not deleted');
}
console.log('✓ Empty room automatic deletion passed');

// 9. Malformed JSON handling in handleMessage
const wsTest = createMockSocket();
handleMessage(wsTest, 'THIS_IS_NOT_VALID_JSON{', 'p_test', roomManager);
const lastErr = wsTest.getLastMessage();
if (!lastErr || lastErr.type !== SERVER_MESSAGES.ERROR || lastErr.payload.code !== ERROR_CODES.INVALID_MESSAGE) {
  throw new Error('Server did not return proper error for malformed JSON');
}
console.log('✓ Malformed JSON safely caught without crashing');

console.log('=== ALL ROOM & PROTOCOL TESTS PASSED! ===');
