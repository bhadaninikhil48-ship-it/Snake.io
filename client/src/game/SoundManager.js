/**
 * SoundManager - Zero-dependency Web Audio API Sound Synthesizer
 * Generates futuristic retro synth SFX dynamically for Single-Player and Multiplayer.
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.muteListeners = new Set();
    
    // Load mute preference
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('snake_clash_muted');
        if (saved !== null) {
          this.isMuted = JSON.parse(saved);
        }
      }
    } catch {
      this.isMuted = false;
    }
  }

  init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  subscribeMute(listener) {
    this.muteListeners.add(listener);
    return () => this.muteListeners.delete(listener);
  }

  notifyMute() {
    for (const fn of this.muteListeners) {
      try {
        fn(this.isMuted);
      } catch {}
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('snake_clash_muted', JSON.stringify(this.isMuted));
      }
    } catch {}
    this.notifyMute();
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('snake_clash_muted', JSON.stringify(this.isMuted));
      }
    } catch {}
    this.notifyMute();
  }

  playEat() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Silently catch audio context autoplay errors
    }
  }

  playSuperEat() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      
      // Dual-oscillator celebratory chime
      [587.33, 880, 1174.66].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const startTime = now + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.18);
      });
    } catch {
      // Silently catch
    }
  }

  playDie() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Silently catch
    }
  }

  playStart() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Silently catch
    }
  }

  playCountdown(seconds) {
    if (this.isMuted) return;
    if (seconds <= 0) {
      this.playStart();
      return;
    }

    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Pitch slightly higher as countdown progresses (3: 440, 2: 523, 1: 659)
      const freqs = { 3: 440, 2: 523.25, 1: 659.25 };
      const freq = freqs[seconds] || 440;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Silently catch
    }
  }

  playVictory() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      // Triumphant rising arpeggio: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const start = now + i * 0.08;
        const dur = 0.2;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.13, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Silently catch
    }
  }

  playDefeat() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      // Low descending two-tone minor: Eb3 -> C3
      const notes = [
        { freq: 155.56, time: 0, dur: 0.18 },
        { freq: 130.81, time: 0.15, dur: 0.28 },
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const start = now + time;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Silently catch
    }
  }

  playDraw() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      // Neutral mystery chord: D4 + Ab4 resolving to A4
      [293.66, 415.30].forEach((freq) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.24);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.26);
      });
    } catch {
      // Silently catch
    }
  }

  playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Silently catch
    }
  }
}

export const soundManager = new SoundManager();
