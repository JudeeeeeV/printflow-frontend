import { ApiError } from './apiClient';
import type { OperationStatus } from './orderService';
import {
  clearRecovery,
  fileIdentity,
  isRecoveryStorageAvailable,
  newOperationKey,
  readRecovery,
  writeRecovery,
  type RecoveryOperation,
} from './submissionRecovery';

export type SubmissionPhase =
  | 'idle'
  | 'sending'
  | 'checking'
  | 'processing'
  | 'unconfirmed'
  | 'retry'
  | 'needs_file'
  | 'file_mismatch'
  | 'offline'
  | 'rate_limited'
  | 'duplicate';

export interface SubmissionSnapshot {
  phase: SubmissionPhase;
  isBusy: boolean;
  hasUnresolved: boolean;
  needsFile: boolean;
  duplicateOrderId: string | null;
  storageAvailable: boolean;
}

export interface SendArguments<F, A> {
  action: A;
  fields: F;
  file: File | null;
  key: string;
  confirmDuplicate: boolean;
}

export interface SubmissionConfig<T, A extends string, F> {
  scope: string;
  send: (args: SendArguments<F, A>) => Promise<unknown>;
  checkOperation: (key: string) => Promise<OperationStatus<T>>;
  onSuccess: (result: T, action: A, fields: F) => void;
  onFailure: (error: unknown, action: A, fields: F) => void;
}

const UNCONFIRMED_RECHECK_MS = 15_000;
const MAX_PROCESSING_RECHECK_MS = 5_000;

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** A write that may have reached the server must be checked, never assumed. */
function isUncertain(error: unknown) {
  if (!(error instanceof ApiError)) return true;
  if (error.kind === 'aborted') return false;
  return error.status === 0 || error.status >= 500;
}

function isProcessingResponse(value: unknown): value is { retryAfterSeconds?: number } {
  return !!value && typeof value === 'object' && (value as { status?: unknown }).status === 'processing';
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? (error.data as { code?: unknown } | undefined)?.code : undefined;
}

/**
 * Drives one recoverable student action. Automatic work is limited to reading
 * the operation's status: anything that resubmits starts from a student's click.
 */
export class SubmissionController<T, A extends string, F extends Record<string, unknown>> {
  private phase: SubmissionPhase = 'idle';
  private duplicate: { orderId: string; action: A; fields: F; file: File | null } | null = null;
  private fields: F | null = null;
  private operation: RecoveryOperation | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private readonly storageAvailable = isRecoveryStorageAvailable();

  private readonly config: SubmissionConfig<T, A, F>;
  private readonly notify: (snapshot: SubmissionSnapshot) => void;

  constructor(config: SubmissionConfig<T, A, F>, notify: (snapshot: SubmissionSnapshot) => void) {
    this.config = config;
    this.notify = notify;
  }

  get snapshot(): SubmissionSnapshot {
    return {
      phase: this.phase,
      isBusy: this.phase === 'sending' || this.phase === 'checking',
      hasUnresolved: this.operation !== null,
      needsFile: this.operation?.file != null,
      duplicateOrderId: this.duplicate?.orderId ?? null,
      storageAvailable: this.storageAvailable,
    };
  }

  private setPhase(phase: SubmissionPhase) {
    this.phase = phase;
    if (!this.disposed) this.notify(this.snapshot);
  }

  /** Returns saved fields, then checks any unresolved operation before asking for a file. */
  restore(): F | null {
    const record = readRecovery(this.config.scope);
    if (!record) return null;
    this.fields = record.fields as F;
    if (record.operation) {
      this.operation = record.operation;
      void this.check();
    }
    return this.fields;
  }

  saveFields(fields: F) {
    // An unresolved operation stays bound to the inputs it was sent with.
    if (this.operation) return;
    this.fields = fields;
    writeRecovery(this.config.scope, fields);
  }

  async submit(action: A, fields: F, file: File | null, options: { confirmDuplicate?: boolean } = {}) {
    if (this.snapshot.isBusy || this.operation) return;
    if (isOffline()) {
      this.saveFields(fields);
      this.setPhase('offline');
      return;
    }
    this.duplicate = null;
    this.fields = fields;
    this.operation = {
      key: newOperationKey(),
      action,
      file: fileIdentity(file),
      confirmDuplicate: options.confirmDuplicate,
    };
    // Persist before sending: a discarded tab must still know this key.
    writeRecovery(this.config.scope, fields, this.operation);
    await this.attempt(file);
  }

