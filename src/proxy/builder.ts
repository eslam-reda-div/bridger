/**
 * Bridger — Proxy Builder
 *
 * Creates JavaScript Proxy objects that transparently forward property access,
 * function calls, indexing, iteration, and operators to remote language runtimes.
 *
 * Design:
 *  - Property access chains (e.g., numpy.random.randint) accumulate a path array
 *  - Function calls trigger RPC to the worker via the adapter
 *  - Results that are remote objects come back as new ref-proxies
 *  - Primitives are returned as-is
 *
 * Patterns:
 *  - Proxy: transparent remote object representation
 *  - Builder: incrementally constructs the property path
 *  - Strategy: different call logic per language (Python call vs PHP static/method)
 */

import type {
  LanguageAdapter,
  ProxyBinding,
  ProxyInternals,
  SupportedLanguage,
  BridgerRef,
} from '../types';
import { BRIDGER_INTERNAL } from '../types';
import { serializeArg, isBridgerRefResult } from '../protocol/serializer';
import { BridgerError, ErrorCode } from '../errors';

// Properties that should NOT be forwarded to the remote runtime
const IGNORED_PROPS = new Set([
  'constructor', 'prototype', '__proto__',
  'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
  'toLocaleString',
]);

// ═══════════════════════════════════════════════════════
//  Public Constructors
// ═══════════════════════════════════════════════════════

/** Create a proxy for an imported module (e.g., numpy, pandas) */
export function createModuleProxy(
  adapter: LanguageAdapter,
  moduleName: string,
  language: SupportedLanguage,
): unknown {
  const binding: ProxyBinding = { type: 'module', module: moduleName, language };
  return buildProxy(adapter, binding, []);
}

/** Create a proxy for a remote object reference (e.g., an ndarray instance) */
export function createRefProxy(
  adapter: LanguageAdapter,
  refId: string,
  typeName: string,
  language: SupportedLanguage,
): unknown {
  const binding: ProxyBinding = { type: 'ref', ref: refId, typeName: typeName || 'object', language };
  return buildProxy(adapter, binding, []);
}

// ═══════════════════════════════════════════════════════
//  Core Proxy Builder
// ═══════════════════════════════════════════════════════

function buildProxy(adapter: LanguageAdapter, binding: ProxyBinding, path: string[]): unknown {
  // Use a function as target so the proxy is callable
  const target = function () {};

  const label = binding.type === 'module'
    ? `${binding.module}${path.length ? '.' + path.join('.') : ''}`
    : `ref<${binding.typeName}>${path.length ? '.' + path.join('.') : ''}`;

  return new Proxy(target, {
    get(_, prop: string | symbol): unknown {
      // ─── Internal metadata (for serialization) ───
      if (prop === BRIDGER_INTERNAL) {
        return { binding, path } satisfies ProxyInternals;
      }

      // ─── Symbol handling ───
      if (typeof prop === 'symbol') {
        if (prop === Symbol.toPrimitive) return undefined;
        if (prop === Symbol.toStringTag) return `Bridger<${label}>`;
        if (prop === Symbol.for('nodejs.util.inspect.custom')) {
          return () => `[Bridger: ${label}]`;
        }
        return undefined;
      }

      // Don't be thenable — prevents auto-unwrapping by await
      if (prop === 'then') return undefined;

      // Basic JS object methods
      if (prop === 'toString' || prop === 'valueOf') return () => `[Bridger: ${label}]`;
      if (prop === 'toJSON') return () => ({ __bridger__: true, ...binding, path });
      if (prop === 'inspect') return () => `[Bridger: ${label}]`;

      // Skip internal JS properties
      if (IGNORED_PROPS.has(prop)) return undefined;

      // ─── Bridger Special Methods ($-prefixed) ───
      const special = resolveSpecialMethod(adapter, binding, path, prop);
      if (special !== undefined) return special;

      // ─── Chain: return a deeper proxy ───
      return buildProxy(adapter, binding, [...path, prop]);
    },

    apply(_, _thisArg, args: unknown[]): unknown {
      return executeCall(adapter, binding, path, args, {});
    },

    construct(_, args: unknown[]): object {
      return executeConstruct(adapter, binding, path, args) as object;
    },
  });
}

// ═══════════════════════════════════════════════════════
//  Special Methods ($-prefixed API)
// ═══════════════════════════════════════════════════════

