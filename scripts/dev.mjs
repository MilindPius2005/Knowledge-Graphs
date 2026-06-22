import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const python = existsSync(join(root, '.venv', 'Scripts', 'python.exe'))
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : 'python';

const children = [
  spawn(python, ['ontology.py'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FLASK_PORT: process.env.FLASK_PORT || '5011', PYTHONUNBUFFERED: '1' },
  }),
  spawn('vite', ['--host', '0.0.0.0', '--port', process.env.VITE_PORT || '5174'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      VITE_BACKEND_TARGET: process.env.VITE_BACKEND_TARGET || 'http://localhost:5011',
    },
  }),
];

function stop(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

for (const child of children) {
  child.on('exit', (code) => {
    if (code) stop(code);
  });
}
