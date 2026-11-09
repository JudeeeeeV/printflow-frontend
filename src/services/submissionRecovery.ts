import { getAccountId } from './apiClient';

const PREFIX = 'pf_recovery:';
const VERSION = 1;

export interface FileIdentity {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface RecoveryOperation {
  key: string;
  action: string;
  file: FileIdentity | null;
  confirmDuplicate?: boolean;
}

/** Never holds file contents, object URLs, signed URLs, or credentials. */
export interface RecoveryRecord {
  version: number;
  account: string;
  fields: Record<string, unknown>;
  operation?: RecoveryOperation;
}

export function newOperationKey(): string {
  // randomUUID needs a secure context and iOS 15.4+.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function fileIdentity(file: File | null | undefined): FileIdentity | null {
  if (!file) return null;
  return { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified };
}

const memory = new Map<string, RecoveryRecord>();

function browserStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function isRecoveryStorageAvailable(): boolean {
  try {
    const storage = browserStorage();
    if (!storage) return false;
    storage.setItem(`${PREFIX}probe`, '1');
    storage.removeItem(`${PREFIX}probe`);
    return true;
  } catch {
    return false;
  }
}

export function readRecovery(scope: string): RecoveryRecord | null {
  let record = memory.get(scope) ?? null;
  if (!record) {
    try {
      const stored = browserStorage()?.getItem(PREFIX + scope);
      record = stored ? (JSON.parse(stored) as RecoveryRecord) : null;
    } catch {
      return null;
    }
  }
  // A record from another account must never be restored or overwritten as ours.
  return record?.version === VERSION && record.account === getAccountId() ? record : null;
}

export function writeRecovery(scope: string, fields: Record<string, unknown>, operation?: RecoveryOperation): void {
  const record: RecoveryRecord = { version: VERSION, account: getAccountId(), fields, operation };
  memory.set(scope, record);
  try {
    browserStorage()?.setItem(PREFIX + scope, JSON.stringify(record));
  } catch {
    // The in-memory copy still covers everything short of a reload.
  }
}

export function clearRecovery(scope: string): void {
  memory.delete(scope);
  try {
    browserStorage()?.removeItem(PREFIX + scope);
  } catch {
    // Nothing further can be cleared without storage access.
  }
}

export function clearAllRecovery(): void {
  memory.clear();
  try {
    const storage = browserStorage();
    if (!storage) return;
    Object.keys(storage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing further can be cleared without storage access.
  }
}
