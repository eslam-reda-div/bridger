/**
 * Bridger Jest Tests — Python Utilities (dateutil, pydantic, toolz, lark-parser)
 *
 * Tests: date parsing, relativedelta, validation, functional utilities,
 * grammar parsing
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

describe('dateutil — Date Parsing & Utilities', () => {
    test('parser.parse ISO date', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('dateutil.parser', fromlist=['parse']).parse('2024-12-25T10:30:00').strftime('%Y-%m-%d %H:%M')"
        );
        expect(result).toBe('2024-12-25 10:30');
    });

    test('parser.parse natural date', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('dateutil.parser', fromlist=['parse']).parse('December 25, 2024').strftime('%Y-%m-%d')"
        );
        expect(result).toBe('2024-12-25');
    });

    test('relativedelta add months', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "(__import__('datetime').date(2024, 1, 31) + __import__('dateutil.relativedelta', fromlist=['relativedelta']).relativedelta(months=1)).isoformat()"
        );
        expect(result).toBe('2024-02-29'); // 2024 is leap year
    });

    test('relativedelta add years', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "(__import__('datetime').date(2024, 3, 1) + __import__('dateutil.relativedelta', fromlist=['relativedelta']).relativedelta(years=2)).isoformat()"
        );
        expect(result).toBe('2026-03-01');
    });

    test('rrule — recurring dates', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
list(str(d.date()) for d in __import__('dateutil.rrule', fromlist=['rrule','WEEKLY']).rrule(
    __import__('dateutil.rrule', fromlist=['WEEKLY']).WEEKLY,
    count=4,
    dtstart=__import__('datetime').datetime(2024, 1, 1)
))
`);
        expect(result).toHaveLength(4);
        expect(result[0]).toBe('2024-01-01');
    });
});

describe('pydantic — Data Validation', () => {
    test('BaseModel validation succeeds', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  type('User', (__import__('pydantic').BaseModel,), {
    '__annotations__': {'name': str, 'age': int}
  }),
  setattr(__import__('builtins'), '_User',
    type('User', (__import__('pydantic').BaseModel,), {
      '__annotations__': {'name': str, 'age': int}
    })),
  __import__('builtins')._User(name='Alice', age=30).model_dump()
)[-1])()
`);
        expect(result.name).toBe('Alice');
        expect(result.age).toBe(30);
    });

    test('BaseModel validation type coercion', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_M',
    type('M', (__import__('pydantic').BaseModel,), {
      '__annotations__': {'value': int}
    })),
  __import__('builtins')._M(value='42').model_dump()
)[-1])()
`);
        expect(result.value).toBe(42);
    });

    test('BaseModel validation fails on bad type', async () => {
        const builtins = await bridge('python:builtins');
        await expect(async () => {
            await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_M',
    type('M', (__import__('pydantic').BaseModel,), {
      '__annotations__': {'value': int}
    })),
  __import__('builtins')._M(value='not_a_number')
))()
`);
        }).rejects.toThrow();
    });
});

describe('toolz — Functional Utilities', () => {
    let toolz;
    beforeAll(async () => {
        toolz = await bridge('python:toolz');
    });

    test('pipe (function composition)', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('toolz').pipe(10, lambda x: x * 2, lambda x: x + 5)"
        );
        expect(result).toBe(25); // (10 * 2) + 5
    });

    test('partition into chunks', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "list(__import__('toolz').partition(3, [1,2,3,4,5,6,7,8,9]))"
        );
        expect(result).toEqual([
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]);
    });

    test('groupby', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "dict(__import__('toolz').groupby(lambda x: x % 2, [1,2,3,4,5,6]))"
        );
        expect(result[0]).toEqual([2, 4, 6]);
        expect(result[1]).toEqual([1, 3, 5]);
    });

    test('merge dicts', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('toolz').merge({'a': 1}, {'b': 2}, {'c': 3})"
        );
        expect(result).toEqual({
            a: 1,
            b: 2,
            c: 3
        });
    });

    test('frequencies', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('toolz').frequencies(['a','b','a','c','b','a'])"
        );
        expect(result.a).toBe(3);
        expect(result.b).toBe(2);
        expect(result.c).toBe(1);
    });

    test('first / last', async () => {
        const builtins = await bridge('python:builtins');
        const first = await builtins.eval("__import__('toolz').first([10, 20, 30])");
        const last = await builtins.eval("__import__('toolz').last([10, 20, 30])");
        expect(first).toBe(10);
        expect(last).toBe(30);
    });

    test('take', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "list(__import__('toolz').take(3, range(100)))"
        );
        expect(result).toEqual([0, 1, 2]);
    });
});

describe('lark-parser — Grammar Parsing', () => {
    test('parse simple arithmetic grammar', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_p',
    __import__('lark').Lark('''
      start: NUMBER "+" NUMBER
      NUMBER: /[0-9]+/
      %ignore " "
    ''')),
  str(__import__('builtins')._p.parse("3 + 4"))
)[-1])()
`);
        expect(result).toContain('Tree');
        expect(result).toContain('3');
        expect(result).toContain('4');
    });

    test('parse JSON-like grammar', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_p',
    __import__('lark').Lark('''
      start: "{" pair ("," pair)* "}"
      pair: STRING ":" value
      value: STRING | NUMBER
      STRING: /"[^"]*"/
      NUMBER: /[0-9]+/
      %ignore " "
    ''')),
  str(type(__import__('builtins')._p.parse('{"name": "test", "age": 25}')).__name__)
)[-1])()
`);
        expect(result).toBe('Tree');
    });
});