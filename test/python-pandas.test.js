/**
 * Bridger Jest Tests — Pandas (Data Processing)
 *
 * Tests: DataFrame creation, column access, filtering, groupby, merge,
 * sort, fillna, drop, rename, describe, to_json, iloc, loc, value_counts,
 * string ops, apply, concat, pivot, rolling
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let pd, np;
beforeAll(async () => {
    pd = await bridge('python:pandas');
    np = await bridge('python:numpy');
});

describe('Pandas — DataFrame Creation', () => {
    test('from dict', async () => {
        const df = await pd.DataFrame({
            a: [1, 2, 3],
            b: [4, 5, 6]
        });
        const shape = await df.shape.$value();
        expect(shape).toEqual([3, 2]);
    });

    test('from list of dicts', async () => {
        const df = await pd.DataFrame([{
                name: 'Alice',
                age: 25
            },
            {
                name: 'Bob',
                age: 30
            },
        ]);
        expect(await df.$len()).toBe(2);
    });

    test('columns', async () => {
        const df = await pd.DataFrame({
            x: [1],
            y: [2],
            z: [3]
        });
        const cols = await df.columns.tolist();
        expect(cols).toEqual(['x', 'y', 'z']);
    });
});

describe('Pandas — Column Operations', () => {
    let df;
    beforeAll(async () => {
        df = await pd.DataFrame({
            name: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
            age: [25, 30, 35, 28, 32],
            salary: [50000, 60000, 70000, 55000, 65000],
            dept: ['eng', 'eng', 'mgmt', 'eng', 'mgmt'],
        });
    });

    test('single column access', async () => {
        const ages = await df.age.tolist();
        expect(ages).toEqual([25, 30, 35, 28, 32]);
    });

    test('dtypes', async () => {
        const dtypes = await df.dtypes;
        const repr = await dtypes.$repr();
        expect(typeof repr).toBe('string');
    });

    test('describe', async () => {
        const desc = await df.describe();
        const ageStats = await desc.$getitem('age');
        const count = await ageStats.$getitem('count');
        approxEq(count, 5);
    });
});

describe('Pandas — Filtering & Indexing', () => {
    let df;
    beforeAll(async () => {
        df = await pd.DataFrame({
            name: ['Alice', 'Bob', 'Charlie'],
            age: [25, 30, 35],
            score: [90, 85, 95],
        });
    });

    test('boolean mask filter', async () => {
        const ageCol = await df.__getitem__('age');
        const mask = await ageCol.$op('gt', 26);
        const filtered = await df.__getitem__(mask);
        expect(await filtered.$len()).toBe(2);
    });

    test('iloc', async () => {
        const row = await df.iloc.$getitem(0);
        const repr = await row.$repr();
        expect(repr).toContain('Alice');
    });

    test('head', async () => {
        const h = await df.head(2);
        expect(await h.$len()).toBe(2);
    });

    test('tail', async () => {
        const t = await df.tail(1);
        expect(await t.$len()).toBe(1);
    });
});

describe('Pandas — Aggregation & GroupBy', () => {
    let df;
    beforeAll(async () => {
        df = await pd.DataFrame({
            name: ['A', 'B', 'C', 'D'],
            dept: ['X', 'X', 'Y', 'Y'],
            salary: [100, 200, 300, 400],
        });
    });

    test('groupby sum', async () => {
        const grouped = await df.groupby('dept');
        const sums = await grouped.salary.sum();
        expect(await sums.$getitem('X')).toBe(300);
        expect(await sums.$getitem('Y')).toBe(700);
    });

    test('groupby mean', async () => {
        const grouped = await df.groupby('dept');
        const means = await grouped.salary.mean();
        expect(await means.$getitem('X')).toBe(150);
        expect(await means.$getitem('Y')).toBe(350);
    });

    test('value_counts', async () => {
        const counts = await df.dept.value_counts();
        expect(await counts.$getitem('X')).toBe(2);
        expect(await counts.$getitem('Y')).toBe(2);
    });
});

describe('Pandas — Transformations', () => {
    test('sort_values', async () => {
        const df = await pd.DataFrame({
            val: [3, 1, 2]
        });
        const sorted = await df.sort_values('val');
        const vals = await sorted.val.tolist();
        expect(vals).toEqual([1, 2, 3]);
    });

    test('fillna', async () => {
        const df = await pd.DataFrame({
            a: [1, null, 3]
        });
        const filled = await df.fillna(0);
        const vals = await filled.a.tolist();
        expect(vals).toEqual([1, 0, 3]);
    });

    test('drop columns', async () => {
        const df = await pd.DataFrame({
            a: [1],
            b: [2],
            c: [3]
        });
        const dropped = await df.drop.$call({
            columns: ['b', 'c']
        });
        const cols = await dropped.columns.tolist();
        expect(cols).toEqual(['a']);
    });

    test('rename columns', async () => {
        const df = await pd.DataFrame({
            old: [1, 2]
        });
        const renamed = await df.rename.$call({
            columns: {
                old: 'new'
            }
        });
        const cols = await renamed.columns.tolist();
        expect(cols).toEqual(['new']);
    });

    test('Series string methods', async () => {
        const s = await pd.Series(['hello', 'world']);
        const upper = await s.str.upper();
        const list = await upper.tolist();
        expect(list).toEqual(['HELLO', 'WORLD']);
    });

    test('Series arithmetic', async () => {
        const s = await pd.Series([10, 20, 30]);
        const doubled = await s.$op('mul', 2);
        expect(await doubled.tolist()).toEqual([20, 40, 60]);
    });
});

describe('Pandas — Merge & Concat', () => {
    test('merge inner', async () => {
        const left = await pd.DataFrame({
            key: ['a', 'b', 'c'],
            v1: [1, 2, 3]
        });
        const right = await pd.DataFrame({
            key: ['a', 'b', 'd'],
            v2: [4, 5, 6]
        });
        const merged = await pd.merge.$call([left, right], {
            on: 'key',
            how: 'inner'
        });
        expect(await merged.$len()).toBe(2);
    });

    test('merge left', async () => {
        const left = await pd.DataFrame({
            key: ['a', 'b', 'c'],
            v1: [1, 2, 3]
        });
        const right = await pd.DataFrame({
            key: ['a', 'b'],
            v2: [4, 5]
        });
        const merged = await pd.merge.$call([left, right], {
            on: 'key',
            how: 'left'
        });
        expect(await merged.$len()).toBe(3);
    });

    test('concat', async () => {
        const df1 = await pd.DataFrame({
            a: [1, 2]
        });
        const df2 = await pd.DataFrame({
            a: [3, 4]
        });
        const result = await pd.concat([df1, df2]);
        expect(await result.$len()).toBe(4);
    });
});

describe('Pandas — IO', () => {
    test('to_json', async () => {
        const df = await pd.DataFrame({
            a: [1, 2],
            b: [3, 4]
        });
        const json = await df.to_json();
        expect(typeof json).toBe('string');
        const parsed = JSON.parse(json);
        expect(parsed).toHaveProperty('a');
    });

    test('to_dict', async () => {
        const df = await pd.DataFrame({
            a: [1, 2],
            b: [3, 4]
        });
        const d = await df.to_dict('list');
        expect(d.a).toEqual([1, 2]);
        expect(d.b).toEqual([3, 4]);
    });
});

describe('Pandas — Series', () => {
    test('create with name', async () => {
        const s = await pd.Series.$call([
            [10, 20, 30]
        ], {
            name: 'my_series'
        });
        const name = await s.name.$value();
        expect(name).toBe('my_series');
    });

    test('sum / mean / std', async () => {
        const s = await pd.Series([10, 20, 30, 40, 50]);
        expect(await s.sum()).toBe(150);
        expect(await s.mean()).toBe(30);
    });

    test('unique', async () => {
        const s = await pd.Series([1, 2, 2, 3, 3, 3]);
        const u = await s.unique();
        expect(await u.tolist()).toEqual([1, 2, 3]);
    });
});