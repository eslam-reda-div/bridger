#!/usr/bin/env python3
"""
Bridger Python Worker v2 - Robust persistent worker for ANY Python package.
Communicates via newline-delimited JSON over stdin/stdout.

Handles:
  - Module import (including submodules)
  - Function/method calls with args and kwargs
  - Attribute access & property reads
  - Object references (proxied back to JS)
  - __getitem__ / __setitem__ (indexing/slicing)
  - __len__, __iter__, __contains__
  - Operator overloads (__add__, __mul__, etc.)
  - Introspection of modules, classes, objects
  - exec() for arbitrary Python code blocks
  - Proper serialization of all common types
"""

import sys
import json
import importlib
import inspect
import traceback
import types
import os


class ObjectRegistry:
    """Stores Python objects referenced from Node.js via opaque IDs."""

    def __init__(self):
        self._objects = {}
        self._counter = 0

    def store(self, obj):
        self._counter += 1
        ref_id = f"pyref_{self._counter}"
        self._objects[ref_id] = obj
        return ref_id

    def get(self, ref_id):
        if ref_id not in self._objects:
            raise KeyError(f"Object reference not found: {ref_id}")
        return self._objects[ref_id]

    def delete(self, ref_id):
        self._objects.pop(ref_id, None)

    def has(self, ref_id):
        return ref_id in self._objects

    def count(self):
        return len(self._objects)


