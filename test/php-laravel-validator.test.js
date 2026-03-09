/**
 * Bridger Jest Tests — PHP illuminate/validation (Laravel Validator)
 *
 * Tests the Laravel Validator standalone, using the same validation rules
 * you'd use in Laravel controllers: required, string, email, numeric,
 * min, max, between, in, regex, confirmed, nullable, array, date, etc.
 */
'use strict';

const {
    bridge,
    shutdown
} = require('./helpers');

afterAll(() => shutdown());

let php, factory;

beforeAll(async () => {
    php = await bridge('php:php');

    // Set up: ArrayLoader → Translator → Validation Factory
    const loader = await php.Illuminate.Translation.ArrayLoader.new();
    const translator = await php.Illuminate.Translation.Translator.new(loader, 'en');
    factory = await php.Illuminate.Validation.Factory.new(translator);
});

// Helper: create a validator and return { passes, fails, errors }
async function validate(data, rules) {
    const v = await factory.make(data, rules);
    const passes = await v.passes();
    const fails = await v.fails();
    const errorBag = await v.errors();
    const errJson = await php.json_encode(errorBag);
    const errors = JSON.parse(errJson);
    return {
        passes,
        fails,
        errors
    };
}

// ═══════════════════════════════════════════════════════
//  required
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — required', () => {
    test('passes when field is present and non-empty', async () => {
        const {
            passes
        } = await validate({
            name: 'John'
        }, {
            name: 'required'
        });
        expect(passes).toBe(true);
    });

    test('fails when field is missing', async () => {
        const {
            fails,
            errors
        } = await validate({}, {
            name: 'required'
        });
        expect(fails).toBe(true);
        expect(errors).toHaveProperty('name');
    });

    test('fails when field is empty string', async () => {
        const {
            fails
        } = await validate({
            name: ''
        }, {
            name: 'required'
        });
        expect(fails).toBe(true);
    });

    test('fails when field is null', async () => {
        const {
            fails
        } = await validate({
            name: null
        }, {
            name: 'required'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  string & numeric
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — string & numeric', () => {
    test('string passes for a string value', async () => {
        const {
            passes
        } = await validate({
            name: 'Alice'
        }, {
            name: 'required|string'
        });
        expect(passes).toBe(true);
    });

    test('numeric passes for number', async () => {
        const {
            passes
        } = await validate({
            age: 25
        }, {
            age: 'required|numeric'
        });
        expect(passes).toBe(true);
    });

    test('numeric passes for numeric string', async () => {
        const {
            passes
        } = await validate({
            age: '25'
        }, {
            age: 'required|numeric'
        });
        expect(passes).toBe(true);
    });

    test('numeric fails for non-numeric string', async () => {
        const {
            fails
        } = await validate({
            age: 'abc'
        }, {
            age: 'required|numeric'
        });
        expect(fails).toBe(true);
    });

    test('integer passes for int value', async () => {
        const {
            passes
        } = await validate({
            count: 10
        }, {
            count: 'required|integer'
        });
        expect(passes).toBe(true);
    });

    test('integer fails for float', async () => {
        const {
            fails
        } = await validate({
            count: 3.14
        }, {
            count: 'required|integer'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  email
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — email', () => {
    test('valid email passes', async () => {
        const {
            passes
        } = await validate({
            email: 'user@example.com'
        }, {
            email: 'required|email'
        });
        expect(passes).toBe(true);
    });

    test('invalid email fails', async () => {
        const {
            fails
        } = await validate({
            email: 'not-an-email'
        }, {
            email: 'required|email'
        });
        expect(fails).toBe(true);
    });

    test('email with subdomain passes', async () => {
        const {
            passes
        } = await validate({
            email: 'user@mail.example.co.uk'
        }, {
            email: 'required|email'
        });
        expect(passes).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  min / max / between (string length & numeric)
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — min, max, between', () => {
    test('min string length passes', async () => {
        const {
            passes
        } = await validate({
            name: 'Alice'
        }, {
            name: 'required|string|min:3'
        });
        expect(passes).toBe(true);
    });

    test('min string length fails', async () => {
        const {
            fails
        } = await validate({
            name: 'Al'
        }, {
            name: 'required|string|min:3'
        });
        expect(fails).toBe(true);
    });

    test('max string length passes', async () => {
        const {
            passes
        } = await validate({
            name: 'Alice'
        }, {
            name: 'required|string|max:10'
        });
        expect(passes).toBe(true);
    });

    test('max string length fails', async () => {
        const {
            fails
        } = await validate({
            name: 'A very long name indeed'
        }, {
            name: 'required|string|max:10'
        });
        expect(fails).toBe(true);
    });

    test('min numeric passes', async () => {
        const {
            passes
        } = await validate({
            age: 18
        }, {
            age: 'required|numeric|min:18'
        });
        expect(passes).toBe(true);
    });

    test('min numeric fails', async () => {
        const {
            fails
        } = await validate({
            age: 15
        }, {
            age: 'required|numeric|min:18'
        });
        expect(fails).toBe(true);
    });

    test('between numeric passes', async () => {
        const {
            passes
        } = await validate({
            age: 25
        }, {
            age: 'required|numeric|between:18,65'
        });
        expect(passes).toBe(true);
    });

    test('between numeric fails (too low)', async () => {
        const {
            fails
        } = await validate({
            age: 10
        }, {
            age: 'required|numeric|between:18,65'
        });
        expect(fails).toBe(true);
    });

    test('between numeric fails (too high)', async () => {
        const {
            fails
        } = await validate({
            age: 70
        }, {
            age: 'required|numeric|between:18,65'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  in / not_in
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — in, not_in', () => {
    test('in rule passes for valid value', async () => {
        const {
            passes
        } = await validate({
            role: 'admin'
        }, {
            role: 'required|in:admin,editor,viewer'
        });
        expect(passes).toBe(true);
    });

    test('in rule fails for invalid value', async () => {
        const {
            fails
        } = await validate({
            role: 'superuser'
        }, {
            role: 'required|in:admin,editor,viewer'
        });
        expect(fails).toBe(true);
    });

    test('not_in rule passes', async () => {
        const {
            passes
        } = await validate({
            status: 'active'
        }, {
            status: 'required|not_in:banned,suspended'
        });
        expect(passes).toBe(true);
    });

    test('not_in rule fails', async () => {
        const {
            fails
        } = await validate({
            status: 'banned'
        }, {
            status: 'required|not_in:banned,suspended'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  confirmed
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — confirmed', () => {
    test('confirmed passes when fields match', async () => {
        const {
            passes
        } = await validate({
            password: 'secret123',
            password_confirmation: 'secret123'
        }, {
            password: 'required|confirmed'
        });
        expect(passes).toBe(true);
    });

    test('confirmed fails when fields differ', async () => {
        const {
            fails
        } = await validate({
            password: 'secret123',
            password_confirmation: 'different'
        }, {
            password: 'required|confirmed'
        });
        expect(fails).toBe(true);
    });

    test('confirmed fails when confirmation is missing', async () => {
        const {
            fails
        } = await validate({
            password: 'secret123'
        }, {
            password: 'required|confirmed'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  nullable
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — nullable', () => {
    test('nullable allows null value', async () => {
        const {
            passes
        } = await validate({
            bio: null
        }, {
            bio: 'nullable|string'
        });
        expect(passes).toBe(true);
    });

    test('nullable allows missing field', async () => {
        const {
            passes
        } = await validate({}, {
            bio: 'nullable|string'
        });
        expect(passes).toBe(true);
    });

    test('nullable still validates when value is present', async () => {
        const {
            passes
        } = await validate({
            bio: 'Hello world'
        }, {
            bio: 'nullable|string|min:3'
        });
        expect(passes).toBe(true);
    });

    test('nullable fails validation when present but invalid', async () => {
        const {
            fails
        } = await validate({
            bio: 'Hi'
        }, {
            bio: 'nullable|string|min:5'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  array
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — array', () => {
    test('array passes for array value', async () => {
        const {
            passes
        } = await validate({
            tags: ['php', 'laravel']
        }, {
            tags: 'required|array'
        });
        expect(passes).toBe(true);
    });

    test('array fails for non-array', async () => {
        const {
            fails
        } = await validate({
            tags: 'not-array'
        }, {
            tags: 'required|array'
        });
        expect(fails).toBe(true);
    });

    test('array min count passes', async () => {
        const {
            passes
        } = await validate({
            tags: ['a', 'b', 'c']
        }, {
            tags: 'required|array|min:2'
        });
        expect(passes).toBe(true);
    });

    test('array min count fails', async () => {
        const {
            fails
        } = await validate({
            tags: ['a']
        }, {
            tags: 'required|array|min:2'
        });
        expect(fails).toBe(true);
    });

    test('array max count passes', async () => {
        const {
            passes
        } = await validate({
            tags: ['a', 'b']
        }, {
            tags: 'required|array|max:5'
        });
        expect(passes).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  regex
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — regex', () => {
    test('regex passes for matching pattern', async () => {
        const {
            passes
        } = await validate({
            code: 'ABC-123'
        }, {
            code: 'required|regex:/^[A-Z]{3}-[0-9]{3}$/'
        });
        expect(passes).toBe(true);
    });

    test('regex fails for non-matching pattern', async () => {
        const {
            fails
        } = await validate({
            code: 'abc123'
        }, {
            code: 'required|regex:/^[A-Z]{3}-[0-9]{3}$/'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  date / date_format
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — date', () => {
    test('date passes for valid date string', async () => {
        const {
            passes
        } = await validate({
            dob: '2000-01-15'
        }, {
            dob: 'required|date'
        });
        expect(passes).toBe(true);
    });

    test('date fails for invalid date', async () => {
        const {
            fails
        } = await validate({
            dob: 'not-a-date'
        }, {
            dob: 'required|date'
        });
        expect(fails).toBe(true);
    });

    test('date_format validates specific format', async () => {
        const {
            passes
        } = await validate({
            dob: '15/01/2000'
        }, {
            dob: 'required|date_format:d/m/Y'
        });
        expect(passes).toBe(true);
    });

    test('date_format fails for wrong format', async () => {
        const {
            fails
        } = await validate({
            dob: '2000-01-15'
        }, {
            dob: 'required|date_format:d/m/Y'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  boolean
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — boolean', () => {
    test('boolean passes for true', async () => {
        const {
            passes
        } = await validate({
            active: true
        }, {
            active: 'required|boolean'
        });
        expect(passes).toBe(true);
    });

    test('boolean passes for false', async () => {
        const {
            passes
        } = await validate({
            active: false
        }, {
            active: 'boolean'
        });
        expect(passes).toBe(true);
    });

    test('boolean passes for 1 and 0', async () => {
        const r1 = await validate({
            active: 1
        }, {
            active: 'required|boolean'
        });
        const r2 = await validate({
            active: 0
        }, {
            active: 'boolean'
        });
        expect(r1.passes).toBe(true);
        expect(r2.passes).toBe(true);
    });

    test('boolean fails for random string', async () => {
        const {
            fails
        } = await validate({
            active: 'yes'
        }, {
            active: 'required|boolean'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  url / ip
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — url & ip', () => {
    test('url passes for valid URL', async () => {
        const {
            passes
        } = await validate({
            site: 'https://example.com'
        }, {
            site: 'required|url'
        });
        expect(passes).toBe(true);
    });

    test('url fails for invalid URL', async () => {
        const {
            fails
        } = await validate({
            site: 'not a url'
        }, {
            site: 'required|url'
        });
        expect(fails).toBe(true);
    });

    test('ip passes for valid IPv4', async () => {
        const {
            passes
        } = await validate({
            addr: '192.168.1.1'
        }, {
            addr: 'required|ip'
        });
        expect(passes).toBe(true);
    });

    test('ip fails for invalid IP', async () => {
        const {
            fails
        } = await validate({
            addr: '999.999.999.999'
        }, {
            addr: 'required|ip'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  size / digits / digits_between
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — size & digits', () => {
    test('size validates exact string length', async () => {
        const {
            passes
        } = await validate({
            pin: '1234'
        }, {
            pin: 'required|string|size:4'
        });
        expect(passes).toBe(true);
    });

    test('size fails for wrong length', async () => {
        const {
            fails
        } = await validate({
            pin: '123'
        }, {
            pin: 'required|string|size:4'
        });
        expect(fails).toBe(true);
    });

    test('digits validates exact digit count', async () => {
        const {
            passes
        } = await validate({
            otp: '123456'
        }, {
            otp: 'required|digits:6'
        });
        expect(passes).toBe(true);
    });

    test('digits fails for wrong count', async () => {
        const {
            fails
        } = await validate({
            otp: '1234'
        }, {
            otp: 'required|digits:6'
        });
        expect(fails).toBe(true);
    });

    test('digits_between passes', async () => {
        const {
            passes
        } = await validate({
            code: '12345'
        }, {
            code: 'required|digits_between:4,6'
        });
        expect(passes).toBe(true);
    });

    test('digits_between fails', async () => {
        const {
            fails
        } = await validate({
            code: '12'
        }, {
            code: 'required|digits_between:4,6'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  same / different
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — same & different', () => {
    test('same passes when fields match', async () => {
        const {
            passes
        } = await validate({
            email: 'a@b.com',
            email_confirm: 'a@b.com'
        }, {
            email_confirm: 'required|same:email'
        });
        expect(passes).toBe(true);
    });

    test('same fails when fields differ', async () => {
        const {
            fails
        } = await validate({
            email: 'a@b.com',
            email_confirm: 'x@y.com'
        }, {
            email_confirm: 'required|same:email'
        });
        expect(fails).toBe(true);
    });

    test('different passes when fields differ', async () => {
        const {
            passes
        } = await validate({
            old_pass: 'old123',
            new_pass: 'new456'
        }, {
            new_pass: 'required|different:old_pass'
        });
        expect(passes).toBe(true);
    });

    test('different fails when fields match', async () => {
        const {
            fails
        } = await validate({
            old_pass: 'same',
            new_pass: 'same'
        }, {
            new_pass: 'required|different:old_pass'
        });
        expect(fails).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════
//  Multiple rules — Real controller scenarios
// ═══════════════════════════════════════════════════════

describe('Laravel Validator — Controller-style rules', () => {
    test('user registration form', async () => {
        const data = {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'secret123',
            password_confirmation: 'secret123',
            age: 25
        };
        const rules = {
            name: 'required|string|min:2|max:255',
            email: 'required|email',
            password: 'required|string|min:8|confirmed',
            age: 'required|integer|min:18'
        };
        const {
            passes
        } = await validate(data, rules);
        expect(passes).toBe(true);
    });

    test('user registration fails with bad data', async () => {
        const data = {
            name: '',
            email: 'not-email',
            password: 'short',
            password_confirmation: 'mismatch',
            age: 15
        };
        const rules = {
            name: 'required|string|min:2|max:255',
            email: 'required|email',
            password: 'required|string|min:8|confirmed',
            age: 'required|integer|min:18'
        };
        const {
            fails,
            errors
        } = await validate(data, rules);
        expect(fails).toBe(true);
        expect(errors).toHaveProperty('name');
        expect(errors).toHaveProperty('email');
        expect(errors).toHaveProperty('password');
        expect(errors).toHaveProperty('age');
    });

    test('blog post creation', async () => {
        const data = {
            title: 'My First Post',
            body: 'This is the body of my first blog post which is long enough.',
            tags: ['laravel', 'php', 'bridger'],
            status: 'published'
        };
        const rules = {
            title: 'required|string|min:5|max:200',
            body: 'required|string|min:20',
            tags: 'required|array|min:1|max:10',
            status: 'required|in:draft,published,archived'
        };
        const {
            passes
        } = await validate(data, rules);
        expect(passes).toBe(true);
    });

    test('product update form', async () => {
        const data = {
            name: 'Widget Pro',
            price: 29.99,
            stock: 100,
            sku: 'WP-001',
            description: null
        };
        const rules = {
            name: 'required|string|max:100',
            price: 'required|numeric|min:0',
            stock: 'required|integer|min:0',
            sku: 'required|string|size:6',
            description: 'nullable|string|max:1000'
        };
        const {
            passes
        } = await validate(data, rules);
        expect(passes).toBe(true);
    });

    test('contact form', async () => {
        const data = {
            name: 'Jane',
            email: 'jane@test.com',
            subject: 'Hello',
            message: 'I have a question about your product.'
        };
        const rules = {
            name: 'required|string|min:2',
            email: 'required|email',
            subject: 'required|string|min:3|max:100',
            message: 'required|string|min:10|max:2000'
        };
        const {
            passes
        } = await validate(data, rules);
        expect(passes).toBe(true);
    });

    test('errors contain all failed fields', async () => {
        const {
            fails,
            errors
        } = await validate({
            name: '',
            email: 'bad',
            age: 'abc'
        }, {
            name: 'required',
            email: 'email',
            age: 'numeric'
        });
        expect(fails).toBe(true);
        expect(Object.keys(errors)).toEqual(expect.arrayContaining(['name', 'email', 'age']));
    });
});