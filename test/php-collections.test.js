/**
 * Bridger Jest Tests — PHP Illuminate Collections
 *
 * Tests: creation, counting, querying, transformations, sorting,
 * plucking, chunking, flattening, zipping, and more
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

describe('Collections — Creation & Basics', () => {
    test('create and count', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        expect(await coll.count()).toBe(5);
    });

    test('all retrieves items', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3]);
        expect(await coll.all()).toEqual([1, 2, 3]);
    });

    test('toArray', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30]);
        expect(await coll.toArray()).toEqual([10, 20, 30]);
    });

    test('isEmpty / isNotEmpty', async () => {
        const empty = await php.Illuminate.Support.Collection.new([]);
        const notEmpty = await php.Illuminate.Support.Collection.new([1]);
        expect(await empty.isEmpty()).toBe(true);
        expect(await notEmpty.isNotEmpty()).toBe(true);
    });

    test('toJson', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3]);
        const json = await coll.toJson();
        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual([1, 2, 3]);
    });
});

describe('Collections — Access', () => {
    test('first', async () => {
        const coll = await php.Illuminate.Support.Collection.new(['a', 'b', 'c']);
        expect(await coll.first()).toBe('a');
    });

    test('last', async () => {
        const coll = await php.Illuminate.Support.Collection.new(['a', 'b', 'c']);
        expect(await coll.last()).toBe('c');
    });

    test('get by index', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30]);
        expect(await coll.get(1)).toBe(20);
    });

    test('get with default', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30]);
        expect(await coll.get(99, 'default')).toBe('default');
    });

    test('contains', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3]);
        expect(await coll.contains(2)).toBe(true);
        expect(await coll.contains(5)).toBe(false);
    });
});

describe('Collections — Aggregation', () => {
    test('sum', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30]);
        expect(await coll.sum()).toBe(60);
    });

    test('avg', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30]);
        expect(await coll.avg()).toBe(20);
    });

    test('min', async () => {
        const coll = await php.Illuminate.Support.Collection.new([5, 3, 8, 1, 9]);
        expect(await coll.min()).toBe(1);
    });

    test('max', async () => {
        const coll = await php.Illuminate.Support.Collection.new([5, 3, 8, 1, 9]);
        expect(await coll.max()).toBe(9);
    });

    test('count', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 1, 2, 3]);
        expect(await coll.count()).toBe(4);
    });

    test('median', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        expect(await coll.median()).toBe(3);
    });
});

describe('Collections — Transformations', () => {
    test('reverse and values', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const reversed = await coll.reverse();
        const vals = await reversed.values();
        expect(await vals.all()).toEqual([5, 4, 3, 2, 1]);
    });

    test('unique', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 2, 3, 3, 3]);
        const unique = await coll.unique();
        const vals = await unique.values();
        expect(await vals.all()).toEqual([1, 2, 3]);
    });

    test('sort and values', async () => {
        const coll = await php.Illuminate.Support.Collection.new([3, 1, 4, 1, 5]);
        const sorted = await coll.sort();
        const vals = await sorted.values();
        expect(await vals.all()).toEqual([1, 1, 3, 4, 5]);
    });

    test('flip', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            a: 1,
            b: 2,
            c: 3
        });
        const flipped = await coll.flip();
        const all = await flipped.all();
        expect(all['1']).toBe('a');
        expect(all['2']).toBe('b');
    });

    test('merge', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2]);
        const merged = await coll.merge([3, 4, 5]);
        expect(await merged.all()).toEqual([1, 2, 3, 4, 5]);
    });

    test('push', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3]);
        const pushed = await coll.push(4);
        expect(await pushed.count()).toBe(4);
    });

    test('prepend', async () => {
        const coll = await php.Illuminate.Support.Collection.new([2, 3, 4]);
        const prepended = await coll.prepend(1);
        const all = await prepended.all();
        expect(all[0]).toBe(1);
    });

    test('take', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const taken = await coll.take(3);
        expect(await taken.all()).toEqual([1, 2, 3]);
    });

    test('skip', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const skipped = await coll.skip(2);
        const vals = await skipped.values();
        expect(await vals.all()).toEqual([3, 4, 5]);
    });

    test('slice', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const sliced = await coll.slice(1, 3);
        const vals = await sliced.values();
        expect(await vals.all()).toEqual([2, 3, 4]);
    });

    test('pad', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2]);
        const padded = await coll.pad(5, 0);
        expect(await padded.all()).toEqual([1, 2, 0, 0, 0]);
    });

    test('implode', async () => {
        const coll = await php.Illuminate.Support.Collection.new(['a', 'b', 'c']);
        expect(await coll.implode(',')).toBe('a,b,c');
    });

    test('join (alias for implode)', async () => {
        const coll = await php.Illuminate.Support.Collection.new(['x', 'y', 'z']);
        expect(await coll.join('-')).toBe('x-y-z');
    });
});

describe('Collections — Structural', () => {
    test('chunk', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5, 6]);
        const chunks = await coll.chunk(2);
        expect(await chunks.count()).toBe(3);
    });

    test('flatten', async () => {
        const coll = await php.Illuminate.Support.Collection.new([
            [1, 2],
            [3, 4],
            [5]
        ]);
        const flat = await coll.flatten();
        expect(await flat.all()).toEqual([1, 2, 3, 4, 5]);
    });

    test('zip', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3]);
        const zipped = await coll.zip(['a', 'b', 'c']);
        expect(await zipped.count()).toBe(3);
    });

    test('pluck with assoc data', async () => {
        const coll = await php.Illuminate.Support.Collection.new([{
                name: 'Alice',
                age: 25
            },
            {
                name: 'Bob',
                age: 30
            },
        ]);
        const names = await coll.pluck('name');
        expect(await names.all()).toEqual(['Alice', 'Bob']);
    });

    test('collapse nested arrays', async () => {
        const coll = await php.Illuminate.Support.Collection.new([
            [1, 2],
            [3, 4],
            [5]
        ]);
        const collapsed = await coll.collapse();
        expect(await collapsed.all()).toEqual([1, 2, 3, 4, 5]);
    });

    test('combine keys and values', async () => {
        const keys = await php.Illuminate.Support.Collection.new(['a', 'b', 'c']);
        const combined = await keys.combine([1, 2, 3]);
        const all = await combined.all();
        expect(all.a).toBe(1);
        expect(all.b).toBe(2);
        expect(all.c).toBe(3);
    });
});

describe('Collections — Searching', () => {
    test('search', async () => {
        const coll = await php.Illuminate.Support.Collection.new([10, 20, 30, 40]);
        expect(await coll.search(30)).toBe(2);
    });

    test('has (key existence)', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            name: 'Alice',
            age: 25
        });
        expect(await coll.has('name')).toBe(true);
        expect(await coll.has('email')).toBe(false);
    });

    test('countBy grouping values', async () => {
        const coll = await php.Illuminate.Support.Collection.new(['a', 'b', 'a', 'c', 'b', 'a']);
        const counts = await coll.countBy();
        const all = await counts.all();
        expect(all.a).toBe(3);
        expect(all.b).toBe(2);
        expect(all.c).toBe(1);
    });
});

describe('Collections — Misc', () => {
    test('keys', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            a: 1,
            b: 2,
            c: 3
        });
        const keys = await coll.keys();
        expect(await keys.all()).toEqual(['a', 'b', 'c']);
    });

    test('values reindexes', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            a: 1,
            b: 2,
            c: 3
        });
        const vals = await coll.values();
        expect(await vals.all()).toEqual([1, 2, 3]);
    });

    test('only specific keys', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            a: 1,
            b: 2,
            c: 3,
            d: 4
        });
        const only = await coll.only(['a', 'c']);
        const all = await only.all();
        expect(all.a).toBe(1);
        expect(all.c).toBe(3);
    });

    test('except specific keys', async () => {
        const coll = await php.Illuminate.Support.Collection.new({
            a: 1,
            b: 2,
            c: 3
        });
        const except = await coll.except(['b']);
        const all = await except.all();
        expect(all.a).toBe(1);
        expect(all.c).toBe(3);
        expect(all.b).toBeUndefined();
    });

    test('random returns element', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const rand = await coll.random();
        expect([1, 2, 3, 4, 5]).toContain(rand);
    });

    test('nth every 2nd element', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5, 6]);
        const nth = await coll.nth(2);
        expect(await nth.all()).toEqual([1, 3, 5]);
    });

    test('pipe value through function string', async () => {
        const coll = await php.Illuminate.Support.Collection.new([1, 2, 3, 4, 5]);
        const sum = await coll.sum();
        expect(sum).toBe(15);
    });
});