function resolveSpecialMethod(
  adapter: LanguageAdapter,
  binding: ProxyBinding,
  path: string[],
  prop: string,
): unknown {
  // ─── $value() — resolve attribute to a value ───
  if (prop === '$value') {
    return () => resolveValue(adapter, binding, path);
  }

  // ─── $destroy() — release remote reference ───
  if (prop === '$destroy') {
    return async () => {
      if (binding.type === 'ref' && binding.ref) {
        return adapter.send({ type: 'destroy', ref: binding.ref });
      }
    };
  }

  // ─── $introspect(className?) — discover module/object members ───
  if (prop === '$introspect') {
    return async (className?: string) => {
      if (binding.language === 'php') {
        // For PHP, introspect a class by name
        const cls = className ?? (binding.type === 'module' ? path.join('\\') : undefined);
        if (cls) {
          return adapter.send({ type: 'introspect_class', class: cls });
        }
        if (binding.type === 'ref') {
          // Get the type first, then introspect that class
          const typeInfo = await adapter.send({ type: 'type', ref: binding.ref }) as { type?: string };
          if (typeInfo?.type) {
            return adapter.send({ type: 'introspect_class', class: typeInfo.type });
          }
        }
        return {};
      }
      // Python
      if (binding.type === 'module') {
        return adapter.send({ type: 'introspect', module: binding.module });
      }
      return adapter.send({ type: 'introspect', ref: binding.ref });
    };
  }

  // ─── $call(...) — call with keyword arguments and/or positional args ───
  // Usage: $call({ key: value })  OR  $call([arg1, arg2], { key: value })
  if (prop === '$call') {
    return (...callArgs: unknown[]) => {
      let posArgs: unknown[] = [];
      let kwargs: Record<string, unknown> = {};
      if (callArgs.length === 1 && !Array.isArray(callArgs[0]) && typeof callArgs[0] === 'object' && callArgs[0] !== null) {
        kwargs = callArgs[0] as Record<string, unknown>;
      } else if (callArgs.length === 2 && Array.isArray(callArgs[0])) {
        posArgs = callArgs[0] as unknown[];
        kwargs = (callArgs[1] as Record<string, unknown>) ?? {};
      } else if (callArgs.length >= 1) {
        posArgs = callArgs;
      }
      return executeCall(adapter, binding, path, posArgs, kwargs);
    };
  }

  // ─── $getitem(key) — bracket access: obj[key] ───
  if (prop === '$getitem') {
    return async (key: unknown) => {
      requireRef(binding, '$getitem');
      const resolved = await resolveRefPath(adapter, binding, path);
      const result = await adapter.send({ type: 'getitem', ref: resolved.ref, key: serializeArg(key) });
      return wrapResult(adapter, result, binding.language);
    };
  }

  // ─── $setitem(key, value) — bracket set: obj[key] = value ───
  if (prop === '$setitem') {
    return async (key: unknown, value: unknown) => {
      requireRef(binding, '$setitem');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({
        type: 'setitem', ref: resolved.ref,
        key: serializeArg(key), value: serializeArg(value),
      });
    };
  }

  // ─── $len() — length of object ───
  if (prop === '$len') {
    return async () => {
      requireRef(binding, '$len');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({ type: binding.language === 'php' ? 'count' : 'len', ref: resolved.ref });
    };
  }

  // ─── $iter(limit?) — iterate to JS array ───
  if (prop === '$iter') {
    return async (limit?: number) => {
      requireRef(binding, '$iter');
      const resolved = await resolveRefPath(adapter, binding, path);
      const result = await adapter.send({ type: 'iter', ref: resolved.ref, ...(limit ? { limit } : {}) });
      return Array.isArray(result) ? result.map(r => wrapResult(adapter, r, binding.language)) : result;
    };
  }

  // ─── $contains(value) — membership test ───
  if (prop === '$contains') {
    return async (value: unknown) => {
      requireRef(binding, '$contains');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({ type: 'contains', ref: resolved.ref, value: serializeArg(value) });
    };
  }

  // ─── $op(operator, other?) — any operator ───
  if (prop === '$op') {
    return async (op: string, other?: unknown) => {
      requireRef(binding, '$op');
      const resolved = await resolveRefPath(adapter, binding, path);
      const result = await adapter.send({
        type: 'operator', ref: resolved.ref, op,
        ...(other !== undefined ? { other: serializeArg(other) } : {}),
      });
      return wrapResult(adapter, result, binding.language);
    };
  }

  // ─── Operator shorthands ───
  const opMap: Record<string, string> = {
    '$add': 'add', '$sub': 'sub', '$mul': 'mul', '$div': 'truediv',
    '$mod': 'mod', '$pow': 'pow', '$matmul': 'matmul',
    '$eq': 'eq', '$ne': 'ne', '$lt': 'lt', '$gt': 'gt', '$le': 'le', '$ge': 'ge',
  };
  if (opMap[prop]) {
    const op = opMap[prop];
    return async (other: unknown) => {
      requireRef(binding, prop);
      const resolved = await resolveRefPath(adapter, binding, path);
      const result = await adapter.send({ type: 'operator', ref: resolved.ref, op, other: serializeArg(other) });
      return wrapResult(adapter, result, binding.language);
    };
  }

  // Unary operators
  const unaryMap: Record<string, string> = { '$neg': 'neg', '$pos': 'pos', '$abs': 'abs', '$invert': 'invert' };
  if (unaryMap[prop]) {
    const op = unaryMap[prop];
    return async () => {
      requireRef(binding, prop);
      const resolved = await resolveRefPath(adapter, binding, path);
      const res = await adapter.send({ type: 'operator', ref: resolved.ref, op });
      return wrapResult(adapter, res, binding.language);
    };
  }

  // ─── $repr() / $str() — string representations ───
  if (prop === '$repr') {
    return async () => {
      requireRef(binding, '$repr');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({ type: 'repr', ref: resolved.ref, mode: 'repr' });
    };
  }
  if (prop === '$str') {
    return async () => {
      requireRef(binding, '$str');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({ type: 'repr', ref: resolved.ref, mode: 'str' });
    };
  }

  // ─── $type() — type info ───
  if (prop === '$type') {
    return async () => {
      requireRef(binding, '$type');
      const resolved = await resolveRefPath(adapter, binding, path);
      return adapter.send({ type: 'type', ref: resolved.ref });
    };
  }

  // ─── $dir(includePrivate?) — list attributes ───
  if (prop === '$dir') {
    return async (includePrivate?: boolean) => {
      if (binding.type === 'ref') {
        return adapter.send({ type: 'dir', ref: binding.ref, includePrivate: !!includePrivate });
      }
      return adapter.send({ type: 'dir', module: binding.module, includePrivate: !!includePrivate });
    };
  }

  // ─── $info() — worker info ───
  if (prop === '$info') {
    return async () => adapter.send({ type: 'info' });
  }

  // Not a special method
  return undefined;
}

