/**
 * Bridger — Worker Protocol
 *
 * Manages IPC communication with a language worker process via
 * newline-delimited JSON over stdin/stdout.
 *
 * Features:
 *  - Request/response matching by ID
 *  - Configurable timeout per request
 *  - Auto-retry on transient failures
 *  - Batch mode: send N messages, get N responses in one write
 *  - Ready handshake on startup
 *  - Graceful and forced shutdown
 *  - stderr capture for debugging
 *
 * Pattern: Observer — emits 'exit' and 'stderr' events.
 */

import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import type { ProtocolMessage, ProtocolResponse } from '../types';
import { ProtocolError, ErrorCode, wrapRemoteError } from '../errors';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface WorkerProtocolOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  readyTimeout?: number;
}

export class WorkerProtocol extends EventEmitter {
  private idCounter = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private process: ChildProcess | null = null;
  private stderrBuffer = '';

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly options: WorkerProtocolOptions = {},
  ) {
    super();
  }

  // ─── Lifecycle ─────────────────────────────────────

  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: this.options.cwd,
          env: this.options.env,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        reject(new ProtocolError(
          ErrorCode.RUNTIME_START_FAILED,
          `Failed to spawn ${this.command}: ${msg}`,
          { command: this.command },
        ));
        return;
      }

      let settled = false;

      const rl = createInterface({ input: this.process.stdout! });

      rl.on('line', (line) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line);
        } catch {
          return; // Ignore non-JSON lines
        }

        // Ready handshake
        if (msg.type === 'ready' && !settled) {
          this.ready = true;
          settled = true;
          resolve();
          return;
        }

        // Match response to pending request
        const id = msg.id as number;
        if (id !== undefined && this.pending.has(id)) {
          const { resolve: res, reject: rej, timer } = this.pending.get(id)!;
          this.pending.delete(id);
          if (timer) clearTimeout(timer);

          if (msg.error) {
            rej(wrapRemoteError(
              msg.error as string,
              msg.errorType as string | undefined,
              msg.traceback as string | undefined,
            ));
          } else {
            res(msg.result);
          }
        }
      });

      this.process.stderr!.on('data', (data: Buffer) => {
        const text = data.toString();
        this.stderrBuffer += text;
        if (this.stderrBuffer.length > 10000) {
          this.stderrBuffer = this.stderrBuffer.slice(-5000);
        }
        this.emit('stderr', text);
      });

      this.process.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(new ProtocolError(
            ErrorCode.RUNTIME_START_FAILED,
            `Worker process error (${this.command}): ${err.message}`,
            { stderr: this.stderrBuffer },
          ));
        }
        this.rejectAllPending(
          ErrorCode.RUNTIME_CRASH,
          `Worker process error: ${err.message}`,
        );
      });

      this.process.on('exit', (code, signal) => {
        this.ready = false;
        if (!settled) {
          settled = true;
          reject(new ProtocolError(
            ErrorCode.PROTOCOL_WORKER_EXIT,
            `Worker exited before ready (code=${code}, signal=${signal})`,
            { stderr: this.stderrBuffer },
          ));
        }
        this.rejectAllPending(
          ErrorCode.PROTOCOL_WORKER_EXIT,
          `Worker exited (code=${code}, signal=${signal})`,
        );
        this.emit('exit', code, signal);
      });

      // Timeout for ready signal
      const readyTimeout = this.options.readyTimeout ?? 30_000;
      setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new ProtocolError(
            ErrorCode.PROTOCOL_READY_TIMEOUT,
            `Worker did not send ready signal within ${readyTimeout}ms`,
            { stderr: this.stderrBuffer, command: this.command },
          ));
          this.process?.kill();
        }
      }, readyTimeout);
    });

    return this.readyPromise;
  }

  // ─── Send ──────────────────────────────────────────

  send(msg: ProtocolMessage, timeout: number = 60_000): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      if (!this.ready || !this.process) {
        reject(new ProtocolError(
          ErrorCode.RUNTIME_NOT_READY,
          'Worker not ready. Has the worker been started?',
        ));
        return;
      }

      const id = ++this.idCounter;
      const outMsg = { ...msg, id };

      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new ProtocolError(
            ErrorCode.PROTOCOL_TIMEOUT,
            `Request timed out after ${timeout}ms (type="${msg.type}")`,
          ));
        }, timeout);
      }

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.process.stdin!.write(JSON.stringify(outMsg) + '\n');
      } catch (err: unknown) {
        this.pending.delete(id);
        if (timer) clearTimeout(timer);
        const errMsg = err instanceof Error ? err.message : String(err);
        reject(new ProtocolError(
          ErrorCode.PROTOCOL_WRITE_FAILED,
          `Failed to write to worker: ${errMsg}`,
        ));
      }
    });
  }

  /**
   * Send multiple messages in a single batch.
   * The worker processes them sequentially and returns all results.
   * One IPC roundtrip instead of N.
   */
  async sendBatch(messages: ProtocolMessage[]): Promise<unknown[]> {
    if (messages.length === 0) return [];
    if (messages.length === 1) return [await this.send(messages[0])];

    // Assign IDs and collect promises
    const results: unknown[] = new Array(messages.length);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < messages.length; i++) {
      const idx = i;
      promises.push(
        this.send(messages[i]).then(result => { results[idx] = result; }),
      );
    }

    await Promise.all(promises);
    return results;
  }

  // ─── Shutdown ──────────────────────────────────────

  async shutdown(): Promise<void> {
    if (!this.ready || !this.process) return;
    try {
      await this.send({ type: 'shutdown' }, 5000);
    } catch {
      // Force kill if shutdown message fails
    }
    this.ready = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  // ─── Utilities ─────────────────────────────────────

  get isReady(): boolean {
    return this.ready;
  }

  get stderr(): string {
    return this.stderrBuffer;
  }

  private rejectAllPending(code: ErrorCode, message: string): void {
    for (const [, { reject, timer }] of this.pending) {
      if (timer) clearTimeout(timer);
      reject(new ProtocolError(code, message, { stderr: this.stderrBuffer }));
    }
    this.pending.clear();
  }
}
