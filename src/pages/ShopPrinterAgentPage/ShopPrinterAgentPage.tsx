import React, { useCallback, useEffect, useState } from 'react';
import { Download, Printer, Renew, TrashCan } from '@carbon/icons-react';
import {
  daemonDeviceService,
  type AgentRelease,
  type DaemonDevice,
} from '../../services/daemonDeviceService';

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never';

export const ShopPrinterAgentPage: React.FC = () => {
  const [devices, setDevices] = useState<DaemonDevice[]>([]);
  const [release, setRelease] = useState<AgentRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isWindows = /Windows/i.test(navigator.userAgent);

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const [deviceRows, latestRelease] = await Promise.all([
        daemonDeviceService.listMine(),
        daemonDeviceService.latestRelease(),
      ]);
      setDevices(deviceRows);
      setRelease(latestRelease);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load printer-agent information.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(false), 0);
    const timer = window.setInterval(() => void load(false), 10_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [load]);

  const handleRescan = async (deviceId: string) => {
    setPendingDeviceId(deviceId);
    setMessage(null);
    try {
      const result = await daemonDeviceService.rescan(deviceId);
      setMessage({ type: 'success', text: result.message });
      window.setTimeout(() => void load(false), 1_500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to request a printer rescan.',
      });
    } finally {
      setPendingDeviceId(null);
    }
  };

  const handleRevoke = async (device: DaemonDevice) => {
    if (!window.confirm(`Revoke ${device.name}? It will no longer be allowed to print until it is registered again.`)) {
      return;
    }
    setPendingDeviceId(device.id);
    setMessage(null);
    try {
      const result = await daemonDeviceService.revoke(device.id);
      setMessage({ type: 'success', text: result.message });
      await load(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to revoke the printer agent.',
      });
    } finally {
      setPendingDeviceId(null);
    }
  };

  const activeDevices = devices.filter((device) => !device.revoked_at);
  const revokedDevices = devices.filter((device) => Boolean(device.revoked_at));

  return (
    <div className="w-full max-w-6xl p-5 font-sans sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-carbon-blue-60">Local printing</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-carbon-gray-100">Printer Agent</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Install the PrintFlow Printer Agent once on the Windows computer connected to your printers. It starts automatically and securely receives approved print jobs.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-6 border-l-4 px-4 py-3 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-green-600 bg-green-50 text-green-800'
              : 'border-red-600 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="mb-7 border border-gray-200 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
        <div className="flex flex-col gap-5 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-carbon-blue-60 text-white">
              <Download className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-black text-carbon-gray-100">Install on this printing computer</h2>
              <p className="mt-1 text-sm text-gray-600">
                Version {release?.version || '—'} for Windows
              </p>
            </div>
          </div>
          {release?.available && release.downloadUrl && isWindows ? (
            <a
              href={release.downloadUrl}
              className="inline-flex min-h-11 items-center justify-center bg-carbon-blue-60 px-5 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
            >
              <Download className="mr-2 h-5 w-5" />
              Download for Windows
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center bg-gray-300 px-5 text-sm font-bold text-gray-600"
            >
              <Download className="mr-2 h-5 w-5" />
              {!isWindows ? 'Windows computer required' : 'Installer not published yet'}
            </button>
          )}
        </div>
        <div className="grid gap-5 p-5 text-sm text-gray-700 sm:grid-cols-3 sm:p-6">
          <div><span className="mb-2 block font-black text-carbon-blue-60">01</span>Download and run the installer on the computer physically connected to the printer.</div>
          <div><span className="mb-2 block font-black text-carbon-blue-60">02</span>Sign in once with this verified print-shop account when the setup page opens.</div>
          <div><span className="mb-2 block font-black text-carbon-blue-60">03</span>Approve Windows startup. No terminal is required after setup.</div>
        </div>
        {release?.sha256 && (
          <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-600 sm:px-6">
            SHA-256: <code className="break-all font-mono">{release.sha256}</code>
          </div>
        )}
      </section>

      <section className="border border-gray-200 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-black text-carbon-gray-100">Registered printing computers</h2>
            <p className="mt-1 text-sm text-gray-500">Only one computer is used for live dispatch at a time.</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-carbon-gray-100"
            aria-label="Refresh printer agents"
          >
            <Renew className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            <div className="h-24 animate-pulse bg-gray-100" />
            <div className="h-24 animate-pulse bg-gray-100" />
          </div>
        ) : activeDevices.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Printer className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="font-black text-carbon-gray-100">No printer agent registered</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">Download the installer above and complete the one-time sign-in on your printing computer.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {activeDevices.map((device) => (
              <article key={device.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-black text-carbon-gray-100">{device.name}</h3>
                      <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider ${device.status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                        {device.status === 'CONNECTED' ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                      <span>Agent {device.agent_version || 'Unknown version'}</span>
                      <span>Last seen {formatDate(device.last_seen_at)}</span>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Detected printers</p>
                      <div className="flex flex-wrap gap-2">
                        {device.printers.length > 0 ? device.printers.map((printer) => (
                          <span key={printer} className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">{printer}</span>
                        )) : <span className="text-sm italic text-gray-400">No printers reported</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRescan(device.id)}
                      disabled={device.status !== 'CONNECTED' || pendingDeviceId === device.id}
                      className="inline-flex min-h-10 items-center border border-carbon-blue-60 px-4 text-sm font-bold text-carbon-blue-60 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                    >
                      <Renew className="mr-2 h-4 w-4" /> Rescan
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(device)}
                      disabled={pendingDeviceId === device.id}
                      className="inline-flex min-h-10 items-center border border-red-600 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <TrashCan className="mr-2 h-4 w-4" /> Revoke
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {revokedDevices.length > 0 && (
          <details className="border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
            <summary className="cursor-pointer text-sm font-bold text-gray-600">Revoked devices ({revokedDevices.length})</summary>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              {revokedDevices.map((device) => <li key={device.id}>{device.name} — revoked {formatDate(device.revoked_at)}</li>)}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
};
