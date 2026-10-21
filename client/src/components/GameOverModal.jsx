/**
 * GameOverModal - Displays match breakdown, collision cause, and restart actions
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Trophy, Skull, ShieldAlert } from 'lucide-react';

export const GameOverModal = ({ stats, engine }) => {
  const isNewRecord = stats.isNewHighScore;

  useEffect(() => {
    if (isNewRecord) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00ffcc', '#ff007f', '#ffe600', '#00f3ff'],
        });
      } catch {
        // Ignore confetti errors
      }
    }
  }, [isNewRecord]);

  const deathText =
    stats.deathReason === 'WALL'
      ? 'ARENA BOUNDARY BREACH'
      : stats.deathReason === 'SELF'
      ? 'TAIL SYSTEM OVERLOAD'
      : 'SYSTEM COLLAPSE';

  return (
    <div className="modal-backdrop">
      <div className="game-over-modal glass-panel">
        {/* Header */}
        <div className="modal-header">
          <div className="danger-badge">
            <Skull size={18} className="danger-icon" />
            <span>TERMINATED</span>
          </div>
          <h2 className="modal-title">GAME OVER</h2>
          <div className="death-reason">
            <ShieldAlert size={14} />
            <span>{deathText}</span>
          </div>
        </div>

        {/* New High Score Banner */}
        {isNewRecord && (
          <div className="new-high-score-banner">
            <Trophy size={20} className="glow-trophy" />
            <span>NEW ALL-TIME RECORD!</span>
          </div>
        )}

        {/* Match Statistics */}
        <div className="stats-breakdown-grid">
          <div className="breakdown-item">
            <span className="breakdown-label">FINAL SCORE</span>
            <span className="breakdown-val neon-cyan">{stats.score}</span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">SNAKE LENGTH</span>
            <span className="breakdown-val neon-green">{stats.snakeLength}</span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">RECORD SCORE</span>
            <span className="breakdown-val neon-gold">{stats.highScore}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn-cyber-primary"
            onClick={() => engine.restartGame()}
            autoFocus
          >
            <RotateCcw size={18} />
            <span>PLAY AGAIN</span>
          </button>

          <button
            type="button"
            className="btn-cyber-secondary"
            onClick={() => engine.goToMenu()}
          >
            <Home size={18} />
            <span>MAIN MENU</span>
          </button>
        </div>

        <p className="modal-hint">Press [SPACE], [ENTER], or [R] to replay</p>
      </div>
    </div>
  );
};
