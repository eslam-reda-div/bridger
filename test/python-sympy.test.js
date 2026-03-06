/**
 * Bridger Jest Tests — SymPy (Symbolic Mathematics)
 *
 * Tests: symbols, solve, differentiate, integrate, simplify, expand,
 * limits, series, matrices, substitution
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let sympy;
beforeAll(async () => {
    sympy = await bridge('python:sympy');
});

describe('SymPy — Symbol Creation', () => {
    test('create symbol', async () => {
        const x = await sympy.Symbol('x');
        const t = await x.$type();
        expect(t.type).toBe('Symbol');
    });

    test('symbols utility', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').symbols('x y z'))"
        );
        expect(typeof result).toBe('string');
        expect(result).toContain('x');
    });
});

describe('SymPy — Solving Equations', () => {
    test('solve linear equation: 2x + 1 = 5 → x = 2', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').solve(__import__('sympy').Symbol('x')*2 + 1 - 5, __import__('sympy').Symbol('x')))"
        );
        expect(result).toBe('[2]');
    });

    test('solve quadratic: x² - 5x + 6 = 0 → [2, 3]', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "sorted([int(s) for s in __import__('sympy').solve(__import__('sympy').Symbol('x')**2 - 5*__import__('sympy').Symbol('x') + 6)])"
        );
        expect(result).toEqual([2, 3]);
    });
});

describe('SymPy — Calculus', () => {
    test('differentiate x³ → 3x²', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').diff(__import__('sympy').Symbol('x')**3, __import__('sympy').Symbol('x')))"
        );
        expect(result).toBe('3*x**2');
    });

    test('integrate x² → x³/3', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').integrate(__import__('sympy').Symbol('x')**2, __import__('sympy').Symbol('x')))"
        );
        expect(result).toBe('x**3/3');
    });

    test('definite integral ∫₀¹ x² dx = 1/3', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').integrate(__import__('sympy').Symbol('x')**2, (__import__('sympy').Symbol('x'), 0, 1)))"
        );
        expect(result).toBe('1/3');
    });

    test('limit sin(x)/x as x→0 = 1', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').limit(__import__('sympy').sin(__import__('sympy').Symbol('x'))/__import__('sympy').Symbol('x'), __import__('sympy').Symbol('x'), 0))"
        );
        expect(result).toBe('1');
    });
});

describe('SymPy — Simplification', () => {
    test('simplify (x²-1)/(x-1) → x+1', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').simplify((__import__('sympy').Symbol('x')**2 - 1)/(__import__('sympy').Symbol('x') - 1)))"
        );
        expect(result).toBe('x + 1');
    });

    test('expand (x+1)(x+2)', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').expand((__import__('sympy').Symbol('x')+1)*(__import__('sympy').Symbol('x')+2)))"
        );
        expect(result).toBe('x**2 + 3*x + 2');
    });

    test('factor x²+3x+2 → (x+1)(x+2)', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').factor(__import__('sympy').Symbol('x')**2 + 3*__import__('sympy').Symbol('x') + 2))"
        );
        expect(result).toBe('(x + 1)*(x + 2)');
    });
});

describe('SymPy — Number Theory', () => {
    test('isprime', async () => {
        expect(await sympy.isprime(17)).toBe(true);
        expect(await sympy.isprime(18)).toBe(false);
    });

    test('factorial', async () => {
        const builtins = await bridge('python:builtins');
        const r = await builtins.eval("int(__import__('sympy').factorial(10))");
        expect(r).toBe(3628800);
    });

    test('fibonacci', async () => {
        const builtins = await bridge('python:builtins');
        const r = await builtins.eval("int(__import__('sympy').fibonacci(10))");
        expect(r).toBe(55);
    });
});

describe('SymPy — Matrix', () => {
    test('Matrix determinant', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "int(__import__('sympy').Matrix([[1,2],[3,4]]).det())"
        );
        expect(result).toBe(-2);
    });

    test('Matrix inverse', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "str(__import__('sympy').Matrix([[1,0],[0,1]]).inv())"
        );
        expect(result).toContain('1');
    });
});

describe('mpmath — Arbitrary Precision', () => {
    let mp;
    beforeAll(async () => {
        mp = await bridge('python:mpmath');
    });

    test('pi to 50 digits', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('mpmath').nstr(__import__('mpmath').pi, 50)"
        );
        expect(result).toMatch(/^3\.14159265358979/);
        expect(result.replace('.', '').length).toBeGreaterThan(30);
    });

    test('sqrt(2) high precision', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('mpmath').nstr(__import__('mpmath').sqrt(2), 30)"
        );
        expect(result).toMatch(/^1\.41421356/);
    });

    test('euler number', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "float(__import__('mpmath').e)"
        );
        approxEq(result, 2.71828, 0.001);
    });
});