class Serializer:
    """Converts Python values to/from JSON-compatible format."""

    def __init__(self, registry):
        self.registry = registry

    def serialize(self, value):
        """Convert a Python value to a JSON-safe representation."""
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            if abs(value) > 2**53:
                return {"__type__": "bigint", "__value__": str(value)}
            return value
        if isinstance(value, float):
            if value != value:
                return {"__type__": "float", "__value__": "NaN"}
            if value == float('inf'):
                return {"__type__": "float", "__value__": "Infinity"}
            if value == float('-inf'):
                return {"__type__": "float", "__value__": "-Infinity"}
            return value
        if isinstance(value, str):
            return value
        if isinstance(value, bytes):
            import base64
            return {"__type__": "bytes", "__value__": base64.b64encode(value).decode('ascii')}
        if isinstance(value, (list, tuple)):
            if type(value) not in (list, tuple):
                # Subclass of list/tuple — store as reference to preserve methods
                ref_id = self.registry.store(value)
                return {
                    "__bridger_ref__": ref_id,
                    "__type__": type(value).__name__,
                    "__len__": len(value),
                    "__indexable__": True,
                }
            return [self.serialize(v) for v in value]
        if isinstance(value, dict):
            if type(value) is not dict:
                # Subclass of dict (Counter, OrderedDict, etc.) — store as reference
                ref_id = self.registry.store(value)
                result = {
                    "__bridger_ref__": ref_id,
                    "__type__": type(value).__name__,
                    "__len__": len(value),
                    "__indexable__": True,
                }
                if callable(value):
                    result["__callable__"] = True
                return result
            return {str(k): self.serialize(v) for k, v in value.items()}
        if isinstance(value, set):
            return {"__type__": "set", "__value__": [self.serialize(v) for v in value]}
        if isinstance(value, frozenset):
            return {"__type__": "frozenset", "__value__": [self.serialize(v) for v in value]}
        if isinstance(value, complex):
            return {"__type__": "complex", "__real__": value.real, "__imag__": value.imag}
        if isinstance(value, range):
            return list(value)
        if isinstance(value, type):
            # A class itself — store as reference
            ref_id = self.registry.store(value)
            return {
                "__bridger_ref__": ref_id,
                "__type__": "type",
                "__name__": value.__name__,
                "__callable__": True,
                "__is_class__": True,
            }
        if isinstance(value, slice):
            return {"__type__": "slice", "start": value.start, "stop": value.stop, "step": value.step}

        # ─── NumPy ────────────────────
        try:
            import numpy as np
            if isinstance(value, np.integer):
                return int(value)
            if isinstance(value, np.floating):
                return float(value)
            if isinstance(value, np.bool_):
                return bool(value)
            if isinstance(value, np.complexfloating):
                return {"__type__": "complex", "__real__": float(value.real), "__imag__": float(value.imag)}
            if isinstance(value, np.ndarray):
                ref_id = self.registry.store(value)
                return {
                    "__bridger_ref__": ref_id,
                    "__type__": "ndarray",
                    "__shape__": list(value.shape),
                    "__dtype__": str(value.dtype),
                    "__len__": len(value) if value.ndim > 0 else 0,
                }
            if isinstance(value, np.dtype):
                return str(value)
        except ImportError:
            pass

        # ─── Pandas ───────────────────
        try:
            import pandas as pd
            if isinstance(value, pd.DataFrame):
                ref_id = self.registry.store(value)
                return {
                    "__bridger_ref__": ref_id,
                    "__type__": "DataFrame",
                    "__shape__": list(value.shape),
                    "__columns__": [str(c) for c in value.columns],
                }
            if isinstance(value, pd.Series):
                ref_id = self.registry.store(value)
                return {
                    "__bridger_ref__": ref_id,
                    "__type__": "Series",
                    "__len__": len(value),
                    "__name__": str(value.name) if value.name is not None else None,
                }
            if isinstance(value, pd.Index):
                return value.tolist()
            if isinstance(value, pd.Timestamp):
                return value.isoformat()
        except ImportError:
            pass

        # ─── Generators/Iterators → list ───
        if hasattr(value, '__next__') and hasattr(value, '__iter__'):
            items = []
            try:
                for i, v in enumerate(value):
                    items.append(self.serialize(v))
                    if i >= 10000:
                        break
            except Exception:
                pass
            return items

        # ─── Modules ─────────────────
        if isinstance(value, types.ModuleType):
            ref_id = self.registry.store(value)
            return {
                "__bridger_ref__": ref_id,
                "__type__": "module",
                "__name__": getattr(value, '__name__', str(value)),
            }

        # ─── Callables ───────────────
        if callable(value):
            ref_id = self.registry.store(value)
            result = {
                "__bridger_ref__": ref_id,
                "__type__": type(value).__name__,
                "__callable__": True,
            }
            if inspect.isclass(value):
                result["__is_class__"] = True
            return result

        # ─── Enum values ─────────────
        try:
            import enum
            if isinstance(value, enum.Enum):
                return {"__type__": "enum", "name": value.name, "value": self.serialize(value.value)}
        except ImportError:
            pass

        # ─── datetime ─────────────────
        try:
            import datetime
            if isinstance(value, datetime.datetime):
                return value.isoformat()
            if isinstance(value, datetime.date):
                return value.isoformat()
            if isinstance(value, datetime.timedelta):
                return value.total_seconds()
        except ImportError:
            pass

        # ─── pathlib ──────────────────
        try:
            import pathlib
            if isinstance(value, pathlib.PurePath):
                return str(value)
        except ImportError:
            pass

        # ─── Fallback: any object → reference ───
        ref_id = self.registry.store(value)
        type_name = type(value).__name__
        try:
            repr_str = repr(value)
            if len(repr_str) > 500:
                repr_str = repr_str[:500] + "..."
        except Exception:
            repr_str = f"<{type_name}>"

        result = {
            "__bridger_ref__": ref_id,
            "__type__": type_name,
            "__repr__": repr_str,
        }

        # Detect if it's iterable/indexable/callable
        if hasattr(value, '__len__'):
            try:
                result["__len__"] = len(value)
            except Exception:
                pass
        if hasattr(value, '__getitem__'):
            result["__indexable__"] = True
        if callable(value):
            result["__callable__"] = True

        return result

    def deserialize(self, value):
        """Convert a JSON value back to Python, resolving bridger references."""
        if value is None:
            return None
        if isinstance(value, (bool, int, float, str)):
            return value
        if isinstance(value, list):
            return [self.deserialize(v) for v in value]
        if isinstance(value, dict):
            if "__bridger_ref__" in value:
                return self.registry.get(value["__bridger_ref__"])
            if "__bridger_module__" in value:
                import importlib
                mod = importlib.import_module(value["__bridger_module__"])
                for attr in (value.get("__path__") or []):
                    mod = getattr(mod, attr)
                return mod
            if "__type__" in value:
                t = value["__type__"]
                if t == "bytes":
                    import base64
                    return base64.b64decode(value["__value__"])
                if t == "bigint":
                    return int(value["__value__"])
                if t == "float":
                    v = value["__value__"]
                    if v == "NaN": return float('nan')
                    if v == "Infinity": return float('inf')
                    if v == "-Infinity": return float('-inf')
                if t == "complex":
                    return complex(value.get("__real__", 0), value.get("__imag__", 0))
                if t == "set":
                    return set(self.deserialize(v) for v in value["__value__"])
                if t == "slice":
                    return slice(value.get("start"), value.get("stop"), value.get("step"))
            return {k: self.deserialize(v) for k, v in value.items()}
        return value


