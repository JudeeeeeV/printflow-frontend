import { apiClient } from './apiClient';

export interface DaemonDevice {
  id: string;
  shop_id: string;
  name: string;
  agent_version: string | null;
  printers: string[];
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  status: 'CONNECTED' | 'OFFLINE';
}

export interface AgentRelease {
  available: boolean;
  platform: 'windows';
  version: string;
  fileName: string;
  downloadUrl: string | null;
  sha256: string | null;
  publishedAt: string | null;
}

export const daemonDeviceService = {
  // Live printer status: always read the current list.
  listMine: () =>
    apiClient<DaemonDevice[]>('/daemon-devices/mine', { cache: 'no-store' }),
  latestRelease: () => apiClient<AgentRelease>('/agent-releases/latest'),
  rescan: (deviceId: string) =>
    apiClient<{ message: string }>(`/daemon-devices/${deviceId}/rescan`, {
      method: 'POST',
    }),
  revoke: (deviceId: string) =>
    apiClient<{ message: string }>(`/daemon-devices/${deviceId}/revoke`, {
      method: 'POST',
    }),
};
