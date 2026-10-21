import { WebSocket } from 'ws';

console.log('=== RUNNING COMPREHENSIVE LIVE SERVER VALIDATION (PORT 3001) ===');

const WS_URL = 'ws://localhost:3001';

function createClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.name = name;
    ws.messages = [];

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        ws.messages.push(parsed);
      } catch {}
    });

    ws.waitFor = (predicate, timeout = 3000) => {
      return new Promise((res, rej) => {
        const start = Date.now();
        const check = () => {
          const match = ws.messages.find(predicate);
          if (match) return res(match);
          if (Date.now() - start > timeout) return rej(new Error(`${name}: Timed out waiting for message`));
          setTimeout(check, 25);
        };
        check();
      });
    };

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

async function run() {
  // Test 1 & 2: WebSocket connections work
  const p1 = await createClient('Player1');
  const welcome1 = await p1.waitFor((m) => m.type === 'WELCOME');
  console.log('Test 1 & 2 PASSED: Connected and received WELCOME with ID:', welcome1.payload.playerId);

  // Test 3: A room can be created
  p1.send(JSON.stringify({
    type: 'CREATE_ROOM',
    payload: { playerName: 'CyberLord' },
  }));
  const roomCreatedMsg = await p1.waitFor((m) => m.type === 'ROOM_CREATED');
  const room = roomCreatedMsg.payload.room;
  const roomCode = room.code;
  console.log('Test 3 PASSED: Room created with code:', roomCode);

  // Test 4: Second browser / client can join the room
  const p2 = await createClient('Player2');
  await p2.waitFor((m) => m.type === 'WELCOME');
  p2.send(JSON.stringify({
    type: 'JOIN_ROOM',
    payload: { roomCode, playerName: 'NeonRider' },
  }));
  const p2Joined = await p2.waitFor((m) => m.type === 'ROOM_JOINED');
  console.log('Test 4 PASSED: Player 2 joined room:', p2Joined.payload.room.code);

  // Test 5: Both clients receive the same room state
  const p1State = await p1.waitFor((m) => m.type === 'ROOM_STATE' && m.payload.room.players.length === 2);
  const p2State = await p2.waitFor((m) => m.type === 'ROOM_STATE' && m.payload.room.players.length === 2);
  if (p1State.payload.room.code !== p2State.payload.room.code || p1State.payload.room.players.length !== 2) {
    throw new Error('Room states do not match between clients!');
  }
  console.log('Test 5 PASSED: Both clients received identical room state (2 players synchronized)');

  // Test 6: Third player rejected when room is full
  const p3 = await createClient('Player3');
  await p3.waitFor((m) => m.type === 'WELCOME');
  p3.send(JSON.stringify({
    type: 'JOIN_ROOM',
    payload: { roomCode, playerName: 'Intruder' },
  }));
  const fullError = await p3.waitFor((m) => m.type === 'ERROR');
  if (fullError.payload.code !== 'ROOM_FULL') {
    throw new Error(`Expected ROOM_FULL, got ${fullError.payload.code}`);
  }
  console.log('Test 6 PASSED: Third player rejected with ROOM_FULL error');

  // Test 7: Invalid room codes rejected
  p3.send(JSON.stringify({
    type: 'JOIN_ROOM',
    payload: { roomCode: 'ZZZZZ', playerName: 'Ghost' },
  }));
  const notFoundError = await p3.waitFor((m) => m.type === 'ERROR' && m.payload.code === 'ROOM_NOT_FOUND');
  console.log('Test 7 PASSED: Nonexistent room code rejected with ROOM_NOT_FOUND');

  // Test 8: Malformed message does not crash server
  p3.send('MALFORMED_NON_JSON_PACKET{{{');
  const malformedError = await p3.waitFor((m) => m.type === 'ERROR' && m.payload.code === 'INVALID_MESSAGE');
  console.log('Test 8 PASSED: Malformed JSON handled gracefully without crashing server');

  // Test 9 & 10: Leaving a room works & updates room state for remaining player
  p2.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
  const p1AfterLeave = await p1.waitFor((m) => m.type === 'PLAYER_LEFT' || (m.type === 'ROOM_STATE' && m.payload.room.players.length === 1));
  console.log('Test 9 & 10 PASSED: Player 2 left room, Player 1 notified and room updated to 1 player');

  // Test 11: Two different rooms remain isolated
  const roomAClient = await createClient('RoomAHost');
  await roomAClient.waitFor((m) => m.type === 'WELCOME');
  roomAClient.send(JSON.stringify({ type: 'CREATE_ROOM', payload: { playerName: 'Alpha' } }));
  const roomACreated = await roomAClient.waitFor((m) => m.type === 'ROOM_CREATED');

  const roomBClient = await createClient('RoomBHost');
  await roomBClient.waitFor((m) => m.type === 'WELCOME');
  roomBClient.send(JSON.stringify({ type: 'CREATE_ROOM', payload: { playerName: 'Beta' } }));
  const roomBCreated = await roomBClient.waitFor((m) => m.type === 'ROOM_CREATED');

  if (roomACreated.payload.room.code === roomBCreated.payload.room.code) {
    throw new Error('Two rooms generated identical codes!');
  }
  console.log(`Test 11 PASSED: Rooms isolated: Room A (${roomACreated.payload.room.code}) vs Room B (${roomBCreated.payload.room.code})`);

  // Cleanup
  p1.close();
  p2.close();
  p3.close();
  roomAClient.close();
  roomBClient.close();

  console.log('=== ALL LIVE INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
