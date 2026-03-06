/**
 * Bridger — Package Installer Facade
 *
 * Unified interface for installing/removing packages across all languages.
 * Manages the manifest (bridger.json) and lockfile (bridger.lock.json).
 *
 * Pattern: Facade — hides pip/composer/manifest/lockfile complexity.
 * Pattern: Strategy — delegates to language-specific installers.
 */

import * as path from 'path';
import type { SupportedLanguage, PackageSpec } from '../types';
import { BridgerError, ErrorCode, ValidationError } from '../errors';
import { Manifest, Lockfile } from './store';
import { PythonInstaller } from './python';
import { PHPInstaller } from './php';

export class PackageInstaller {
  private readonly manifest: Manifest;
  private readonly lockfile: Lockfile;
  private readonly pythonInstaller: PythonInstaller;
  private readonly phpInstaller: PHPInstaller;
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const runtimesDir = path.join(projectRoot, '.runtimes');
    this.manifest = new Manifest(path.join(runtimesDir, 'bridger.json'));
    this.lockfile = new Lockfile(path.join(runtimesDir, 'bridger.lock.json'));
    this.pythonInstaller = new PythonInstaller(projectRoot);
    this.phpInstaller = new PHPInstaller(projectRoot);
  }

  /** Install a package from a spec like "python:numpy@1.26.4" */
  install(spec: PackageSpec): {
    packageName: string;
    installedVersion: string;
    language: SupportedLanguage;
  } {
    const { language, packageName, version } = spec;
    const key = `${language}:${packageName}`;

    let result: { installedVersion: string; dependencies: string[] };

    switch (language) {
      case 'python':
        result = this.pythonInstaller.install(packageName, version);
        break;
      case 'php':
        result = this.phpInstaller.install(packageName, version);
        break;
      default:
        throw new BridgerError(ErrorCode.UNSUPPORTED_LANGUAGE, `Unsupported language: ${language}`);
    }

    // Update manifest
    this.manifest.addPackage(key, {
      language,
      package: packageName,
      version: version ?? result.installedVersion,
    });
    this.manifest.save();

    // Update lockfile
    this.lockfile.addPackage(key, {
      language,
      package: packageName,
      installedVersion: result.installedVersion,
      versionConstraint: version ?? '*',
      dependencies: result.dependencies,
      installedAt: new Date().toISOString(),
    });
    this.lockfile.save();

    // Detect runtime version
    this.detectAndSaveRuntime(language);

    return { packageName, installedVersion: result.installedVersion, language };
  }

  /** Remove a package */
  remove(spec: PackageSpec): void {
    const { language, packageName } = spec;
    const key = `${language}:${packageName}`;

    switch (language) {
      case 'python':
        this.pythonInstaller.uninstall(packageName);
        break;
      case 'php':
        this.phpInstaller.uninstall(packageName);
        break;
      default:
        throw new BridgerError(ErrorCode.UNSUPPORTED_LANGUAGE, `Unsupported language: ${language}`);
    }

    this.manifest.removePackage(key);
    this.manifest.save();
    this.lockfile.removePackage(key);
    this.lockfile.save();
  }

  /** Upgrade a package to latest or specific version */
  upgrade(spec: PackageSpec): {
    packageName: string;
    installedVersion: string;
    language: SupportedLanguage;
  } {
    // Uninstall then reinstall for a clean upgrade
    const key = `${spec.language}:${spec.packageName}`;
    const existing = this.lockfile.getPackage(key);

    const result = this.install(spec);

    if (existing) {
      return { ...result };
    }
    return result;
  }

  /** List all installed packages */
  list(): Array<{
    key: string;
    language: SupportedLanguage;
    package: string;
    version: string;
    constraint: string;
  }> {
    const allPkgs = this.lockfile.getAllPackages();
    return Object.entries(allPkgs).map(([key, pkg]) => ({
      key,
      language: pkg.language,
      package: pkg.package,
      version: pkg.installedVersion,
      constraint: pkg.versionConstraint,
    }));
  }

  /** Get info about a specific package */
  info(language: SupportedLanguage, packageName: string): {
    installed: boolean;
    version: string | null;
    constraint: string | null;
    dependencies: string[];
  } | null {
    const key = `${language}:${packageName}`;
    const pkg = this.lockfile.getPackage(key);
    if (!pkg) return { installed: false, version: null, constraint: null, dependencies: [] };

    return {
      installed: true,
      version: pkg.installedVersion,
      constraint: pkg.versionConstraint,
      dependencies: pkg.dependencies,
    };
  }

  /** Get runtime versions */
  getRuntimes(): Record<string, string | null> {
    return {
      python: this.pythonInstaller.detectVersion(),
      php: this.phpInstaller.detectVersion(),
      composer: this.phpInstaller.detectComposerVersion(),
    };
  }

  /** Initialize a new project (detect runtimes, create manifest) */
  init(): void {
    this.detectAndSaveRuntime('python');
    this.detectAndSaveRuntime('php');
    this.manifest.save();
    this.lockfile.save();
  }

  private detectAndSaveRuntime(language: SupportedLanguage): void {
    let version: string | null = null;
    let runtimePath: string | null = null;

    switch (language) {
      case 'python':
        version = this.pythonInstaller.detectVersion();
        runtimePath = path.join(this.projectRoot, '.runtimes', 'python', 'venv');
        break;
      case 'php':
        version = this.phpInstaller.detectVersion();
        runtimePath = path.join(this.projectRoot, '.runtimes', 'php');
        break;
    }

    if (version) {
      this.manifest.setRuntime(language, version);
      this.lockfile.setRuntime(language, {
        version,
        path: runtimePath,
        detectedAt: new Date().toISOString(),
      });
    }
  }
}
