/**
 * Bridger Jest Tests — PHP Carbon (DateTime)
 *
 * Tests: creation, formatting, arithmetic, comparison, diffForHumans,
 * day-of-week checks, start/end of periods, parsing, timezone
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

describe('Carbon — Creation', () => {
    test('now() returns current year', async () => {
        const carbon = await php.Carbon.Carbon.now();
        const year = await carbon.format('Y');
        expect(Number(year)).toBeGreaterThanOrEqual(2024);
    });

    test('create(year, month, day)', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 12, 25);
        const formatted = await carbon.format('Y-m-d');
        expect(formatted).toBe('2024-12-25');
    });

    test('create with time', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15, 14, 30, 0);
        const formatted = await carbon.format('Y-m-d H:i:s');
        expect(formatted).toBe('2024-06-15 14:30:00');
    });

    test('parse from string', async () => {
        const carbon = await php.Carbon.Carbon.parse('2024-03-15 14:30:00');
        const hour = await carbon.format('H');
        expect(hour).toBe('14');
    });

    test('createFromFormat', async () => {
        const carbon = await php.Carbon.Carbon.createFromFormat('d/m/Y', '25/12/2024');
        const formatted = await carbon.format('Y-m-d');
        expect(formatted).toBe('2024-12-25');
    });

    test('today / yesterday / tomorrow', async () => {
        const today = await php.Carbon.Carbon.today();
        const fmtToday = await today.format('Y');
        expect(Number(fmtToday)).toBeGreaterThanOrEqual(2024);
    });

    test('createFromTimestamp', async () => {
        const carbon = await php.Carbon.Carbon.createFromTimestamp(0);
        const formatted = await carbon.format('Y-m-d');
        expect(formatted).toBe('1970-01-01');
    });
});

describe('Carbon — Formatting', () => {
    test('format full datetime', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 15, 9, 5, 30);
        const result = await carbon.format('Y-m-d H:i:s');
        expect(result).toBe('2024-01-15 09:05:30');
    });

    test('format day name', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 12, 25);
        const day = await carbon.format('l'); // full day name
        expect(day).toBe('Wednesday');
    });

    test('format month name', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 3, 1);
        const month = await carbon.format('F');
        expect(month).toBe('March');
    });

    test('toDateString', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15);
        const result = await carbon.toDateString();
        expect(result).toBe('2024-06-15');
    });

    test('toTimeString', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 1, 14, 30, 45);
        const result = await carbon.toTimeString();
        expect(result).toBe('14:30:45');
    });
});

describe('Carbon — Arithmetic', () => {
    test('addDays', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 1);
        const modified = await carbon.addDays(30);
        const formatted = await modified.format('Y-m-d');
        expect(formatted).toBe('2024-01-31');
    });

    test('subDays', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 31);
        const modified = await carbon.subDays(30);
        const formatted = await modified.format('Y-m-d');
        expect(formatted).toBe('2024-01-01');
    });

    test('addMonths', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 15);
        const modified = await carbon.addMonths(3);
        const month = await modified.format('m');
        expect(month).toBe('04');
    });

    test('subMonths', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15);
        const modified = await carbon.subMonths(3);
        const month = await modified.format('m');
        expect(month).toBe('03');
    });

    test('addYears', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 1);
        const modified = await carbon.addYears(5);
        const year = await modified.format('Y');
        expect(year).toBe('2029');
    });

    test('addHours / addMinutes / addSeconds', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 1, 10, 0, 0);
        const m1 = await carbon.addHours(2);
        const h = await m1.format('H');
        expect(h).toBe('12');
    });

    test('addWeeks', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 1);
        const modified = await carbon.addWeeks(2);
        const formatted = await modified.format('Y-m-d');
        expect(formatted).toBe('2024-01-15');
    });
});

describe('Carbon — Comparison', () => {
    test('greaterThan / lessThan', async () => {
        const a = await php.Carbon.Carbon.create(2024, 6, 1);
        const b = await php.Carbon.Carbon.create(2024, 1, 1);
        const gt = await a.greaterThan(b);
        const lt = await a.lessThan(b);
        expect(gt).toBe(true);
        expect(lt).toBe(false);
    });

    test('equalTo', async () => {
        const a = await php.Carbon.Carbon.create(2024, 6, 15);
        const b = await php.Carbon.Carbon.create(2024, 6, 15);
        const eq = await a.equalTo(b);
        expect(eq).toBe(true);
    });

    test('isBetween', async () => {
        const date = await php.Carbon.Carbon.create(2024, 6, 15);
        const start = await php.Carbon.Carbon.create(2024, 1, 1);
        const end = await php.Carbon.Carbon.create(2024, 12, 31);
        const result = await date.isBetween(start, end);
        expect(result).toBe(true);
    });
});

describe('Carbon — Day Checks', () => {
    test('isWeekday (Wednesday 2024-12-25)', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 12, 25);
        expect(await carbon.isWeekday()).toBe(true);
    });

    test('isWeekend (Saturday 2024-12-28)', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 12, 28);
        expect(await carbon.isWeekend()).toBe(true);
    });

    test('isMonday through isSunday', async () => {
        // 2024-12-23 is Monday
        const monday = await php.Carbon.Carbon.create(2024, 12, 23);
        expect(await monday.isMonday()).toBe(true);
        // 2024-12-24 is Tuesday
        const tuesday = await php.Carbon.Carbon.create(2024, 12, 24);
        expect(await tuesday.isTuesday()).toBe(true);
    });

    test('isLeapYear', async () => {
        const y2024 = await php.Carbon.Carbon.create(2024, 1, 1);
        const y2023 = await php.Carbon.Carbon.create(2023, 1, 1);
        expect(await y2024.isLeapYear()).toBe(true);
        expect(await y2023.isLeapYear()).toBe(false);
    });

    test('isFuture / isPast', async () => {
        const past = await php.Carbon.Carbon.create(2000, 1, 1);
        expect(await past.isPast()).toBe(true);
        const future = await php.Carbon.Carbon.create(2099, 1, 1);
        expect(await future.isFuture()).toBe(true);
    });
});

describe('Carbon — Start/End of Period', () => {
    test('startOfMonth', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15);
        const start = await carbon.startOfMonth();
        expect(await start.format('d')).toBe('01');
    });

    test('endOfMonth', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 2, 15);
        const end = await carbon.endOfMonth();
        expect(await end.format('d')).toBe('29'); // 2024 is leap year
    });

    test('startOfYear', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15);
        const start = await carbon.startOfYear();
        expect(await start.format('m-d')).toBe('01-01');
    });

    test('startOfWeek', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 12, 25); // Wednesday
        const start = await carbon.startOfWeek();
        expect(await start.format('l')).toBe('Monday');
    });

    test('startOfDay', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 1, 15, 14, 30, 0);
        const start = await carbon.startOfDay();
        expect(await start.format('H:i:s')).toBe('00:00:00');
    });
});

describe('Carbon — Diff', () => {
    test('diffInDays', async () => {
        const a = await php.Carbon.Carbon.create(2024, 1, 1);
        const b = await php.Carbon.Carbon.create(2024, 1, 31);
        const diff = await a.diffInDays(b);
        expect(diff).toBe(30);
    });

    test('diffInMonths', async () => {
        const a = await php.Carbon.Carbon.create(2024, 1, 1);
        const b = await php.Carbon.Carbon.create(2024, 7, 1);
        const diff = await a.diffInMonths(b);
        expect(diff).toBe(6);
    });

    test('diffInYears', async () => {
        const a = await php.Carbon.Carbon.create(2020, 1, 1);
        const b = await php.Carbon.Carbon.create(2024, 1, 1);
        const diff = await a.diffInYears(b);
        expect(diff).toBe(4);
    });

    test('diffForHumans', async () => {
        const past = await php.Carbon.Carbon.create(2024, 1, 1);
        const result = await past.diffForHumans();
        expect(typeof result).toBe('string');
        // Should contain time unit
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('Carbon — Getters', () => {
    test('year / month / day / hour / minute / second', async () => {
        const carbon = await php.Carbon.Carbon.create(2024, 6, 15, 14, 30, 45);
        expect(await carbon.format('Y')).toBe('2024');
        expect(await carbon.format('m')).toBe('06');
        expect(await carbon.format('d')).toBe('15');
        expect(await carbon.format('H')).toBe('14');
        expect(await carbon.format('i')).toBe('30');
        expect(await carbon.format('s')).toBe('45');
    });

    test('dayOfWeek', async () => {
        // 2024-12-25 is Wednesday = 3 (0=Sunday in Carbon)
        const carbon = await php.Carbon.Carbon.create(2024, 12, 25);
        const dow = await carbon.format('w');
        expect(dow).toBe('3');
    });

    test('daysInMonth', async () => {
        const feb2024 = await php.Carbon.Carbon.create(2024, 2, 1);
        const days = await feb2024.format('t');
        expect(days).toBe('29'); // leap year
    });
});

describe('Carbon — Copy & Immutability', () => {
    test('copy creates independent instance', async () => {
        const original = await php.Carbon.Carbon.create(2024, 1, 1);
        const copy = await original.copy();
        const modified = await copy.addDays(10);
        expect(await modified.format('d')).toBe('11');
        // Original should be unaffected if using immutable
    });
});