import { WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { handleMessage, handleDisconnect, send } from '../websocket/messageHandlers.js';
import { SERVER_MESSAGES, CLIENT_MESSAGES, ERROR_CODES } from '../websocket/protocol.js';

console.log('=== RUNNING REAL WEBSOCKET E2E TEST ===');

// Setup ephemeral test server
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

wss.on('connection', (ws) => {
  const playerId = `p_test_${Math.random().toString(36).substring(2, 7)}`;
  ws.playerId = playerId;
  ws.isAlive = true;

  send(ws, SERVER_MESSAGES.WELCOME, { playerId });

  ws.on('message', (data) => {
    handleMessage(ws, data, playerId, roomManager);
  });

  ws.on('close', () => {
    handleDisconnect(playerId, roomManager);
  });
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const wsUrl = `ws://127.0.0.1:${port}`;

// Helper to create connected client
function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const messages = [];

    ws.on('message', (raw) => {
      messages.push(JSON.parse(raw.toString()));
    });

    ws.waitForType = (type, timeout = 2000) => {
      return new Promise((res, rej) => {
        const check = () => {
          const match = messages.find((m) => m.type === type);
          if (match) return res(match);
          if (Date.now() - start > timeout) return rej(new Error(`Timed out waiting for ${type}`));
          setTimeout(check, 20);
        };
        const start = Date.now();
        check();
      });
    };

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

const c1 = await connectClient();
const welcome1 = await c1.waitForType(SERVER_MESSAGES.WELCOME);
console.log('✓ Client 1 connected & received WELCOME:', welcome1.payload.playerId);

// Client 1 creates room
c1.send(JSON.stringify({
  type: CLIENT_MESSAGES.CREATE_ROOM,
  payload: { playerName: 'LeaderOne' },
}));
const created = await c1.waitForType(SERVER_MESSAGES.ROOM_CREATED);
const roomCode = created.payload.room.code;
console.log('✓ Room created over WebSocket with code:', roomCode);

// Client 2 connects & joins
const c2 = await connectClient();
await c2.waitForType(SERVER_MESSAGES.WELCOME);
c2.send(JSON.stringify({
  type: CLIENT_MESSAGES.JOIN_ROOM,
  payload: { roomCode, playerName: 'ChallengerTwo' },
}));

const joined2 = await c2.waitForType(SERVER_MESSAGES.ROOM_JOINED);
console.log('✓ Client 2 joined room over WebSocket successfully');

// Client 1 should have received PLAYER_JOINED
const playerJoinedMsg = await c1.waitForType(SERVER_MESSAGES.PLAYER_JOINED);
if (playerJoinedMsg.payload.player.name !== 'ChallengerTwo') {
  throw new Error('Client 1 did not get correct player joined notification');
}
console.log('✓ Client 1 received real-time broadcast of PLAYER_JOINED');

// Client 3 tries to join the full room -> Expect ERROR ROOM_FULL
const c3 = await connectClient();
await c3.waitForType(SERVER_MESSAGES.WELCOME);
c3.send(JSON.stringify({
  type: CLIENT_MESSAGES.JOIN_ROOM,
  payload: { roomCode, playerName: 'Intruder' },
}));
const errorMsg = await c3.waitForType(SERVER_MESSAGES.ERROR);
if (errorMsg.payload.code !== ERROR_CODES.ROOM_FULL) {
  throw new Error(`Expected ROOM_FULL, got ${errorMsg.payload.code}`);
}
console.log('✓ Client 3 rejected with ROOM_FULL error as expected');

// Clean up
c1.close();
c2.close();
c3.close();
server.close();
console.log('=== REAL WEBSOCKET E2E TEST PASSED! ===');
process.exit(0);
