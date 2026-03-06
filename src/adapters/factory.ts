/**
 * Bridger — Adapter Factory
 *
 * Factory Pattern: creates the correct LanguageAdapter based on language string.
 * New languages are added by registering a new factory function.
 *
 * SOLID — Open/Closed: new languages added without modifying existing code.
 */

import type { LanguageAdapter, SupportedLanguage, BridgerConfig } from '../types';
import { BridgerError, ErrorCode } from '../errors';
import { PythonAdapter } from './python';
import { PHPAdapter } from './php';

type AdapterConstructor = new (config: BridgerConfig) => LanguageAdapter;

const registry = new Map<SupportedLanguage, AdapterConstructor>();

// Register built-in adapters
registry.set('python', PythonAdapter);
registry.set('php', PHPAdapter);

/**
 * Create a LanguageAdapter for the given language.
 */
export function createAdapter(language: SupportedLanguage, config: BridgerConfig): LanguageAdapter {
  const Ctor = registry.get(language);
  if (!Ctor) {
    const supported = Array.from(registry.keys()).join(', ');
    throw new BridgerError(
      ErrorCode.UNSUPPORTED_LANGUAGE,
      `Unsupported language: "${language}". Supported: ${supported}`,
      { language },
    );
  }
  return new Ctor(config);
}

/**
 * Register a custom adapter for a language.
 * Allows community extensions to add new language support.
 */
export function registerAdapter(language: SupportedLanguage, ctor: AdapterConstructor): void {
  registry.set(language, ctor);
}

/**
 * Get the list of supported languages.
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return Array.from(registry.keys());
}
