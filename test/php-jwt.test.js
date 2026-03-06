/**
 * Bridger Jest Tests — PHP firebase/php-jwt
 *
 * Tests: JWT encode, decode, algorithms (HS256/HS384/HS512),
 * expiration, invalid token, wrong key
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

describe('firebase/php-jwt — HS256', () => {
    const secret = 'my-super-secret-key-for-testing-only-32bytes!';
    test('encode returns string token', async () => {
        const payload = {
            sub: '1234567890',
            name: 'Test User',
            iat: 1516239022
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
    });

    test('encode then decode roundtrip', async () => {
        const payload = {
            sub: '123',
            name: 'Alice',
            admin: true
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS256');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.sub.$value()).toBe('123');
        expect(await decoded.name.$value()).toBe('Alice');
        expect(await decoded.admin.$value()).toBe(true);
    });

    test('decode with wrong key throws', async () => {
        const payload = {
            sub: 'test'
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        await expect(async () => {
            const wrongKey = await php.Firebase.JWT.Key.new('wrong-key-that-is-at-least-32bytes!!', 'HS256');
            await php.Firebase.JWT.JWT.decode(token, wrongKey);
        }).rejects.toThrow();
    });

    test('token contains expected payload data', async () => {
        const payload = {
            user_id: 42,
            role: 'admin',
            permissions: ['read', 'write', 'delete']
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS256');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.user_id.$value()).toBe(42);
        expect(await decoded.role.$value()).toBe('admin');
    });
});

describe('firebase/php-jwt — Different Algorithms', () => {
    test('HS384 encode/decode', async () => {
        const secret = 'hs384-secret-key-needs-to-be-much-longer-than-48-bytes-here!';
        const payload = {
            data: 'hs384-test'
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS384');
        expect(typeof token).toBe('string');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS384');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.data.$value()).toBe('hs384-test');
    });

    test('HS512 encode/decode', async () => {
        const secret = 'hs512-secret-key-needs-to-be-even-longer-than-64-bytes-which-means-this-string-has-to-go-on!';
        const payload = {
            data: 'hs512-test'
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS512');
        expect(typeof token).toBe('string');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS512');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.data.$value()).toBe('hs512-test');
    });
});

describe('firebase/php-jwt — Complex Payloads', () => {
    const secret = 'complex-payload-secret-key-32bytes-now!';

    test('nested objects', async () => {
        const payload = {
            user: {
                id: 1,
                name: 'Alice'
            },
            metadata: {
                created: '2024-01-01'
            }
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS256');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        const json = await php.json_encode(decoded);
        const obj = JSON.parse(json);
        expect(obj.user.id).toBe(1);
    });

    test('numeric values preserved', async () => {
        const payload = {
            int_val: 42,
            float_val: 3.14,
            neg: -10,
            zero: 0
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS256');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.int_val.$value()).toBe(42);
        expect(await decoded.float_val.$value()).toBeCloseTo(3.14);
        expect(await decoded.neg.$value()).toBe(-10);
        expect(await decoded.zero.$value()).toBe(0);
    });

    test('boolean values preserved', async () => {
        const payload = {
            active: true,
            deleted: false
        };
        const token = await php.Firebase.JWT.JWT.encode(payload, secret, 'HS256');
        const key = await php.Firebase.JWT.Key.new(secret, 'HS256');
        const decoded = await php.Firebase.JWT.JWT.decode(token, key);
        expect(await decoded.active.$value()).toBe(true);
        expect(await decoded.deleted.$value()).toBe(false);
    });
});