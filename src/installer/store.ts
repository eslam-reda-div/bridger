/**
 * Bridger — Manifest & Lockfile Store
 *
 * Manages bridger.json (manifest) and bridger.lock.json (lockfile).
 *
 * - bridger.json: user-facing package declarations with version constraints
 * - bridger.lock.json: exact installed versions, hashes, timestamps
 *
 * Both live under <projectRoot>/.runtimes/
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ManifestData, ManifestPackage, LockfileData, LockfilePackage, LockfileRuntime, SupportedLanguage } from '../types';

// ═══════════════════════════════════════════════════════
//  Manifest  (bridger.json)
// ═══════════════════════════════════════════════════════

export class Manifest {
  private data: ManifestData;

  constructor(private readonly filePath: string) {
    this.data = this.load();
  }

  private load(): ManifestData {
    if (fs.existsSync(this.filePath)) {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    }
    return { version: '1.0', runtimes: {}, packages: {} };
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + '\n');
  }

  setRuntime(language: string, version: string): void {
    this.data.runtimes[language] = { version };
  }

  addPackage(key: string, entry: ManifestPackage): void {
    this.data.packages[key] = entry;
  }

  removePackage(key: string): void {
    delete this.data.packages[key];
  }

  getPackage(key: string): ManifestPackage | undefined {
    return this.data.packages[key];
  }

  getAllPackages(): Record<string, ManifestPackage> {
    return { ...this.data.packages };
  }

  getRuntimes(): Record<string, { version: string }> {
    return { ...this.data.runtimes };
  }
}

// ═══════════════════════════════════════════════════════
//  Lockfile  (bridger.lock.json)
// ═══════════════════════════════════════════════════════

export class Lockfile {
  private data: LockfileData;

  constructor(private readonly filePath: string) {
    this.data = this.load();
  }

  private load(): LockfileData {
    if (fs.existsSync(this.filePath)) {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    }
    return { lockfileVersion: 1, runtimes: {}, packages: {} };
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + '\n');
  }

  setRuntime(language: string, runtime: LockfileRuntime): void {
    this.data.runtimes[language] = runtime;
  }

  getRuntime(language: string): LockfileRuntime | undefined {
    return this.data.runtimes[language];
  }

  addPackage(key: string, entry: LockfilePackage): void {
    this.data.packages[key] = entry;
  }

  removePackage(key: string): void {
    delete this.data.packages[key];
  }

  getPackage(key: string): LockfilePackage | undefined {
    return this.data.packages[key];
  }

  getAllPackages(): Record<string, LockfilePackage> {
    return { ...this.data.packages };
  }

  listByLanguage(language: SupportedLanguage): LockfilePackage[] {
    return Object.values(this.data.packages).filter(p => p.language === language);
  }
}
