/**
 * Bridger — Base Language Adapter
 *
 * Abstract base class implementing the LanguageAdapter interface.
 * Provides shared functionality (start, stop, send, retry, restart)
 * while deferring language-specific details to subclasses.
 *
 * Patterns:
 *  - Template Method: subclasses override buildSpawnArgs/buildSpawnEnv
 *  - Adapter: wraps WorkerProtocol behind clean interface
 *
 * SOLID:
 *  - Single Responsibility: manages one language worker lifecycle
 *  - Open/Closed: extend via subclass without modifying base
 *  - Liskov Substitution: all adapters interchangeable
 *  - Dependency Inversion: depends on LanguageAdapter interface
 */

import * as path from 'path';
import type { LanguageAdapter, ProtocolMessage, SupportedLanguage, BridgerConfig } from '../types';
import { WorkerProtocol, type WorkerProtocolOptions } from '../protocol/worker';
import { RuntimeError, ProtocolError, ErrorCode } from '../errors';

/** Workers directory — sibling to the adapters/ folder inside dist/. */
export const WORKERS_DIR = path.resolve(__dirname, '..', 'workers');

export abstract class BaseAdapter implements LanguageAdapter {
  abstract readonly language: SupportedLanguage;

  protected protocol: WorkerProtocol | null = null;
  protected config: BridgerConfig;
  protected runtimesDir: string;
  private restartAttempts = 0;
  private readonly maxRestartAttempts: number;

  constructor(config: BridgerConfig) {
    this.config = config;
    this.runtimesDir = path.join(config.projectRoot, '.runtimes');
    this.maxRestartAttempts = config.maxRetries;
  }

  // ─── Abstract: subclasses must implement ───────────

  /** Return the command and args to spawn the worker process */
  protected abstract buildSpawnCommand(): { command: string; args: string[] };

  /** Return environment variables for the worker process */
  protected abstract buildSpawnEnv(): NodeJS.ProcessEnv;

  /** Return working directory for the worker process */
  protected abstract buildSpawnCwd(): string;

  // ─── Lifecycle ─────────────────────────────────────

  async start(): Promise<void> {
    if (this.protocol?.isReady) return;

    const { command, args } = this.buildSpawnCommand();
    const env = this.buildSpawnEnv();
    const cwd = this.buildSpawnCwd();

    this.protocol = new WorkerProtocol(command, args, { cwd, env });

    // Auto-restart on crash
    this.protocol.on('exit', () => {
      this.protocol = null;
    });

    try {
      await this.protocol.start();
    } catch (err) {
      this.protocol = null;
      if (err instanceof ProtocolError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new RuntimeError(
        ErrorCode.RUNTIME_START_FAILED,
        `Failed to start ${this.language} worker: ${msg}`,
        { language: this.language },
      );
    }

    // Verify connection
    const ok = await this.ping();
    if (!ok) {
      throw new RuntimeError(
        ErrorCode.RUNTIME_START_FAILED,
        `${this.language} worker started but failed ping check`,
        { language: this.language },
      );
    }

    this.restartAttempts = 0;
  }

  async stop(): Promise<void> {
    if (this.protocol) {
      await this.protocol.shutdown();
      this.protocol = null;
    }
  }

  isRunning(): boolean {
    return this.protocol?.isReady ?? false;
  }

  // ─── Send with auto-restart ────────────────────────

  async send(msg: ProtocolMessage, timeout?: number): Promise<unknown> {
    // Ensure started
    if (!this.protocol?.isReady) {
      await this.ensureRunning();
    }

    try {
      return await this.protocol!.send(msg, timeout ?? this.config.workerTimeout);
    } catch (err) {
      // If the worker crashed, try restarting once
      if (err instanceof ProtocolError && err.code === ErrorCode.PROTOCOL_WORKER_EXIT) {
        if (this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          await this.start();
          return this.protocol!.send(msg, timeout ?? this.config.workerTimeout);
        }
      }
      throw err;
    }
  }

  async sendBatch(messages: ProtocolMessage[]): Promise<unknown[]> {
    if (!this.protocol?.isReady) {
      await this.ensureRunning();
    }
    return this.protocol!.sendBatch(messages);
  }

  // ─── Import ────────────────────────────────────────

  async importModule(moduleName: string): Promise<void> {
    await this.send({ type: 'import', module: moduleName });
  }

  async importFrom(moduleName: string, names: string[]): Promise<Record<string, unknown>> {
    const result = await this.send({
      type: 'import_from',
      module: moduleName,
      names,
    });
    return result as Record<string, unknown>;
  }

  // ─── Health check ──────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const result = await this.protocol!.send({ type: 'ping' }, 5000);
      return result === 'pong';
    } catch {
      return false;
    }
  }

  // ─── Private ───────────────────────────────────────

  private async ensureRunning(): Promise<void> {
    if (this.protocol?.isReady) return;
    await this.start();
  }
}