  /** Resubmits with the original key and inputs. Only ever called from a click. */
  async retry(file: File | null) {
    if (this.snapshot.isBusy || !this.operation) return;
    await this.attempt(file);
  }

  async submitAnyway() {
    if (!this.duplicate) return;
    const { action, fields, file } = this.duplicate;
    await this.submit(action, fields, file, { confirmDuplicate: true });
  }

  dismissDuplicate() {
    this.duplicate = null;
    this.setPhase('idle');
  }

  /** Abandons an unresolved operation. The student is warned it may still appear. */
  startOver() {
    clearTimeout(this.timer);
    this.operation = null;
    if (this.fields) writeRecovery(this.config.scope, this.fields);
    else clearRecovery(this.config.scope);
    this.setPhase('idle');
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }

  onReconnect() {
    if (this.phase === 'unconfirmed' || this.phase === 'offline') {
      if (this.operation) void this.check();
      else this.setPhase('idle');
    }
  }

  async check() {
    const operation = this.operation;
    if (!operation || this.phase === 'sending') return;
    clearTimeout(this.timer);
    this.setPhase('checking');
    let status: OperationStatus<T>;
    try {
      status = await this.config.checkOperation(operation.key);
    } catch {
      if (this.operation !== operation) return;
      this.setPhase('unconfirmed');
      this.recheckAfter(UNCONFIRMED_RECHECK_MS);
      return;
    }
    if (this.operation !== operation) return;
    if (status.status === 'succeeded') {
      this.complete(status.result as T);
    } else if (status.status === 'failed' && !status.retryAllowed) {
      const body = (status.error?.data ?? {}) as { message?: string };
      this.fail(
        new ApiError(body.message || 'This submission was not accepted.', status.error?.status ?? 400, status.error?.data),
      );
    } else if (status.status === 'processing' && !status.retryAllowed) {
      this.setPhase('processing');
      this.recheckAfter(Math.min((status.retryAfterSeconds ?? 5) * 1000, MAX_PROCESSING_RECHECK_MS));
    } else {
      this.setPhase('retry');
    }
  }

  private recheckAfter(delayMs: number) {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.check(), delayMs);
  }

  private async attempt(file: File | null) {
    const operation = this.operation as RecoveryOperation;
    if (operation.file && !file) {
      this.setPhase('needs_file');
      return;
    }
    if (isOffline()) {
      this.setPhase('offline');
      return;
    }
    if (file) {
      // A File is a reference; the phone may have dropped what it points to.
      try {
        await file.slice(0, 1).arrayBuffer();
      } catch {
        this.setPhase('needs_file');
        return;
      }
    }
    this.setPhase('sending');
    try {
      const response = await this.config.send({
        action: operation.action as A,
        fields: this.fields as F,
        file,
        key: operation.key,
        confirmDuplicate: operation.confirmDuplicate === true,
      });
      if (isProcessingResponse(response)) {
        this.setPhase('processing');
        this.recheckAfter(Math.min((response.retryAfterSeconds ?? 5) * 1000, MAX_PROCESSING_RECHECK_MS));
      } else {
        this.complete(response as T);
      }
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'rate_limited') this.setPhase('rate_limited');
      else if (isUncertain(error)) {
        this.phase = 'idle';
        await this.check();
      } else if (errorCode(error) === 'OPERATION_KEY_REUSED') this.setPhase('file_mismatch');
      else if (errorCode(error) === 'POSSIBLE_DUPLICATE') {
        const orderId = (error as ApiError).data as { orderId: string };
        this.duplicate = { orderId: orderId.orderId, action: operation.action as A, fields: this.fields as F, file };
        this.resolveOperation();
        this.setPhase('duplicate');
      } else this.fail(error);
    }
  }

  /** Keeps the student's fields, and frees the form for a new key. */
  private resolveOperation() {
    this.operation = null;
    if (this.fields) writeRecovery(this.config.scope, this.fields);
  }

  private complete(result: T) {
    const action = this.operation?.action as A;
    const fields = this.fields as F;
    this.operation = null;
    this.fields = null;
    clearRecovery(this.config.scope);
    this.setPhase('idle');
    if (!this.disposed) this.config.onSuccess(result, action, fields);
  }

  private fail(error: unknown) {
    const action = this.operation?.action as A;
    this.resolveOperation();
    this.setPhase('idle');
    if (!this.disposed) this.config.onFailure(error, action, this.fields as F);
  }
}
