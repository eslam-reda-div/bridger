#!/usr/bin/env node

/**
 * Bridger — Quick Start Example
 *
 * Setup:
 *   mkdir my-project && cd my-project
 *   npm init -y
 *   npm install @eslam-reda-div/bridger
 *   npx bridger init
 *   npx bridger install python:numpy
 *   npx bridger install php:nesbot/carbon
 *   node index.js
 */

'use strict';

const {
    bridge,
    shutdown
} = require('@eslam-reda-div/bridger');

async function main() {
    // ── Python: NumPy ────────────────────────────
    const np = await bridge('python:numpy');

    const sum = await np.sum([1, 2, 3, 4, 5]);
    console.log('NumPy sum:', sum); // 15

    const mean = await np.mean([10, 20, 30]);
    console.log('NumPy mean:', mean); // 20

    const dot = await np.dot([1, 2], [3, 4]);
    console.log('NumPy dot:', dot); // 11

    // ── PHP: Carbon ──────────────────────────────
    const php = await bridge('php:php');

    const now = await php.Carbon.Carbon.now();
    const formatted = await now.format('Y-m-d H:i:s');
    console.log('Carbon now:', formatted);

    const future = await now.addDays(30);
    const futureStr = await future.format('Y-m-d');
    console.log('30 days from now:', futureStr);

    await shutdown();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});