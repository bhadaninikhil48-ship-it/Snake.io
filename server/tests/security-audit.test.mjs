/**
 * Security & Regression Test Suite for Pre-Deployment Hardening
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { handleMessage, send } from '../websocket/messageHandlers.js';
import { CLIENT_MESSAGES, SERVER_MESSAGES, ERROR_CODES, ROOM_STATUS, MAX_MESSAGE_SIZE } from '../websocket/protocol.js';

// Mock WebSocket helper
function createMockSocket(id = 'mock_sec_ws') {
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
    getLastSent() {
      return this.sent[this.sent.length - 1];
    },
  };
}

describe('Pre-Deployment Security & Regression Audit Tests', () => {
  it('1. Malformed null payload does not crash server process', () => {
    const roomManager = new RoomManager();
    const ws = createMockSocket('ws_null_payload');

    // Attempt to crash handler with null payload on object destructuring
    assert.doesNotThrow(() => {
      handleMessage(ws, JSON.stringify({ type: CLIENT_MESSAGES.JOIN_ROOM, payload: null }), 'p_sec_1', roomManager);
    });

    const reply = ws.getLastSent();
    assert.strictEqual(reply.type, SERVER_MESSAGES.ERROR);
    assert.strictEqual(reply.payload.code, ERROR_CODES.ROOM_NOT_FOUND);
  });

  it('2. Primitive number or array payload does not crash server process', () => {
    const roomManager = new RoomManager();
    const ws = createMockSocket('ws_num_payload');

    assert.doesNotThrow(() => {
      handleMessage(ws, JSON.stringify({ type: CLIENT_MESSAGES.INPUT, payload: 12345 }), 'p_sec_2', roomManager);
    });

    const reply = ws.getLastSent();
    assert.strictEqual(reply.type, SERVER_MESSAGES.ERROR);
    assert.strictEqual(reply.payload.code, ERROR_CODES.MATCH_NOT_ACTIVE);
  });

  it('3. Buffer payload exceeding size limit is rejected', () => {
    const roomManager = new RoomManager();
    const ws = createMockSocket('ws_buf_payload');

    const oversizedBuffer = Buffer.alloc(MAX_MESSAGE_SIZE + 100, 65); // 'A's

    handleMessage(ws, oversizedBuffer, 'p_sec_3', roomManager);

    const reply = ws.getLastSent();
    assert.strictEqual(reply.type, SERVER_MESSAGES.ERROR);
    assert.strictEqual(reply.payload.code, ERROR_CODES.INVALID_PAYLOAD);
  });

  it('4. Per-connection rate limiter triggers RATE_LIMITED on message flood', () => {
    const roomManager = new RoomManager();
    const ws = createMockSocket('ws_flood');

    // Send 60 valid pings (allowed)
    for (let i = 0; i < 60; i++) {
      handleMessage(ws, JSON.stringify({ type: CLIENT_MESSAGES.PING }), 'p_sec_4', roomManager);
    }
    assert.strictEqual(ws.getLastSent().type, SERVER_MESSAGES.PONG);

    // 61st message within same second must be rate-limited
    handleMessage(ws, JSON.stringify({ type: CLIENT_MESSAGES.PING }), 'p_sec_4', roomManager);

    const rateLimitedReply = ws.getLastSent();
    assert.strictEqual(rateLimitedReply.type, SERVER_MESSAGES.ERROR);
    assert.strictEqual(rateLimitedReply.payload.code, ERROR_CODES.RATE_LIMITED);
  });

  it('5. RETURN_TO_LOBBY is rejected during active matches to prevent griefing', () => {
    const roomManager = new RoomManager();
    const ws1 = createMockSocket('ws_p1');
    const ws2 = createMockSocket('ws_p2');

    // Setup room with 2 players
    const createRes = roomManager.createRoom('p1', 'Player1', ws1);
    roomManager.joinRoom('p2', createRes.room.code, 'Player2', ws2);

    // Ready both players and start match
    roomManager.setReady('p1', true);
    roomManager.setReady('p2', true);
    roomManager.startMatch(createRes.room.code, {});

    assert.strictEqual(createRes.room.status, ROOM_STATUS.STARTING);

    // P2 attempts to reset active match via RETURN_TO_LOBBY
    handleMessage(ws2, JSON.stringify({ type: CLIENT_MESSAGES.RETURN_TO_LOBBY }), 'p2', roomManager);

    const reply = ws2.getLastSent();
    assert.strictEqual(reply.type, SERVER_MESSAGES.ERROR);
    assert.strictEqual(reply.payload.code, ERROR_CODES.GAME_ALREADY_STARTED);

    // Match game must still be alive
    assert.ok(createRes.room.game);

    // Cleanup
    createRes.room.game.destroy();
  });

  it('6. RETURN_TO_LOBBY is permitted after match reaches GAME_OVER', () => {
    const roomManager = new RoomManager();
    const ws1 = createMockSocket('ws_p1');

    const createRes = roomManager.createRoom('p1', 'Player1', ws1);
    createRes.room.status = ROOM_STATUS.GAME_OVER;

    const res = roomManager.returnToLobby(createRes.room.code);
    assert.strictEqual(res.success, true);
    assert.strictEqual(createRes.room.status, ROOM_STATUS.LOBBY);
  });

  it('7. Cryptographically secure room code generates valid 5-char code from CODE_CHARS', () => {
    const roomManager = new RoomManager();
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let i = 0; i < 50; i++) {
      const code = roomManager.generateRoomCode();
      assert.strictEqual(code.length, 5);
      for (const char of code) {
        assert.ok(CODE_CHARS.includes(char), `Character "${char}" not in CODE_CHARS`);
      }
    }
  });
});
