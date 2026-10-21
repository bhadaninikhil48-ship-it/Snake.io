/**
 * SNAKE CLASH ONLINE - Multiplayer Backend Server (Phase 2)
 * Express HTTP + WebSocket ("ws") Server
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './rooms/RoomManager.js';
import { Matchmaker } from './matchmaking/Matchmaker.js';
import {
  handleMessage,
  handleDisconnect,
  send,
} from './websocket/messageHandlers.js';
import { SERVER_MESSAGES, MAX_MESSAGE_SIZE } from './websocket/protocol.js';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../client/dist');

// Express Middleware
app.use(express.json());

// CORS headers for local development & API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize RoomManager & Matchmaker
const roomManager = new RoomManager();
const matchmaker = new Matchmaker();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    phase: '4C',
    service: 'Snake Clash Online Multiplayer Server',
    activeRooms: roomManager.rooms.size,
    queuedPlayers: matchmaker.getQueueSize(),
    timestamp: Date.now(),
  });
});

// Serve production static frontend if built
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Create HTTP server
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MESSAGE_SIZE,
});

// Setup WebSocket connection handling
wss.on('connection', (ws, req) => {
  const playerId = `p_${randomUUID().substring(0, 8)}`;
  ws.playerId = playerId;
  ws.isAlive = true;

  // Heartbeat pong listener
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Welcome client and provide their unique server player ID
  send(ws, SERVER_MESSAGES.WELCOME, {
    playerId,
    serverTime: Date.now(),
    maxPlayersPerRoom: 2,
  });

  // Message handler
  ws.on('message', (data) => {
    handleMessage(ws, data, playerId, roomManager, matchmaker);
  });

  // Disconnection handler
  const cleanup = () => {
    handleDisconnect(playerId, roomManager, matchmaker);
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error(`[WebSocket] Error on connection ${playerId}:`, err.message);
    cleanup();
  });
});

// Heartbeat ping interval to detect dead sockets
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Start listening if not running inside test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, HOST, () => {
    console.log(`[Snake Clash Server] Multiplayer backend running on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown handling for container and process terminations
  const shutdown = (signal) => {
    console.log(`\n[Snake Clash Server] Received ${signal}. Closing active connections...`);
    clearInterval(heartbeatInterval);

    for (const ws of wss.clients) {
      try {
        ws.close(1001, 'Server is shutting down');
      } catch {}
    }

    server.close(() => {
      console.log('[Snake Clash Server] HTTP and WebSocket listeners closed cleanly.');
      process.exit(0);
    });

    // Force exit after 5 seconds if connections hang
    setTimeout(() => {
      console.error('[Snake Clash Server] Forcefully shutting down.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app, server, wss, roomManager, matchmaker, heartbeatInterval };
