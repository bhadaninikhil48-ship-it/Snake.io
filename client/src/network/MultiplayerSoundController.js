/**
 * MultiplayerSoundController - Event-Driven Audio Coordinator for Multiplayer
 * Prevents duplicate sound triggers from repeated GAME_STATE packets.
 */

import { soundManager } from '../game/SoundManager.js';

export class MultiplayerSoundController {
  constructor(soundMgr = soundManager) {
    this.sound = soundMgr;
    this.lastCountdown = null;
    this.lastP1Score = null;
    this.lastP2Score = null;
    this.lastP1Alive = true;
    this.lastP2Alive = true;
    this.hasPlayedMatchEnd = false;
    this.lastMatchStatus = null;
  }

  /**
   * Resets all tracked state (called when starting match, returning to lobby, or disconnecting)
   */
  reset() {
    this.lastCountdown = null;
    this.lastP1Score = null;
    this.lastP2Score = null;
    this.lastP1Alive = true;
    this.lastP2Alive = true;
    this.hasPlayedMatchEnd = false;
    this.lastMatchStatus = null;
  }

  /**
   * Handles countdown sound cues from MATCH_STARTING or GAME_STATE
   */
  onCountdown(seconds) {
    if (typeof seconds !== 'number') return;

    if (seconds !== this.lastCountdown) {
      this.lastCountdown = seconds;
      this.sound.playCountdown(seconds);
    }
  }

  /**
   * Evaluates authoritative GAME_STATE snapshot and triggers sounds only on genuine transitions
   */
  onGameState(state) {
    if (!state) return;

    const { status, countdown, p1, p2 } = state;

    // 1. Countdown sounds
    if (status === 'COUNTDOWN' && typeof countdown === 'number') {
      this.onCountdown(countdown);
    }

    // 2. Transition from COUNTDOWN to ACTIVE
    if (this.lastMatchStatus === 'COUNTDOWN' && status === 'ACTIVE') {
      this.sound.playStart();
    }
    this.lastMatchStatus = status;

    // Only process in-game events when active
    if (status !== 'ACTIVE') return;

    if (!p1 || !p2) return;

    // 3. First snapshot of match - initialize baselines without playing historical sounds
    if (this.lastP1Score === null || this.lastP2Score === null) {
      this.lastP1Score = p1.score || 0;
      this.lastP2Score = p2.score || 0;
      this.lastP1Alive = p1.isAlive !== undefined ? p1.isAlive : true;
      this.lastP2Alive = p2.isAlive !== undefined ? p2.isAlive : true;
      return;
    }

    // 4. Food consumption detection
    const p1ScoreDelta = (p1.score || 0) - this.lastP1Score;
    const p2ScoreDelta = (p2.score || 0) - this.lastP2Score;

    if (p1ScoreDelta > 0 || p2ScoreDelta > 0) {
      const isSuper = p1ScoreDelta >= 30 || p2ScoreDelta >= 30;
      if (isSuper) {
        this.sound.playSuperEat();
      } else {
        this.sound.playEat();
      }
      this.lastP1Score = p1.score || 0;
      this.lastP2Score = p2.score || 0;
    }

    // 5. Snake collision / elimination detection
    const p1Died = this.lastP1Alive && !p1.isAlive;
    const p2Died = this.lastP2Alive && !p2.isAlive;

    if (p1Died || p2Died) {
      this.sound.playDie();
      this.lastP1Alive = p1.isAlive;
      this.lastP2Alive = p2.isAlive;
    }
  }

  /**
   * Handles match end sound selection (victory, defeat, or draw) exactly once
   */
  onMatchEnd(result, myPlayerId) {
    if (this.hasPlayedMatchEnd || !result) return;
    this.hasPlayedMatchEnd = true;

    if (result.isDraw) {
      this.sound.playDraw();
    } else if (result.winnerId === myPlayerId) {
      this.sound.playVictory();
    } else {
      this.sound.playDefeat();
    }
  }
}

export const multiplayerSoundController = new MultiplayerSoundController();
