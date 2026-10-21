/**
 * RoomManager - Manages rooms, players, codes, and lifecycle
 */

import { randomInt } from 'crypto';
import {
  ROOM_STATUS,
  MAX_PLAYERS_PER_ROOM,
  MAX_NAME_LENGTH,
  ERROR_CODES,
} from '../websocket/protocol.js';
import { MultiplayerGame } from '../game/MultiplayerGame.js';

// Easily readable character set (no 0/O, 1/I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} Key: roomCode */
    this.rooms = new Map();
    /** @type {Map<string, string>} Key: playerId, Value: roomCode */
    this.playerRoomMap = new Map();
  }

  /**
   * Generates a unique 5-character readable room code using cryptographically secure random integers
   */
  generateRoomCode() {
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        const idx = randomInt(0, CODE_CHARS.length);
        code += CODE_CHARS[idx];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 1000);

    return code;
  }

  /**
   * Sanitizes player names
   */
  sanitizeName(rawName, defaultIndex = 1) {
    if (typeof rawName !== 'string') {
      return `Player ${defaultIndex}`;
    }
    const cleaned = rawName
      .replace(/[^\w\s\-_]/g, '')
      .trim()
      .substring(0, MAX_NAME_LENGTH);

    return cleaned || `Player ${defaultIndex}`;
  }

  /**
   * Creates a new room
   */
  createRoom(playerId, playerName, ws) {
    // If player is already in a room, leave it first
    if (this.playerRoomMap.has(playerId)) {
      this.leaveRoom(playerId);
    }

    const code = this.generateRoomCode();
    const cleanName = this.sanitizeName(playerName, 1);

    const hostPlayer = {
      id: playerId,
      name: cleanName,
      isReady: false,
      isHost: true,
      color: '#00f3ff', // Neon Cyan
      ws,
    };

    const room = {
      code,
      hostId: playerId,
      status: ROOM_STATUS.LOBBY,
      players: [hostPlayer],
      createdAt: Date.now(),
      game: null,
    };

    this.rooms.set(code, room);
    this.playerRoomMap.set(playerId, code);

    return { success: true, room };
  }

  /**
   * Joins an existing room
   */
  joinRoom(playerId, roomCode, playerName, ws) {
    if (!roomCode || typeof roomCode !== 'string') {
      return { success: false, error: ERROR_CODES.ROOM_NOT_FOUND, message: 'Invalid room code provided.' };
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      return { success: false, error: ERROR_CODES.ROOM_NOT_FOUND, message: `Room "${normalizedCode}" not found.` };
    }

    if (room.status !== ROOM_STATUS.LOBBY) {
      return { success: false, error: ERROR_CODES.GAME_ALREADY_STARTED, message: 'Game has already started in this room.' };
    }

    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      return { success: false, error: ERROR_CODES.ROOM_FULL, message: 'Room is already at maximum capacity.' };
    }

    // Check if player is already in this room
    if (room.players.some((p) => p.id === playerId)) {
      return { success: false, error: ERROR_CODES.ALREADY_IN_ROOM, message: 'You are already in this room.' };
    }

    // Leave any other room before joining
    if (this.playerRoomMap.has(playerId)) {
      this.leaveRoom(playerId);
    }

    const playerIndex = room.players.length + 1;
    const cleanName = this.sanitizeName(playerName, playerIndex);

    const newPlayer = {
      id: playerId,
      name: cleanName,
      isReady: false,
      isHost: false,
      color: '#ff007f', // Neon Pink for Player 2
      ws,
    };

    room.players.push(newPlayer);
    this.playerRoomMap.set(playerId, normalizedCode);

    return { success: true, room, newPlayer };
  }

  /**
   * Toggle or set player ready state
   */
  setReady(playerId, isReady) {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) {
      return { success: false, error: ERROR_CODES.NOT_IN_ROOM, message: 'Player is not in a room.' };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: ERROR_CODES.ROOM_NOT_FOUND, message: 'Room not found.' };
    }

    if (room.status !== ROOM_STATUS.LOBBY) {
      return { success: false, error: ERROR_CODES.GAME_ALREADY_STARTED, message: 'Match already in progress.' };
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return { success: false, error: ERROR_CODES.NOT_IN_ROOM, message: 'Player not found in room.' };
    }

    player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;

    return { success: true, room, player };
  }

  /**
   * Starts match for a room when 2 players are present and both ready
   */
  startMatch(roomCode, callbacks) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, message: 'Room not found' };
    if (room.players.length !== 2) return { success: false, message: 'Need exactly 2 players to start match' };
    if (!room.players.every((p) => p.isReady)) return { success: false, message: 'Both players must be ready' };
    if (room.status !== ROOM_STATUS.LOBBY) return { success: false, message: 'Match already active' };

    if (room.game) {
      room.game.destroy();
      room.game = null;
    }

    room.status = ROOM_STATUS.STARTING;

    const game = new MultiplayerGame(roomCode, room.players[0], room.players[1], {
      onCountdown: (seconds, snapshot) => {
        if (callbacks.onCountdown) callbacks.onCountdown(room, seconds, snapshot);
      },
      onTick: (snapshot) => {
        if (room.status === ROOM_STATUS.STARTING && snapshot.status === 'ACTIVE') {
          room.status = ROOM_STATUS.IN_GAME;
        }
        if (callbacks.onTick) callbacks.onTick(room, snapshot);
      },
      onMatchEnd: (result) => {
        room.status = ROOM_STATUS.GAME_OVER;
        if (callbacks.onMatchEnd) callbacks.onMatchEnd(room, result);
      },
    });

    room.game = game;
    game.startCountdown();

    return { success: true, room, game };
  }

  /**
   * Resets room to LOBBY status (e.g. for rematch after match ends)
   */
  returnToLobby(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, message: 'Room not found' };

    // Guard: only completed matches can return to lobby
    if (room.status !== ROOM_STATUS.GAME_OVER) {
      return {
        success: false,
        error: ERROR_CODES.GAME_ALREADY_STARTED,
        message: 'Cannot return to lobby while match is active.',
      };
    }

    if (room.game) {
      room.game.destroy();
      room.game = null;
    }

    room.status = ROOM_STATUS.LOBBY;
    for (const p of room.players) {
      p.isReady = false;
    }

    return { success: true, room };
  }

  /**
   * Player leaves their current room
   */
  leaveRoom(playerId) {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) {
      return { success: false, error: ERROR_CODES.NOT_IN_ROOM, message: 'Player is not in a room.' };
    }

    const room = this.rooms.get(roomCode);
    this.playerRoomMap.delete(playerId);

    if (!room) {
      return { success: true, roomDeleted: true };
    }

    // If an active game is running, handle game disconnect
    if (room.game) {
      room.game.handleDisconnect(playerId);
      room.game.destroy();
      room.game = null;
      room.status = ROOM_STATUS.LOBBY;
    }

    // Remove player
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    let removedPlayer = null;
    if (playerIndex !== -1) {
      removedPlayer = room.players.splice(playerIndex, 1)[0];
    }

    // Check if room is empty
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return {
        success: true,
        roomCode,
        roomDeleted: true,
        removedPlayerId: playerId,
      };
    }

    // If host left, promote remaining player
    let newHostId = null;
    if (room.hostId === playerId) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
      newHostId = room.hostId;
    }

    return {
      success: true,
      roomCode,
      room,
      roomDeleted: false,
      removedPlayerId: playerId,
      newHostId,
    };
  }

  /**
   * Gets a room by code
   */
  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.trim().toUpperCase()) || null;
  }

  /**
   * Gets the room code for a given player ID
   */
  getPlayerRoom(playerId) {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Serializes room state for network transmission (strips WebSocket references)
   */
  toPublicRoomJSON(room) {
    if (!room) return null;
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      playerCount: room.players.length,
      createdAt: room.createdAt,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        isHost: p.isHost,
        color: p.color,
      })),
    };
  }
}
