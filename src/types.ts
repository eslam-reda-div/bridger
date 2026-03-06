/**
 * Bridger — Core Type Definitions
 *
 * Central type declarations used across the entire codebase.
 * Follows Interface Segregation: small, focused interfaces.
 */

// ═══════════════════════════════════════════════════════
//  Language & Configuration
// ═══════════════════════════════════════════════════════

export type SupportedLanguage = 'python' | 'php';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface BridgerConfig {
  /** Project root directory (default: process.cwd()) */
  projectRoot: string;
  /** Timeout for worker IPC calls in ms (default: 60000) */
  workerTimeout: number;
  /** Max retries on transient worker failure (default: 2) */
  maxRetries: number;
  /** Attribute cache TTL in ms (default: 300000 = 5min) */
  cacheTTL: number;
  /** Max number of cached entries (default: 1000) */
  cacheMaxSize: number;
  /** Log level (default: 'info') */
  logLevel: LogLevel;
}

export const DEFAULT_CONFIG: Readonly<BridgerConfig> = {
  projectRoot: process.cwd(),
  workerTimeout: 60_000,
  maxRetries: 2,
  cacheTTL: 300_000,
  cacheMaxSize: 1000,
  logLevel: 'info',
};

// ═══════════════════════════════════════════════════════
//  Package Spec
// ═══════════════════════════════════════════════════════

export interface PackageSpec {
  language: SupportedLanguage;
  packageName: string;
  version: string | null;
}

/** Options when importing a module via bridge() */
export interface ImportOptions {
  /** Selective import: only these names will be pre-resolved */
  only?: string[];
  /** Override the default worker timeout */
  timeout?: number;
  /** Disable result caching */
  noCache?: boolean;
}

// ═══════════════════════════════════════════════════════
//  Protocol Messages
// ═══════════════════════════════════════════════════════

export interface ProtocolMessage {
  id?: number;
  type: string;
  [key: string]: unknown;
}

export interface ProtocolResponse {
  id: number;
  result?: unknown;
  error?: string;
  errorType?: string;
  traceback?: string;
  __shutdown__?: boolean;
}

// ═══════════════════════════════════════════════════════
//  Bridger References
// ═══════════════════════════════════════════════════════

export interface BridgerRef {
  __bridger_ref__: string;
  __type__?: string;
  __repr__?: string;
  __len__?: number;
  __callable__?: boolean;
  __indexable__?: boolean;
  __is_class__?: boolean;
  __iterable__?: boolean;
  __shape__?: number[];
  __dtype__?: string;
  __columns__?: string[];
  __name__?: string;
}

export function isBridgerRef(value: unknown): value is BridgerRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__bridger_ref__' in value
  );
}

// ═══════════════════════════════════════════════════════
//  Introspection
// ═══════════════════════════════════════════════════════

export interface TypeInfo {
  type: string;
  module?: string;
  qualname?: string;
  mro?: string[];
  interfaces?: string[];
  parents?: string[];
}

export interface FunctionInfo {
  name: string;
  signature?: string | null;
  params?: string[];
}

export interface ClassInfo {
  name: string;
  methods: (string | FunctionInfo)[];
}

export interface PropertyInfo {
  name: string;
  type?: string;
  static?: boolean;
}

export interface IntrospectionResult {
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  properties?: PropertyInfo[];
  modules?: string[];
  name?: string;
  methods?: FunctionInfo[];
  staticMethods?: FunctionInfo[];
  constants?: Array<{ name: string; value: unknown }>;
  parent?: string | null;
}

export interface WorkerInfo {
  python_version?: string;
  php_version?: string;
  platform: string;
  modules_loaded?: string[];
  objects_tracked: number;
  pid: number;
}

// ═══════════════════════════════════════════════════════
//  Installer Types
// ═══════════════════════════════════════════════════════

export interface ManifestData {
  version: string;
  runtimes: Record<string, { version: string }>;
  packages: Record<string, ManifestPackage>;
}

export interface ManifestPackage {
  language: SupportedLanguage;
  package: string;
  version: string;
}

export interface LockfileData {
  lockfileVersion: number;
  runtimes: Record<string, LockfileRuntime>;
  packages: Record<string, LockfilePackage>;
}

export interface LockfileRuntime {
  version: string;
  path: string | null;
  detectedAt: string;
}

export interface LockfilePackage {
  language: SupportedLanguage;
  package: string;
  installedVersion: string;
  versionConstraint: string;
  dependencies: string[];
  installedAt: string;
}

// ═══════════════════════════════════════════════════════
//  Proxy Internals
// ═══════════════════════════════════════════════════════

export const BRIDGER_INTERNAL = Symbol.for('bridger.internal');

export interface ProxyBinding {
  type: 'module' | 'ref';
  module?: string;
  ref?: string;
  typeName?: string;
  language: SupportedLanguage;
}

export interface ProxyInternals {
  binding: ProxyBinding;
  path: string[];
}

// ═══════════════════════════════════════════════════════
//  Adapter Interface  (Adapter Pattern — Open/Closed)
// ═══════════════════════════════════════════════════════

/**
 * LanguageAdapter abstracts the communication with a specific language runtime.
 * New languages can be supported by implementing this interface.
 *
 * Follows Open/Closed Principle: extend by adding new adapters,
 * never modifying existing code.
 */
export interface LanguageAdapter {
  readonly language: SupportedLanguage;

  /** Start the worker process */
  start(): Promise<void>;
  /** Stop the worker process gracefully */
  stop(): Promise<void>;
  /** Check if the worker is alive */
  isRunning(): boolean;

  /** Send a protocol message and await the response */
  send(msg: ProtocolMessage, timeout?: number): Promise<unknown>;

  /** Send multiple messages in one batch (reduces IPC roundtrips) */
  sendBatch(messages: ProtocolMessage[]): Promise<unknown[]>;

  /** Import an entire module */
  importModule(moduleName: string): Promise<void>;
  /** Import specific names from a module (selective import) */
  importFrom(moduleName: string, names: string[]): Promise<Record<string, unknown>>;

  /** Health check */
  ping(): Promise<boolean>;
}
