/**
 * Bridger Jest Tests — Cryptography, PyJWT, bcrypt
 *
 * Tests: Fernet encrypt/decrypt, hashing (SHA256/SHA512), HMAC,
 * JWT encode/decode, bcrypt hash/verify
 */
'use strict';

const {
    bridge,
    shutdown
} = require('./helpers');

afterAll(() => shutdown());

describe('cryptography — Fernet (Symmetric Encryption)', () => {
    test('encrypt and decrypt roundtrip', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  __import__('cryptography.fernet', fromlist=['Fernet']),
  setattr(__import__('builtins'), '_key', __import__('cryptography.fernet', fromlist=['Fernet']).Fernet.generate_key()),
  setattr(__import__('builtins'), '_f', __import__('cryptography.fernet', fromlist=['Fernet']).Fernet(__import__('builtins')._key)),
  __import__('builtins')._f.decrypt(__import__('builtins')._f.encrypt(b'Hello Bridger!')).decode()
)[-1])()
`);
        expect(result).toBe('Hello Bridger!');
    });

    test('Fernet key generation', async () => {
        const builtins = await bridge('python:builtins');
        const key = await builtins.eval(
            "__import__('cryptography.fernet', fromlist=['Fernet']).Fernet.generate_key().decode()"
        );
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(20);
    });
});

describe('cryptography — Hashing', () => {
    test('SHA256 digest', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_h',
    __import__('cryptography.hazmat.primitives.hashes', fromlist=['Hash','SHA256']).Hash(
      __import__('cryptography.hazmat.primitives.hashes', fromlist=['SHA256']).SHA256()
    )),
  __import__('builtins')._h.update(b'hello'),
  __import__('builtins')._h.finalize().hex()
)[-1])()
`);
        expect(typeof result).toBe('string');
        expect(result.length).toBe(64); // SHA256 → 32 bytes → 64 hex chars
    });
});

describe('PyJWT — JSON Web Tokens', () => {
    let jwt;
    beforeAll(async () => {
        jwt = await bridge('python:jwt');
    });

    test('encode JWT', async () => {
        const token = await jwt.encode({
            sub: 'user123',
            role: 'admin'
        }, 'secret_key', 'HS256');
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    test('decode JWT', async () => {
        const token = await jwt.encode({
            sub: 'user123',
            role: 'admin'
        }, 'secret_key', 'HS256');
        const decoded = await jwt.decode(token, 'secret_key', ['HS256']);
        expect(decoded.sub).toBe('user123');
        expect(decoded.role).toBe('admin');
    });

    test('JWT with different algorithms', async () => {
        const token = await jwt.encode({
            data: 'test'
        }, 'mykey', 'HS384');
        expect(typeof token).toBe('string');
        const decoded = await jwt.decode(token, 'mykey', ['HS384']);
        expect(decoded.data).toBe('test');
    });

    test('JWT decode with wrong key fails', async () => {
        const token = await jwt.encode({
            data: 'test'
        }, 'correct_key', 'HS256');
        await expect(async () => {
            await jwt.decode(token, 'wrong_key', ['HS256']);
        }).rejects.toThrow();
    });
});

describe('bcrypt — Password Hashing', () => {
    let bcrypt;
    beforeAll(async () => {
        bcrypt = await bridge('python:bcrypt');
    });

    test('hashpw and checkpw', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_salt', __import__('bcrypt').gensalt()),
  setattr(__import__('builtins'), '_hash', __import__('bcrypt').hashpw(b'my_password', __import__('builtins')._salt)),
  __import__('bcrypt').checkpw(b'my_password', __import__('builtins')._hash)
)[-1])()
`);
        expect(result).toBe(true);
    });

    test('wrong password returns false', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_salt', __import__('bcrypt').gensalt()),
  setattr(__import__('builtins'), '_hash', __import__('bcrypt').hashpw(b'correct', __import__('builtins')._salt)),
  __import__('bcrypt').checkpw(b'wrong', __import__('builtins')._hash)
)[-1])()
`);
        expect(result).toBe(false);
    });

    test('gensalt produces different salts', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
[__import__('bcrypt').gensalt().decode() for _ in range(3)]
`);
        expect(result).toHaveLength(3);
        // All three should be different
        const unique = new Set(result);
        expect(unique.size).toBe(3);
    });
});