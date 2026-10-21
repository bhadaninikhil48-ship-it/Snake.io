/**
 * MultiplayerClient - Reusable Native WebSocket Client for Snake Clash Online
 */

export const CONNECTION_STATUS = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
};

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.status = CONNECTION_STATUS.DISCONNECTED;
    this.playerId = null;
    this.currentRoom = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.shouldAutoReconnect = false;
    this.lastSeenTick = 0;
    this.pendingDirection = null;
  }

  /**
   * Resolves the WebSocket URL using Vite environment variable with smart local/production fallback
   */
  getWsUrl() {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    // Local dev: backend runs on port 3001
    if (isLocalhost) {
      return `${isHttps ? 'wss:' : 'ws:'}//${host}:3001`;
    }

    // Production: use current host and standard secure port (or window.location.port if explicitly set)
    const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
    return `${isHttps ? 'wss:' : 'ws:'}//${host}${port}`;
  }

  /**
   * Connect to backend WebSocket server
   */
  connect() {
    // Avoid duplicate connection attempts
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      return Promise.resolve(this.ws);
    }

    this.shouldAutoReconnect = true;
    this.setStatus(CONNECTION_STATUS.CONNECTING);

    return new Promise((resolve, reject) => {
      const url = this.getWsUrl();

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        this.setStatus(CONNECTION_STATUS.ERROR, err.message);
        return reject(err);
      }

      this.ws.onopen = () => {
        this.setStatus(CONNECTION_STATUS.CONNECTED);
        resolve(this.ws);
      };

      this.ws.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error('[MultiplayerClient] WebSocket error:', err);
        this.setStatus(CONNECTION_STATUS.ERROR, 'Connection error');
      };

      this.ws.onclose = () => {
        const wasConnected = this.status === CONNECTION_STATUS.CONNECTED;
        this.setStatus(CONNECTION_STATUS.DISCONNECTED);
        this.currentRoom = null;

        if (this.shouldAutoReconnect && wasConnected) {
          this.scheduleReconnect();
        }
      };
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldAutoReconnect) {
        this.connect().catch(() => {});
      }
    }, 3000);
  }

  /**
   * Disconnect cleanly
   */
  disconnect() {
    this.shouldAutoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentRoom = null;
    this.setStatus(CONNECTION_STATUS.DISCONNECTED);
  }

  setStatus(newStatus, errorDetails = null) {
    this.status = newStatus;
    this.emit('statusChange', { status: newStatus, error: errorDetails });
  }

  /**
   * Sends JSON payload to server
   */
  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify({ type, payload }));
      return true;
    } catch (err) {
      console.error('[MultiplayerClient] Send failed:', err);
      return false;
    }
  }

  /**
   * API: Join quick matchmaking queue
   */
  joinMatchmaking(playerName) {
    return this.ensureConnected().then(() => {
      this.send('JOIN_MATCHMAKING', { playerName });
    });
  }

  /**
   * API: Cancel matchmaking search
   */
  cancelMatchmaking() {
    return this.send('CANCEL_MATCHMAKING', {});
  }

  /**
   * API: Create a new room
   */
  createRoom(playerName) {
    return this.ensureConnected().then(() => {
      this.send('CREATE_ROOM', { playerName });
    });
  }

  /**
   * API: Join an existing room
   */
  joinRoom(roomCode, playerName) {
    return this.ensureConnected().then(() => {
      this.send('JOIN_ROOM', {
        roomCode: roomCode ? roomCode.trim().toUpperCase() : '',
        playerName,
      });
    });
  }

  /**
   * API: Toggle or set ready state
   */
  setReady(isReady) {
    return this.send('SET_READY', { isReady });
  }

  /**
   * API: Leave room
   */
  leaveRoom() {
    this.send('LEAVE_ROOM', {});
    this.currentRoom = null;
    this.lastSeenTick = 0;
    this.pendingDirection = null;
    this.emit('roomState', { room: null });
  }

  /**
   * API: Send direction input to authoritative server
   */
  sendInput(direction, seq = 0) {
    if (!direction) return false;
    this.pendingDirection = direction;
    return this.send('INPUT', { direction, seq });
  }

  /**
   * API: Return room back to lobby status
   */
  returnToLobby() {
    this.lastSeenTick = 0;
    this.pendingDirection = null;
    return this.send('RETURN_TO_LOBBY', {});
  }

  /**
   * API: Request fresh game state
   */
  requestGameState() {
    return this.send('REQUEST_GAME_STATE', {});
  }

  ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return this.connect();
  }

  /**
   * Dispatches incoming server message to listeners
   */
  handleIncomingMessage(rawData) {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch {
      console.warn('[MultiplayerClient] Failed to parse server message:', rawData);
      return;
    }

    const { type, payload } = message;

    switch (type) {
      case 'WELCOME':
        this.playerId = payload.playerId;
        this.emit('welcome', payload);
        break;

      case 'ROOM_CREATED':
      case 'ROOM_JOINED':
      case 'ROOM_STATE':
        this.currentRoom = payload.room;
        this.emit('roomState', payload);
        break;

      case 'PLAYER_JOINED':
        this.currentRoom = payload.room;
        this.emit('playerJoined', payload);
        this.emit('roomState', payload);
        break;

      case 'PLAYER_LEFT':
        this.currentRoom = payload.room;
        this.emit('playerLeft', payload);
        this.emit('roomState', payload);
        break;

      case 'MATCHMAKING_QUEUED':
        this.emit('matchmakingQueued', payload);
        break;

      case 'MATCHMAKING_CANCELLED':
        this.emit('matchmakingCancelled', payload);
        break;

      case 'MATCH_FOUND':
        this.currentRoom = payload.room;
        this.emit('matchFound', payload);
        this.emit('roomState', payload);
        break;

      case 'MATCHMAKING_ERROR':
        this.emit('matchmakingError', payload);
        this.emit('error', payload);
        break;

      case 'MATCH_STARTING':
        this.lastSeenTick = 0;
        this.emit('matchStarting', payload);
        break;

      case 'GAME_STATE':
        // Drop out-of-order stale packets
        if (typeof payload.tick === 'number' && payload.tick < this.lastSeenTick) {
          return;
        }
        if (typeof payload.tick === 'number') {
          this.lastSeenTick = payload.tick;
        }
        if (this.pendingDirection) {
          const mySnake = payload.p1?.id === this.playerId ? payload.p1 : payload.p2?.id === this.playerId ? payload.p2 : null;
          if (mySnake && mySnake.direction === this.pendingDirection) {
            this.pendingDirection = null;
          }
        }
        this.emit('gameState', payload);
        break;

      case 'MATCH_ENDED':
        this.emit('matchEnded', payload);
        break;

      case 'MATCH_CANCELLED':
        this.emit('matchCancelled', payload);
        break;

      case 'ERROR':
        this.emit('error', payload);
        break;

      case 'PONG':
        this.emit('pong', payload);
        break;

      default:
        this.emit(type, payload);
        break;
    }
  }

  /**
   * Event listener subscription
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[MultiplayerClient] Handler error on event "${event}":`, err);
        }
      }
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
