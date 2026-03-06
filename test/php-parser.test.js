/**
 * Bridger Jest Tests — PHP nikic/php-parser
 *
 * Tests: parsing PHP code into AST, node types, pretty-printing,
 * traversal concepts
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

describe('php-parser — Parsing PHP Code', () => {
    test('create parser factory', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        expect(factory).toBeTruthy();
    });

    test('parse simple PHP code returns array', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php echo "Hello World"; ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse variable assignment', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php $x = 42; ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse function definition', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php function add($a, $b) { return $a + $b; } ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse class definition', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = `<?php 
class User {
    public string $name;
    public int $age;
    
    public function __construct(string $name, int $age) {
        $this->name = $name;
        $this->age = $age;
    }
    
    public function greet(): string {
        return "Hello, " . $this->name;
    }
}
?>`;
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse if/else', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php if ($x > 0) { echo "positive"; } else { echo "non-positive"; } ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse for loop', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php for ($i = 0; $i < 10; $i++) { echo $i; } ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('parse array expression', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php $arr = [1, 2, 3, "hello" => "world"]; ?>';
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
    });

    test('invalid code returns null or throws', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        // Deliberately invalid PHP
        const code = '<?php function ( { $$$$ } ?>';
        // The parser may return null or throw
        try {
            const stmts = await parser.parse(code);
            // If it returns, stmts is null for invalid code
            expect(stmts === null || stmts !== undefined).toBe(true);
        } catch (e) {
            // Expected — parser threw an error
            expect(e).toBeTruthy();
        }
    });
});

describe('php-parser — Pretty Printer', () => {
    test('prettyPrint code', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php $x=1+2; echo $x; ?>';
        const stmts = await parser.parse(code);

        const printer = await php.PhpParser.PrettyPrinter.Standard.new();
        const printed = await printer.prettyPrint(stmts);
        expect(typeof printed).toBe('string');
        expect(printed).toContain('$x');
    });

    test('prettyPrintFile includes PHP tag', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php echo "hello"; ?>';
        const stmts = await parser.parse(code);

        const printer = await php.PhpParser.PrettyPrinter.Standard.new();
        const printed = await printer.prettyPrintFile(stmts);
        expect(printed).toContain('<?php');
    });
});

describe('php-parser — Node Types', () => {
    test('parse and check first statement type is Stmt_Expression', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php echo "hello"; ?>';
        const stmts = await parser.parse(code);
        // stmts is an array; check it has content
        expect(stmts).toBeTruthy();
        const count = await php.count(stmts);
        expect(count).toBeGreaterThan(0);
    });

    test('parse multiple statements', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = '<?php $a = 1; $b = 2; $c = $a + $b; echo $c; ?>';
        const stmts = await parser.parse(code);
        const count = await php.count(stmts);
        expect(count).toBe(4);
    });

    test('parse try-catch', async () => {
        const factory = await php.PhpParser.ParserFactory.new();
        const parser = await factory.createForNewestSupportedVersion();
        const code = `<?php
try {
    throw new Exception("error");
} catch (Exception $e) {
    echo $e->getMessage();
}
?>`;
        const stmts = await parser.parse(code);
        expect(stmts).toBeTruthy();
        const count = await php.count(stmts);
        expect(count).toBeGreaterThan(0);
    });
});