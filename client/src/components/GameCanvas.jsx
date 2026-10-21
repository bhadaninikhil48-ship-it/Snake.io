/**
 * GameCanvas - Renders HTML5 Canvas for Single-Player and Authoritative Multiplayer
 * Uses sub-tick client-side interpolation for smooth 60fps/144fps multiplayer rendering.
 * Supports intuitive 4-direction touch/pointer swipe controls.
 */

import React, { useEffect, useRef } from 'react';
import { ARENA_SIZE } from '../game/constants.js';
import { SnapshotInterpolator } from '../network/SnapshotInterpolator.js';
import { SwipeController } from '../game/SwipeController.js';
import { multiplayerClient } from '../network/MultiplayerClient.js';

export const GameCanvas = ({
  engine,
  isMultiplayer = false,
  multiplayerState = null,
  onDirection = null,
}) => {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const interpolatorRef = useRef(new SnapshotInterpolator(100));
  const swipeControllerRef = useRef(new SwipeController({ minDistance: 25 }));

  // Forward incoming authoritative snapshots to the interpolator
  useEffect(() => {
    if (isMultiplayer && multiplayerState) {
      interpolatorRef.current.pushSnapshot(multiplayerState);
    } else if (!isMultiplayer) {
      interpolatorRef.current.reset();
    }
  }, [multiplayerState, isMultiplayer]);

  // Single-player canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const setupCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = ARENA_SIZE * dpr;
      canvas.height = ARENA_SIZE * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      if (!isMultiplayer) {
        engine.setCanvas(canvas);
        engine.renderSingleFrame();
      }
    };

    setupCanvas();

    window.addEventListener('resize', setupCanvas);
    return () => {
      window.removeEventListener('resize', setupCanvas);
    };
  }, [engine, isMultiplayer]);

  // Multiplayer render loop with sub-tick visual interpolation
  useEffect(() => {
    if (!isMultiplayer || !engine) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId = null;
    const interpolator = interpolatorRef.current;

    const renderLoop = (timestamp) => {
      const visualState = interpolator.getInterpolatedState(performance.now());
      if (visualState) {
        engine.renderer.renderMultiplayer(ctx, visualState, timestamp);
      }
      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      interpolator.reset();
    };
  }, [isMultiplayer, engine]);

  // Attach 4-direction pointer swipe controls to the gameplay area
  useEffect(() => {
    const target = wrapperRef.current;
    if (!target || !onDirection) return;

    const getCurrentDirection = () => {
      if (isMultiplayer) {
        const myId = multiplayerClient.playerId;
        const mySnake =
          multiplayerState?.p1?.id === myId
            ? multiplayerState.p1
            : multiplayerState?.p2?.id === myId
            ? multiplayerState.p2
            : null;
        return mySnake?.direction || null;
      }
      return engine?.snake?.direction?.name || null;
    };

    return swipeControllerRef.current.attach(target, onDirection, getCurrentDirection);
  }, [onDirection, isMultiplayer, multiplayerState, engine]);

  return (
    <div ref={wrapperRef} className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className="game-canvas"
      />
    </div>
  );
};
