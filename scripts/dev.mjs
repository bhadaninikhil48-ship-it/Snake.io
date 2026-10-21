/**
 * dev.mjs - Starts both Backend Server and Frontend Vite Dev Server concurrently.
 * Handles graceful shutdown on SIGINT/Ctrl+C.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('====================================================');
console.log('  STARTING SNAKE CLASH ONLINE (FULLSTACK DEV MODE)  ');
console.log('====================================================');

// 1. Spawn Backend Server
const serverProc = spawn('node', ['server/server.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env, PORT: '3001' },
});

// 2. Spawn Client Vite Dev Server
const clientProc = spawn(npmCmd, ['--prefix', 'client', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows,
  env: process.env,
});

function cleanup() {
  console.log('\n[Dev Orchestrator] Stopping servers...');
  try {
    serverProc.kill();
  } catch {}
  try {
    clientProc.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

serverProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Server] Exited with code ${code}`);
  }
});

clientProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Client] Exited with code ${code}`);
  }
});
