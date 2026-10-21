/**
 * HUD - Heads-Up Display showing Live Score, Length, High Score, and Controls
 */

import React from 'react';
import { Volume2, VolumeX, Pause, Play, Trophy, Zap } from 'lucide-react';
import { GAME_STATES, SPEED_PRESETS } from '../game/constants';

export const HUD = ({ stats, engine }) => {
  const isPlaying = stats.state === GAME_STATES.PLAYING;
  const isPaused = stats.state === GAME_STATES.PAUSED;

  return (
    <header className="hud-container">
      {/* Brand / Logo */}
      <div className="hud-brand">
        <span className="brand-dot" />
        <h1 className="brand-title">SNAKE CLASH</h1>
        <span className="brand-tag">ARENA</span>
      </div>

      {/* Main Stats Hub */}
      <div className="hud-stats">
        {/* Score Indicator */}
        <div className="stat-card stat-score">
          <span className="stat-label">SCORE</span>
          <span className="stat-value neon-cyan">{stats.score}</span>
        </div>

        {/* Length Indicator */}
        <div className="stat-card stat-length">
          <span className="stat-label">LENGTH</span>
          <span className="stat-value neon-green">{stats.snakeLength}</span>
        </div>

        {/* High Score Indicator */}
        <div className="stat-card stat-best">
          <div className="stat-label-with-icon">
            <Trophy size={14} className="trophy-icon" />
            <span className="stat-label">BEST</span>
          </div>
          <span className="stat-value neon-gold">{stats.highScore}</span>
        </div>

        {/* Speed Indicator */}
        <div className="stat-card stat-speed">
          <div className="stat-label-with-icon">
            <Zap size={14} className="speed-icon" />
            <span className="stat-label">MODE</span>
          </div>
          <span className="stat-value speed-pill">
            {SPEED_PRESETS[stats.speedKey]?.label || 'NORMAL'}
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="hud-actions">
        {/* Pause Button */}
        {(isPlaying || isPaused) && (
          <button
            className={`hud-btn ${isPaused ? 'btn-active' : ''}`}
            onClick={() => engine.togglePause()}
            title={isPaused ? 'Resume Game (Space)' : 'Pause Game (Space)'}
            aria-label="Pause or Resume"
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        )}

        {/* Sound Toggle */}
        <button
          className={`hud-btn ${stats.isMuted ? 'btn-muted' : ''}`}
          onClick={() => engine.toggleMute()}
          title={stats.isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          aria-label="Toggle Sound"
        >
          {stats.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </header>
  );
};
