/**
 * Bridger Jest Tests — NumPy (Mathematics & Scientific Computing)
 *
 * Tests: array creation, arithmetic, linalg, fft, random, sorting, reshaping,
 * broadcasting, boolean indexing, dtypes, stacking, clipping, unique, argmax/min
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let np;
beforeAll(async () => {
    np = await bridge('python:numpy');
});

describe('NumPy — Array Creation', () => {
    test('array from list', async () => {
        const arr = await np.array([1, 2, 3, 4, 5]);
        const list = await arr.tolist();
        expect(list).toEqual([1, 2, 3, 4, 5]);
    });

    test('zeros', async () => {
        const z = await np.zeros([2, 3]);
        const list = await z.tolist();
        expect(list).toEqual([
            [0, 0, 0],
            [0, 0, 0]
        ]);
    });

    test('ones', async () => {
        const o = await np.ones([3]);
        const list = await o.tolist();
        expect(list).toEqual([1, 1, 1]);
    });

    test('arange', async () => {
        const a = await np.arange(5);
        const list = await a.tolist();
        expect(list).toEqual([0, 1, 2, 3, 4]);
    });

    test('linspace', async () => {
        const l = await np.linspace(0, 1, 5);
        const list = await l.tolist();
        expect(list).toHaveLength(5);
        approxEq(list[0], 0);
        approxEq(list[4], 1);
    });

    test('eye (identity matrix)', async () => {
        const e = await np.eye(3);
        const list = await e.tolist();
        expect(list).toEqual([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]);
    });

    test('full', async () => {
        const f = await np.full([2, 2], 7);
        const list = await f.tolist();
        expect(list).toEqual([
            [7, 7],
            [7, 7]
        ]);
    });

    test('empty_like shape matches', async () => {
        const a = await np.array([
            [1, 2],
            [3, 4]
        ]);
        const e = await np.empty_like(a);
        const shape = await e.shape.$value();
        expect(shape).toEqual([2, 2]);
    });
});

describe('NumPy — Arithmetic & Broadcasting', () => {
    test('array + scalar', async () => {
        const a = await np.array([1, 2, 3]);
        const r = await a.$op('add', 10);
        expect(await r.tolist()).toEqual([11, 12, 13]);
    });

    test('array * scalar', async () => {
        const a = await np.array([2, 4, 6]);
        const r = await a.$op('mul', 3);
        expect(await r.tolist()).toEqual([6, 12, 18]);
    });

    test('array ** 2', async () => {
        const a = await np.array([1, 2, 3, 4]);
        const r = await a.$op('pow', 2);
        expect(await r.tolist()).toEqual([1, 4, 9, 16]);
    });

    test('element-wise add two arrays', async () => {
        const a = await np.array([1, 2, 3]);
        const b = await np.array([10, 20, 30]);
        const r = await np.add(a, b);
        expect(await r.tolist()).toEqual([11, 22, 33]);
    });

    test('dot product', async () => {
        const r = await np.dot([1, 2, 3], [4, 5, 6]);
        expect(r).toBe(32);
    });

    test('matmul', async () => {
        const a = await np.array([
            [1, 2],
            [3, 4]
        ]);
        const b = await np.array([
            [5, 6],
            [7, 8]
        ]);
        const r = await np.matmul(a, b);
        expect(await r.tolist()).toEqual([
            [19, 22],
            [43, 50]
        ]);
    });
});

describe('NumPy — Shape & Reshape', () => {
    test('reshape 1D → 2D', async () => {
        const a = await np.arange(12);
        const r = await a.reshape([3, 4]);
        expect(await r.shape.$value()).toEqual([3, 4]);
    });

    test('transpose', async () => {
        const a = await np.array([
            [1, 2, 3],
            [4, 5, 6]
        ]);
        const t = await a.T;
        expect(await t.shape.$value()).toEqual([3, 2]);
    });

    test('flatten', async () => {
        const a = await np.array([
            [1, 2],
            [3, 4]
        ]);
        const f = await a.flatten();
        expect(await f.tolist()).toEqual([1, 2, 3, 4]);
    });

    test('squeeze removes size-1 dims', async () => {
        const a = await np.array([
            [
                [1, 2, 3]
            ]
        ]);
        const s = await a.squeeze();
        expect(await s.shape.$value()).toEqual([3]);
    });
});

describe('NumPy — Indexing & Slicing', () => {
    test('$getitem single element', async () => {
        const a = await np.array([10, 20, 30, 40]);
        expect(await a.$getitem(2)).toBe(30);
    });

    test('boolean indexing', async () => {
        const a = await np.array([1, 2, 3, 4, 5, 6]);
        const mask = await a.$op('gt', 3);
        const filtered = await a.$getitem(mask);
        expect(await filtered.tolist()).toEqual([4, 5, 6]);
    });

    test('$setitem', async () => {
        const a = await np.array([1, 2, 3]);
        await a.$setitem(1, 99);
        expect(await a.tolist()).toEqual([1, 99, 3]);
    });
});

describe('NumPy — Linear Algebra', () => {
    test('linalg.det', async () => {
        const m = await np.array([
            [1, 2],
            [3, 4]
        ]);
        const d = await np.linalg.det(m);
        approxEq(d, -2);
    });

    test('linalg.inv', async () => {
        const m = await np.array([
            [1, 2],
            [3, 4]
        ]);
        const inv = await np.linalg.inv(m);
        const prod = await np.matmul(m, inv);
        const list = await prod.tolist();
        approxEq(list[0][0], 1, 0.001);
        approxEq(list[1][1], 1, 0.001);
    });

    test('linalg.eig eigenvalues', async () => {
        const m = await np.array([
            [2, 1],
            [1, 2]
        ]);
        const result = await np.linalg.eig(m);
        const eigenvalues = await result.$getitem(0);
        const vals = await eigenvalues.tolist();
        approxEq(vals[0], 3);
        approxEq(vals[1], 1);
    });

    test('linalg.norm', async () => {
        const v = await np.array([3, 4]);
        const n = await np.linalg.norm(v);
        approxEq(n, 5);
    });

    test('linalg.solve (Ax = b)', async () => {
        const A = await np.array([
            [3, 1],
            [1, 2]
        ]);
        const b = await np.array([9, 8]);
        const x = await np.linalg.solve(A, b);
        const list = await x.tolist();
        approxEq(list[0], 2);
        approxEq(list[1], 3);
    });
});

describe('NumPy — Statistics & Aggregation', () => {
    test('sum', async () => {
        const a = await np.array([1, 2, 3, 4, 5]);
        expect(await np.sum(a)).toBe(15);
    });

    test('mean', async () => {
        expect(await np.mean([10, 20, 30])).toBe(20);
    });

    test('std', async () => {
        const s = await np.std([2, 4, 4, 4, 5, 5, 7, 9]);
        approxEq(s, 2.0);
    });

    test('min / max', async () => {
        const a = await np.array([3, 1, 4, 1, 5, 9]);
        expect(await np.min(a)).toBe(1);
        expect(await np.max(a)).toBe(9);
    });

    test('argmax / argmin', async () => {
        const a = await np.array([3, 1, 4, 1, 5, 9]);
        expect(await np.argmax(a)).toBe(5);
        expect(await np.argmin(a)).toBe(1);
    });

    test('cumsum', async () => {
        const a = await np.array([1, 2, 3, 4]);
        const cs = await np.cumsum(a);
        expect(await cs.tolist()).toEqual([1, 3, 6, 10]);
    });
});

describe('NumPy — Sorting & Searching', () => {
    test('sort', async () => {
        const a = await np.array([3, 1, 4, 1, 5, 9, 2, 6]);
        const s = await np.sort(a);
        expect(await s.tolist()).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });

    test('unique', async () => {
        const a = await np.array([1, 2, 2, 3, 3, 3]);
        const u = await np.unique(a);
        expect(await u.tolist()).toEqual([1, 2, 3]);
    });

    test('where (conditional)', async () => {
        const a = await np.array([1, -2, 3, -4, 5]);
        const pos = await a.$op('gt', 0);
        const r = await np.where(pos, a, 0);
        expect(await r.tolist()).toEqual([1, 0, 3, 0, 5]);
    });

    test('clip', async () => {
        const a = await np.array([1, 5, 10, 15, 20]);
        const c = await np.clip(a, 5, 15);
        expect(await c.tolist()).toEqual([5, 5, 10, 15, 15]);
    });
});

describe('NumPy — Stacking & Concatenation', () => {
    test('concatenate', async () => {
        const a = await np.array([1, 2]);
        const b = await np.array([3, 4]);
        const r = await np.concatenate([a, b]);
        expect(await r.tolist()).toEqual([1, 2, 3, 4]);
    });

    test('stack', async () => {
        const a = await np.array([1, 2, 3]);
        const b = await np.array([4, 5, 6]);
        const s = await np.stack([a, b]);
        expect(await s.shape.$value()).toEqual([2, 3]);
    });

    test('hstack', async () => {
        const a = await np.array([1, 2]);
        const b = await np.array([3, 4]);
        const r = await np.hstack([a, b]);
        expect(await r.tolist()).toEqual([1, 2, 3, 4]);
    });

    test('vstack', async () => {
        const a = await np.array([1, 2]);
        const b = await np.array([3, 4]);
        const r = await np.vstack([a, b]);
        expect(await r.tolist()).toEqual([
            [1, 2],
            [3, 4]
        ]);
    });
});

describe('NumPy — Random', () => {
    test('random.choice', async () => {
        const r = await np.random.choice([10, 20, 30, 40, 50], 3);
        const list = await r.tolist();
        expect(list).toHaveLength(3);
        list.forEach(v => expect([10, 20, 30, 40, 50]).toContain(v));
    });

    test('random.randint', async () => {
        const v = await np.random.randint(0, 100);
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(100);
    });

    test('random.normal returns array', async () => {
        const r = await np.random.normal(0, 1, 100);
        const shape = await r.shape.$value();
        expect(shape).toEqual([100]);
    });
});

describe('NumPy — Type & Dtype', () => {
    test('astype float32', async () => {
        const a = await np.array([1.5, 2.5, 3.5]);
        const f32 = await a.astype('float32');
        const dtype = await f32.dtype.$value();
        expect(dtype).toBe('float32');
    });

    test('ndim / size', async () => {
        const a = await np.array([
            [1, 2, 3],
            [4, 5, 6]
        ]);
        const ndim = await a.ndim.$value();
        const size = await a.size.$value();
        expect(ndim).toBe(2);
        expect(size).toBe(6);
    });
});