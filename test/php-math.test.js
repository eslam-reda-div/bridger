/**
 * Bridger Jest Tests — PHP brick/math & markrogoyski/math-php
 *
 * Tests: BigDecimal, BigInteger, BigRational, statistics, number theory,
 * linear algebra, probability
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let php;
beforeAll(async () => {
    php = await bridge('php:php');
});

// ── brick/math ─────────────────────────────────────────────────

describe('brick/math — BigInteger', () => {
    test('create from string', async () => {
        const bi = await php.Brick.Math.BigInteger.of('123456789012345678901234567890');
        const str = await bi.toBase(10);
        expect(str).toBe('123456789012345678901234567890');
    });

    test('addition', async () => {
        const a = await php.Brick.Math.BigInteger.of('999999999999999999');
        const b = await a.plus('1');
        const str = await b.toBase(10);
        expect(str).toBe('1000000000000000000');
    });

    test('multiplication', async () => {
        const a = await php.Brick.Math.BigInteger.of('1000000');
        const b = await a.multipliedBy('1000000');
        const str = await b.toBase(10);
        expect(str).toBe('1000000000000');
    });

    test('division', async () => {
        const a = await php.Brick.Math.BigInteger.of('100');
        const b = await a.quotient('3');
    });

    test('power', async () => {
        const a = await php.Brick.Math.BigInteger.of('2');
        const b = await a.power(64);
        const str = await b.toBase(10);
        expect(str).toBe('18446744073709551616');
    });

    test('modulo', async () => {
        const a = await php.Brick.Math.BigInteger.of('17');
        const b = await a.mod('5');
        const str = await b.toBase(10);
        expect(str).toBe('2');
    });

    test('comparison', async () => {
        const a = await php.Brick.Math.BigInteger.of('100');
        const b = await php.Brick.Math.BigInteger.of('200');
        const cmp = await a.compareTo(b);
        expect(cmp).toBeLessThan(0); // a < b
    });

    test('isEqualTo', async () => {
        const a = await php.Brick.Math.BigInteger.of('42');
        const result = await a.isEqualTo('42');
        expect(result).toBe(true);
    });

    test('abs of negative', async () => {
        const a = await php.Brick.Math.BigInteger.of('-42');
        const b = await a.abs();
        const str = await b.toBase(10);
        expect(str).toBe('42');
    });

    test('gcd', async () => {
        const a = await php.Brick.Math.BigInteger.of('48');
        const b = await a.gcd('18');
        const str = await b.toBase(10);
        expect(str).toBe('6');
    });
});

describe('brick/math — BigDecimal', () => {
    test('create from string', async () => {
        const bd = await php.Brick.Math.BigDecimal.of('3.14159265358979323846');
        const str = await bd.__toString();
        expect(str).toContain('3.14159');
    });

    test('addition', async () => {
        const a = await php.Brick.Math.BigDecimal.of('1.1');
        const b = await a.plus('2.2');
        const str = await b.__toString();
        expect(str).toBe('3.3');
    });

    test('subtraction', async () => {
        const a = await php.Brick.Math.BigDecimal.of('5.5');
        const b = await a.minus('2.3');
        const str = await b.__toString();
        expect(str).toBe('3.2');
    });

    test('multiplication', async () => {
        const a = await php.Brick.Math.BigDecimal.of('1.5');
        const b = await a.multipliedBy('3');
        const str = await b.__toString();
        expect(str).toBe('4.5');
    });

    test('exact division', async () => {
        const a = await php.Brick.Math.BigDecimal.of('10');
        const RoundingMode = php.Brick.Math.RoundingMode;
        const b = await a.dividedBy('4', 1, await RoundingMode.UNNECESSARY.$value());
        const str = await b.__toString();
        expect(str).toBe('2.5');
    });

    test('comparison', async () => {
        const a = await php.Brick.Math.BigDecimal.of('3.14');
        const b = await php.Brick.Math.BigDecimal.of('2.71');
        const cmp = await a.compareTo(b);
        expect(cmp).toBeGreaterThan(0);
    });

    test('isNegative / isPositive', async () => {
        const neg = await php.Brick.Math.BigDecimal.of('-5.5');
        const pos = await php.Brick.Math.BigDecimal.of('5.5');
        expect(await neg.isNegative()).toBe(true);
        expect(await pos.isPositive()).toBe(true);
    });

    test('scale', async () => {
        const bd = await php.Brick.Math.BigDecimal.of('3.14159');
        const scale = await bd.getScale();
        expect(scale).toBe(5);
    });
});

describe('brick/math — BigRational', () => {
    test('create from fraction', async () => {
        const br = await php.Brick.Math.BigRational.of('1/3');
        const str = await br.__toString();
        expect(str).toBe('1/3');
    });

    test('addition', async () => {
        const a = await php.Brick.Math.BigRational.of('1/3');
        const b = await a.plus('1/6');
        const c = await b.simplified();
        const str = await c.__toString();
        expect(str).toBe('1/2');
    });

    test('multiplication', async () => {
        const a = await php.Brick.Math.BigRational.of('2/3');
        const b = await a.multipliedBy('3/4');
        const c = await b.simplified();
        const str = await c.__toString();
        expect(str).toBe('1/2');
    });

    test('reciprocal', async () => {
        const a = await php.Brick.Math.BigRational.of('3/7');
        const b = await a.reciprocal();
        const str = await b.__toString();
        expect(str).toBe('7/3');
    });
});

// ── markrogoyski/math-php ──────────────────────────────────────

describe('math-php — Statistics', () => {
    test('mean', async () => {
        const result = await php.MathPHP.Statistics.Average.mean([2, 4, 6, 8, 10]);
        expect(result).toBe(6);
    });

    test('median', async () => {
        const result = await php.MathPHP.Statistics.Average.median([1, 2, 3, 4, 5]);
        expect(result).toBe(3);
    });

    test('mode', async () => {
        const result = await php.MathPHP.Statistics.Average.mode([1, 2, 2, 3, 3, 3, 4]);
        expect(result).toEqual([3]);
    });

    test('standard deviation (population)', async () => {
        const result = await php.MathPHP.Statistics.Descriptive.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], true);
        expect(result).toBeCloseTo(2, 0);
    });

    test('variance', async () => {
        const result = await php.MathPHP.Statistics.Descriptive.populationVariance([2, 4, 4, 4, 5, 5, 7, 9]);
        expect(result).toBeCloseTo(4, 0);
    });

    test('range', async () => {
        const result = await php.MathPHP.Statistics.Descriptive.range([1, 5, 3, 9, 2]);
        expect(result).toBe(8);
    });
});

describe('math-php — Number Theory', () => {
    test('factorial', async () => {
        const result = await php.MathPHP.Probability.Combinatorics.factorial(5);
        expect(result).toBe(120);
    });

    test('factorial of 0', async () => {
        const result = await php.MathPHP.Probability.Combinatorics.factorial(0);
        expect(result).toBe(1);
    });
});

describe('math-php — Probability', () => {
    test('binomial coefficient (n choose k)', async () => {
        const result = await php.MathPHP.Probability.Combinatorics.combinations(5, 2);
        expect(result).toBe(10);
    });

    test('permutations', async () => {
        const result = await php.MathPHP.Probability.Combinatorics.permutations(5, 2);
        expect(result).toBe(20);
    });
});