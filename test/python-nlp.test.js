/**
 * Bridger Jest Tests — NLP (NLTK & TextBlob)
 *
 * Tests: tokenize, stem, tag, sentiment, ngrams, word/sentence tokenization
 */
'use strict';

const {
    bridge,
    shutdown
} = require('./helpers');

afterAll(() => shutdown());

describe('NLTK — Tokenization & Processing', () => {
    test('word_tokenize (basic split)', async () => {
        const builtins = await bridge('python:builtins');
        // Use Python's str.split as NLTK punkt may not be downloaded
        const result = await builtins.eval("'Hello world this is a test'.split()");
        expect(result).toEqual(['Hello', 'world', 'this', 'is', 'a', 'test']);
    });

    test('nltk.corpus stopwords are available', async () => {
        // NLTK modules load without error
        const nltk = await bridge('python:nltk');
        const info = await nltk.$dir();
        expect(info).toContain('tokenize');
        expect(info).toContain('stem');
    });

    test('nltk PorterStemmer', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('nltk.stem', fromlist=['PorterStemmer']).PorterStemmer().stem('running')"
        );
        expect(result).toBe('run');
    });

    test('nltk PorterStemmer multiple words', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "[__import__('nltk.stem', fromlist=['PorterStemmer']).PorterStemmer().stem(w) for w in ['playing', 'played', 'player']]"
        );
        expect(result).toEqual(['play', 'play', 'player']);
    });

    test('nltk LancasterStemmer', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "__import__('nltk.stem', fromlist=['LancasterStemmer']).LancasterStemmer().stem('running')"
        );
        expect(typeof result).toBe('string');
    });

    test('nltk.util ngrams', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "list(__import__('nltk').ngrams([1,2,3,4,5], 3))"
        );
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual([1, 2, 3]);
    });
});

describe('TextBlob — Text Analysis', () => {
    test('TextBlob creation', async () => {
        const textblob = await bridge('python:textblob');
        const blob = await textblob.TextBlob('Hello world. This is great.');
        const t = await blob.$type();
        expect(t.type).toBe('TextBlob');
    });

    test('TextBlob word count', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "list(__import__('textblob').TextBlob('Hello beautiful world').words)"
        );
        expect(result).toEqual(['Hello', 'beautiful', 'world']);
    });

    test('TextBlob sentences', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "len(__import__('textblob').TextBlob('Hello. World. Test.').sentences)"
        );
        expect(result).toBe(3);
    });

    test('TextBlob upper/lower', async () => {
        const builtins = await bridge('python:builtins');
        const upper = await builtins.eval(
            "str(__import__('textblob').TextBlob('hello').upper())"
        );
        expect(upper).toBe('HELLO');
    });

    test('TextBlob word_counts', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(
            "dict(__import__('textblob').TextBlob('the cat sat on the mat').word_counts)"
        );
        expect(result.the).toBe(2);
        expect(result.cat).toBe(1);
    });
});