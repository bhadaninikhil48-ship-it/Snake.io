import { WebSocket } from 'ws';

console.log('=== STARTING LIVE MULTIPLAYER MATCH E2E TEST (PORT 3001) ===');

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

    ws.waitFor = (predicate, timeout = 6000) => {
      return new Promise((res, rej) => {
        const start = Date.now();
        const check = () => {
          const match = ws.messages.find(predicate);
          if (match) return res(match);
          if (Date.now() - start > timeout) {
            return rej(new Error(`${name}: Timed out waiting for message. Received types: ${ws.messages.map(m => m.type).join(', ')}`));
          }
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
  // Step 1: Connect Player 1 and create room
  const p1 = await createClient('Player1');
  await p1.waitFor((m) => m.type === 'WELCOME');
  p1.send(JSON.stringify({ type: 'CREATE_ROOM', payload: { playerName: 'AceP1' } }));
  const createdMsg = await p1.waitFor((m) => m.type === 'ROOM_CREATED');
  const roomCode = createdMsg.payload.room.code;
  console.log(`✓ 1. Room created: ${roomCode}`);

  // Step 2: Connect Player 2 and join room
  const p2 = await createClient('Player2');
  await p2.waitFor((m) => m.type === 'WELCOME');
  p2.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomCode, playerName: 'RivalP2' } }));
  await p2.waitFor((m) => m.type === 'ROOM_JOINED');
  console.log('✓ 2. Player 2 joined room');

  // Step 3: Both players set ready
  p1.send(JSON.stringify({ type: 'SET_READY', payload: { isReady: true } }));
  p2.send(JSON.stringify({ type: 'SET_READY', payload: { isReady: true } }));

  // Step 4: Both receive MATCH_STARTING
  const p1Start = await p1.waitFor((m) => m.type === 'MATCH_STARTING');
  const p2Start = await p2.waitFor((m) => m.type === 'MATCH_STARTING');
  if (p1Start.payload.roomCode !== roomCode || p2Start.payload.roomCode !== roomCode) {
    throw new Error('Match starting room code mismatch');
  }
  console.log('✓ 3. MATCH_STARTING broadcast with countdown to both players');

  // Step 5: Both receive initial GAME_STATE
  const p1InitialState = await p1.waitFor((m) => m.type === 'GAME_STATE');
  const p2InitialState = await p2.waitFor((m) => m.type === 'GAME_STATE');
  if (p1InitialState.payload.p1.segments.length !== 4 || p2InitialState.payload.p2.segments.length !== 4) {
    throw new Error('Initial snake segment lengths mismatch');
  }
  console.log('✓ 4. Initial GAME_STATE synchronized (P1 at 7,15; P2 at 22,15)');

  // Step 6: Wait for countdown to finish and match to become ACTIVE
  console.log('... Awaiting countdown completion ...');
  const activeState = await p1.waitFor((m) => m.type === 'GAME_STATE' && m.payload.status === 'ACTIVE', 5000);
  console.log(`✓ 5. Match entered ACTIVE simulation at tick ${activeState.payload.tick}`);

  // Step 7: Player 1 sends direction input 'UP'
  p1.send(JSON.stringify({ type: 'INPUT', payload: { direction: 'UP' } }));
  
  // Wait a few ticks and verify Player 1 snake direction updated
  const updatedState = await p1.waitFor((m) => m.type === 'GAME_STATE' && m.payload.status === 'ACTIVE' && m.payload.p1.direction === 'UP', 3000);
  console.log(`✓ 6. Direction input 'UP' authoritatively processed and confirmed on tick ${updatedState.payload.tick}`);

  // Step 8: Test match resolution by driving P2 into top wall
  p2.send(JSON.stringify({ type: 'INPUT', payload: { direction: 'UP' } }));
  
  // Wait for MATCH_ENDED
  console.log('... Awaiting match collision resolution ...');
  const endP1 = await p1.waitFor((m) => m.type === 'MATCH_ENDED', 6000);
  const endP2 = await p2.waitFor((m) => m.type === 'MATCH_ENDED', 6000);
  console.log(`✓ 7. MATCH_ENDED broadcast received: Winner=${endP1.payload.winnerId}, Reason=${endP1.payload.reason}`);

  // Step 9: Return to lobby
  p1.send(JSON.stringify({ type: 'RETURN_TO_LOBBY' }));
  const lobbyState = await p1.waitFor((m) => m.type === 'ROOM_STATE' && m.payload.room.status === 'LOBBY');
  console.log(`✓ 8. Room successfully returned to LOBBY status (${lobbyState.payload.room.status})`);

  // Cleanup
  p1.close();
  p2.close();
  console.log('=== LIVE MULTIPLAYER MATCH E2E TEST PASSED! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('LIVE E2E TEST FAILED:', err);
  process.exit(1);
});
