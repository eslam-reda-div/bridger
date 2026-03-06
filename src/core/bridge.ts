/**
 * Bridger — Bridge (Facade Pattern)
 *
 * The central entry point for importing cross-language packages.
 * Manages adapter lifecycle, caching, and selective imports.
 *
 * Patterns:
 *  - Facade: simple interface hiding adapter/proxy/protocol complexity
 *  - Singleton: default instance via index.ts
 *  - Strategy: different adapters per language (delegated to factory)
 */

import type {
  BridgerConfig,
  SupportedLanguage,
  LanguageAdapter,
  ImportOptions,
  PackageSpec,
} from '../types';
import { DEFAULT_CONFIG } from '../types';
import { createAdapter } from '../adapters/factory';
import { createModuleProxy, wrapResult } from '../proxy/builder';
import { LRUCache } from './cache';
import { BridgerError, ErrorCode, ValidationError } from '../errors';

export class Bridge {
  private readonly config: BridgerConfig;
  private readonly adapters = new Map<SupportedLanguage, LanguageAdapter>();
  private readonly proxyCache = new Map<string, unknown>();
  private readonly valueCache: LRUCache;

  constructor(config?: Partial<BridgerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.valueCache = new LRUCache(this.config.cacheMaxSize, this.config.cacheTTL);
  }

  // ═══════════════════════════════════════════════════════
  //  Import Methods
  // ═══════════════════════════════════════════════════════

  /**
   * Import a full module from another language.
   *
   * @example
   *   const numpy = await bridge.import('python:numpy');
   *   const result = await numpy.sum([1, 2, 3]);
   */
  async import(spec: string, options?: ImportOptions): Promise<unknown> {
    const { language, packageName } = Bridge.parseSpec(spec);
    const cacheKey = `${language}:${packageName}`;

    // Return cached proxy if available
    if (!options?.noCache && this.proxyCache.has(cacheKey)) {
      return this.proxyCache.get(cacheKey);
    }

    const adapter = await this.getOrCreateAdapter(language);

    // Import in the worker
    await adapter.importModule(packageName);

    // Create proxy
    const proxy = createModuleProxy(adapter, packageName, language);
    this.proxyCache.set(cacheKey, proxy);

    // Handle selective import: pre-resolve specific names
    if (options?.only && options.only.length > 0) {
      return this.selectiveImport(adapter, packageName, language, options.only);
    }

    return proxy;
  }

  /**
   * Selective import: import specific names from a module.
   *
   * @example
   *   const { array, sum, mean } = await bridge.from('python:numpy', ['array', 'sum', 'mean']);
   */
  async from(spec: string, names: string[]): Promise<Record<string, unknown>> {
    const { language, packageName } = Bridge.parseSpec(spec);
    const adapter = await this.getOrCreateAdapter(language);

    // Import the module first
    await adapter.importModule(packageName);

    return this.selectiveImport(adapter, packageName, language, names);
  }

  // ═══════════════════════════════════════════════════════
  //  Adapter Management
  // ═══════════════════════════════════════════════════════

  /** Get or create and start the adapter for a language */
  private async getOrCreateAdapter(language: SupportedLanguage): Promise<LanguageAdapter> {
    let adapter = this.adapters.get(language);
    if (adapter?.isRunning()) return adapter;

    // Create new adapter
    adapter = createAdapter(language, this.config);
    await adapter.start();
    this.adapters.set(language, adapter);
    return adapter;
  }

  /** Selective import: resolve specific names to pre-wrapped proxies */
  private async selectiveImport(
    adapter: LanguageAdapter,
    moduleName: string,
    language: SupportedLanguage,
    names: string[],
  ): Promise<Record<string, unknown>> {
    try {
      // Try the worker's import_from handler (batch-resolves names)
      const result = await adapter.importFrom(moduleName, names);
      const wrapped: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(result)) {
        wrapped[name] = wrapResult(adapter, value, language);
      }
      return wrapped;
    } catch {
      // Fallback: resolve each name individually
      const result: Record<string, unknown> = {};
      for (const name of names) {
        const value = await adapter.send({
          type: 'get_attr',
          module: moduleName,
          path: [name],
        });
        result[name] = wrapResult(adapter, value, language);
      }
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════

  /** Shutdown all adapters and clear caches */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const adapter of this.adapters.values()) {
      promises.push(adapter.stop());
    }
    await Promise.allSettled(promises);
    this.adapters.clear();
    this.proxyCache.clear();
    this.valueCache.clear();
  }

  // ═══════════════════════════════════════════════════════
  //  Spec Parsing
  // ═══════════════════════════════════════════════════════

  static parseSpec(spec: string): PackageSpec {
    const colonIndex = spec.indexOf(':');
    if (colonIndex === -1) {
      throw new ValidationError(
        `Invalid package spec: "${spec}". Expected format: "language:package[@version]"\n` +
        `Examples: "python:numpy", "python:numpy@1.26.4", "php:spatie/collection@^7.0"`,
        { spec },
      );
    }

    const language = spec.substring(0, colonIndex).toLowerCase() as SupportedLanguage;
    const rest = spec.substring(colonIndex + 1);

    // Split package name and version at the last '@'
    const atIndex = rest.lastIndexOf('@');
    let packageName: string;
    let version: string | null;

    if (atIndex > 0) {
      packageName = rest.substring(0, atIndex);
      version = rest.substring(atIndex + 1);
    } else {
      packageName = rest;
      version = null;
    }

    if (!packageName) {
      throw new ValidationError(
        `Empty package name in spec: "${spec}"`,
        { spec },
      );
    }

    return { language, packageName, version };
  }
}