// ═══════════════════════════════════════════════════════
//  Call Execution
// ═══════════════════════════════════════════════════════

async function executeCall(
  adapter: LanguageAdapter,
  binding: ProxyBinding,
  path: string[],
  args: unknown[],
  kwargs: Record<string, unknown>,
): Promise<unknown> {
  const serializedArgs = args.map(serializeArg);
  const serializedKwargs = kwargs ? serializeArg(kwargs) : {};

  let result: unknown;

  if (binding.type === 'module') {
    if (binding.language === 'python') {
      result = await adapter.send({
        type: 'call',
        module: binding.module,
        path,
        args: serializedArgs,
        kwargs: serializedKwargs,
      });
    } else if (binding.language === 'php') {
      result = await executePHPModuleCall(adapter, path, serializedArgs);
    }
  } else if (binding.type === 'ref') {
    if (binding.language === 'python') {
      result = await adapter.send({
        type: 'call_ref',
        ref: binding.ref,
        path,
        args: serializedArgs,
        kwargs: serializedKwargs,
      });
    } else if (binding.language === 'php') {
      if (path.length === 0) {
        throw new BridgerError(
          ErrorCode.NOT_CALLABLE,
          'Cannot call a PHP object reference directly. Use a method name.',
          { language: 'php', ref: binding.ref },
        );
      }
      result = await adapter.send({
        type: 'call_method',
        ref: binding.ref,
        method: path[path.length - 1],
        args: serializedArgs,
      });
    }
  }

  return wrapResult(adapter, result, binding.language);
}

/** Handle PHP module-level calls (functions, static methods, class creation) */
async function executePHPModuleCall(
  adapter: LanguageAdapter,
  path: string[],
  args: unknown[],
): Promise<unknown> {
  if (path.length === 0) {
    throw new BridgerError(
      ErrorCode.INVALID_ARGUMENT,
      'No function or class specified for PHP call',
      { language: 'php' },
    );
  }

  // Single name → global function
  if (path.length === 1) {
    return adapter.send({ type: 'call_function', function: path[0], args });
  }

  const last = path[path.length - 1];
  const classPath = path.slice(0, -1).join('\\');

  // .new() → create instance
  if (last === 'new') {
    return adapter.send({ type: 'create_instance', class: classPath, args });
  }

  // Otherwise → static method call
  return adapter.send({ type: 'call_static', class: classPath, method: last, args });
}

