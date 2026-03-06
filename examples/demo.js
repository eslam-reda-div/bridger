'use strict';

/**
 * Bridger Demo — Using Python packages from Node.js
 *
 * Run: node examples/demo.js
 */

const {
    bridge,
    shutdown
} = require('../src/index');

async function main() {
    console.log('🌉 Bridger Demo\n');

    // ═══════════════════════════════════════
    // 1. NumPy — Scientific Computing
    // ═══════════════════════════════════════
    console.log('═══ NumPy ═══\n');

    const numpy = await bridge('python:numpy');

    // Basic math
    const sum = await numpy.sum([1, 2, 3, 4, 5]);
    console.log('  sum([1,2,3,4,5]) =', sum);

    const mean = await numpy.mean([10, 20, 30, 40, 50]);
    console.log('  mean([10..50]) =', mean);

    const std = await numpy.std([10, 20, 30, 40, 50]);
    console.log('  std([10..50]) =', std);

    // Linear algebra
    const dot = await numpy.dot([1, 2, 3], [4, 5, 6]);
    console.log('  dot([1,2,3], [4,5,6]) =', dot);

    // Array operations
    const arr = await numpy.array([
        [1, 2],
        [3, 4]
    ]);
    const transposed = await arr.T();
    const tList = await transposed.tolist();
    console.log('  [[1,2],[3,4]].T =', JSON.stringify(tList));

    // Random numbers
    const rand = await numpy.random.randint(1, 100, [5]);
    const randList = await rand.tolist();
    console.log('  random integers:', randList);

    // Constants
    const pi = await numpy.pi();
    const e = await numpy.e();
    console.log(`  pi = ${pi}, e = ${e}`);

    // ═══════════════════════════════════════
    // 2. Math stdlib
    // ═══════════════════════════════════════
    console.log('\n═══ Python Math ═══\n');

    const math = await bridge('python:math');
    console.log('  sqrt(256) =', await math.sqrt(256));
    console.log('  factorial(10) =', await math.factorial(10));
    console.log('  gcd(48, 18) =', await math.gcd(48, 18));
    console.log('  log2(1024) =', await math.log2(1024));

    // ═══════════════════════════════════════
    // 3. JSON module — roundtrip
    // ═══════════════════════════════════════
    console.log('\n═══ Cross-language JSON ═══\n');

    const json = await bridge('python:json');
    const encoded = await json.dumps({
        name: 'Bridger',
        version: 1,
        features: ['python', 'php']
    });
    console.log('  json.dumps =', encoded);
    const decoded = await json.loads(encoded);
    console.log('  json.loads =', decoded);

    // ═══════════════════════════════════════
    // 4. Introspection
    // ═══════════════════════════════════════
    console.log('\n═══ Introspection ═══\n');

    const info = await numpy.$introspect();
    console.log(`  NumPy has ${info.functions.length} functions, ${info.classes.length} classes`);
    console.log('  Sample functions:', info.functions.slice(0, 8).map(f => f.name).join(', '));

    // ═══════════════════════════════════════
    // Done
    // ═══════════════════════════════════════
    console.log('\n✅ All demos completed!\n');

    await shutdown();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});