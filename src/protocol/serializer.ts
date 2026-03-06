/**
 * Bridger — Argument Serializer
 *
 * Handles conversion of JS values to/from the IPC wire format.
 * Recognizes Bridger proxy references and converts them to
 * { __bridger_ref__ } markers so the remote worker can resolve them.
 *
 * Pattern: Strategy — different serialization logic per value type.
 */

import { BRIDGER_INTERNAL, type ProxyInternals, type BridgerRef } from '../types';

/**
 * Serialize a JS argument for sending to the remote worker.
 * Converts Bridger proxy references into { __bridger_ref__: id } markers.
 */
export function serializeArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string') return arg;

  // Check for Bridger proxy object (has BRIDGER_INTERNAL symbol)
  if (typeof arg === 'object' || typeof arg === 'function') {
    const internal = (arg as Record<symbol, unknown>)[BRIDGER_INTERNAL] as ProxyInternals | undefined;
    if (internal) {
      const { binding, path } = internal;
      if (binding.type === 'ref' && binding.ref) {
        return { __bridger_ref__: binding.ref };
      }
      // Module proxy passed as arg — send module + path so worker can resolve
      if (binding.type === 'module' && binding.module) {
        return { __bridger_module__: binding.module, __path__: path };
      }
      return undefined;
    }
  }

  if (Array.isArray(arg)) {
    return arg.map(serializeArg);
  }

  if (typeof arg === 'object' && arg !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(arg)) {
      result[key] = serializeArg(value);
    }
    return result;
  }

  return arg;
}

/**
 * Check if a value from the worker is a Bridger object reference.
 */
export function isBridgerRefResult(value: unknown): value is BridgerRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__bridger_ref__' in value
  );
}
