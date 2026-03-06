/**
 * Bridger — Error Hierarchy
 *
 * Comprehensive, typed error classes for every failure scenario.
 * Each error carries an error code, contextual details, and optional
 * remote traceback from the Python/PHP worker.
 *
 * Pattern: Template Method — base class defines structure,
 * subclasses provide specific codes and context.
 */

// ═══════════════════════════════════════════════════════
//  Error Codes (exhaustive enumeration)
// ═══════════════════════════════════════════════════════

export enum ErrorCode {
  // ── General ──
  UNKNOWN                = 'UNKNOWN',
  INVALID_ARGUMENT       = 'INVALID_ARGUMENT',

  // ── Runtime / Worker ──
  RUNTIME_NOT_FOUND      = 'RUNTIME_NOT_FOUND',
  RUNTIME_START_FAILED   = 'RUNTIME_START_FAILED',
  RUNTIME_CRASH          = 'RUNTIME_CRASH',
  RUNTIME_NOT_READY      = 'RUNTIME_NOT_READY',
  RUNTIME_RESTART_FAILED = 'RUNTIME_RESTART_FAILED',

  // ── Protocol / IPC ──
  PROTOCOL_TIMEOUT       = 'PROTOCOL_TIMEOUT',
  PROTOCOL_INVALID_JSON  = 'PROTOCOL_INVALID_JSON',
  PROTOCOL_WRITE_FAILED  = 'PROTOCOL_WRITE_FAILED',
  PROTOCOL_WORKER_EXIT   = 'PROTOCOL_WORKER_EXIT',
  PROTOCOL_READY_TIMEOUT = 'PROTOCOL_READY_TIMEOUT',

  // ── Import ──
  MODULE_NOT_FOUND       = 'MODULE_NOT_FOUND',
  IMPORT_FAILED          = 'IMPORT_FAILED',
  PACKAGE_NOT_INSTALLED  = 'PACKAGE_NOT_INSTALLED',

  // ── Call / Attribute ──
  ATTRIBUTE_NOT_FOUND    = 'ATTRIBUTE_NOT_FOUND',
  NOT_CALLABLE           = 'NOT_CALLABLE',
  REFERENCE_NOT_FOUND    = 'REFERENCE_NOT_FOUND',
  OPERATION_NOT_SUPPORTED= 'OPERATION_NOT_SUPPORTED',
  TYPE_ERROR             = 'TYPE_ERROR',
  INDEX_ERROR            = 'INDEX_ERROR',
  KEY_ERROR              = 'KEY_ERROR',

  // ── Remote Exception ──
  REMOTE_EXCEPTION       = 'REMOTE_EXCEPTION',
  SERIALIZATION_ERROR    = 'SERIALIZATION_ERROR',

  // ── Install ──
  INSTALL_FAILED         = 'INSTALL_FAILED',
  UNINSTALL_FAILED       = 'UNINSTALL_FAILED',
  VERSION_CONFLICT       = 'VERSION_CONFLICT',
  PACKAGE_NOT_FOUND_REMOTE = 'PACKAGE_NOT_FOUND_REMOTE',
  INVALID_SPEC           = 'INVALID_SPEC',
  VENV_CREATION_FAILED   = 'VENV_CREATION_FAILED',
  COMPOSER_INIT_FAILED   = 'COMPOSER_INIT_FAILED',

  // ── Language ──
  UNSUPPORTED_LANGUAGE   = 'UNSUPPORTED_LANGUAGE',
}

// ═══════════════════════════════════════════════════════
//  Base Error
// ═══════════════════════════════════════════════════════

export interface BridgerErrorContext {
  language?: string;
  module?: string;
  ref?: string;
  path?: string[];
  spec?: string;
  command?: string;
  stderr?: string;
  remoteType?: string;
  remoteTraceback?: string;
}

export class BridgerError extends Error {
  public readonly code: ErrorCode;
  public readonly context: BridgerErrorContext;

