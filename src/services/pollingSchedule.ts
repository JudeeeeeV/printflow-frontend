const POLL_WITHOUT_STREAM_MS = 5_000;
const POLL_WITH_STREAM_MS = 20_000;
const FAILURE_BACKOFF_MS = [10_000, 20_000, 40_000, 60_000];

export function nextPollDelayMs({
  failures,
  retryAfterMs,
  streamConnected,
}: {
  failures: number;
  retryAfterMs?: number;
  streamConnected: boolean;
}): number {
  if (failures > 0) {
    const backoff = FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1];
    return Math.max(backoff, retryAfterMs ?? 0);
  }
  return streamConnected ? POLL_WITH_STREAM_MS : POLL_WITHOUT_STREAM_MS;
}
