/**
 * Bridger — PHP Adapter
 *
 * Concrete adapter for the PHP runtime.
 * Manages Composer autoload, spawns php-worker.php, configures environment.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { BridgerConfig } from '../types';
import { BaseAdapter, WORKERS_DIR } from './base';

export class PHPAdapter extends BaseAdapter {
  readonly language = 'php' as const;

  constructor(config: BridgerConfig) {
    super(config);
  }

  protected buildSpawnCommand(): { command: string; args: string[] } {
    const workerPath = path.join(WORKERS_DIR, 'php-worker.php');
    const autoloadPath = this.getAutoloadPath();

    const args = [workerPath];
    if (fs.existsSync(autoloadPath)) {
      args.push(autoloadPath);
    }

    return { command: 'php', args };
  }

  protected buildSpawnEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      BRIDGER_AUTOLOAD_PATH: this.getAutoloadPath(),
    };
  }

  protected buildSpawnCwd(): string {
    const phpDir = path.join(this.runtimesDir, 'php');
    fs.mkdirSync(phpDir, { recursive: true });
    return phpDir;
  }

  // ─── Override: PHP doesn't "import" modules ────────

  async importModule(_moduleName: string): Promise<void> {
    // PHP packages are autoloaded via Composer. No import step needed.
  }

  async importFrom(_moduleName: string, _names: string[]): Promise<Record<string, unknown>> {
    // PHP uses autoloading. Selective import is handled at the proxy level.
    return {};
  }

  // ─── Private ───────────────────────────────────────

  private getAutoloadPath(): string {
    return path.join(this.runtimesDir, 'php', 'vendor', 'autoload.php');
  }
}
