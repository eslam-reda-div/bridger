/**
 * Bridger Jest Tests — PHP respect/validation
 *
 * Tests: various validation rules — string, numeric, email, URL,
 * date, length, regex, boolean, IP, domain, etc.
 */
'use strict';

const {
    bridge,
    shutdown
} = require('./helpers');

afterAll(() => shutdown());

let php;
beforeAll(async () => {
    php = await bridge('php:php');
});

describe('respect/validation — String Validators', () => {
    test('stringType validates strings', async () => {
        const v = await php.Respect.Validation.Validator.stringType();
        expect(await v.validate('hello')).toBe(true);
        expect(await v.validate(123)).toBe(false);
    });

    test('alpha validates alphabetic strings', async () => {
        const v = await php.Respect.Validation.Validator.alpha();
        expect(await v.validate('hello')).toBe(true);
        expect(await v.validate('hello123')).toBe(false);
    });

    test('alnum validates alphanumeric', async () => {
        const v = await php.Respect.Validation.Validator.alnum();
        expect(await v.validate('hello123')).toBe(true);
        expect(await v.validate('hello 123')).toBe(false);
    });

    test('length validates string length range', async () => {
        const v = await php.Respect.Validation.Validator.length(3, 10);
        expect(await v.validate('hello')).toBe(true);
        expect(await v.validate('hi')).toBe(false);
        expect(await v.validate('this is way too long')).toBe(false);
    });

    test('regex validates pattern', async () => {
        const v = await php.Respect.Validation.Validator.regex('/^[A-Z]{3}$/');
        expect(await v.validate('ABC')).toBe(true);
        expect(await v.validate('abc')).toBe(false);
        expect(await v.validate('ABCD')).toBe(false);
    });

    test('noWhitespace', async () => {
        const v = await php.Respect.Validation.Validator.noWhitespace();
        expect(await v.validate('hello')).toBe(true);
        expect(await v.validate('hello world')).toBe(false);
    });

    test('startsWith / endsWith', async () => {
        const v1 = await php.Respect.Validation.Validator.startsWith('Hello');
        expect(await v1.validate('Hello World')).toBe(true);
        expect(await v1.validate('World Hello')).toBe(false);

        const v2 = await php.Respect.Validation.Validator.endsWith('World');
        expect(await v2.validate('Hello World')).toBe(true);
        expect(await v2.validate('World Hello')).toBe(false);
    });
});

describe('respect/validation — Numeric Validators', () => {
    test('intType', async () => {
        const v = await php.Respect.Validation.Validator.intType();
        expect(await v.validate(42)).toBe(true);
        expect(await v.validate('42')).toBe(false);
    });

    test('floatType', async () => {
        const v = await php.Respect.Validation.Validator.floatType();
        expect(await v.validate(3.14)).toBe(true);
    });

    test('positive / negative', async () => {
        const pos = await php.Respect.Validation.Validator.positive();
        expect(await pos.validate(5)).toBe(true);
        expect(await pos.validate(-5)).toBe(false);

        const neg = await php.Respect.Validation.Validator.negative();
        expect(await neg.validate(-5)).toBe(true);
        expect(await neg.validate(5)).toBe(false);
    });

    test('between', async () => {
        const v = await php.Respect.Validation.Validator.between(1, 100);
        expect(await v.validate(50)).toBe(true);
        expect(await v.validate(150)).toBe(false);
        expect(await v.validate(0)).toBe(false);
    });

    test('even / odd', async () => {
        const even = await php.Respect.Validation.Validator.even();
        expect(await even.validate(4)).toBe(true);
        expect(await even.validate(3)).toBe(false);

        const odd = await php.Respect.Validation.Validator.odd();
        expect(odd && await odd.validate(3)).toBe(true);
    });

    test('multiple', async () => {
        const v = await php.Respect.Validation.Validator.multiple(3);
        expect(await v.validate(9)).toBe(true);
        expect(await v.validate(10)).toBe(false);
    });
});

describe('respect/validation — Type Validators', () => {
    test('boolType', async () => {
        const v = await php.Respect.Validation.Validator.boolType();
        expect(await v.validate(true)).toBe(true);
        expect(await v.validate(false)).toBe(true);
        expect(await v.validate('true')).toBe(false);
    });

    test('arrayType', async () => {
        const v = await php.Respect.Validation.Validator.arrayType();
        expect(await v.validate([1, 2])).toBe(true);
        expect(await v.validate('not array')).toBe(false);
    });

    test('nullType', async () => {
        const v = await php.Respect.Validation.Validator.nullType();
        expect(await v.validate(null)).toBe(true);
        expect(await v.validate('')).toBe(false);
    });

    test('trueVal / falseVal', async () => {
        const trueV = await php.Respect.Validation.Validator.trueVal();
        expect(await trueV.validate(true)).toBe(true);
        expect(await trueV.validate(1)).toBe(true);

        const falseV = await php.Respect.Validation.Validator.falseVal();
        expect(await falseV.validate(false)).toBe(true);
        expect(await falseV.validate(0)).toBe(true);
    });
});

describe('respect/validation — Network Validators', () => {
    test('ip', async () => {
        const v = await php.Respect.Validation.Validator.ip();
        expect(await v.validate('192.168.1.1')).toBe(true);
        expect(await v.validate('not.an.ip')).toBe(false);
    });

    test('url', async () => {
        const v = await php.Respect.Validation.Validator.url();
        expect(await v.validate('https://example.com')).toBe(true);
        expect(await v.validate('not a url')).toBe(false);
    });
});

describe('respect/validation — Comparison Validators', () => {
    test('equals', async () => {
        const v = await php.Respect.Validation.Validator.equals('hello');
        expect(await v.validate('hello')).toBe(true);
        expect(await v.validate('world')).toBe(false);
    });

    test('min / max', async () => {
        const minV = await php.Respect.Validation.Validator.min(10);
        expect(await minV.validate(15)).toBe(true);
        expect(await minV.validate(5)).toBe(false);

        const maxV = await php.Respect.Validation.Validator.max(100);
        expect(await maxV.validate(50)).toBe(true);
        expect(await maxV.validate(150)).toBe(false);
    });

    test('in array of values', async () => {
        const v = await php.Respect.Validation.Validator.in(['red', 'green', 'blue']);
        expect(await v.validate('red')).toBe(true);
        expect(await v.validate('yellow')).toBe(false);
    });
});

describe('respect/validation — Special Validators', () => {
    test('not (negation)', async () => {
        const v = await php.Respect.Validation.Validator.not(
            await php.Respect.Validation.Validator.equals('forbidden')
        );
        expect(await v.validate('allowed')).toBe(true);
        expect(await v.validate('forbidden')).toBe(false);
    });

    test('each (validate array elements)', async () => {
        const v = await php.Respect.Validation.Validator.each(
            await php.Respect.Validation.Validator.intType()
        );
        expect(await v.validate([1, 2, 3])).toBe(true);
        expect(await v.validate([1, 'two', 3])).toBe(false);
    });

    test('optional (null or valid)', async () => {
        const v = await php.Respect.Validation.Validator.optional(
            await php.Respect.Validation.Validator.intType()
        );
        expect(await v.validate(42)).toBe(true);
        expect(await v.validate(null)).toBe(true);
    });
});