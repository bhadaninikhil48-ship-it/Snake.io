/**
 * Matchmaker - Server-Authoritative Quick Match Queue and Pairing Engine
 */

import { ERROR_CODES } from '../websocket/protocol.js';

export class Matchmaker {
  constructor() {
    /** @type {Array<{ playerId: string, playerName: string, ws: any, queuedAt: number }>} */
    this.queue = [];
    /** @type {Set<string>} */
    this.queuedPlayerIds = new Set();
  }

  /**
   * Returns current queue length
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Checks whether a player ID is currently queued
   */
  isInQueue(playerId) {
    return this.queuedPlayerIds.has(playerId);
  }

  /**
   * Enqueues a player for Quick Match
   */
  enqueue(playerId, playerName, ws, roomManager) {
    if (!playerId) {
      return { success: false, error: ERROR_CODES.INVALID_PAYLOAD, message: 'Missing player ID.' };
    }

    if (!ws || ws.readyState !== ws.OPEN) {
      return { success: false, error: ERROR_CODES.INVALID_MESSAGE, message: 'Socket connection is not open.' };
    }

    // Guard: player cannot enqueue if already inside a room
    if (roomManager && roomManager.getPlayerRoom(playerId)) {
      return {
        success: false,
        error: ERROR_CODES.ALREADY_IN_ROOM,
        message: 'Cannot join matchmaking while inside an active room.',
      };
    }

    // Guard: player cannot be queued multiple times
    if (this.queuedPlayerIds.has(playerId)) {
      return {
        success: false,
        error: ERROR_CODES.ALREADY_IN_QUEUE,
        message: 'You are already in the matchmaking queue.',
      };
    }

    const sanitizedName = roomManager ? roomManager.sanitizeName(playerName, 1) : (playerName || 'Pilot');

    const entry = {
      playerId,
      playerName: sanitizedName,
      ws,
      queuedAt: Date.now(),
    };

    this.queue.push(entry);
    this.queuedPlayerIds.add(playerId);

    return {
      success: true,
      queuePosition: this.queue.length,
      entry,
    };
  }

  /**
   * Removes a player from the matchmaking queue (user cancelled or leaving)
   */
  cancel(playerId) {
    if (!this.queuedPlayerIds.has(playerId)) {
      return {
        success: false,
        error: ERROR_CODES.NOT_IN_QUEUE,
        message: 'Player is not in the matchmaking queue.',
      };
    }

    this.queue = this.queue.filter((e) => e.playerId !== playerId);
    this.queuedPlayerIds.delete(playerId);

    return { success: true };
  }

  /**
   * Cleans up disconnected sockets from the queue
   */
  handleDisconnect(playerId) {
    if (this.queuedPlayerIds.has(playerId)) {
      this.cancel(playerId);
      return true;
    }
    return false;
  }

  /**
   * Prunes stale entries (closed sockets or players who joined a room)
   */
  pruneStale(roomManager) {
    const valid = [];
    for (const entry of this.queue) {
      const isSocketOpen = entry.ws && entry.ws.readyState === entry.ws.OPEN;
      const isInRoom = roomManager ? Boolean(roomManager.getPlayerRoom(entry.playerId)) : false;

      if (isSocketOpen && !isInRoom) {
        valid.push(entry);
      } else {
        this.queuedPlayerIds.delete(entry.playerId);
      }
    }
    this.queue = valid;
  }

  /**
   * Attempts to pair waiting players into 2-player rooms.
   * Returns an array of matched room results.
   *
   * @param {import('../rooms/RoomManager.js').RoomManager} roomManager
   * @returns {Array<{ room: any, player1: any, player2: any }>}
   */
  tryMatch(roomManager) {
    if (!roomManager) return [];

    this.pruneStale(roomManager);

    const matches = [];

    while (this.queue.length >= 2) {
      const p1 = this.queue.shift();
      this.queuedPlayerIds.delete(p1.playerId);

      // Verify p1 is still valid
      if (!p1.ws || p1.ws.readyState !== p1.ws.OPEN || roomManager.getPlayerRoom(p1.playerId)) {
        continue;
      }

      // Find next valid candidate that is not p1
      let p2 = null;
      while (this.queue.length > 0) {
        const candidate = this.queue.shift();
        this.queuedPlayerIds.delete(candidate.playerId);

        if (
          candidate.playerId !== p1.playerId &&
          candidate.ws &&
          candidate.ws.readyState === candidate.ws.OPEN &&
          !roomManager.getPlayerRoom(candidate.playerId)
        ) {
          p2 = candidate;
          break;
        }
      }

      // If no valid opponent was found, re-queue p1 at the front
      if (!p2) {
        this.queue.unshift(p1);
        this.queuedPlayerIds.add(p1.playerId);
        break;
      }

      // Create room with p1 as host
      const createResult = roomManager.createRoom(p1.playerId, p1.playerName, p1.ws);
      if (!createResult.success) {
        // Fallback: put p2 back in queue
        this.queue.unshift(p2);
        this.queuedPlayerIds.add(p2.playerId);
        continue;
      }

      // Join room with p2
      const joinResult = roomManager.joinRoom(p2.playerId, createResult.room.code, p2.playerName, p2.ws);
      if (!joinResult.success) {
        // Cleanup room and re-queue p1
        roomManager.leaveRoom(p1.playerId);
        this.queue.unshift(p1);
        this.queuedPlayerIds.add(p1.playerId);
        continue;
      }

      matches.push({
        room: createResult.room,
        player1: p1,
        player2: p2,
      });
    }

    return matches;
  }
}
