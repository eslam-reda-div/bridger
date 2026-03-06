/**
 * Bridger Jest Tests — SciPy (Scientific Computing)
 *
 * Tests: optimize, integrate, interpolate, linalg, stats, signal, spatial
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let scipy, np;
beforeAll(async () => {
    scipy = await bridge('python:scipy');
    np = await bridge('python:numpy');
});

describe('SciPy — Optimization', () => {
    test('optimize.minimize_scalar', async () => {
        const optimize = await bridge('python:scipy.optimize');
        // Minimize x^2 + 3x + 2 → minimum at x = -1.5
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "(__import__('scipy.optimize', fromlist=['minimize_scalar']).minimize_scalar(lambda x: x**2 + 3*x + 2)).x"
        );
        approxEq(result, -1.5);
    });

    test('optimize.root_scalar (bisect)', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "(__import__('scipy.optimize', fromlist=['root_scalar']).root_scalar(lambda x: x**2 - 4, bracket=[0, 10], method='bisect')).root"
        );
        approxEq(result, 2.0);
    });
});

describe('SciPy — Integration', () => {
    test('integrate.quad (definite integral)', async () => {
        const builtins = await bridge('python:builtins');
        // ∫₀¹ x² dx = 1/3
        const result = await builtins.eval(
            "__import__('scipy.integrate', fromlist=['quad']).quad(lambda x: x**2, 0, 1)[0]"
        );
        approxEq(result, 1 / 3);
    });
});

describe('SciPy — Linear Algebra', () => {
    test('linalg.lu factorization', async () => {
        const builtins = await bridge('python:builtins');
        const shape = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_lu',
    __import__('scipy.linalg', fromlist=['lu']).lu(__import__('numpy').array([[1,2],[3,4]]))),
  list(__import__('builtins')._lu[0].shape)
)[-1])()
`);
        expect(shape).toEqual([2, 2]);
    });

    test('linalg.svd', async () => {
        const builtins = await bridge('python:builtins');
        const shape0 = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_svd',
    __import__('scipy.linalg', fromlist=['svd']).svd(__import__('numpy').array([[1,2],[3,4],[5,6]]))),
  __import__('builtins')._svd[0].shape[0]
)[-1])()
`);
        expect(shape0).toBe(3);
    });
});

describe('SciPy — Statistics', () => {
    test('stats.norm.pdf (normal distribution)', async () => {
        const stats = await bridge('python:scipy.stats');
        const pdf_at_0 = await stats.norm.pdf(0);
        approxEq(pdf_at_0, 0.3989, 0.001); // 1/√(2π)
    });

    test('stats.norm.cdf', async () => {
        const stats = await bridge('python:scipy.stats');
        const cdf = await stats.norm.cdf(0);
        approxEq(cdf, 0.5);
    });

    test('stats.pearsonr (correlation)', async () => {
        const stats = await bridge('python:scipy.stats');
        const result = await stats.pearsonr([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
        // Perfect positive correlation → r = 1.0
        const statistic = await result.statistic.$value();
        approxEq(statistic, 1.0);
    });

    test('stats.ttest_ind', async () => {
        const stats = await bridge('python:scipy.stats');
        const result = await stats.ttest_ind([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
        const pvalue = await result.pvalue.$value();
        approxEq(pvalue, 1.0); // identical samples → p-value = 1.0
    });
});

describe('SciPy — Interpolation', () => {
    test('interpolate.interp1d', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "float(__import__('scipy.interpolate', fromlist=['interp1d']).interp1d([0, 1, 2, 3], [0, 1, 4, 9])(1.5))"
        );
        approxEq(result, 2.5); // linear interpolation between 1 and 4
    });
});

describe('SciPy — Spatial', () => {
    test('spatial.distance.euclidean', async () => {
        const distance = await bridge('python:scipy.spatial.distance');
        const d = await distance.euclidean([0, 0], [3, 4]);
        approxEq(d, 5.0);
    });

    test('spatial.distance.cosine', async () => {
        const distance = await bridge('python:scipy.spatial.distance');
        const d = await distance.cosine([1, 0], [0, 1]);
        approxEq(d, 1.0); // orthogonal vectors → cosine distance = 1
    });
});