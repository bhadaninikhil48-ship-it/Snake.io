/**
 * Automated Test Suite for Server-Side Quick Matchmaking (Phase 4C)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { Matchmaker } from '../matchmaking/Matchmaker.js';
import { CLIENT_MESSAGES, SERVER_MESSAGES, ERROR_CODES, ROOM_STATUS } from '../websocket/protocol.js';

// Mock WebSocket helper
function createMockSocket(id = 'mock_ws') {
  return {
    id,
    readyState: WebSocket.OPEN,
    OPEN: WebSocket.OPEN,
    CLOSED: WebSocket.CLOSED,
    sent: [],
    send(str) {
      this.sent.push(JSON.parse(str));
    },
    close() {
      this.readyState = WebSocket.CLOSED;
    },
  };
}

describe('Phase 4C: Matchmaker Unit Tests', () => {
  it('1. Enqueue single player successfully', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');

    const result = matchmaker.enqueue('p1', 'Neo', ws1, roomManager);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.queuePosition, 1);
    assert.strictEqual(matchmaker.getQueueSize(), 1);
    assert.strictEqual(matchmaker.isInQueue('p1'), true);
  });

  it('2. Prevent duplicate queuing for same player', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');

    matchmaker.enqueue('p1', 'Neo', ws1, roomManager);
    const dupResult = matchmaker.enqueue('p1', 'Neo', ws1, roomManager);

    assert.strictEqual(dupResult.success, false);
    assert.strictEqual(dupResult.error, ERROR_CODES.ALREADY_IN_QUEUE);
    assert.strictEqual(matchmaker.getQueueSize(), 1);
  });

  it('3. Prevent queuing if player is already inside a room', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');

    // Create room first
    roomManager.createRoom('p1', 'Neo', ws1);

    const result = matchmaker.enqueue('p1', 'Neo', ws1, roomManager);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, ERROR_CODES.ALREADY_IN_ROOM);
    assert.strictEqual(matchmaker.getQueueSize(), 0);
  });

  it('4. Cancel matchmaking removes player cleanly', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');

    matchmaker.enqueue('p1', 'Neo', ws1, roomManager);
    assert.strictEqual(matchmaker.isInQueue('p1'), true);

    const cancelResult = matchmaker.cancel('p1');
    assert.strictEqual(cancelResult.success, true);
    assert.strictEqual(matchmaker.isInQueue('p1'), false);
    assert.strictEqual(matchmaker.getQueueSize(), 0);

    // Second cancel should fail with NOT_IN_QUEUE
    const notInQueueResult = matchmaker.cancel('p1');
    assert.strictEqual(notInQueueResult.success, false);
    assert.strictEqual(notInQueueResult.error, ERROR_CODES.NOT_IN_QUEUE);
  });

  it('5. Successfully pairs 2 waiting players into a single room', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');
    const ws2 = createMockSocket('ws2');

    matchmaker.enqueue('p1', 'PlayerOne', ws1, roomManager);
    matchmaker.enqueue('p2', 'PlayerTwo', ws2, roomManager);

    assert.strictEqual(matchmaker.getQueueSize(), 2);

    const matches = matchmaker.tryMatch(roomManager);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matchmaker.getQueueSize(), 0);
    assert.strictEqual(matchmaker.isInQueue('p1'), false);
    assert.strictEqual(matchmaker.isInQueue('p2'), false);

    const match = matches[0];
    assert.ok(match.room);
    assert.strictEqual(match.room.players.length, 2);
    assert.strictEqual(match.room.players[0].id, 'p1');
    assert.strictEqual(match.room.players[0].isHost, true);
    assert.strictEqual(match.room.players[1].id, 'p2');
    assert.strictEqual(match.room.players[1].isHost, false);
    assert.strictEqual(match.room.status, ROOM_STATUS.LOBBY);
  });

  it('6. Handles disconnected player in queue gracefully', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');
    const ws2 = createMockSocket('ws2');

    matchmaker.enqueue('p1', 'PlayerOne', ws1, roomManager);
    // Player 1 drops connection
    ws1.close();

    matchmaker.enqueue('p2', 'PlayerTwo', ws2, roomManager);

    // tryMatch should prune dead ws1 and leave ws2 waiting
    const matches = matchmaker.tryMatch(roomManager);
    assert.strictEqual(matches.length, 0);
    assert.strictEqual(matchmaker.getQueueSize(), 1);
    assert.strictEqual(matchmaker.isInQueue('p1'), false);
    assert.strictEqual(matchmaker.isInQueue('p2'), true);
  });

  it('7. Clean handleDisconnect evacuates player from queue', () => {
    const roomManager = new RoomManager();
    const matchmaker = new Matchmaker();
    const ws1 = createMockSocket('ws1');

    matchmaker.enqueue('p1', 'PlayerOne', ws1, roomManager);
    assert.strictEqual(matchmaker.isInQueue('p1'), true);

    const disconnected = matchmaker.handleDisconnect('p1');
    assert.strictEqual(disconnected, true);
    assert.strictEqual(matchmaker.isInQueue('p1'), false);
    assert.strictEqual(matchmaker.getQueueSize(), 0);
  });
});

describe('Phase 4C: Live WebSocket Quick Matchmaking E2E Test', () => {
  it('Pairs two live WebSocket clients via Quick Match and verifies synchronized room', async () => {
    const WS_URL = 'ws://localhost:3001';

    // Helper to connect and wait for message
    const createLiveClient = () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        const inbox = [];
        let welcomePayload = null;

        ws.on('open', () => {});
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          inbox.push(msg);
          if (msg.type === SERVER_MESSAGES.WELCOME) {
            welcomePayload = msg.payload;
            resolve({ ws, inbox, playerId: welcomePayload.playerId });
          }
        });
        ws.on('error', reject);
      });
    };

    const waitForMessage = (client, type, timeoutMs = 3000) => {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          const found = client.inbox.find((m) => m.type === type);
          if (found) {
            return resolve(found);
          }
          if (Date.now() - start > timeoutMs) {
            return reject(new Error(`Timed out waiting for message "${type}"`));
          }
          setTimeout(check, 30);
        };
        check();
      });
    };

    const c1 = await createLiveClient();
    const c2 = await createLiveClient();

    try {
      // 1. Client 1 joins matchmaking
      c1.ws.send(JSON.stringify({
        type: CLIENT_MESSAGES.JOIN_MATCHMAKING,
        payload: { playerName: 'QuickPilot1' },
      }));

      const c1Queued = await waitForMessage(c1, SERVER_MESSAGES.MATCHMAKING_QUEUED);
      assert.strictEqual(c1Queued.type, SERVER_MESSAGES.MATCHMAKING_QUEUED);

      // 2. Client 2 joins matchmaking
      c2.ws.send(JSON.stringify({
        type: CLIENT_MESSAGES.JOIN_MATCHMAKING,
        payload: { playerName: 'QuickPilot2' },
      }));

      const c2Queued = await waitForMessage(c2, SERVER_MESSAGES.MATCHMAKING_QUEUED);
      assert.strictEqual(c2Queued.type, SERVER_MESSAGES.MATCHMAKING_QUEUED);

      // 3. Both clients must receive MATCH_FOUND
      const c1MatchFound = await waitForMessage(c1, SERVER_MESSAGES.MATCH_FOUND);
      const c2MatchFound = await waitForMessage(c2, SERVER_MESSAGES.MATCH_FOUND);

      assert.ok(c1MatchFound.payload.roomCode);
      assert.strictEqual(c1MatchFound.payload.roomCode, c2MatchFound.payload.roomCode);
      assert.strictEqual(c1MatchFound.payload.opponent.id, c2.playerId);
      assert.strictEqual(c2MatchFound.payload.opponent.id, c1.playerId);

      // 4. Both clients receive ROOM_STATE with 2 players
      const c1RoomState = await waitForMessage(c1, SERVER_MESSAGES.ROOM_STATE);
      const c2RoomState = await waitForMessage(c2, SERVER_MESSAGES.ROOM_STATE);

      assert.strictEqual(c1RoomState.payload.room.players.length, 2);
      assert.strictEqual(c2RoomState.payload.room.players.length, 2);

      // 5. Test cancelling matchmaking on client 3
      const c3 = await createLiveClient();
      c3.ws.send(JSON.stringify({
        type: CLIENT_MESSAGES.JOIN_MATCHMAKING,
        payload: { playerName: 'SoloCanceller' },
      }));
      await waitForMessage(c3, SERVER_MESSAGES.MATCHMAKING_QUEUED);

      c3.ws.send(JSON.stringify({
        type: CLIENT_MESSAGES.CANCEL_MATCHMAKING,
        payload: {},
      }));
      const c3Cancelled = await waitForMessage(c3, SERVER_MESSAGES.MATCHMAKING_CANCELLED);
      assert.strictEqual(c3Cancelled.type, SERVER_MESSAGES.MATCHMAKING_CANCELLED);
      c3.ws.close();

    } finally {
      c1.ws.close();
      c2.ws.close();
    }
  });
});
