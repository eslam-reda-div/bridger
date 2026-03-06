/**
 * Bridger — Python Package Installer
 *
 * Manages Python packages via pip inside a venv.
 * Creates venv on first install, supports version constraints.
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync, execFileSync } from 'child_process';
import { InstallError, ErrorCode, RuntimeError } from '../errors';

export class PythonInstaller {
  private readonly runtimesDir: string;
  private readonly pythonDir: string;
  private readonly venvDir: string;

  constructor(projectRoot: string) {
    this.runtimesDir = path.join(projectRoot, '.runtimes');
    this.pythonDir = path.join(this.runtimesDir, 'python');
    this.venvDir = path.join(this.pythonDir, 'venv');
  }

  /** Ensure a virtualenv exists, creating one if needed */
  ensureVenv(): void {
    if (fs.existsSync(this.getPipBin())) return;

    const systemPython = this.findSystemPython();
    fs.mkdirSync(this.pythonDir, { recursive: true });

    try {
      execFileSync(systemPython, ['-m', 'venv', this.venvDir], {
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError(ErrorCode.VENV_CREATION_FAILED, `Failed to create Python venv: ${msg}`, {
        command: `${systemPython} -m venv ${this.venvDir}`,
      });
    }
  }

  /** Install a Python package */
  install(packageName: string, version: string | null): {
    installedVersion: string;
    dependencies: string[];
  } {
    this.ensureVenv();
    const pip = this.getPipBin();
    const spec = version ? `${packageName}==${version}` : packageName;

    try {
      execFileSync(pip, ['install', spec], {
        cwd: this.pythonDir,
        stdio: 'pipe',
        timeout: 300_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError(ErrorCode.INSTALL_FAILED, `Failed to install ${spec}: ${msg}`, {
        command: `pip install ${spec}`,
      });
    }

    return {
      installedVersion: this.getInstalledVersion(packageName) ?? version ?? 'unknown',
      dependencies: this.getDependencies(packageName),
    };
  }

  /** Uninstall a Python package */
  uninstall(packageName: string): void {
    const pip = this.getPipBin();
    if (!fs.existsSync(pip)) return;

    try {
      execFileSync(pip, ['uninstall', '-y', packageName], {
        cwd: this.pythonDir,
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError(ErrorCode.UNINSTALL_FAILED, `Failed to uninstall ${packageName}: ${msg}`, {
        command: `pip uninstall -y ${packageName}`,
      });
    }
  }

  /** Get the installed version of a package from pip show */
  getInstalledVersion(packageName: string): string | null {
    const pip = this.getPipBin();
    if (!fs.existsSync(pip)) return null;

    try {
      const output = execFileSync(pip, ['show', packageName], {
        cwd: this.pythonDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 30_000,
      });
      const match = output.match(/^Version:\s*(.+)$/m);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  /** Get dependencies of a package from pip show */
  getDependencies(packageName: string): string[] {
    const pip = this.getPipBin();
    if (!fs.existsSync(pip)) return [];

    try {
      const output = execFileSync(pip, ['show', packageName], {
        cwd: this.pythonDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 30_000,
      });
      const match = output.match(/^Requires:\s*(.+)$/m);
      if (!match || !match[1].trim()) return [];
      return match[1].split(',').map(d => d.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /** List all installed packages */
  listInstalled(): Array<{ name: string; version: string }> {
    const pip = this.getPipBin();
    if (!fs.existsSync(pip)) return [];

    try {
      const output = execFileSync(pip, ['list', '--format=json'], {
        cwd: this.pythonDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 30_000,
      });
      return JSON.parse(output);
    } catch {
      return [];
    }
  }

  /** Detect system Python version */
  detectVersion(): string | null {
    try {
      const python = this.findSystemPython();
      const output = execFileSync(python, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 10_000,
      });
      const match = output.match(/Python\s+([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /** Find system Python binary */
  private findSystemPython(): string {
    const candidates = process.platform === 'win32'
      ? ['python', 'python3', 'py']
      : ['python3', 'python'];

    for (const bin of candidates) {
      try {
        execFileSync(bin, ['--version'], { stdio: 'pipe', timeout: 10_000 });
        return bin;
      } catch {
        continue;
      }
    }

    throw new RuntimeError(ErrorCode.RUNTIME_NOT_FOUND, 'Python not found. Please install Python 3.x.', {
      language: 'python',
    });
  }

  private getPipBin(): string {
    return process.platform === 'win32'
      ? path.join(this.venvDir, 'Scripts', 'pip.exe')
      : path.join(this.venvDir, 'bin', 'pip');
  }
}
