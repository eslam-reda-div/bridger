/**
 * Bridger — Python Adapter
 *
 * Concrete adapter for the Python runtime.
 * Manages Python venv, spawns python-worker.py, configures environment.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { BridgerConfig } from '../types';
import { BaseAdapter, WORKERS_DIR } from './base';

export class PythonAdapter extends BaseAdapter {
  readonly language = 'python' as const;

  constructor(config: BridgerConfig) {
    super(config);
  }

  protected buildSpawnCommand(): { command: string; args: string[] } {
    const workerPath = path.join(WORKERS_DIR, 'python-worker.py');
    const pythonBin = this.findPythonBin();
    return { command: pythonBin, args: ['-u', workerPath] };
  }

  protected buildSpawnEnv(): NodeJS.ProcessEnv {
    const venvDir = this.getVenvDir();
    const base: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONPATH: path.join(this.runtimesDir, 'python'),
    };

    if (fs.existsSync(venvDir)) {
      const binDir = process.platform === 'win32'
        ? path.join(venvDir, 'Scripts')
        : path.join(venvDir, 'bin');

      base.VIRTUAL_ENV = venvDir;
      base.PATH = binDir + path.delimiter + (process.env.PATH ?? '');
    }

    return base;
  }

  protected buildSpawnCwd(): string {
    const pythonDir = path.join(this.runtimesDir, 'python');
    fs.mkdirSync(pythonDir, { recursive: true });
    return pythonDir;
  }

  // ─── Private ───────────────────────────────────────

  private getVenvDir(): string {
    return path.join(this.runtimesDir, 'python', 'venv');
  }

  private findPythonBin(): string {
    const venvDir = this.getVenvDir();

    // Prefer venv python
    const candidates = [
      path.join(venvDir, 'Scripts', 'python.exe'),
      path.join(venvDir, 'bin', 'python'),
      path.join(venvDir, 'bin', 'python3'),
    ];

    for (const bin of candidates) {
      if (fs.existsSync(bin)) return bin;
    }

    // Fallback to system Python
    return process.platform === 'win32' ? 'python' : 'python3';
  }
}
