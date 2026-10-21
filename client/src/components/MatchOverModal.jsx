/**
 * MatchOverModal - Displays multiplayer outcome, winner, and rematch navigation
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Skull, Swords, RotateCcw, Home, ShieldAlert } from 'lucide-react';
import { multiplayerClient } from '../network/MultiplayerClient.js';

export const MatchOverModal = ({ matchResult, gameState, onReturnToLobby, onLeaveToMenu }) => {
  const myId = multiplayerClient.playerId;
  const isDraw = matchResult?.isDraw;
  const isWinner = !isDraw && matchResult?.winnerId === myId;
  const isLoser = !isDraw && !isWinner;

  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00f3ff', '#00ff88', '#ffe600', '#ff007f'],
        });
      } catch {}
    }
  }, [isWinner]);

  let outcomeTitle = 'MATCH CONCLUDED';
  let bannerClass = 'banner-draw';

  if (isWinner) {
    outcomeTitle = 'VICTORY ACHIEVED!';
    bannerClass = 'banner-victory';
  } else if (isLoser) {
    outcomeTitle = 'DEFEAT // TERMINATED';
    bannerClass = 'banner-defeat';
  } else if (isDraw) {
    outcomeTitle = 'DRAW // MUTUAL DESTRUCTION';
    bannerClass = 'banner-draw';
  }

  // Format reason
  const reasonRaw = matchResult?.reason || 'ARENA_RESOLUTION';
  const reasonText = reasonRaw
    .replace(/_/g, ' ')
    .toUpperCase();

  const p1 = gameState?.p1 || {};
  const p2 = gameState?.p2 || {};

  return (
    <div className="modal-backdrop">
      <div className="glass-panel match-over-modal">
        {/* Banner */}
        <div className={`mp-outcome-banner ${bannerClass}`}>
          {isWinner && <Trophy size={28} className="neon-gold" />}
          {isLoser && <Skull size={28} className="neon-red" />}
          {isDraw && <Swords size={28} className="neon-cyan" />}
          <h2 className="outcome-title">{outcomeTitle}</h2>
          <div className="outcome-reason-tag">
            <ShieldAlert size={14} />
            <span>{reasonText}</span>
          </div>
        </div>

        {/* Final Head-to-Head Scores */}
        <div className="stats-breakdown-grid mp-score-comparison">
          <div className="breakdown-item">
            <span className="breakdown-label">{p1.name || 'PILOT 1'}</span>
            <span className="breakdown-val neon-cyan">{p1.score || 0} PTS</span>
            <span className="breakdown-sublen">Length {p1.length || 4}</span>
          </div>

          <div className="mp-vs-separator">VS</div>

          <div className="breakdown-item">
            <span className="breakdown-label">{p2.name || 'PILOT 2'}</span>
            <span className="breakdown-val neon-pink">{p2.score || 0} PTS</span>
            <span className="breakdown-sublen">Length {p2.length || 4}</span>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn-cyber-primary"
            onClick={onReturnToLobby}
            autoFocus
          >
            <RotateCcw size={18} />
            <span>RETURN TO LOBBY (REMATCH)</span>
          </button>

          <button
            type="button"
            className="btn-cyber-secondary"
            onClick={onLeaveToMenu}
          >
            <Home size={18} />
            <span>EXIT TO MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