class BridgerWorker:
    def __init__(self):
        self.modules = {}
        self.registry = ObjectRegistry()
        self.serializer = Serializer(self.registry)

    def resolve_path(self, base, path):
        """Navigate a dotted attribute path, auto-importing submodules as needed."""
        obj = base
        for i, part in enumerate(path):
            try:
                obj = getattr(obj, part)
            except AttributeError:
                # Try importing as a submodule
                if isinstance(obj, types.ModuleType):
                    sub_name = obj.__name__ + '.' + part
                    try:
                        obj = importlib.import_module(sub_name)
                        continue
                    except ImportError:
                        pass
                # Also try for the base module
                if isinstance(base, types.ModuleType) and i > 0:
                    sub_name = base.__name__ + '.' + '.'.join(path[:i + 1])
                    try:
                        obj = importlib.import_module(sub_name)
                        continue
                    except ImportError:
                        pass
                raise AttributeError(
                    f"'{type(obj).__name__}' object has no attribute '{part}' "
                    f"(path so far: {'.'.join(path[:i + 1])})"
                )
        return obj

    def handle(self, msg):
        msg_id = msg.get("id")
        msg_type = msg.get("type")

        try:
            handler = getattr(self, f"_handle_{msg_type}", None)
            if handler is None:
                return {"id": msg_id, "error": f"Unknown message type: {msg_type}"}
            return handler(msg)
        except Exception as e:
            return {
                "id": msg_id,
                "error": str(e),
                "errorType": type(e).__name__,
                "traceback": traceback.format_exc(),
            }

    def _handle_import(self, msg):
        module_name = msg["module"]
        mod = importlib.import_module(module_name)
        self.modules[module_name] = mod
        return {"id": msg["id"], "result": True}

    def _handle_call(self, msg):
        """Call a function on an imported module, navigating by path."""
        module_name = msg["module"]
        path = msg["path"]
        raw_args = msg.get("args", [])
        raw_kwargs = msg.get("kwargs", {})

        args = [self.serializer.deserialize(a) for a in raw_args]
        kwargs = {k: self.serializer.deserialize(v) for k, v in raw_kwargs.items()}

        mod = self.modules[module_name]
        target = self.resolve_path(mod, path)

        if callable(target):
            result = target(*args, **kwargs)
        elif not args and not kwargs:
            result = target
        else:
            raise TypeError(f"'{'.'.join(path)}' is not callable")

        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_call_ref(self, msg):
        """Call a method on a stored object reference."""
        ref_id = msg["ref"]
        path = msg.get("path", [])
        raw_args = msg.get("args", [])
        raw_kwargs = msg.get("kwargs", {})

        args = [self.serializer.deserialize(a) for a in raw_args]
        kwargs = {k: self.serializer.deserialize(v) for k, v in raw_kwargs.items()}

        obj = self.registry.get(ref_id)

        if path:
            target = self.resolve_path(obj, path)
        else:
            target = obj

        if callable(target):
            result = target(*args, **kwargs)
        elif not args and not kwargs:
            result = target
        else:
            raise TypeError("Target is not callable")

        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_get_attr(self, msg):
        module_name = msg["module"]
        path = msg["path"]
        mod = self.modules[module_name]
        result = self.resolve_path(mod, path)
        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_get_ref_attr(self, msg):
        ref_id = msg["ref"]
        path = msg["path"]
        obj = self.registry.get(ref_id)
        result = self.resolve_path(obj, path)
        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_getitem(self, msg):
        """Support obj[key] — __getitem__"""
        ref_id = msg["ref"]
        raw_key = msg["key"]
        key = self.serializer.deserialize(raw_key)
        obj = self.registry.get(ref_id)
        result = obj[key]
        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_setitem(self, msg):
        """Support obj[key] = value — __setitem__"""
        ref_id = msg["ref"]
        key = self.serializer.deserialize(msg["key"])
        value = self.serializer.deserialize(msg["value"])
        obj = self.registry.get(ref_id)
        obj[key] = value
        return {"id": msg["id"], "result": True}

    def _handle_len(self, msg):
        """Support len(obj)"""
        ref_id = msg["ref"]
        obj = self.registry.get(ref_id)
        return {"id": msg["id"], "result": len(obj)}

    def _handle_iter(self, msg):
        """Convert iterable to list (with limit)"""
        ref_id = msg["ref"]
        limit = msg.get("limit", 10000)
        obj = self.registry.get(ref_id)
        items = []
        for i, v in enumerate(obj):
            items.append(self.serializer.serialize(v))
            if i >= limit - 1:
                break
        return {"id": msg["id"], "result": items}

    def _handle_contains(self, msg):
        """Support `value in obj`"""
        ref_id = msg["ref"]
        value = self.serializer.deserialize(msg["value"])
        obj = self.registry.get(ref_id)
        return {"id": msg["id"], "result": value in obj}

    def _handle_operator(self, msg):
        """Support Python operators: add, sub, mul, div, etc."""
        ref_id = msg["ref"]
        op = msg["op"]
        raw_other = msg.get("other")
        other = self.serializer.deserialize(raw_other) if raw_other is not None else None

        obj = self.registry.get(ref_id)

        ops = {
            "add": "__add__", "radd": "__radd__",
            "sub": "__sub__", "rsub": "__rsub__",
            "mul": "__mul__", "rmul": "__rmul__",
            "truediv": "__truediv__", "floordiv": "__floordiv__",
            "mod": "__mod__", "pow": "__pow__",
            "and": "__and__", "or": "__or__", "xor": "__xor__",
            "lshift": "__lshift__", "rshift": "__rshift__",
            "neg": "__neg__", "pos": "__pos__", "abs": "__abs__",
            "invert": "__invert__",
            "eq": "__eq__", "ne": "__ne__",
            "lt": "__lt__", "le": "__le__",
            "gt": "__gt__", "ge": "__ge__",
            "matmul": "__matmul__",
        }

        method_name = ops.get(op)
        if not method_name:
            raise ValueError(f"Unknown operator: {op}")

        method = getattr(obj, method_name, None)
        if method is None:
            raise TypeError(f"Object does not support operator '{op}'")

        if op in ("neg", "pos", "abs", "invert"):
            result = method()
        else:
            result = method(other)

        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_repr(self, msg):
        """Get string representation of object."""
        ref_id = msg["ref"]
        obj = self.registry.get(ref_id)
        mode = msg.get("mode", "repr")
        if mode == "str":
            result = str(obj)
        else:
            result = repr(obj)
        if len(result) > 10000:
            result = result[:10000] + "..."
        return {"id": msg["id"], "result": result}

    def _handle_type(self, msg):
        """Get the type name and module of an object."""
        ref_id = msg["ref"]
        obj = self.registry.get(ref_id)
        return {"id": msg["id"], "result": {
            "type": type(obj).__name__,
            "module": type(obj).__module__,
            "qualname": type(obj).__qualname__,
            "mro": [c.__name__ for c in type(obj).__mro__],
        }}

    def _handle_dir(self, msg):
        """List all attribute names on an object."""
        ref_id = msg.get("ref")
        module_name = msg.get("module")

        if ref_id:
            obj = self.registry.get(ref_id)
        elif module_name:
            obj = self.modules.get(module_name)
        else:
            return {"id": msg["id"], "error": "No target"}

        include_private = msg.get("includePrivate", False)
        names = dir(obj)
        if not include_private:
            names = [n for n in names if not n.startswith('_')]

        return {"id": msg["id"], "result": names}

    def _handle_introspect(self, msg):
        """Detailed introspection of a module or object."""
        module_name = msg.get("module")
        ref_id = msg.get("ref")

        if module_name:
            obj = self.modules.get(module_name)
            if obj is None:
                return {"id": msg["id"], "error": f"Module not imported: {module_name}"}
        elif ref_id:
            obj = self.registry.get(ref_id)
        else:
            return {"id": msg["id"], "error": "No target specified"}

        members = {
            "functions": [],
            "classes": [],
            "properties": [],
            "modules": [],
        }

        for name in dir(obj):
            if name.startswith('_'):
                continue
            try:
                attr = getattr(obj, name)
                if isinstance(attr, types.ModuleType):
                    members["modules"].append(name)
                elif inspect.isclass(attr):
                    methods = []
                    for m in dir(attr):
                        if not m.startswith('_'):
                            try:
                                if callable(getattr(attr, m)):
                                    methods.append(m)
                            except Exception:
                                pass
                    members["classes"].append({"name": name, "methods": methods[:50]})
                elif callable(attr):
                    sig = None
                    try:
                        sig = str(inspect.signature(attr))
                    except (ValueError, TypeError):
                        pass
                    members["functions"].append({"name": name, "signature": sig})
                else:
                    members["properties"].append({
                        "name": name,
                        "type": type(attr).__name__,
                    })
            except Exception:
                pass

        return {"id": msg["id"], "result": members}

    def _handle_exec(self, msg):
        """Execute arbitrary Python code and return the result.
        The code has access to all imported modules and the registry."""
        code = msg["code"]
        # Build a namespace with all imported modules
        namespace = dict(self.modules)
        namespace["__registry__"] = self.registry
        namespace["__result__"] = None

        exec(compile(code, "<bridger>", "exec"), namespace)

        result = namespace.get("__result__")
        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_eval(self, msg):
        """Evaluate a Python expression and return the result."""
        expr = msg["expr"]
        namespace = dict(self.modules)
        namespace["__registry__"] = self.registry

        result = eval(compile(expr, "<bridger>", "eval"), namespace)
        return {"id": msg["id"], "result": self.serializer.serialize(result)}

    def _handle_destroy(self, msg):
        ref_id = msg["ref"]
        self.registry.delete(ref_id)
        return {"id": msg["id"], "result": True}

    def _handle_destroy_many(self, msg):
        """Release multiple references at once."""
        refs = msg["refs"]
        for ref_id in refs:
            self.registry.delete(ref_id)
        return {"id": msg["id"], "result": True}

    def _handle_ping(self, msg):
        return {"id": msg["id"], "result": "pong"}

    def _handle_info(self, msg):
        """Return worker status info."""
        return {"id": msg["id"], "result": {
            "python_version": sys.version,
            "platform": sys.platform,
            "modules_loaded": list(self.modules.keys()),
            "objects_tracked": self.registry.count(),
            "pid": os.getpid(),
        }}

    def _handle_import_from(self, msg):
        """Selective import: import specific names from a module."""
        module_name = msg["module"]
        names = msg["names"]
        mod = importlib.import_module(module_name)
        self.modules[module_name] = mod

        result = {}
        for name in names:
            try:
                attr = getattr(mod, name)
                result[name] = self.serializer.serialize(attr)
            except AttributeError:
                result[name] = None
        return {"id": msg["id"], "result": result}

    def _handle_batch(self, msg):
        """Process multiple messages in one IPC call."""
        messages = msg.get("messages", [])
        results = []
        for sub_msg in messages:
            response = self.handle(sub_msg)
            results.append(response)
        return {"id": msg["id"], "result": results}

    def _handle_shutdown(self, msg):
        return {"id": msg["id"], "result": True, "__shutdown__": True}

    def run(self):
        """Main loop: read JSON from stdin, process, write JSON to stdout."""
        sys.stdout.write(json.dumps({"type": "ready"}) + "\n")
        sys.stdout.flush()

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                sys.stdout.write(json.dumps({"error": f"Invalid JSON: {e}"}) + "\n")
                sys.stdout.flush()
                continue

            response = self.handle(msg)
            try:
                out = json.dumps(response, default=str)
            except (TypeError, ValueError) as e:
                out = json.dumps({
                    "id": msg.get("id"),
                    "error": f"Serialization error: {e}",
                    "errorType": "SerializationError",
                })

            sys.stdout.write(out + "\n")
            sys.stdout.flush()

            if response.get("__shutdown__"):
                break


if __name__ == "__main__":
    worker = BridgerWorker()
    worker.run()
