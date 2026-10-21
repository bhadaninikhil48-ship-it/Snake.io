/**
 * MultiplayerHUD - Live Heads-up Display for Head-to-Head Multiplayer Clashes
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, LogOut, Swords, Volume2, VolumeX } from 'lucide-react';
import { multiplayerClient, CONNECTION_STATUS } from '../network/MultiplayerClient.js';
import { soundManager } from '../game/SoundManager.js';

export const MultiplayerHUD = ({ gameState, onLeave }) => {
  const [connectionStatus, setConnectionStatus] = useState(multiplayerClient.status);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);

  const myId = multiplayerClient.playerId;
  const p1 = gameState?.p1 || { name: 'Player 1', score: 0, length: 4 };
  const p2 = gameState?.p2 || { name: 'Player 2', score: 0, length: 4 };

  const isP1Me = p1.id === myId;
  const isP2Me = p2.id === myId;

  useEffect(() => {
    const unsubNet = multiplayerClient.on('statusChange', ({ status }) => {
      setConnectionStatus(status);
    });
    const unsubMute = soundManager.subscribeMute((muted) => {
      setIsMuted(muted);
    });

    return () => {
      unsubNet();
      unsubMute();
    };
  }, []);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;

  return (
    <header className="hud-container mp-hud-container">
      {/* Player 1 Card (Cyan) */}
      <div className={`mp-player-stat-card ${isP1Me ? 'mp-me-card' : ''}`}>
        <div className="mp-stat-identity">
          <span className="player-color-dot" style={{ backgroundColor: '#00f3ff' }} />
          <span className="mp-player-name">{p1.name} {isP1Me && '(YOU)'}</span>
        </div>
        <div className="mp-stat-scores">
          <span className="mp-stat-val neon-cyan">{p1.score} PTS</span>
          <span className="mp-stat-len">LEN {p1.length}</span>
        </div>
      </div>

      {/* Center Match Status */}
      <div className="mp-center-hub">
        <Swords size={20} className="mp-clash-icon" />
        <span className="mp-status-pill">
          {gameState?.status === 'COUNTDOWN'
            ? `PREPARING (${gameState.countdown}s)`
            : gameState?.status === 'ENDED'
            ? 'MATCH ENDED'
            : 'LIVE ARENA'}
        </span>
      </div>

      {/* Player 2 Card (Pink) */}
      <div className={`mp-player-stat-card ${isP2Me ? 'mp-me-card' : ''}`}>
        <div className="mp-stat-identity">
          <span className="player-color-dot" style={{ backgroundColor: '#ff007f' }} />
          <span className="mp-player-name">{p2.name} {isP2Me && '(YOU)'}</span>
        </div>
        <div className="mp-stat-scores">
          <span className="mp-stat-val neon-pink">{p2.score} PTS</span>
          <span className="mp-stat-len">LEN {p2.length}</span>
        </div>
      </div>

      {/* Actions: Connection status, Sound Mute & Leave match */}
      <div className="hud-actions">
        {/* Connection indicator */}
        <div
          className="hud-btn"
          style={{ cursor: 'default' }}
          title={isConnected ? 'Server Online' : 'Server Disconnected'}
        >
          {isConnected ? <Wifi size={16} className="neon-cyan" /> : <WifiOff size={16} className="neon-red" />}
        </div>

        {/* Audio Mute Toggle */}
        <button
          type="button"
          className={`hud-btn ${isMuted ? 'btn-muted' : ''}`}
          onClick={() => soundManager.toggleMute()}
          title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Leave Match */}
        <button
          type="button"
          className="hud-btn btn-muted"
          onClick={onLeave}
          title="Surrender / Leave Match"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
