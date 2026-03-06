/**
 * Shared Bridger test helpers for Jest.
 *
 * Provides bridge/from/shutdown + helpers to check approximate equality,
 * arrays, types, etc.
 */
'use strict';

const {
    bridge,
    from,
    shutdown,
    createBridge
} = require('../dist/index');

/** Approximate equality for floats */
function approxEq(actual, expected, tol = 0.01) {
    expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

module.exports = {
    bridge,
    from,
    shutdown,
    createBridge,
    approxEq
};