/** Handle `new` keyword (construct) */
async function executeConstruct(
  adapter: LanguageAdapter,
  binding: ProxyBinding,
  path: string[],
  args: unknown[],
): Promise<unknown> {
  const serializedArgs = args.map(serializeArg);

  if (binding.language === 'php') {
    const className = binding.type === 'module' ? path.join('\\') : (binding.typeName ?? '');
    const result = await adapter.send({ type: 'create_instance', class: className, args: serializedArgs });
    return wrapResult(adapter, result, binding.language);
  }

  if (binding.language === 'python') {
    // In Python, constructing is just calling the class
    return executeCall(adapter, binding, path, args, {});
  }
}

// ═══════════════════════════════════════════════════════
//  Value Resolution
// ═══════════════════════════════════════════════════════

async function resolveValue(
  adapter: LanguageAdapter,
  binding: ProxyBinding,
  path: string[],
): Promise<unknown> {
  let result: unknown;

  if (binding.type === 'module') {
    if (binding.language === 'python') {
      result = await adapter.send({ type: 'get_attr', module: binding.module, path });
    } else if (binding.language === 'php') {
      if (path.length >= 2) {
        const className = path.slice(0, -1).join('\\');
        const property = path[path.length - 1];
        result = await adapter.send({ type: 'get_static', class: className, property });
      } else if (path.length === 1) {
        // Try as a constant or check if it's a defined constant
        try {
          result = await adapter.send({ type: 'call_function', function: 'constant', args: [path[0]] });
        } catch {
          // Not a constant, leave as undefined
          result = undefined;
        }
      }
    }
  } else if (binding.type === 'ref') {
    if (binding.language === 'python') {
      result = await adapter.send({ type: 'get_ref_attr', ref: binding.ref, path });
    } else if (binding.language === 'php' && path.length >= 1) {
      result = await adapter.send({
        type: 'get_property', ref: binding.ref, property: path[path.length - 1],
      });
    }
  }

  return wrapResult(adapter, result, binding.language);
}

// ═══════════════════════════════════════════════════════
//  Result Wrapping
// ═══════════════════════════════════════════════════════

/**
 * Wrap a worker result. If it contains __bridger_ref__, create a ref-proxy.
 * Otherwise return the value as-is (recursively wrapping nested refs).
 */
export function wrapResult(adapter: LanguageAdapter, result: unknown, language: SupportedLanguage): unknown {
  if (result === null || result === undefined) return result;
  if (typeof result !== 'object') return result;

  if (Array.isArray(result)) {
    return result.map(item => wrapResult(adapter, item, language));
  }

  if (isBridgerRefResult(result)) {
    return createRefProxy(
      adapter,
      (result as BridgerRef).__bridger_ref__,
      (result as BridgerRef).__type__ ?? 'object',
      language,
    );
  }

  // Regular object — recursively wrap nested refs
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    wrapped[key] = wrapResult(adapter, value, language);
  }
  return wrapped;
}

// ═══════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════

function requireRef(binding: ProxyBinding, method: string): void {
  if (binding.type !== 'ref' || !binding.ref) {
    throw new BridgerError(
      ErrorCode.OPERATION_NOT_SUPPORTED,
      `${method} requires an object reference, not a module proxy`,
    );
  }
}

/**
 * If a ref proxy has a non-empty path (e.g., df.iloc),
 * resolve the intermediate attribute to get the actual sub-ref first.
 * Returns a { ref, binding } with the resolved reference.
 */
async function resolveRefPath(
  adapter: LanguageAdapter,
  binding: ProxyBinding,
  path: string[],
): Promise<{ ref: string; binding: ProxyBinding }> {
  if (path.length === 0) {
    return { ref: binding.ref!, binding };
  }
  // Resolve the intermediate path to get a new ref
  const result = await adapter.send({ type: 'get_ref_attr', ref: binding.ref, path });
  if (result && typeof result === 'object' && '__bridger_ref__' in (result as Record<string, unknown>)) {
    const refResult = result as BridgerRef;
    const newBinding: ProxyBinding = {
      type: 'ref',
      ref: refResult.__bridger_ref__,
      typeName: refResult.__type__ ?? 'object',
      language: binding.language,
    };
    return { ref: refResult.__bridger_ref__, binding: newBinding };
  }
  // The resolved value wasn't a ref — use original
  return { ref: binding.ref!, binding };
}
