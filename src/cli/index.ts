/**
 * Bridger — CLI
 *
 * Command-line interface for package management.
 *
 * Commands:
 *   bridger install <language>:<package>[@version]
 *   bridger remove  <language>:<package>
 *   bridger upgrade <language>:<package>[@version]
 *   bridger list
 *   bridger info <language>:<package>
 *   bridger init
 *   bridger --help
 */

import { PackageInstaller } from '../installer/index';
import { Bridge } from '../core/bridge';
import { BridgerError } from '../errors';

// ═══════════════════════════════════════════════════════
//  Logger
// ═══════════════════════════════════════════════════════

const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  success: (msg: string) => console.log(`  ✓ ${msg}`),
  error: (msg: string) => console.error(`  ✗ ${msg}`),
  header: (msg: string) => console.log(`\n  ${msg}\n`),
  table: (rows: string[][]) => {
    if (rows.length === 0) return;
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    for (const row of rows) {
      const line = row.map((cell, i) => cell.padEnd(widths[i])).join('  ');
      console.log(`  ${line}`);
    }
  },
};

// ═══════════════════════════════════════════════════════
//  Spec Parsing (reuse Bridge.parseSpec)
// ═══════════════════════════════════════════════════════

function parseSpec(spec: string) {
  return Bridge.parseSpec(spec);
}

// ═══════════════════════════════════════════════════════
//  Commands
// ═══════════════════════════════════════════════════════

function cmdInstall(args: string[]): void {
  if (args.length === 0) {
    log.error('Usage: bridger install <language>:<package>[@version]');
    log.info('Example: bridger install python:numpy@1.26.4');
    process.exit(1);
  }

  const installer = new PackageInstaller(process.cwd());

  for (const specStr of args) {
    try {
      const spec = parseSpec(specStr);
      log.info(`Installing ${spec.packageName} for ${spec.language}...`);
      const result = installer.install(spec);
      log.success(`${result.packageName}@${result.installedVersion} installed for ${result.language}`);
    } catch (err) {
      const msg = err instanceof BridgerError ? err.toDetailedString() : (err instanceof Error ? err.message : String(err));
      log.error(`Failed to install ${specStr}: ${msg}`);
      process.exit(1);
    }
  }
}

function cmdRemove(args: string[]): void {
  if (args.length === 0) {
    log.error('Usage: bridger remove <language>:<package>');
    process.exit(1);
  }

  const installer = new PackageInstaller(process.cwd());

  for (const specStr of args) {
    try {
      const spec = parseSpec(specStr);
      log.info(`Removing ${spec.packageName} from ${spec.language}...`);
      installer.remove(spec);
      log.success(`${spec.packageName} removed from ${spec.language}`);
    } catch (err) {
      const msg = err instanceof BridgerError ? err.toDetailedString() : (err instanceof Error ? err.message : String(err));
      log.error(`Failed to remove ${specStr}: ${msg}`);
      process.exit(1);
    }
  }
}

function cmdUpgrade(args: string[]): void {
  if (args.length === 0) {
    log.error('Usage: bridger upgrade <language>:<package>[@version]');
    process.exit(1);
  }

  const installer = new PackageInstaller(process.cwd());

  for (const specStr of args) {
    try {
      const spec = parseSpec(specStr);
      log.info(`Upgrading ${spec.packageName} for ${spec.language}...`);
      const result = installer.upgrade(spec);
      log.success(`${result.packageName}@${result.installedVersion} upgraded for ${result.language}`);
    } catch (err) {
      const msg = err instanceof BridgerError ? err.toDetailedString() : (err instanceof Error ? err.message : String(err));
      log.error(`Failed to upgrade ${specStr}: ${msg}`);
      process.exit(1);
    }
  }
}

function cmdList(): void {
  const installer = new PackageInstaller(process.cwd());
  const packages = installer.list();

  if (packages.length === 0) {
    log.info('No packages installed.');
    return;
  }

  log.header('Installed Packages');
  const rows = [
    ['LANGUAGE', 'PACKAGE', 'VERSION', 'CONSTRAINT'],
    ...packages.map(p => [p.language, p.package, p.version, p.constraint]),
  ];
  log.table(rows);
  console.log();
}

function cmdInfo(args: string[]): void {
  if (args.length === 0) {
    log.error('Usage: bridger info <language>:<package>');
    process.exit(1);
  }

  const installer = new PackageInstaller(process.cwd());
  const spec = parseSpec(args[0]);
  const info = installer.info(spec.language, spec.packageName);

  if (!info || !info.installed) {
    log.info(`${spec.packageName} is not installed for ${spec.language}`);
    return;
  }

  log.header(`Package: ${spec.language}:${spec.packageName}`);
  log.info(`Version:      ${info.version}`);
  log.info(`Constraint:   ${info.constraint}`);
  log.info(`Dependencies: ${info.dependencies.length > 0 ? info.dependencies.join(', ') : 'none'}`);
  console.log();
}

function cmdInit(): void {
  const installer = new PackageInstaller(process.cwd());
  log.info('Detecting runtimes...');

  const runtimes = installer.getRuntimes();
  for (const [name, version] of Object.entries(runtimes)) {
    if (version) {
      log.success(`${name}: ${version}`);
    } else {
      log.info(`${name}: not found`);
    }
  }

  installer.init();
  log.success('Initialized bridger project');
  console.log();
}

function showHelp(): void {
  console.log(`
  Bridger - Universal Runtime Bridge

  Usage:
    bridger install <language>:<package>[@version]   Install a package
    bridger remove  <language>:<package>             Remove a package
    bridger upgrade <language>:<package>[@version]   Upgrade a package
    bridger list                                     List installed packages
    bridger info    <language>:<package>             Show package info
    bridger init                                     Initialize project

  Examples:
    bridger install python:numpy
    bridger install python:numpy@1.26.4
    bridger install php:spatie/collection
    bridger remove  python:pandas
    bridger list
  `);
}

// ═══════════════════════════════════════════════════════
//  Entry Point
// ═══════════════════════════════════════════════════════

export function runCLI(argv: string[]): void {
  const command = argv[0];
  const args = argv.slice(1);

  switch (command) {
    case 'install':
    case 'i':
    case 'add':
      cmdInstall(args);
      break;
    case 'remove':
    case 'rm':
    case 'uninstall':
      cmdRemove(args);
      break;
    case 'upgrade':
    case 'update':
    case 'up':
      cmdUpgrade(args);
      break;
    case 'list':
    case 'ls':
      cmdList();
      break;
    case 'info':
    case 'show':
      cmdInfo(args);
      break;
    case 'init':
      cmdInit();
      break;
    case '--help':
    case '-h':
    case 'help':
      showHelp();
      break;
    default:
      if (command) {
        log.error(`Unknown command: ${command}`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
}
