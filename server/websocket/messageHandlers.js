/**
 * Message Handlers - JSON WebSocket Protocol Dispatcher & Validator
 */

import {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  ERROR_CODES,
  MAX_MESSAGE_SIZE,
  ROOM_STATUS,
} from './protocol.js';

/**
 * Safely sends a formatted JSON message to a WebSocket client
 */
export function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try {
    const data = JSON.stringify({ type, payload });
    ws.send(data);
  } catch (err) {
    console.error('[WebSocket] Failed to send message:', err);
  }
}

/**
 * Notifies players when matched together via Matchmaker
 */
export function notifyMatch(match, roomManager) {
  const { room, player1, player2 } = match;
  const publicRoom = roomManager.toPublicRoomJSON(room);

  // Notify Player 1 (Host)
  send(player1.ws, SERVER_MESSAGES.MATCH_FOUND, {
    roomCode: room.code,
    room: publicRoom,
    opponent: { id: player2.playerId, name: player2.playerName },
  });
  send(player1.ws, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });

  // Notify Player 2 (Challenger)
  send(player2.ws, SERVER_MESSAGES.MATCH_FOUND, {
    roomCode: room.code,
    room: publicRoom,
    opponent: { id: player1.playerId, name: player1.playerName },
  });
  send(player2.ws, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
}

/**
 * Sends an error message to a WebSocket client
 */
export function sendError(ws, code, message) {
  send(ws, SERVER_MESSAGES.ERROR, { code, message });
}

/**
 * Broadcasts a message to all connected players in a room
 */
export function broadcastRoom(room, type, payload, excludePlayerId = null) {
  if (!room || !Array.isArray(room.players)) return;

  for (const player of room.players) {
    if (excludePlayerId && player.id === excludePlayerId) continue;
    if (player.ws && player.ws.readyState === player.ws.OPEN) {
      send(player.ws, type, payload);
    }
  }
}

/**
 * Initiates match countdown and loop if 2 players in room are ready
 */
