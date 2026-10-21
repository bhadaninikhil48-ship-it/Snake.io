/**
 * Canvas Renderer - High-fidelity Cyberpunk Neon Visuals
 */

import { CELL_SIZE, GRID_SIZE, ARENA_SIZE, THEME } from './constants.js';

export class Renderer {
  constructor() {
    this.pulseAngle = 0;
  }

  /**
   * Main render pass
   */
  render(ctx, gameState, timestamp = 0) {
    const { snake, food, particles, isGameOver } = gameState;

    // Clear background
    this.drawBackground(ctx);

    // Draw grid
    this.drawGrid(ctx, timestamp);

    // Draw arena border
    this.drawBorder(ctx, timestamp);

    // Draw food
    if (food) {
      this.drawFood(ctx, food, timestamp);
    }

    // Draw snake (if alive or dying)
    if (snake) {
      this.drawSnake(ctx, snake, isGameOver, timestamp);
    }

    // Draw particle bursts
    if (particles) {
      particles.draw(ctx);
    }
  }

  drawBackground(ctx) {
    ctx.fillStyle = THEME.arenaBg;
    ctx.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);
  }

  drawGrid(ctx, timestamp) {
    ctx.save();

    // Subtle grid lines
    ctx.strokeStyle = THEME.gridLines;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * CELL_SIZE;
      // Vertical line
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, ARENA_SIZE);
      // Horizontal line
      ctx.moveTo(0, pos);
      ctx.lineTo(ARENA_SIZE, pos);
    }
    ctx.stroke();

    // High-tech intersection dots
    ctx.fillStyle = THEME.gridDots;
    const dotSpacing = CELL_SIZE * 3; // Every 3 cells
    for (let x = dotSpacing; x < ARENA_SIZE; x += dotSpacing) {
      for (let y = dotSpacing; y < ARENA_SIZE; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawBorder(ctx, timestamp) {
    ctx.save();

    // Pulsing neon border
    const pulse = Math.sin(timestamp * 0.003) * 0.2 + 0.8;
    ctx.strokeStyle = THEME.borderGlow;
    ctx.shadowColor = THEME.borderGlow;
    ctx.shadowBlur = 12 * pulse;
    ctx.lineWidth = 2;

    ctx.strokeRect(1, 1, ARENA_SIZE - 2, ARENA_SIZE - 2);

    // Futuristic corner brackets
    const cornerSize = 20;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00ffcc';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(2, cornerSize);
    ctx.lineTo(2, 2);
    ctx.lineTo(cornerSize, 2);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(ARENA_SIZE - cornerSize, 2);
    ctx.lineTo(ARENA_SIZE - 2, 2);
    ctx.lineTo(ARENA_SIZE - 2, cornerSize);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(2, ARENA_SIZE - cornerSize);
    ctx.lineTo(2, ARENA_SIZE - 2);
    ctx.lineTo(cornerSize, ARENA_SIZE - 2);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(ARENA_SIZE - cornerSize, ARENA_SIZE - 2);
    ctx.lineTo(ARENA_SIZE - 2, ARENA_SIZE - 2);
    ctx.lineTo(ARENA_SIZE - 2, ARENA_SIZE - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  drawFood(ctx, food, timestamp) {
    const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
    const radius = CELL_SIZE * 0.38;

    const pulse = Math.sin(timestamp * 0.007) * 2.5;
    const glowRadius = Math.max(2, radius + pulse);

    const isSuper = food.type === 'SUPER' || food.type?.id === 'SUPER';
    const color = food.color || (isSuper ? '#ffe600' : '#ff007f');
    const glowColor = isSuper ? 'rgba(255, 230, 0, 0.9)' : 'rgba(255, 0, 127, 0.8)';

    ctx.save();

    // Outer pulsing energy aura
    const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius * 1.8);
    auraGrad.addColorStop(0, glowColor);
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Core Orb
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright specular highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting rings if super food
    if (isSuper) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const rot = timestamp * 0.004;
      ctx.ellipse(cx, cy, radius * 1.5, radius * 0.6, rot, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSnake(ctx, snake, isGameOver, timestamp) {
    const segments = snake.segments;
    if (segments.length === 0) return;

    ctx.save();

    const head = snake.getHead();
    const headRadius = CELL_SIZE * 0.44;
    const bodyRadius = CELL_SIZE * 0.40;

    // 1. Draw Body Segments (from tail to head for proper layer blending)
    for (let i = segments.length - 1; i >= 1; i--) {
      const seg = segments[i];
      const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;

      // Color gradient along snake length
      const ratio = 1 - i / segments.length;
      const blue = Math.floor(180 + 75 * ratio);
      const green = Math.floor(140 + 115 * ratio);
      const color = isGameOver
        ? `rgba(255, 46, 99, ${0.4 + 0.6 * ratio})`
        : `rgb(0, ${green}, ${blue})`;

      // Segment glow
      ctx.shadowColor = isGameOver ? 'rgba(255, 46, 99, 0.5)' : 'rgba(0, 229, 255, 0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.arc(cx, cy, bodyRadius, 0, Math.PI * 2);
      ctx.fill();

      // Connector to previous segment for smooth continuous body look
      const prev = segments[i - 1];
      const px = prev.x * CELL_SIZE + CELL_SIZE / 2;
      const py = prev.y * CELL_SIZE + CELL_SIZE / 2;

      ctx.lineWidth = bodyRadius * 2;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    // 2. Draw Head
    const hx = head.x * CELL_SIZE + CELL_SIZE / 2;
    const hy = head.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.shadowColor = isGameOver ? '#ff2e63' : THEME.snake.headGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = isGameOver ? '#ff2e63' : THEME.snake.head;

    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Eyes looking in the direction of movement
    this.drawSnakeEyes(ctx, hx, hy, snake.direction, headRadius, isGameOver);

    ctx.restore();
  }

  drawSnakeEyes(ctx, hx, hy, dir, headRadius, isGameOver) {
    ctx.save();
    ctx.shadowBlur = 0;

    let dirVector = { x: 1, y: 0 };
    if (typeof dir === 'string') {
      if (dir === 'UP') dirVector = { x: 0, y: -1 };
      else if (dir === 'DOWN') dirVector = { x: 0, y: 1 };
      else if (dir === 'LEFT') dirVector = { x: -1, y: 0 };
      else if (dir === 'RIGHT') dirVector = { x: 1, y: 0 };
    } else if (dir && typeof dir.x === 'number') {
      dirVector = dir;
    }

    // Angle of eyes according to movement direction
    let angle = 0;
    if (dirVector.x === 1) angle = 0; // Right
    else if (dirVector.x === -1) angle = Math.PI; // Left
    else if (dirVector.y === -1) angle = -Math.PI / 2; // Up
    else if (dirVector.y === 1) angle = Math.PI / 2; // Down

    ctx.translate(hx, hy);
    ctx.rotate(angle);

    const eyeOffsetForward = headRadius * 0.35;
    const eyeOffsetLateral = headRadius * 0.45;
    const eyeRadius = headRadius * 0.28;
    const pupilRadius = eyeRadius * 0.55;

    // Left Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeOffsetForward, -eyeOffsetLateral, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.beginPath();
    ctx.arc(eyeOffsetForward, eyeOffsetLateral, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    if (isGameOver) {
      // X eyes when dead
      ctx.strokeStyle = '#080a11';
      ctx.lineWidth = 1.5;

      [-eyeOffsetLateral, eyeOffsetLateral].forEach((yOff) => {
        ctx.beginPath();
        ctx.moveTo(eyeOffsetForward - 3, yOff - 3);
        ctx.lineTo(eyeOffsetForward + 3, yOff + 3);
        ctx.moveTo(eyeOffsetForward + 3, yOff - 3);
        ctx.lineTo(eyeOffsetForward - 3, yOff + 3);
        ctx.stroke();
      });
    } else {
      // Pupils looking ahead
      ctx.fillStyle = '#080a11';
      ctx.beginPath();
      ctx.arc(eyeOffsetForward + pupilRadius * 0.6, -eyeOffsetLateral, pupilRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeOffsetForward + pupilRadius * 0.6, eyeOffsetLateral, pupilRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render pass for authoritative multiplayer match
   */
  renderMultiplayer(ctx, mpState, timestamp = 0, localPlayerId = null, pendingDirection = null) {
    // Clear background
    this.drawBackground(ctx);

    // Draw grid
    this.drawGrid(ctx, timestamp);

    // Draw arena border
    this.drawBorder(ctx, timestamp);

    // Draw shared food
    if (mpState.food) {
      this.drawFood(ctx, mpState.food, timestamp);
    }

    // Draw Player 1 Snake (Cyan)
    if (mpState.p1 && mpState.p1.segments) {
      const p1Intended = (localPlayerId && mpState.p1.id === localPlayerId) ? pendingDirection : null;
      this.drawPlayerSnake(
        ctx,
        mpState.p1,
        '#00f3ff',
        'rgba(0, 243, 255, 0.45)',
        timestamp,
        p1Intended
      );
    }

    // Draw Player 2 Snake (Pink)
    if (mpState.p2 && mpState.p2.segments) {
      const p2Intended = (localPlayerId && mpState.p2.id === localPlayerId) ? pendingDirection : null;
      this.drawPlayerSnake(
        ctx,
        mpState.p2,
        '#ff007f',
        'rgba(255, 0, 127, 0.45)',
        timestamp,
        p2Intended
      );
    }

    // Draw Countdown overlay if starting
    if (mpState.countdown && mpState.countdown > 0) {
      this.drawCountdown(ctx, mpState.countdown);
    }
  }

  /**
   * Renders a multiplayer participant's snake
   */
  drawPlayerSnake(ctx, pSnake, baseColor, glowColor, timestamp, intendedDirection = null) {
    const segments = pSnake.segments;
    if (!segments || segments.length === 0) return;

    ctx.save();

    const head = segments[0];
    const headRadius = CELL_SIZE * 0.44;
    const bodyRadius = CELL_SIZE * 0.40;
    const isDead = !pSnake.isAlive;

    // 1. Draw Body Segments (tail to head)
    for (let i = segments.length - 1; i >= 1; i--) {
      const seg = segments[i];
      const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;

      const ratio = 1 - i / segments.length;
      const color = isDead
        ? `rgba(255, 46, 99, ${0.3 + 0.5 * ratio})`
        : baseColor;

      ctx.shadowColor = isDead ? 'rgba(255, 46, 99, 0.5)' : glowColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.arc(cx, cy, bodyRadius, 0, Math.PI * 2);
      ctx.fill();

      // Body connector
      const prev = segments[i - 1];
      const px = prev.x * CELL_SIZE + CELL_SIZE / 2;
      const py = prev.y * CELL_SIZE + CELL_SIZE / 2;

      ctx.lineWidth = bodyRadius * 2;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    // 2. Draw Head
    const hx = head.x * CELL_SIZE + CELL_SIZE / 2;
    const hy = head.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.shadowColor = isDead ? '#ff2e63' : baseColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = isDead ? '#ff2e63' : baseColor;

    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Eyes looking in the direction of movement (or local pending direction)
    const eyeDir = intendedDirection || pSnake.direction;
    this.drawSnakeEyes(ctx, hx, hy, eyeDir, headRadius, isDead);

    // 4. Draw Callsign Tag above head
    if (pSnake.name) {
      ctx.shadowBlur = 0;
      ctx.font = 'bold 10px Orbitron, sans-serif';
      ctx.fillStyle = isDead ? '#ff2e63' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(pSnake.name, hx, hy - headRadius - 6);
    }

    ctx.restore();
  }

  /**
   * Draw pre-match countdown numbers
   */
  drawCountdown(ctx, seconds) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 12, 0.65)';
    ctx.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);

    ctx.font = '900 72px Orbitron, sans-serif';
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 30;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(seconds.toString(), ARENA_SIZE / 2, ARENA_SIZE / 2 - 10);

    ctx.font = '700 16px Rajdhani, sans-serif';
    ctx.fillStyle = '#e2f1ff';
    ctx.shadowBlur = 10;
    ctx.fillText('ARENA INITIALIZATION...', ARENA_SIZE / 2, ARENA_SIZE / 2 + 50);

    ctx.restore();
  }
}
