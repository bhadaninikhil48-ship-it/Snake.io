/**
 * MainMenu - Cyberpunk Neon Entry Screen
 */

import React from 'react';
import { Play, Trophy, Keyboard, Zap, Users } from 'lucide-react';
import { SPEED_PRESETS } from '../game/constants';

export const MainMenu = ({ engine, stats, onOpenMultiplayer }) => {
  return (
    <div className="menu-overlay">
      <div className="menu-card glass-panel">
        {/* Glow Header */}
        <div className="menu-header">
          <div className="menu-badge">PHASE 1 // SINGLE-PLAYER PROTOCOL</div>
          <h1 className="menu-title">
            SNAKE <span className="title-highlight">CLASH</span>
          </h1>
          <p className="menu-subtitle">ENTER THE CYBER ARENA</p>
        </div>

        {/* High Score Banner */}
        {stats.highScore > 0 && (
          <div className="menu-record-badge">
            <Trophy size={16} className="record-trophy" />
            <span>ALL-TIME RECORD:</span>
            <strong className="record-val">{stats.highScore} PTS</strong>
          </div>
        )}

        {/* Speed / Difficulty Selection */}
        <div className="speed-selector-group">
          <span className="selector-title">SELECT VELOCITY:</span>
          <div className="speed-buttons">
            {Object.entries(SPEED_PRESETS).map(([key, config]) => {
              const isActive = stats.speedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`speed-option-btn ${isActive ? 'active' : ''}`}
                  onClick={() => engine.setSpeedPreset(key)}
                >
                  <Zap size={14} />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Play Action Buttons */}
        <div className="menu-actions">
          <button
            type="button"
            className="btn-cyber-primary"
            onClick={() => engine.startGame()}
            autoFocus
          >
            <Play size={20} fill="currentColor" />
            <span>INITIALIZE ARENA (SOLO)</span>
          </button>

          <button
            type="button"
            className="btn-cyber-multiplayer"
            onClick={onOpenMultiplayer}
          >
            <Users size={20} />
            <span>MULTIPLAYER ARENA (ONLINE)</span>
          </button>
        </div>

        {/* Controls Instructions Card */}
        <div className="controls-guide">
          <div className="guide-header">
            <Keyboard size={16} />
            <span>FLIGHT CONTROLS</span>
          </div>
          <div className="guide-grid">
            <div className="guide-item">
              <span className="key-cap">W A S D</span>
              <span className="guide-text">or Arrows to Steer</span>
            </div>
            <div className="guide-item">
              <span className="key-cap">SPACE</span>
              <span className="guide-text">Pause / Resume</span>
            </div>
            <div className="guide-item">
              <span className="key-cap">M</span>
              <span className="guide-text">Toggle Audio</span>
            </div>
            <div className="guide-item">
              <span className="key-cap">R</span>
              <span className="guide-text">Quick Restart</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="menu-footer">
          <span className="footer-status">ONLINE ENGINE READY</span>
          <span className="footer-version">v1.0.0-phase1</span>
        </div>
      </div>
    </div>
  );
};
