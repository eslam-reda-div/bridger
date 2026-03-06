/**
 * Bridger — PHP Package Installer
 *
 * Manages PHP packages via Composer.
 * Initializes Composer project on first install, supports version constraints.
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync, execFileSync } from 'child_process';
import { InstallError, ErrorCode, RuntimeError } from '../errors';

const IS_WIN = process.platform === 'win32';

/**
 * Run a composer command. On Windows, composer is a .bat/.cmd file 
 * and must be run through a shell.
 */
function runComposer(composerBin: string, args: string[], options: {
  cwd?: string;
  timeout?: number;
  encoding?: BufferEncoding;
} = {}): string {
  const cmd = [composerBin, ...args].map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
  return execSync(cmd, {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout ?? 120_000,
    encoding: options.encoding ?? 'utf-8',
    windowsHide: true,
  }) as string;
}

export class PHPInstaller {
  private readonly runtimesDir: string;
  private readonly phpDir: string;

  constructor(projectRoot: string) {
    this.runtimesDir = path.join(projectRoot, '.runtimes');
    this.phpDir = path.join(this.runtimesDir, 'php');
  }

  /** Ensure a Composer project exists */
  ensureComposer(): void {
    const composerJson = path.join(this.phpDir, 'composer.json');
    if (fs.existsSync(composerJson)) return;

    fs.mkdirSync(this.phpDir, { recursive: true });

    try {
      runComposer(this.findComposerBin(), ['init', '--no-interaction', '-n'], {
        cwd: this.phpDir,
        timeout: 60_000,
      });
    } catch (err: unknown) {
      // Fallback: create minimal composer.json
      fs.writeFileSync(
        composerJson,
        JSON.stringify({ name: 'bridger/runtime', description: 'Bridger PHP runtime', require: {} }, null, 4) + '\n',
      );
    }
  }

  /** Install a PHP package */
  install(packageName: string, version: string | null): {
    installedVersion: string;
    dependencies: string[];
  } {
    this.ensureComposer();
    const composer = this.findComposerBin();
    const spec = version ? `${packageName}:${version}` : packageName;

    try {
      runComposer(composer, ['require', spec, '--no-interaction'], {
        cwd: this.phpDir,
        timeout: 300_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError(ErrorCode.INSTALL_FAILED, `Failed to install ${spec}: ${msg}`, {
        command: `composer require ${spec}`,
      });
    }

    return {
      installedVersion: this.getInstalledVersion(packageName) ?? version ?? 'unknown',
      dependencies: this.getDependencies(packageName),
    };
  }

  /** Uninstall a PHP package */
  uninstall(packageName: string): void {
    const composer = this.findComposerBin();
    const composerJson = path.join(this.phpDir, 'composer.json');
    if (!fs.existsSync(composerJson)) return;

    try {
      runComposer(composer, ['remove', packageName, '--no-interaction'], {
        cwd: this.phpDir,
        timeout: 120_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError(ErrorCode.UNINSTALL_FAILED, `Failed to uninstall ${packageName}: ${msg}`, {
        command: `composer remove ${packageName}`,
      });
    }
  }

  /** Get installed version from composer.lock */
  getInstalledVersion(packageName: string): string | null {
    const lockPath = path.join(this.phpDir, 'composer.lock');
    if (!fs.existsSync(lockPath)) return null;

    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      const packages = [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])];
      const pkg = packages.find((p: { name: string }) => p.name === packageName);
      return pkg?.version?.replace(/^v/, '') ?? null;
    } catch {
      return null;
    }
  }

  /** Get dependencies from composer.lock */
  getDependencies(packageName: string): string[] {
    const lockPath = path.join(this.phpDir, 'composer.lock');
    if (!fs.existsSync(lockPath)) return [];

    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      const packages = [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])];
      const pkg = packages.find((p: { name: string }) => p.name === packageName);
      return pkg?.require ? Object.keys(pkg.require).filter((d: string) => !d.startsWith('php') && !d.startsWith('ext-')) : [];
    } catch {
      return [];
    }
  }

  /** Detect PHP version */
  detectVersion(): string | null {
    try {
      const output = execFileSync('php', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 10_000,
      });
      const match = output.match(/PHP\s+([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /** Detect Composer version */
  detectComposerVersion(): string | null {
    try {
      const output = runComposer(this.findComposerBin(), ['--version', '--no-ansi'], {
        timeout: 10_000,
      });
      const match = output.match(/Composer\s+(?:version\s+)?([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /** Find Composer binary */
  private findComposerBin(): string {
    const candidates = process.platform === 'win32'
      ? ['composer', 'composer.bat', 'composer.phar']
      : ['composer', 'composer.phar'];

    for (const bin of candidates) {
      try {
        runComposer(bin, ['--version', '--no-ansi'], { timeout: 10_000 });
        return bin;
      } catch {
        continue;
      }
    }

    throw new RuntimeError(ErrorCode.RUNTIME_NOT_FOUND, 'Composer not found. Please install Composer.', {
      language: 'php',
    });
  }
}
