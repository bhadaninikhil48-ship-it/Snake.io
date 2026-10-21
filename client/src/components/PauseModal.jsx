/**
 * PauseModal - Displayed when player pauses the session
 */

import React from 'react';
import { Play, RotateCcw, Home, PauseCircle } from 'lucide-react';

export const PauseModal = ({ engine }) => {
  return (
    <div className="modal-backdrop">
      <div className="pause-modal glass-panel">
        <div className="modal-header">
          <PauseCircle size={36} className="pause-icon neon-cyan" />
          <h2 className="modal-title">ARENA PAUSED</h2>
          <p className="pause-subtitle">SYSTEM STATE SUSPENDED</p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-cyber-primary"
            onClick={() => engine.togglePause()}
            autoFocus
          >
            <Play size={18} />
            <span>RESUME</span>
          </button>

          <button
            type="button"
            className="btn-cyber-secondary"
            onClick={() => engine.restartGame()}
          >
            <RotateCcw size={18} />
            <span>RESTART</span>
          </button>

          <button
            type="button"
            className="btn-cyber-tertiary"
            onClick={() => engine.goToMenu()}
          >
            <Home size={18} />
            <span>MAIN MENU</span>
          </button>
        </div>

        <p className="modal-hint">Press [SPACE] to resume</p>
      </div>
    </div>
  );
};
