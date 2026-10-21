/**
 * MultiplayerLobbyModal - Real-time Room Creation, Quick Matchmaking, Joining, and Waiting Lobby Screen
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Copy,
  Check,
  LogIn,
  PlusCircle,
  LogOut,
  Wifi,
  WifiOff,
  Crown,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Zap,
  Search,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  multiplayerClient,
  CONNECTION_STATUS,
} from '../network/MultiplayerClient.js';

export const MultiplayerLobbyModal = ({ onClose, onMatchStart }) => {
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem('snake_clash_player_name') || 'CyberPilot';
    } catch {
      return 'CyberPilot';
    }
  });

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(multiplayerClient.status);
  const [room, setRoom] = useState(multiplayerClient.currentRoom);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('quick'); // 'quick' | 'create' | 'join'
  const [isSearching, setIsSearching] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);

  const searchTimerRef = useRef(null);

  // Connect & listen to WebSocket events
  useEffect(() => {
    setIsLoading(true);
    multiplayerClient
      .connect()
      .catch(() => {
        setErrorMessage('Unable to connect to game server. Ensure backend is running.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    const unsubStatus = multiplayerClient.on('statusChange', ({ status, error }) => {
      setConnectionStatus(status);
      if (error) {
        setErrorMessage(`Connection Error: ${error}`);
      }
    });

    const unsubRoom = multiplayerClient.on('roomState', ({ room }) => {
      setRoom(room);
      setIsLoading(false);
      setIsSearching(false);
      setErrorMessage('');
    });

    const unsubError = multiplayerClient.on('error', ({ code, message }) => {
      setErrorMessage(message || code || 'An error occurred.');
      setIsLoading(false);
      setIsSearching(false);
    });

    const unsubQueued = multiplayerClient.on('matchmakingQueued', () => {
      setIsSearching(true);
      setIsLoading(false);
      setErrorMessage('');
    });

    const unsubCancelled = multiplayerClient.on('matchmakingCancelled', () => {
      setIsSearching(false);
      setIsLoading(false);
      setSearchSeconds(0);
    });

    const unsubMatchFound = multiplayerClient.on('matchFound', ({ room }) => {
      setIsSearching(false);
      setIsLoading(false);
      setRoom(room);
    });

    const unsubMatchStart = multiplayerClient.on('matchStarting', () => {
      if (onMatchStart) onMatchStart();
    });

    return () => {
      unsubStatus();
      unsubRoom();
      unsubError();
      unsubQueued();
      unsubCancelled();
      unsubMatchFound();
      unsubMatchStart();
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
      }
    };
  }, []);

  // Timer effect for matchmaking search duration
  useEffect(() => {
    if (isSearching) {
      setSearchSeconds(0);
      searchTimerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setSearchSeconds(0);
    }

    return () => {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
      }
    };
  }, [isSearching]);

  const handleNameChange = (e) => {
    const val = e.target.value.substring(0, 16);
    setPlayerName(val);
    try {
      localStorage.setItem('snake_clash_player_name', val);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleStartQuickMatch = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Please enter a pilot callsign.');
      return;
    }
    setErrorMessage('');
    setIsLoading(true);
    try {
      await multiplayerClient.joinMatchmaking(playerName);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start matchmaking.');
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleCancelQuickMatch = () => {
    multiplayerClient.cancelMatchmaking();
    setIsSearching(false);
    setIsLoading(false);
  };

  const handleCreateRoom = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      await multiplayerClient.createRoom(playerName);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create room.');
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    if (e) e.preventDefault();
    if (!roomCodeInput.trim()) {
      setErrorMessage('Please enter a valid room code.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    try {
      await multiplayerClient.joinRoom(roomCodeInput.trim(), playerName);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to join room.');
      setIsLoading(false);
    }
  };

  const handleToggleReady = () => {
    if (!room) return;
    const myPlayer = room.players.find((p) => p.id === multiplayerClient.playerId);
    const nextReady = myPlayer ? !myPlayer.isReady : true;
    multiplayerClient.setReady(nextReady);
  };

  const handleLeaveRoom = () => {
    multiplayerClient.leaveRoom();
    setRoom(null);
    setErrorMessage('');
  };

  const handleCloseModal = () => {
    if (isSearching) {
      multiplayerClient.cancelMatchmaking();
    }
    onClose();
  };

  const handleCopyCode = () => {
    if (!room?.code) return;
    try {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Format mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING;
  const myPlayer = room?.players?.find((p) => p.id === multiplayerClient.playerId);
  const isReady = myPlayer?.isReady || false;

  return (
    <div className="modal-backdrop">
      <div className="glass-panel lobby-modal">
        {/* Connection Status Pill */}
        <div className="lobby-status-bar">
          <div className="status-indicator">
            {isConnected ? (
              <Wifi size={14} className="neon-cyan" />
            ) : (
              <WifiOff size={14} className="neon-red" />
            )}
            <span className={`status-text ${isConnected ? 'neon-cyan' : 'neon-red'}`}>
              {isConnecting
                ? 'CONNECTING TO SERVER...'
                : isConnected
                ? 'SERVER ONLINE'
                : 'SERVER OFFLINE'}
            </span>
          </div>

          <button
            type="button"
            className="lobby-close-btn"
            onClick={handleCloseModal}
            title="Return to Menu"
          >
            <ArrowLeft size={16} />
            <span>EXIT LOBBY</span>
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="lobby-error-banner">
            <ShieldAlert size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* VIEW A: Room Search / Quick Match / Create / Join */}
        {!room ? (
          <div className="lobby-content">
            <div className="lobby-header">
              <h2 className="lobby-title">MULTIPLAYER PORTAL</h2>
              <p className="lobby-subtitle">PHASE 4C // AUTHORITATIVE QUICK MATCH</p>
            </div>

            {/* Pilot Identity Input */}
            <div className="input-group">
              <label htmlFor="pilot-name" className="input-label">
                PILOT CALLSIGN:
              </label>
              <input
                id="pilot-name"
                type="text"
                className="cyber-input"
                placeholder="Enter Callsign"
                value={playerName}
                onChange={handleNameChange}
                maxLength={16}
                disabled={isLoading || isSearching}
              />
            </div>

            {/* Tabs: Quick Match vs Create Arena vs Join Code */}
            <div className="lobby-tabs lobby-tabs-three">
              <button
                type="button"
                className={`lobby-tab ${activeTab === 'quick' ? 'active' : ''}`}
                onClick={() => {
                  if (!isSearching) setActiveTab('quick');
                }}
                disabled={isSearching}
              >
                <Zap size={16} />
                <span>QUICK MATCH</span>
              </button>
              <button
                type="button"
                className={`lobby-tab ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => {
                  if (!isSearching) setActiveTab('create');
                }}
                disabled={isSearching}
              >
                <PlusCircle size={16} />
                <span>CREATE ARENA</span>
              </button>
              <button
                type="button"
                className={`lobby-tab ${activeTab === 'join' ? 'active' : ''}`}
                onClick={() => {
                  if (!isSearching) setActiveTab('join');
                }}
                disabled={isSearching}
              >
                <LogIn size={16} />
                <span>JOIN VIA CODE</span>
              </button>
            </div>

            {/* Tab 1: Quick Match */}
            {activeTab === 'quick' && (
              <div className="tab-pane">
                {!isSearching ? (
                  <>
                    <p className="tab-description">
                      Find an opponent instantly without exchanging room codes. The server will automatically pair you with another waiting pilot.
                    </p>
                    <button
                      type="button"
                      className="btn-cyber-primary btn-quick-match"
                      onClick={handleStartQuickMatch}
                      disabled={!isConnected || isLoading || !playerName.trim()}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="spin-icon" />
                          <span>CONNECTING...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          <span>FIND MATCH NOW</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="matchmaking-search-container">
                    <div className="matchmaking-radar">
                      <div className="radar-circle radar-ring-1" />
                      <div className="radar-circle radar-ring-2" />
                      <div className="radar-sweep" />
                      <Search size={28} className="radar-center-icon neon-cyan" />
                    </div>

                    <div className="matchmaking-status-text">
                      <h3 className="matchmaking-status-title">SEARCHING FOR OPPONENT...</h3>
                      <p className="matchmaking-status-sub">
                        Scanning active pilots on server grid
                      </p>
                      <div className="matchmaking-timer-pill">
                        <Clock size={14} />
                        <span>TIME ELAPSED: {formatTime(searchSeconds)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-cyber-danger"
                      onClick={handleCancelQuickMatch}
                    >
                      <XCircle size={18} />
                      <span>CANCEL SEARCH</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Create Private Room */}
            {activeTab === 'create' && (
              <div className="tab-pane">
                <p className="tab-description">
                  Generate a private battle arena room code and invite an opponent to clash.
                </p>
                <button
                  type="button"
                  className="btn-cyber-primary"
                  onClick={handleCreateRoom}
                  disabled={!isConnected || isLoading || !playerName.trim()}
                >
                  <PlusCircle size={18} />
                  <span>{isLoading ? 'GENERATING ROOM...' : 'CREATE NEW ROOM'}</span>
                </button>
              </div>
            )}

            {/* Tab 3: Join Private Room */}
            {activeTab === 'join' && (
              <form className="tab-pane" onSubmit={handleJoinRoom}>
                <div className="input-group">
                  <label htmlFor="room-code" className="input-label">
                    ENTER 5-CHARACTER ROOM CODE:
                  </label>
                  <input
                    id="room-code"
                    type="text"
                    className="cyber-input room-code-input"
                    placeholder="e.g. 4N7WM"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-cyber-primary"
                  disabled={!isConnected || isLoading || !roomCodeInput.trim()}
                >
                  <LogIn size={18} />
                  <span>{isLoading ? 'JOINING ARENA...' : 'ENTER ROOM'}</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          /* VIEW B: Waiting Room / Lobby Screen */
          <div className="waiting-room-content">
            <div className="room-code-badge-container">
              <span className="code-label">ROOM ACCESS CODE</span>
              <div className="code-display-row">
                <span className="room-code-highlight">{room.code}</span>
                <button
                  type="button"
                  className={`copy-code-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyCode}
                  title="Copy code to clipboard"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'COPIED!' : 'COPY'}</span>
                </button>
              </div>
              <span className="code-subtext">Share this code with your opponent</span>
            </div>

            {/* Players List in Room */}
            <div className="players-list-card">
              <div className="players-list-header">
                <Users size={16} />
                <span>PILOT ROSTER ({room.players.length}/2)</span>
              </div>

              <div className="players-slots">
                {/* Slot 1 (Host) */}
                {room.players[0] && (
                  <div className="player-slot-row slot-occupied">
                    <div className="player-info-left">
                      <span
                        className="player-color-dot"
                        style={{ backgroundColor: room.players[0].color }}
                      />
                      <span className="player-name-text">
                        {room.players[0].name}
                        {room.players[0].id === multiplayerClient.playerId && ' (YOU)'}
                      </span>
                      {room.players[0].isHost && (
                        <span className="host-pill" title="Room Host">
                          <Crown size={12} />
                          <span>HOST</span>
                        </span>
                      )}
                    </div>
                    <div className="player-info-right">
                      <span
                        className={`ready-status-badge ${
                          room.players[0].isReady ? 'ready-true' : 'ready-false'
                        }`}
                      >
                        {room.players[0].isReady ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>READY</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} />
                            <span>WAITING</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Slot 2 (Opponent or Empty) */}
                {room.players[1] ? (
                  <div className="player-slot-row slot-occupied">
                    <div className="player-info-left">
                      <span
                        className="player-color-dot"
                        style={{ backgroundColor: room.players[1].color }}
                      />
                      <span className="player-name-text">
                        {room.players[1].name}
                        {room.players[1].id === multiplayerClient.playerId && ' (YOU)'}
                      </span>
                    </div>
                    <div className="player-info-right">
                      <span
                        className={`ready-status-badge ${
                          room.players[1].isReady ? 'ready-true' : 'ready-false'
                        }`}
                      >
                        {room.players[1].isReady ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>READY</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} />
                            <span>WAITING</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="player-slot-row slot-empty">
                    <div className="pulsing-radar-dot" />
                    <span className="slot-empty-text">AWAITING OPPONENT PILOT...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ready Status / Countdown Alert */}
            {room.players.length === 2 && room.players.every((p) => p.isReady) ? (
              <div className="all-ready-banner">
                <CheckCircle2 size={18} className="neon-green" />
                <span>ALL PILOTS READY // LOBBY LOCKED FOR ARENA</span>
              </div>
            ) : (
              <div className="lobby-hint-text">
                {room.players.length < 2
                  ? 'Waiting for Player 2 to join arena.'
                  : 'Toggle readiness to confirm arena setup.'}
              </div>
            )}

            {/* Waiting Room Actions */}
            <div className="waiting-room-actions">
              <button
                type="button"
                className={`btn-cyber-primary ${isReady ? 'btn-ready-active' : ''}`}
                onClick={handleToggleReady}
              >
                <CheckCircle2 size={18} />
                <span>{isReady ? 'CANCEL READY' : 'SET AS READY'}</span>
              </button>

              <button
                type="button"
                className="btn-cyber-secondary"
                onClick={handleLeaveRoom}
              >
                <LogOut size={18} />
                <span>LEAVE ROOM</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
