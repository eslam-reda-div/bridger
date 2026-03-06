/**
 * Bridger — Public API
 *
 * The main entry point for the bridger package.
 *
 * Exports:
 *  - bridge(spec)      — Import a module (singleton)
 *  - from(spec, names) — Selective import (singleton)
 *  - shutdown()        — Shutdown all workers (singleton)
 *  - createBridge()    — Create an independent Bridge instance
 *  - Bridge class      — For advanced usage
 *  - Error classes     — For typed error handling
 *  - Types             — For TypeScript consumers
 */

import { Bridge } from './core/bridge';
import type { BridgerConfig, ImportOptions } from './types';

// ═══════════════════════════════════════════════════════
//  Singleton (Singleton Pattern)
// ═══════════════════════════════════════════════════════

let defaultBridge: Bridge | null = null;

function getDefault(): Bridge {
  if (!defaultBridge) {
    defaultBridge = new Bridge();
  }
  return defaultBridge;
}

/**
 * Import a package from another language runtime.
 *
 * @example
 *   const numpy = await bridge('python:numpy');
 *   const result = await numpy.sum([1, 2, 3]);
 */
export async function bridge(spec: string, options?: ImportOptions): Promise<unknown> {
  return getDefault().import(spec, options);
}

/**
 * Selective import: import specific names from a module.
 * Returns a plain object with the requested names as keys.
 *
 * @example
 *   const { array, sum } = await from('python:numpy', ['array', 'sum']);
 */
export async function from(spec: string, names: string[]): Promise<Record<string, unknown>> {
  return getDefault().from(spec, names);
}

/**
 * Shutdown all runtime workers and clean up resources.
 */
export async function shutdown(): Promise<void> {
  if (defaultBridge) {
    await defaultBridge.shutdown();
    defaultBridge = null;
  }
}

/**
 * Create an independent Bridge instance with custom configuration.
 */
export function createBridge(config?: Partial<BridgerConfig>): Bridge {
  return new Bridge(config);
}

// ═══════════════════════════════════════════════════════
//  Process cleanup
// ═══════════════════════════════════════════════════════

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('exit', () => {
  // Best-effort synchronous cleanup
  if (defaultBridge) {
    try {
      // Force kill any remaining workers
      (defaultBridge as any).adapters?.forEach?.((adapter: any) => {
        adapter?.protocol?.process?.kill?.();
      });
    } catch {
      // Ignore
    }
  }
});

// ═══════════════════════════════════════════════════════
//  Re-exports
// ═══════════════════════════════════════════════════════

export { Bridge } from './core/bridge';
export { createAdapter, registerAdapter, getSupportedLanguages } from './adapters/factory';
export {
  BridgerError,
  RuntimeError,
  ProtocolError,
  RemoteError,
  ImportError,
  InstallError,
  ValidationError,
  ErrorCode,
} from './errors';
export type {
  BridgerConfig,
  SupportedLanguage,
  LanguageAdapter,
  ImportOptions,
  PackageSpec,
  BridgerRef,
  IntrospectionResult,
  TypeInfo,
  WorkerInfo,
} from './types';
