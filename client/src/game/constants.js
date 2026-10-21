/**
 * SNAKE CLASH ONLINE - Game Constants & Config
 */

export const GRID_SIZE = 30; // 30x30 grid cells
export const CELL_SIZE = 24; // 24px per cell (Virtual arena resolution = 720x720)
export const ARENA_SIZE = GRID_SIZE * CELL_SIZE; // 720px

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

export const SPEED_PRESETS = {
  CASUAL: { label: 'Casual', tickInterval: 130 },
  NORMAL: { label: 'Normal', tickInterval: 115 }, // Adjusted from 100ms (-13% speed) for smoother gameplay balance
  HARD: { label: 'Hyper', tickInterval: 75 },
};

export const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
};

export const FOOD_TYPES = {
  REGULAR: {
    id: 'REGULAR',
    points: 10,
    growth: 1,
    color: '#ff007f', // Neon pink/magenta
    glowColor: 'rgba(255, 0, 127, 0.8)',
    label: 'Data Orb',
  },
  SUPER: {
    id: 'SUPER',
    points: 30,
    growth: 2,
    color: '#ffe600', // Neon gold
    glowColor: 'rgba(255, 230, 0, 0.9)',
    label: 'Quantum Core',
  },
};

export const THEME = {
  bg: '#080a11',
  arenaBg: '#0c0f18',
  gridLines: 'rgba(0, 240, 255, 0.05)',
  gridDots: 'rgba(0, 240, 255, 0.15)',
  borderGlow: '#00f3ff',
  borderDark: '#042838',
  snake: {
    head: '#00ffcc',
    headGlow: 'rgba(0, 255, 204, 0.85)',
    bodyStart: '#00e5ff',
    bodyEnd: '#0077ff',
    eyes: '#ffffff',
    pupils: '#080a11',
  },
  text: '#e2f1ff',
  accent: '#00f3ff',
  danger: '#ff2e63',
  gold: '#ffcc00',
};
