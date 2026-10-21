/**
 * Main Application Component - Snake Clash Online (Single-Player & Multiplayer)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GameEngine } from './game/GameEngine.js';
import { GAME_STATES } from './game/constants.js';
import { soundManager } from './game/SoundManager.js';
import { GameCanvas } from './components/GameCanvas.jsx';
import { HUD } from './components/HUD.jsx';
import { MultiplayerHUD } from './components/MultiplayerHUD.jsx';
import { MainMenu } from './components/MainMenu.jsx';
import { GameOverModal } from './components/GameOverModal.jsx';
import { PauseModal } from './components/PauseModal.jsx';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal.jsx';
import { MatchOverModal } from './components/MatchOverModal.jsx';
import { multiplayerClient } from './network/MultiplayerClient.js';
import { multiplayerSoundController } from './network/MultiplayerSoundController.js';
import './App.css';

export function App() {
  // Multiplayer UI & Game State
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isMultiplayerMatch, setIsMultiplayerMatch] = useState(false);
  const [multiplayerState, setMultiplayerState] = useState(null);
  const [matchResult, setMatchResult] = useState(null);

  // Single-player state
  const [stats, setStats] = useState({
    state: GAME_STATES.MENU,
    score: 0,
    highScore: 0,
    snakeLength: 4,
    speedKey: 'NORMAL',
    isNewHighScore: false,
    deathReason: null,
    isMuted: soundManager.isMuted,
  });

  // Create single stable GameEngine instance for Single Player
  const engine = useMemo(() => {
    return new GameEngine((snapshot) => {
      setStats((prev) => ({ ...prev, ...snapshot }));
    });
  }, []);

  // Initialize single player engine and sound listener
  useEffect(() => {
    engine.notify();
    const unsubMute = soundManager.subscribeMute((isMuted) => {
      setStats((prev) => ({ ...prev, isMuted }));
    });

    return () => {
      unsubMute();
      engine.destroy();
    };
  }, [engine]);

  // Subscribe to multiplayer network events and sound triggers
  useEffect(() => {
    const unsubMatchStarting = multiplayerClient.on('matchStarting', (payload) => {
      setIsMultiplayerOpen(false);
      setIsMultiplayerMatch(true);
      setMatchResult(null);
      multiplayerSoundController.reset();
      if (typeof payload?.countdown === 'number') {
        multiplayerSoundController.onCountdown(payload.countdown);
      }
    });

    const unsubGameState = multiplayerClient.on('gameState', (payload) => {
      setMultiplayerState(payload);
      multiplayerSoundController.onGameState(payload);
    });

    const unsubMatchEnded = multiplayerClient.on('matchEnded', (payload) => {
      setMatchResult(payload);
      multiplayerSoundController.onMatchEnd(payload, multiplayerClient.playerId);
    });

    const unsubMatchCancelled = multiplayerClient.on('matchCancelled', () => {
      setIsMultiplayerMatch(false);
      setMatchResult(null);
      setIsMultiplayerOpen(true);
      multiplayerSoundController.reset();
    });

    return () => {
      unsubMatchStarting();
      unsubGameState();
      unsubMatchEnded();
      unsubMatchCancelled();
      multiplayerSoundController.reset();
    };
  }, []);

  // Handle keyboard inputs when multiplayer match is active
  useEffect(() => {
    if (!isMultiplayerMatch) return;

    const handleKeyDown = (e) => {
      // Audio toggle hotkey
      if (e.code === 'KeyM') {
        e.preventDefault();
        soundManager.toggleMute();
        return;
      }

      let dir = null;
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          dir = 'UP';
          break;
        case 'ArrowDown':
        case 'KeyS':
          dir = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'KeyA':
          dir = 'LEFT';
          break;
        case 'ArrowRight':
        case 'KeyD':
          dir = 'RIGHT';
          break;
        default:
          break;
      }

      if (dir) {
        e.preventDefault();
        multiplayerClient.sendInput(dir);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMultiplayerMatch]);

  // Navigation handlers
  const handleReturnToLobby = () => {
    multiplayerSoundController.reset();
    multiplayerClient.returnToLobby();
    setIsMultiplayerMatch(false);
    setMatchResult(null);
    setMultiplayerState(null);
    setIsMultiplayerOpen(true);
  };

  const handleLeaveMultiplayer = () => {
    multiplayerSoundController.reset();
    multiplayerClient.leaveRoom();
    setIsMultiplayerMatch(false);
    setMatchResult(null);
    setMultiplayerState(null);
    setIsMultiplayerOpen(false);
  };

  const handleDirectionInput = (dir) => {
    if (isMultiplayerMatch) {
      multiplayerClient.sendInput(dir.name);
    } else {
      engine.sendDirection(dir);
    }
  };

  return (
    <div className="game-root">
      {/* Ambient Cyber Neon Background Glows */}
      <div className="ambient-glow glow-cyan" />
      <div className="ambient-glow glow-pink" />

      {/* Heads-up display: Multiplayer or Single Player */}
      {isMultiplayerMatch ? (
        <MultiplayerHUD
          gameState={multiplayerState}
          onLeave={handleLeaveMultiplayer}
        />
      ) : (
        <HUD stats={stats} engine={engine} />
      )}

      {/* Main Arena Canvas */}
      <main className="arena-container">
        <GameCanvas
          engine={engine}
          isMultiplayer={isMultiplayerMatch}
          multiplayerState={multiplayerState}
          onDirection={handleDirectionInput}
        />

        {/* Modal Layers */}
        {matchResult && (
          <MatchOverModal
            matchResult={matchResult}
            gameState={multiplayerState}
            onReturnToLobby={handleReturnToLobby}
            onLeaveToMenu={handleLeaveMultiplayer}
          />
        )}

        {isMultiplayerOpen && !isMultiplayerMatch && (
          <MultiplayerLobbyModal
            onClose={() => setIsMultiplayerOpen(false)}
            onMatchStart={() => {
              setIsMultiplayerOpen(false);
              setIsMultiplayerMatch(true);
            }}
          />
        )}

        {stats.state === GAME_STATES.MENU && !isMultiplayerOpen && !isMultiplayerMatch && (
          <MainMenu
            engine={engine}
            stats={stats}
            onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          />
        )}

        {stats.state === GAME_STATES.PAUSED && !isMultiplayerMatch && (
          <PauseModal engine={engine} />
        )}

        {stats.state === GAME_STATES.GAME_OVER && !isMultiplayerMatch && (
          <GameOverModal stats={stats} engine={engine} />
        )}
      </main>
    </div>
  );
}

export default App;
