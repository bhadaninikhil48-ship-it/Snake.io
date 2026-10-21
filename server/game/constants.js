/**
 * Server-Side Game Engine Constants for Snake Clash Online (Phase 3)
 */

export const GRID_SIZE = 30; // 30x30 arena grid
export const TICK_INTERVAL_MS = 100; // 100 ms fixed simulation tick (10 ticks per second)
export const COUNTDOWN_SECONDS = 3; // 3 seconds pre-match countdown

export const DIRECTIONS = {
  UP: { x: 0, y: -1, name: 'UP' },
  DOWN: { x: 0, y: 1, name: 'DOWN' },
  LEFT: { x: -1, y: 0, name: 'LEFT' },
  RIGHT: { x: 1, y: 0, name: 'RIGHT' },
};

export const OPPOSITE_DIRECTIONS = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

export const MATCH_STATUS = {
  COUNTDOWN: 'COUNTDOWN',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

export const FOOD_TYPES = {
  REGULAR: {
    id: 'REGULAR',
    points: 10,
    growth: 1,
    color: '#ff007f',
  },
  SUPER: {
    id: 'SUPER',
    points: 30,
    growth: 2,
    color: '#ffe600',
  },
};
