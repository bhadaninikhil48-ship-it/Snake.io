/**
 * TouchControls - Responsive on-screen directional controls for mobile / touchscreen users
 */

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DIRECTIONS } from '../game/constants.js';

export const TouchControls = ({ engine, onDirection }) => {
  const handleDir = (e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDirection) {
      onDirection(dir);
    } else if (engine) {
      engine.sendDirection(dir);
    }
  };

  return (
    <div className="touch-controls-container">
      <div className="dpad-grid">
        <button
          type="button"
          className="dpad-btn dpad-up"
          onPointerDown={(e) => handleDir(e, DIRECTIONS.UP)}
          aria-label="Up"
        >
          <ChevronUp size={24} />
        </button>

        <button
          type="button"
          className="dpad-btn dpad-left"
          onPointerDown={(e) => handleDir(e, DIRECTIONS.LEFT)}
          aria-label="Left"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="dpad-center" />

        <button
          type="button"
          className="dpad-btn dpad-right"
          onPointerDown={(e) => handleDir(e, DIRECTIONS.RIGHT)}
          aria-label="Right"
        >
          <ChevronRight size={24} />
        </button>

        <button
          type="button"
          className="dpad-btn dpad-down"
          onPointerDown={(e) => handleDir(e, DIRECTIONS.DOWN)}
          aria-label="Down"
        >
          <ChevronDown size={24} />
        </button>
      </div>
    </div>
  );
};