export function checkAndStartMatch(room, roomManager) {
  if (
    room.players.length === 2 &&
    room.players.every((p) => p.isReady) &&
    room.status === ROOM_STATUS.LOBBY
  ) {
    const startResult = roomManager.startMatch(room.code, {
      onCountdown: (r, seconds, snapshot) => {
        broadcastRoom(r, SERVER_MESSAGES.MATCH_STARTING, {
          countdown: seconds,
          roomCode: r.code,
          p1: { id: r.players[0].id, name: r.players[0].name, color: r.players[0].color },
          p2: { id: r.players[1].id, name: r.players[1].name, color: r.players[1].color },
        });
        broadcastRoom(r, SERVER_MESSAGES.GAME_STATE, snapshot);
      },
      onTick: (r, snapshot) => {
        broadcastRoom(r, SERVER_MESSAGES.GAME_STATE, snapshot);
      },
      onMatchEnd: (r, result) => {
        broadcastRoom(r, SERVER_MESSAGES.MATCH_ENDED, result);
        const publicRoom = roomManager.toPublicRoomJSON(r);
        broadcastRoom(r, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
      },
    });

    if (startResult.success) {
      const publicRoom = roomManager.toPublicRoomJSON(room);
      broadcastRoom(room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
    }
  }
}

/**
 * Main dispatcher for client messages
 */
export function handleMessage(ws, rawData, playerId, roomManager, matchmaker = null) {
  // 1. Enforce payload size limit (handles string and Buffer)
  const rawLength = typeof rawData === 'string' ? rawData.length : (rawData?.length || rawData?.byteLength || 0);
  if (rawLength > MAX_MESSAGE_SIZE) {
    sendError(ws, ERROR_CODES.INVALID_PAYLOAD, 'Message payload exceeds size limit.');
    return;
  }

  // 2. Enforce per-connection message rate limiting (max 60 messages / sec)
  const now = Date.now();
  if (!ws.rateLimitWindow || now - ws.rateLimitWindow > 1000) {
    ws.rateLimitWindow = now;
    ws.rateLimitCount = 0;
  }
  ws.rateLimitCount++;
  if (ws.rateLimitCount > 60) {
    sendError(ws, ERROR_CODES.RATE_LIMITED, 'Message rate limit exceeded. Please slow down.');
    return;
  }

  // 3. Safely parse JSON
  let message;
  try {
    const text = typeof rawData === 'string' ? rawData : rawData.toString();
    message = JSON.parse(text);
  } catch {
    sendError(ws, ERROR_CODES.INVALID_MESSAGE, 'Malformed JSON payload received.');
    return;
  }

  // 4. Validate message structure
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    sendError(ws, ERROR_CODES.INVALID_MESSAGE, 'Message must be an object with a string "type" field.');
    return;
  }

  // 5. Defensively guarantee payload is a non-null plain object
  const { type } = message;
  const payload = (message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload))
    ? message.payload
    : {};

  try {
    switch (type) {
      case CLIENT_MESSAGES.PING: {
        send(ws, SERVER_MESSAGES.PONG, { timestamp: Date.now() });
        break;
      }

      case CLIENT_MESSAGES.JOIN_MATCHMAKING: {
        if (!matchmaker) {
          sendError(ws, ERROR_CODES.MATCHMAKING_FAILED, 'Matchmaker service is unavailable.');
          return;
        }

        const playerName = payload.playerName;
        const enqueueResult = matchmaker.enqueue(playerId, playerName, ws, roomManager);

        if (!enqueueResult.success) {
          send(ws, SERVER_MESSAGES.MATCHMAKING_ERROR, {
            code: enqueueResult.error,
            message: enqueueResult.message,
          });
          return;
        }

        send(ws, SERVER_MESSAGES.MATCHMAKING_QUEUED, {
          position: enqueueResult.queuePosition,
          queuedAt: enqueueResult.entry.queuedAt,
        });

        // Try to match immediately
        const matches = matchmaker.tryMatch(roomManager);
        for (const match of matches) {
          notifyMatch(match, roomManager);
        }
        break;
      }

      case CLIENT_MESSAGES.CANCEL_MATCHMAKING: {
        if (!matchmaker) {
          sendError(ws, ERROR_CODES.MATCHMAKING_FAILED, 'Matchmaker service is unavailable.');
          return;
        }

        const cancelResult = matchmaker.cancel(playerId);
        if (!cancelResult.success) {
          send(ws, SERVER_MESSAGES.MATCHMAKING_ERROR, {
            code: cancelResult.error,
            message: cancelResult.message,
          });
          return;
        }

        send(ws, SERVER_MESSAGES.MATCHMAKING_CANCELLED, {
          playerId,
          timestamp: Date.now(),
        });
        break;
      }

      case CLIENT_MESSAGES.CREATE_ROOM: {
        if (matchmaker && matchmaker.isInQueue(playerId)) {
          matchmaker.cancel(playerId);
        }

        const playerName = payload.playerName;
        const result = roomManager.createRoom(playerId, playerName, ws);
        if (!result.success) {
          sendError(ws, result.error || ERROR_CODES.INVALID_PAYLOAD, result.message);
          return;
        }

        const publicRoom = roomManager.toPublicRoomJSON(result.room);
        send(ws, SERVER_MESSAGES.ROOM_CREATED, { room: publicRoom });
        send(ws, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
        break;
      }

      case CLIENT_MESSAGES.JOIN_ROOM: {
        if (matchmaker && matchmaker.isInQueue(playerId)) {
          matchmaker.cancel(playerId);
        }

        const { roomCode, playerName } = payload;
        const result = roomManager.joinRoom(playerId, roomCode, playerName, ws);

        if (!result.success) {
          sendError(ws, result.error, result.message);
          return;
        }

        const publicRoom = roomManager.toPublicRoomJSON(result.room);
        const publicNewPlayer = {
          id: result.newPlayer.id,
          name: result.newPlayer.name,
          isReady: result.newPlayer.isReady,
          isHost: result.newPlayer.isHost,
          color: result.newPlayer.color,
        };

        // Notify joining player
        send(ws, SERVER_MESSAGES.ROOM_JOINED, { room: publicRoom });

        // Notify existing players in room
        broadcastRoom(
          result.room,
          SERVER_MESSAGES.PLAYER_JOINED,
          { player: publicNewPlayer, room: publicRoom },
          playerId
        );

        // Broadcast full room state to all players in room
        broadcastRoom(result.room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
        break;
      }

      case CLIENT_MESSAGES.SET_READY: {
        const isReady = payload.isReady;
        const result = roomManager.setReady(playerId, isReady);

        if (!result.success) {
          sendError(ws, result.error, result.message);
          return;
        }

        const publicRoom = roomManager.toPublicRoomJSON(result.room);
        broadcastRoom(result.room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });

        // Check if match should start
        checkAndStartMatch(result.room, roomManager);
        break;
      }

      case CLIENT_MESSAGES.INPUT: {
        const room = roomManager.getPlayerRoom(playerId);
        if (!room || !room.game) {
          sendError(ws, ERROR_CODES.MATCH_NOT_ACTIVE, 'No active match to receive input.');
          return;
        }

        const direction = payload.direction;
        if (!direction || typeof direction !== 'string') {
          sendError(ws, ERROR_CODES.INVALID_PAYLOAD, 'Direction must be a non-empty string.');
          return;
        }

        // Authoritative snake accepts input
        room.game.handleInput(playerId, direction);
        break;
      }

      case CLIENT_MESSAGES.REQUEST_GAME_STATE: {
        const room = roomManager.getPlayerRoom(playerId);
        if (room && room.game) {
          send(ws, SERVER_MESSAGES.GAME_STATE, room.game.getSnapshot());
        }
        break;
      }

      case CLIENT_MESSAGES.RETURN_TO_LOBBY: {
        const room = roomManager.getPlayerRoom(playerId);
        if (!room) {
          sendError(ws, ERROR_CODES.NOT_IN_ROOM, 'Player is not in a room.');
          return;
        }

        // Enforce that return to lobby is only permitted when match is completed
        if (room.status !== ROOM_STATUS.GAME_OVER) {
          sendError(ws, ERROR_CODES.GAME_ALREADY_STARTED, 'Cannot return to lobby while match is active.');
          return;
        }

        roomManager.returnToLobby(room.code);
        const publicRoom = roomManager.toPublicRoomJSON(room);
        broadcastRoom(room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
        break;
      }

      case CLIENT_MESSAGES.LEAVE_ROOM: {
        const result = roomManager.leaveRoom(playerId);
        if (result.success && !result.roomDeleted && result.room) {
          const publicRoom = roomManager.toPublicRoomJSON(result.room);
          broadcastRoom(result.room, SERVER_MESSAGES.PLAYER_LEFT, {
            playerId,
            newHostId: result.newHostId,
            room: publicRoom,
          });
          broadcastRoom(result.room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
        }
        break;
      }

      default: {
        sendError(ws, ERROR_CODES.INVALID_MESSAGE, `Unknown message type: "${type}".`);
        break;
      }
    }
  } catch (err) {
    console.error(`[WebSocket] Unexpected error handling message for ${playerId}:`, err.message);
    sendError(ws, ERROR_CODES.INVALID_PAYLOAD, 'An error occurred while processing the request.');
  }
}

/**
 * Handles client disconnection
 */
export function handleDisconnect(playerId, roomManager, matchmaker = null) {
  if (matchmaker) {
    matchmaker.handleDisconnect(playerId);
  }

  const result = roomManager.leaveRoom(playerId);
  if (result.success && !result.roomDeleted && result.room) {
    const publicRoom = roomManager.toPublicRoomJSON(result.room);
    broadcastRoom(result.room, SERVER_MESSAGES.PLAYER_LEFT, {
      playerId,
      newHostId: result.newHostId,
      room: publicRoom,
    });
    broadcastRoom(result.room, SERVER_MESSAGES.ROOM_STATE, { room: publicRoom });
  }
}
