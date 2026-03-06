# 🌉 Bridger

**Universal Runtime Bridge** — Use any Python or PHP package directly from Node.js.

Instead of rewriting libraries, Bridger runs them in their native runtime and bridges the communication via a fast IPC protocol. You call Python's `numpy.sum()` or PHP's `Collection::make()` as if they were native JavaScript functions.

## Prerequisites

Bridger does **not** bundle Python or PHP — it uses the runtimes already installed on your machine.

| Runtime                  | Required for          | How to install                                                                        |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------- |
| **Node.js** ≥ 16         | Always                | [nodejs.org](https://nodejs.org)                                                      |
| **Python** ≥ 3.8         | Using Python packages | [python.org](https://www.python.org/downloads/)                                       |
| **PHP** ≥ 8.0 + Composer | Using PHP packages    | [php.net](https://www.php.net/downloads) / [getcomposer.org](https://getcomposer.org) |

> You only need the runtime for the language you plan to use. If you only use Python packages, PHP is not required (and vice versa).

Verify your setup:

```bash
node --version    # v16+ required
python --version  # needed for python:* packages
php --version     # needed for php:* packages
composer --version # needed for php:* packages
```

## Architecture

```
Your Node.js App
       │
   bridge("python:numpy")
       │
  ┌────┴─────┐
  │  Bridger │  ← JS Proxy + IPC Protocol
  └────┬─────┘
       │
  ┌────┴──────────┐
  │ Python Worker  │  ← Persistent child process
  │ (numpy loaded) │
  └───────────────┘
```

## Quick Start

### 1. Initialize

```bash
npx bridger init
```

### 2. Install packages

```bash
# Python packages (from pip)
npx bridger install python:numpy
npx bridger install python:pandas
npx bridger install python:requests
npx bridger install python:scikit-learn

# PHP packages (from composer)
npx bridger install php:spatie/collection
npx bridger install php:guzzlehttp/guzzle
```

### 3. Use in your code

```javascript
const { bridge, shutdown } = require("bridger");

async function main() {
  // ─── Python ──────────────────────────
  const numpy = await bridge("python:numpy");

  const sum = await numpy.sum([1, 2, 3, 4, 5]);
  console.log("Sum:", sum); // 15

  const mean = await numpy.mean([10, 20, 30]);
  console.log("Mean:", mean); // 20

  const arr = await numpy.array([
    [1, 2],
    [3, 4],
  ]);
  const shape = await arr.shape();
  console.log("Shape:", shape); // [2, 2]

  const dot = await numpy.dot([1, 2, 3], [4, 5, 6]);
  console.log("Dot product:", dot); // 32

  // ─── Python: pandas ──────────────────
  const pd = await bridge("python:pandas");

  const df = await pd.DataFrame({ name: ["Alice", "Bob"], age: [30, 25] });
  const ages = await df.age.mean();
  console.log("Mean age:", ages);

  // ─── Python: requests ────────────────
  const requests = await bridge("python:requests");
  const response = await requests.get("https://api.github.com");
  const status = await response.status_code();
  console.log("GitHub API status:", status);

  // ─── PHP ─────────────────────────────
  const php = await bridge("php:spatie/collection");
  const items = await php.Spatie.Collection.Collection.make([1, 2, 3]);
  const arr2 = await items.toArray();
  console.log("Collection:", arr2);

  // Clean up worker processes
  await shutdown();
}

main().catch(console.error);
```

## CLI Reference

```bash
bridger install <language:package[@version]>   # Install a package
bridger remove <language:package>              # Remove a package
bridger upgrade [language:package[@version]]   # Upgrade package(s)
bridger list                                   # List installed packages with versions
bridger info <language:package>                # Show package details & dependencies
bridger init                                   # Initialize & detect runtimes
bridger --version                              # Show version
```

### Version-pinned installs

```bash
npx bridger install python:numpy@1.26.4
npx bridger install python:pandas@>=2.0,<3.0
npx bridger install php:spatie/collection@^7.0
```

### Install multiple packages at once

```bash
npx bridger install python:numpy python:pandas python:matplotlib
```

## API Reference

### `bridge(spec)`

Import a package from another language.

```javascript
const { bridge } = require("bridger");

const numpy = await bridge("python:numpy");
const php = await bridge("php:some/package");
```

Returns a **Proxy** object that mirrors the remote package's API.

### Calling functions

Every call is async (crosses process boundary):

```javascript
const result = await numpy.sum([1, 2, 3]);
const arr = await numpy.linspace(0, 10, 100);
```

### Getting attribute values

Use `$value()` to read non-callable attributes:

```javascript
const pi = await numpy.pi(); // Works: pi is returned as value since it's not callable
const version = await numpy.__version__();
```

### Chained access

Property chains work naturally:

```javascript
const result = await numpy.random.randint(0, 100);
const normal = await numpy.random.normal(0, 1, [100]);
```

### Working with objects

Objects returned from Python/PHP become proxy references:

```javascript
const arr = await numpy.array([1, 2, 3]); // Returns a proxy to the remote object
const doubled = await arr.$mul(2); // Operator: arr * 2
const list = await doubled.tolist(); // Get back a JS array
```

### Indexing & Length

```javascript
const arr = await numpy.array([10, 20, 30, 40, 50]);

await arr.$getitem(0); // 10  — like arr[0] in Python
await arr.$setitem(1, 99); // arr[1] = 99
await arr.$len(); // 5  — like len(arr)
await arr.$contains(30); // true — like 30 in arr
```

### Operators

```javascript
const a = await numpy.array([1, 2, 3]);

await a.$add(10); // [11, 12, 13]
await a.$sub(1); // [0, 1, 2]
await a.$mul(3); // [3, 6, 9]
await a.$div(2); // [0.5, 1.0, 1.5]
await a.$pow(2); // [1, 4, 9]
await a.$neg(); // [-1, -2, -3]
await a.$matmul(b); // matrix multiplication
await a.$eq(other); // element-wise comparison
await a.$op("floordiv", 2); // any operator via $op()
```

### Iteration & Inspection

```javascript
const items = await collection.$iter(); // Collect iterable to JS array
const repr = await arr.$repr(); // repr(arr) string
const str = await arr.$str(); // str(arr) string
const type = await arr.$type(); // { type: 'ndarray', module: 'numpy', ... }
const attrs = await arr.$dir(); // list of attribute names
```

### Keyword Arguments (Python)

```javascript
const df = await pd.DataFrame.$call({
  data: { name: ["Alice", "Bob"], age: [25, 30] },
});
```

### Introspection

Discover what's available on a module or object:

```javascript
const info = await numpy.$introspect();
console.log(info.functions); // [{name: 'sum', signature: '...'}, ...]
console.log(info.classes); // [{name: 'ndarray', methods: [...]}, ...]
```

### PHP classes

Access PHP classes via namespace path, use `.new()` to instantiate:

```javascript
const php = await bridge("php:vendor/package");

// Static method
const result = await php.Namespace.ClassName.staticMethod(args);

// Create instance
const instance = await php.Namespace.ClassName.new(args);

// Call instance method
const value = await instance.someMethod();
```

### `shutdown()`

Shutdown all runtime workers. Call when your app is done:

```javascript
const { shutdown } = require("bridger");
await shutdown();
```

### `createBridge(projectRoot)`

Create an independent bridge instance pointing to a specific project:

```javascript
const { createBridge } = require("bridger");
const myBridge = createBridge("/path/to/project");
const np = await myBridge.import("python:numpy");
```

## How It Works

1. **Package Installation**: `bridger install python:numpy` creates a Python venv in `.runtimes/python/venv/` and installs numpy via pip.

2. **Worker Process**: When you call `bridge('python:numpy')`, Bridger spawns a persistent Python worker process that communicates via stdin/stdout JSON protocol.

3. **Proxy Objects**: The returned object is a JavaScript Proxy. Property access builds a path, and function calls send RPC messages to the worker.

4. **Object References**: Complex Python/PHP objects (classes, arrays, DataFrames) are stored in the worker's memory and referenced by ID. The JS proxy holds the ID and forwards method calls.

5. **Serialization**: Primitives, arrays, and dicts are serialized directly. Large numpy arrays and DataFrames are stored as references to avoid serialization overhead.

## `.runtimes/` Directory

```
.runtimes/
├── bridger.json          # Manifest — package constraints & runtime versions
├── bridger.lock.json     # Lockfile — exact resolved versions & dependencies
├── python/
│   └── venv/             # Python virtual environment with installed packages
└── php/
    ├── composer.json      # Composer manifest
    ├── composer.lock      # Composer lockfile
    └── vendor/            # Installed PHP packages
```

### bridger.json (manifest)

```json
{
  "version": "1.0.0",
  "runtimes": {
    "python": { "version": "3.11.5" },
    "php": { "version": "8.3.6" }
  },
  "packages": {
    "python:numpy": {
      "language": "python",
      "package": "numpy",
      "version": "*"
    },
    "python:pandas": {
      "language": "python",
      "package": "pandas",
      "version": ">=2.0"
    }
  }
}
```

### bridger.lock.json (lockfile)

```json
{
  "lockfileVersion": 1,
  "runtimes": {
    "python": { "version": "3.11.5", "path": ".runtimes/python/venv" }
  },
  "packages": {
    "python:numpy": {
      "installedVersion": "2.4.2",
      "versionConstraint": "*",
      "dependencies": [],
      "installedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

Add `.runtimes/` to your `.gitignore`.

## Requirements

- **Node.js** >= 16
- **Python 3** (for Python packages) — must be on PATH
- **PHP** >= 8.0 (for PHP packages) — must be on PATH
- **Composer** (for PHP packages) — must be on PATH

## Supported Languages

| Language | Package Manager | Status          |
| -------- | --------------- | --------------- |
| Python   | pip             | ✅ Full support |
| PHP      | Composer        | ✅ Full support |

## Limitations

- All calls are async (they cross process boundaries)
- Callback functions cannot be passed across language boundaries
- Very large data transfers may have serialization overhead (use object references for large data)
- First call has startup latency (worker process initialization)

## License

MIT