  constructor(code: ErrorCode, message: string, context: BridgerErrorContext = {}) {
    super(message);
    this.name = 'BridgerError';
    this.code = code;
    this.context = context;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Formatted error with full context for debugging */
  toDetailedString(): string {
    const parts = [`[${this.code}] ${this.message}`];
    if (this.context.language)  parts.push(`  Language: ${this.context.language}`);
    if (this.context.module)    parts.push(`  Module: ${this.context.module}`);
    if (this.context.ref)       parts.push(`  Ref: ${this.context.ref}`);
    if (this.context.path)      parts.push(`  Path: ${this.context.path.join('.')}`);
    if (this.context.spec)      parts.push(`  Spec: ${this.context.spec}`);
    if (this.context.remoteType) parts.push(`  Remote type: ${this.context.remoteType}`);
    if (this.context.remoteTraceback) {
      parts.push(`  Remote traceback:\n${this.context.remoteTraceback}`);
    }
    if (this.context.stderr) {
      parts.push(`  Worker stderr:\n${this.context.stderr.slice(0, 2000)}`);
    }
    return parts.join('\n');
  }
}

// ═══════════════════════════════════════════════════════
//  Specific Error Subclasses
// ═══════════════════════════════════════════════════════

/** Thrown when a language runtime binary is not found or cannot start */
export class RuntimeError extends BridgerError {
  constructor(code: ErrorCode, message: string, context: BridgerErrorContext = {}) {
    super(code, message, context);
    this.name = 'RuntimeError';
  }
}

/** Thrown on IPC / protocol failures */
export class ProtocolError extends BridgerError {
  constructor(code: ErrorCode, message: string, context: BridgerErrorContext = {}) {
    super(code, message, context);
    this.name = 'ProtocolError';
  }
}

/** Thrown when the remote worker reports an exception */
export class RemoteError extends BridgerError {
  constructor(message: string, context: BridgerErrorContext = {}) {
    super(ErrorCode.REMOTE_EXCEPTION, message, context);
    this.name = 'RemoteError';
  }
}

/** Thrown on module import failures */
export class ImportError extends BridgerError {
  constructor(code: ErrorCode, message: string, context: BridgerErrorContext = {}) {
    super(code, message, context);
    this.name = 'ImportError';
  }
}

/** Thrown on package installation / removal failures */
export class InstallError extends BridgerError {
  constructor(code: ErrorCode, message: string, context: BridgerErrorContext = {}) {
    super(code, message, context);
    this.name = 'InstallError';
  }
}

/** Thrown on invalid user input (package spec, arguments, etc.) */
export class ValidationError extends BridgerError {
  constructor(message: string, context: BridgerErrorContext = {}) {
    super(ErrorCode.INVALID_ARGUMENT, message, context);
    this.name = 'ValidationError';
  }
}

// ═══════════════════════════════════════════════════════
//  Helper: wrap a raw worker error response
// ═══════════════════════════════════════════════════════

/**
 * Converts a worker error response into the appropriate BridgerError subclass.
 */
export function wrapRemoteError(
  errorMessage: string,
  errorType?: string,
  traceback?: string,
  context: BridgerErrorContext = {},
): BridgerError {
  const ctx: BridgerErrorContext = {
    ...context,
    remoteType: errorType,
    remoteTraceback: traceback,
  };

  // Map known remote error types to specific error codes
  if (errorType) {
    const lower = errorType.toLowerCase();
    if (lower.includes('modulenotfounderror') || lower.includes('importerror')) {
      return new ImportError(ErrorCode.MODULE_NOT_FOUND, errorMessage, ctx);
    }
    if (lower.includes('attributeerror')) {
      return new BridgerError(ErrorCode.ATTRIBUTE_NOT_FOUND, errorMessage, ctx);
    }
    if (lower.includes('typeerror')) {
      return new BridgerError(ErrorCode.TYPE_ERROR, errorMessage, ctx);
    }
    if (lower.includes('keyerror')) {
      return new BridgerError(ErrorCode.KEY_ERROR, errorMessage, ctx);
    }
    if (lower.includes('indexerror')) {
      return new BridgerError(ErrorCode.INDEX_ERROR, errorMessage, ctx);
    }
    if (lower.includes('notcallable') || lower.includes('not callable')) {
      return new BridgerError(ErrorCode.NOT_CALLABLE, errorMessage, ctx);
    }
    if (lower.includes('reference') || lower.includes('not found: pyref') || lower.includes('not found: phpref')) {
      return new BridgerError(ErrorCode.REFERENCE_NOT_FOUND, errorMessage, ctx);
    }
    if (lower.includes('serialization')) {
      return new BridgerError(ErrorCode.SERIALIZATION_ERROR, errorMessage, ctx);
    }
  }

  return new RemoteError(errorMessage, ctx);
}
