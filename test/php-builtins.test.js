/**
 * Bridger Jest Tests — PHP Built-in Functions
 *
 * Tests: arrays, strings, math, date, json, regex, sprintf, sorting, etc.
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

describe('PHP Array Functions', () => {
    test('array_merge', async () => {
        const result = await php.array_merge([1, 2, 3], [4, 5, 6]);
        expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('array_reverse', async () => {
        const result = await php.array_reverse([1, 2, 3, 4, 5]);
        expect(result).toEqual([5, 4, 3, 2, 1]);
    });

    test('array_unique', async () => {
        const result = await php.array_unique([1, 2, 2, 3, 3, 3, 4]);
        const values = Object.values(result);
        expect(values.sort()).toEqual([1, 2, 3, 4]);
    });

    test('array_slice', async () => {
        const result = await php.array_slice([10, 20, 30, 40, 50], 1, 3);
        expect(result).toEqual([20, 30, 40]);
    });

    test('array_combine', async () => {
        const result = await php.array_combine(['a', 'b', 'c'], [1, 2, 3]);
        expect(result).toEqual({
            a: 1,
            b: 2,
            c: 3
        });
    });

    test('array_key_exists', async () => {
        const result = await php.array_key_exists('name', {
            name: 'test',
            age: 20
        });
        expect(result).toBe(true);
    });

    test('in_array', async () => {
        expect(await php.in_array(3, [1, 2, 3, 4])).toBe(true);
        expect(await php.in_array(9, [1, 2, 3, 4])).toBe(false);
    });

    test('range', async () => {
        const result = await php.range(1, 5);
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    test('array_map with strtoupper callback', async () => {
        const result = await php.array_map('strtoupper', ['hello', 'world']);
        expect(result).toEqual(['HELLO', 'WORLD']);
    });

    test('array_filter removes falsy', async () => {
        const result = await php.array_filter([0, 1, '', 'hello', null, 42, false]);
        const values = Object.values(result);
        expect(values).toEqual([1, 'hello', 42]);
    });

    test('array_pop / array_push via count', async () => {
        const arr = [1, 2, 3, 4, 5];
        expect(await php.count(arr)).toBe(5);
        const sliced = await php.array_slice(arr, 0, -1);
        expect(sliced).toEqual([1, 2, 3, 4]);
    });

    test('array_search', async () => {
        const result = await php.array_search('b', ['a', 'b', 'c']);
        expect(result).toBe(1);
    });

    test('array_flip', async () => {
        const result = await php.array_flip({
            a: 1,
            b: 2,
            c: 3
        });
        expect(result['1']).toBe('a');
        expect(result['2']).toBe('b');
    });

    test('array_keys / array_values', async () => {
        const obj = {
            name: 'Alice',
            age: 30
        };
        const keys = await php.array_keys(obj);
        const values = await php.array_values(obj);
        expect(keys).toEqual(['name', 'age']);
        expect(values).toEqual(['Alice', 30]);
    });

    test('array_chunk', async () => {
        const result = await php.array_chunk([1, 2, 3, 4, 5], 2);
        expect(result).toEqual([
            [1, 2],
            [3, 4],
            [5]
        ]);
    });

    test('array_diff', async () => {
        const result = await php.array_diff([1, 2, 3, 4, 5], [2, 4]);
        const values = Object.values(result);
        expect(values.sort()).toEqual([1, 3, 5]);
    });

    test('array_intersect', async () => {
        const result = await php.array_intersect([1, 2, 3, 4], [2, 4, 6]);
        const values = Object.values(result);
        expect(values.sort()).toEqual([2, 4]);
    });

    test('array_sum', async () => {
        expect(await php.array_sum([1, 2, 3, 4, 5])).toBe(15);
    });

    test('array_product', async () => {
        expect(await php.array_product([1, 2, 3, 4])).toBe(24);
    });

    test('array_fill', async () => {
        const result = await php.array_fill(0, 3, 'x');
        expect(result).toEqual(['x', 'x', 'x']);
    });

    test('array_pad', async () => {
        const result = await php.array_pad([1, 2], 5, 0);
        expect(result).toEqual([1, 2, 0, 0, 0]);
    });

    test('array_splice equivalent via slice + merge', async () => {
        const arr = [1, 2, 3, 4, 5];
        const head = await php.array_slice(arr, 0, 2);
        const tail = await php.array_slice(arr, 3);
        const result = await php.array_merge(head, [99], tail);
        expect(result).toEqual([1, 2, 99, 4, 5]);
    });
});

describe('PHP String Functions', () => {
    test('strtoupper / strtolower', async () => {
        expect(await php.strtoupper('hello world')).toBe('HELLO WORLD');
        expect(await php.strtolower('HELLO WORLD')).toBe('hello world');
    });

    test('str_replace', async () => {
        const result = await php.str_replace('world', 'Bridger', 'Hello world!');
        expect(result).toBe('Hello Bridger!');
    });

    test('explode / implode', async () => {
        expect(await php.explode(',', 'a,b,c,d')).toEqual(['a', 'b', 'c', 'd']);
        expect(await php.implode('-', ['x', 'y', 'z'])).toBe('x-y-z');
    });

    test('substr', async () => {
        expect(await php.substr('Hello World', 6, 5)).toBe('World');
    });

    test('strlen', async () => {
        expect(await php.strlen('Hello')).toBe(5);
    });

    test('strpos', async () => {
        expect(await php.strpos('Hello World', 'World')).toBe(6);
    });

    test('str_pad left and right', async () => {
        expect(await php.str_pad('42', 5, '0', 0)).toBe('00042'); // STR_PAD_LEFT=0
        expect(await php.str_pad('42', 5, '-')).toBe('42---'); // STR_PAD_RIGHT default
    });

    test('trim / ltrim / rtrim', async () => {
        expect(await php.trim('  hello  ')).toBe('hello');
        expect(await php.ltrim('  hello')).toBe('hello');
        expect(await php.rtrim('hello  ')).toBe('hello');
    });

    test('ucfirst / lcfirst', async () => {
        expect(await php.ucfirst('hello')).toBe('Hello');
        expect(await php.lcfirst('Hello')).toBe('hello');
    });

    test('str_repeat', async () => {
        expect(await php.str_repeat('ab', 3)).toBe('ababab');
    });

    test('str_word_count', async () => {
        expect(await php.str_word_count('Hello beautiful world')).toBe(3);
    });

    test('str_contains (PHP 8+)', async () => {
        expect(await php.str_contains('Hello World', 'World')).toBe(true);
        expect(await php.str_contains('Hello World', 'xyz')).toBe(false);
    });

    test('str_starts_with / str_ends_with (PHP 8+)', async () => {
        expect(await php.str_starts_with('Hello World', 'Hello')).toBe(true);
        expect(await php.str_ends_with('Hello World', 'World')).toBe(true);
    });

    test('md5 / sha1', async () => {
        const md5 = await php.md5('hello');
        expect(md5).toHaveLength(32);
        const sha1 = await php.sha1('hello');
        expect(sha1).toHaveLength(40);
    });

    test('base64_encode / base64_decode', async () => {
        const encoded = await php.base64_encode('Hello Bridger');
        expect(typeof encoded).toBe('string');
        const decoded = await php.base64_decode(encoded);
        expect(decoded).toBe('Hello Bridger');
    });

    test('wordwrap', async () => {
        const result = await php.wordwrap('The quick brown fox jumped over the lazy dog', 15, '\n', true);
        expect(result).toContain('\n');
    });

    test('nl2br', async () => {
        const result = await php.nl2br("Hello\nWorld");
        expect(result).toContain('<br');
    });
});

describe('PHP Math Functions', () => {
    test('abs / ceil / floor / round', async () => {
        expect(await php.abs(-42)).toBe(42);
        expect(await php.ceil(4.1)).toBe(5);
        expect(await php.floor(4.9)).toBe(4);
        expect(await php.round(4.556, 2)).toBe(4.56);
    });

    test('max / min', async () => {
        expect(await php.max(1, 5, 3, 9, 2)).toBe(9);
        expect(await php.min(1, 5, 3, 9, 2)).toBe(1);
    });

    test('pow / sqrt', async () => {
        expect(await php.pow(2, 10)).toBe(1024);
        expect(await php.sqrt(144)).toBe(12);
    });

    test('pi / M_PI constant via pi()', async () => {
        const piVal = await php.pi();
        expect(Math.abs(piVal - 3.14159265)).toBeLessThan(0.001);
    });

    test('log / log10', async () => {
        expect(Math.abs(await php.log(Math.E) - 1)).toBeLessThan(0.001);
        expect(Math.abs(await php.log10(100) - 2)).toBeLessThan(0.001);
    });

    test('fmod', async () => {
        expect(await php.fmod(10.5, 3)).toBeCloseTo(1.5);
    });

    test('intdiv', async () => {
        expect(await php.intdiv(10, 3)).toBe(3);
    });

    test('number_format', async () => {
        expect(await php.number_format(1234567.891, 2, '.', ',')).toBe('1,234,567.89');
    });

    test('rand between bounds', async () => {
        const val = await php.rand(1, 100);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(100);
    });
});

describe('PHP JSON Functions', () => {
    test('json_encode / json_decode', async () => {
        const encoded = await php.json_encode({
            name: 'Bridger',
            version: 2
        });
        expect(typeof encoded).toBe('string');
        const decoded = await php.json_decode(encoded, true);
        expect(decoded.name).toBe('Bridger');
        expect(decoded.version).toBe(2);
    });

    test('json_encode array', async () => {
        const encoded = await php.json_encode([1, 2, 3]);
        expect(encoded).toBe('[1,2,3]');
    });

    test('json_encode nested', async () => {
        const data = {
            users: [{
                name: 'Alice'
            }, {
                name: 'Bob'
            }]
        };
        const encoded = await php.json_encode(data);
        const decoded = await php.json_decode(encoded, true);
        expect(decoded.users).toHaveLength(2);
        expect(decoded.users[0].name).toBe('Alice');
    });
});

describe('PHP Regex (preg) Functions', () => {
    test('preg_match', async () => {
        const result = await php.preg_match('/\\d+/', 'abc123def');
        expect(result).toBe(1);
    });

    test('preg_replace', async () => {
        const result = await php.preg_replace('/\\d+/', '#', 'abc123def456');
        expect(result).toBe('abc#def#');
    });

    test('preg_split', async () => {
        const result = await php.preg_split('/[\\s,]+/', 'one, two, three four');
        expect(result).toEqual(['one', 'two', 'three', 'four']);
    });
});

describe('PHP Date Functions', () => {
    test('date formatting current year', async () => {
        const year = await php.date('Y');
        expect(Number(year)).toBeGreaterThanOrEqual(2024);
    });

    test('date with timestamp', async () => {
        const result = await php.date('Y-m-d', 0);
        expect(result).toBe('1970-01-01');
    });

    test('time returns timestamp', async () => {
        const ts = await php.time();
        expect(typeof ts).toBe('number');
        expect(ts).toBeGreaterThan(1700000000);
    });

    test('mktime', async () => {
        const ts = await php.mktime(0, 0, 0, 1, 1, 2024);
        expect(typeof ts).toBe('number');
    });
});

describe('PHP sprintf', () => {
    test('sprintf basic', async () => {
        const result = await php.sprintf('Hello %s, you are %d years old', 'World', 25);
        expect(result).toBe('Hello World, you are 25 years old');
    });

    test('sprintf with float', async () => {
        const result = await php.sprintf('Pi is %.4f', 3.14159);
        expect(result).toBe('Pi is 3.1416');
    });

    test('sprintf padding', async () => {
        const result = await php.sprintf('%05d', 42);
        expect(result).toBe('00042');
    });
});

describe('PHP Type Functions', () => {
    test('is_string / is_int / is_array / is_null', async () => {
        expect(await php.is_string('hello')).toBe(true);
        expect(await php.is_int(42)).toBe(true);
        expect(await php.is_array([1, 2])).toBe(true);
        expect(await php.is_null(null)).toBe(true);
    });

    test('gettype', async () => {
        expect(await php.gettype('hello')).toBe('string');
        expect(await php.gettype(42)).toBe('integer');
        expect(await php.gettype(3.14)).toBe('double');
    });

    test('intval / floatval / strval', async () => {
        expect(await php.intval('42')).toBe(42);
        expect(await php.floatval('3.14')).toBeCloseTo(3.14);
        expect(await php.strval(42)).toBe('42');
    });
});