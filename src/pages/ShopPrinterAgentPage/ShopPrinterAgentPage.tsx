import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Checkmark,
  Download,
  Printer,
  Renew,
  Screen,
  TrashCan,
  WarningAlt,
} from "@carbon/icons-react";
import {
  daemonDeviceService,
  type AgentRelease,
  type DaemonDevice,
} from "../../services/daemonDeviceService";
import { PrinterAgentSkeleton } from "./PrinterAgentSkeleton";

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

export const ShopPrinterAgentPage: React.FC = () => {
  const [devices, setDevices] = useState<DaemonDevice[]>([]);
  const [release, setRelease] = useState<AgentRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<DaemonDevice | null>(
    null,
  );
  const [allowAdditionalInstall, setAllowAdditionalInstall] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const isWindows = /Windows/i.test(navigator.userAgent);
  const revokeDialogRef = useRef<HTMLDivElement>(null);
  const cancelRevokeRef = useRef<HTMLButtonElement>(null);
  const devicesLoadingRef = useRef(false);

  const load = useCallback(async (showLoader = false) => {
    if (devicesLoadingRef.current) return;
    devicesLoadingRef.current = true;
    if (showLoader) setIsLoading(true);
    try {
      const deviceRows = await daemonDeviceService.listMine();
      setDevices(deviceRows);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to load printer-agent information.",
      });
    } finally {
      devicesLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => void load(false);
    const initialTimer = window.setTimeout(refresh, 0);
    const timer = window.setInterval(() => void load(false), 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    // Installer metadata must not block live printer counts and device status.
    void daemonDeviceService
      .latestRelease()
      .then((latestRelease) => {
        if (!cancelled) setRelease(latestRelease);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage({
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Installer download information is unavailable.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deviceToRevoke) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRevokeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [deviceToRevoke]);

  const handleRescan = async (deviceId: string) => {
    setPendingDeviceId(deviceId);
    setMessage(null);
    try {
      const result = await daemonDeviceService.rescan(deviceId);
      setMessage({ type: "success", text: result.message });
      window.setTimeout(() => void load(false), 1_500);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to request a printer rescan.",
      });
    } finally {
      setPendingDeviceId(null);
    }
  };

  const handleRevoke = async (device: DaemonDevice) => {
    setDeviceToRevoke(null);
    setPendingDeviceId(device.id);
    setMessage(null);
    try {
      const result = await daemonDeviceService.revoke(device.id);
      setMessage({ type: "success", text: result.message });
      await load(false);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to revoke the printer agent.",
      });
    } finally {
      setPendingDeviceId(null);
    }
  };

  const handleRevokeDialogKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDeviceToRevoke(null);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      revokeDialogRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) || [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const activeDevices = devices.filter((device) => !device.revoked_at);
  const currentVersionDevice = release
    ? activeDevices.find(
        (device) =>
          device.status === "CONNECTED" &&
          device.agent_version === release.version,
      )
    : undefined;
  const shouldBlockDownload =
    Boolean(currentVersionDevice) && !allowAdditionalInstall;

  if (isLoading && !release && devices.length === 0) {
    return (
      <div
        className="mx-auto w-full min-w-0 max-w-7xl bg-carbon-gray-10 p-4 font-sans sm:p-6 lg:p-8"
        aria-busy="true"
      >
        <PrinterAgentSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 bg-carbon-gray-10 p-4 font-sans text-carbon-gray-100 sm:space-y-6 sm:p-6 lg:p-8">
      <header className="border border-black bg-carbon-gray-100 px-4 py-3 text-white shadow-[0_8px_24px_rgba(22,22,22,0.06)] sm:px-6 sm:py-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
          Local printing
        </p>
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          Printer Agent
        </h1>
        <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-gray-300">
          Connect your printing computer, detect printers, and receive approved
          print jobs automatically.
        </p>
      </header>

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-3 border border-l-4 px-4 py-3 text-sm font-semibold [overflow-wrap:anywhere] ${message.type === "success" ? "border-green-300 border-l-green-600 bg-green-50 text-green-800" : "border-red-300 border-l-red-600 bg-red-50 text-red-800"}`}
        >
          {message.type === "success" ? (
            <Checkmark className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <WarningAlt
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <section
        aria-labelledby="agent-install-title"
        className="border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]"
      >
        <div className="flex flex-col gap-4 border-b border-gray-300 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-carbon-gray-100 text-white">
              <Download className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="agent-install-title"
                className="text-lg font-black tracking-tight"
              >
                Install on this printing computer
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                One-time setup. Starts automatically with Windows.
              </p>
              <p className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 border border-black bg-carbon-gray-10 px-2 py-1 text-xs font-semibold text-gray-700 [overflow-wrap:anywhere]">
                <span>Windows</span>
                <span aria-hidden="true" className="text-gray-400">
                  /
                </span>
                <span>Version {release?.version || "—"}</span>
              </p>
            </div>
          </div>
          {shouldBlockDownload ? (
            <div className="flex shrink-0 flex-col items-stretch gap-1 lg:items-end">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 border border-green-300 bg-green-50 px-5 py-2 text-sm font-bold text-green-800"
              >
                <Checkmark className="h-5 w-5 shrink-0" aria-hidden="true" />
                Already installed
              </button>
              <button
                type="button"
                onClick={() => setAllowAdditionalInstall(true)}
                className="min-h-11 px-2 py-2 text-sm font-bold text-carbon-blue-60 underline-offset-4 transition-colors hover:bg-blue-50 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
              >
                Install on another computer
              </button>
            </div>
          ) : release?.available && release.downloadUrl && isWindows ? (
            <a
              href={release.downloadUrl}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-carbon-blue-60 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
            >
              <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
              Download for Windows
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 border border-black bg-carbon-gray-10 px-5 py-3 text-sm font-bold text-gray-600"
            >
              <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!isWindows
                ? "Windows computer required"
                : "Installer not published yet"}
            </button>
          )}
        </div>
        {currentVersionDevice && (
          <div className="flex flex-col gap-2 border-b border-gray-300 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-carbon-blue-70 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <p className="min-w-0 [overflow-wrap:anywhere]">
              <span className="font-bold">{currentVersionDevice.name}</span> is
              connected with Printer Agent {release?.version}.
            </p>
            {allowAdditionalInstall && (
              <button
                type="button"
                onClick={() => setAllowAdditionalInstall(false)}
                className="min-h-11 shrink-0 px-2 py-2 text-sm font-bold text-carbon-blue-60 underline-offset-4 transition-colors hover:bg-blue-100 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
              >
                Cancel additional install
              </button>
            )}
          </div>
        )}
        <div className="p-4 sm:p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-600">
            Get started in three steps
          </p>
          <ol className="grid list-none gap-3 lg:grid-cols-3">
            <li className="border border-black bg-carbon-gray-10 p-4">
              <span
                aria-hidden="true"
                className="mb-4 flex h-9 w-9 items-center justify-center bg-carbon-blue-60 text-sm font-bold tabular-nums text-white"
              >
                01
              </span>
              <h3 className="text-base font-bold">Install the agent</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Download and run the installer on the Windows computer
                physically connected to your printer.
              </p>
            </li>
            <li className="border border-black bg-carbon-gray-10 p-4">
              <span
                aria-hidden="true"
                className="mb-4 flex h-9 w-9 items-center justify-center bg-carbon-blue-60 text-sm font-bold tabular-nums text-white"
              >
                02
              </span>
              <h3 className="text-base font-bold">Connect your shop</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Sign in once with this verified print-shop account when the
                setup page opens.
              </p>
            </li>
            <li className="border border-black bg-carbon-gray-10 p-4">
              <span
                aria-hidden="true"
                className="mb-4 flex h-9 w-9 items-center justify-center bg-carbon-blue-60 text-sm font-bold tabular-nums text-white"
              >
                03
              </span>
              <h3 className="text-base font-bold">Enable startup</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Approve Windows startup. The agent starts automatically; no
                terminal is required after setup.
              </p>
            </li>
          </ol>
        </div>
        {release?.sha256 && (
          <div className="flex min-w-0 flex-col gap-2 border-t border-gray-300 bg-carbon-gray-10 px-4 py-3 text-xs text-gray-600 sm:px-6">
            <span className="font-bold uppercase tracking-[0.12em]">
              Installer verification · SHA-256
            </span>
            <code className="break-all font-mono leading-relaxed">
              {release.sha256}
            </code>
          </div>
        )}
      </section>

      <section
        aria-labelledby="registered-computers-title"
        aria-busy={isLoading}
        className="border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-300 p-4 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="registered-computers-title"
                className="text-lg font-black tracking-tight"
              >
                Registered printing computers
              </h2>
              {!isLoading && (
                <span className="border border-black bg-carbon-gray-10 px-2 py-1 text-xs font-bold tabular-nums text-gray-700">
                  {activeDevices.length}{" "}
                  {activeDevices.length === 1 ? "computer" : "computers"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Only one computer is used for live dispatch at a time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-black bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
            aria-label="Refresh printer agents"
          >
            <Renew className="h-5 w-5" aria-hidden="true" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <PrinterAgentSkeleton variant="computers" />
        ) : activeDevices.length === 0 ? (
          <div className="m-4 flex flex-col items-center border border-dashed border-black bg-carbon-gray-10 px-4 py-10 text-center sm:m-6">
            <span className="mb-4 flex h-14 w-14 items-center justify-center border border-black bg-white text-carbon-blue-60">
              <Screen className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold">No printer agent registered</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
              Download the installer above and complete the one-time sign-in on
              your printing computer.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-6">
            {activeDevices.map((device) => (
              <article
                key={device.id}
                aria-labelledby={`device-${device.id}-title`}
                aria-busy={pendingDeviceId === device.id}
                className="min-w-0 border border-black"
              >
                <div
                  className={`flex min-w-0 flex-col gap-4 border-b border-gray-300 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between ${device.status === "CONNECTED" ? "bg-blue-50" : "bg-carbon-gray-10"}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center ${device.status === "CONNECTED" ? "bg-carbon-blue-60 text-white" : "border border-black bg-white text-gray-600"}`}
                    >
                      <Screen className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          id={`device-${device.id}-title`}
                          className={`min-w-0 text-lg font-black tracking-tight [overflow-wrap:anywhere] ${device.status === "CONNECTED" ? "text-carbon-blue-70 sm:text-xl" : "text-carbon-gray-100"}`}
                        >
                          {device.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-bold ${device.status === "CONNECTED" ? "border-green-300 bg-green-50 text-green-800" : "border-gray-300 bg-white text-gray-600"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${device.status === "CONNECTED" ? "bg-green-600" : "bg-gray-400"}`}
                          />
                          {device.status === "CONNECTED"
                            ? "Connected"
                            : "Offline"}
                        </span>
                      </div>
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-relaxed text-gray-600">
                        <div className="min-w-0 [overflow-wrap:anywhere]">
                          <dt className="inline font-semibold">Agent </dt>
                          <dd className="inline">
                            {device.agent_version || "Unknown version"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold">Last seen </dt>
                          <dd className="inline">
                            {formatDate(device.last_seen_at)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRescan(device.id)}
                      disabled={
                        device.status !== "CONNECTED" ||
                        pendingDeviceId === device.id
                      }
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-black bg-white px-4 py-2 text-sm font-bold text-carbon-blue-60 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:border-black disabled:bg-carbon-gray-10 disabled:text-gray-500 motion-reduce:transition-none sm:flex-none"
                    >
                      <Renew className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Rescan
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceToRevoke(device)}
                      disabled={pendingDeviceId === device.id}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-black bg-white px-4 py-2 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:border-black disabled:bg-carbon-gray-10 disabled:text-gray-500 motion-reduce:transition-none sm:flex-none"
                    >
                      <TrashCan
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <h4 className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-600">
                    Detected printers
                    <span className="border border-black bg-carbon-gray-10 px-2 py-0.5 tracking-normal tabular-nums">
                      {device.printers.length}
                    </span>
                  </h4>
                  {device.printers.length > 0 ? (
                    <ul className="divide-y divide-gray-200 border border-black">
                      {device.printers.map((printer) => (
                        <li
                          key={printer}
                          className="flex min-w-0 items-center gap-3 px-3 py-4 sm:gap-4 sm:px-4"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-black bg-carbon-gray-10 text-gray-600">
                            <Printer className="h-6 w-6" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 text-sm font-semibold leading-relaxed text-carbon-gray-100 [overflow-wrap:anywhere]">
                            {printer}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-3 border border-dashed border-black bg-carbon-gray-10 p-4 text-sm text-gray-600">
                      <Printer
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <p>No printers reported</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {deviceToRevoke && (
        <div
          className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeviceToRevoke(null);
          }}
        >
          <div
            ref={revokeDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-agent-title"
            aria-describedby="revoke-agent-description"
            onKeyDown={handleRevokeDialogKeyDown}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-black bg-white shadow-2xl"
          >
            <div className="p-6 sm:p-7">
              <span className="mb-5 flex h-11 w-11 items-center justify-center bg-carbon-gray-100 text-white">
                <TrashCan className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="revoke-agent-title"
                className="text-xl font-black tracking-tight text-carbon-gray-100"
              >
                Revoke printer agent?
              </h2>
              <p
                id="revoke-agent-description"
                className="mt-3 text-sm leading-relaxed text-gray-600"
              >
                <span className="font-bold text-carbon-gray-100 [overflow-wrap:anywhere]">
                  {deviceToRevoke.name}
                </span>{" "}
                will be disconnected and removed from this shop. The computer
                must be registered again before it can receive print jobs.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-200">
              <button
                ref={cancelRevokeRef}
                type="button"
                onClick={() => setDeviceToRevoke(null)}
                className="min-h-12 border-r border-gray-200 bg-white px-4 text-sm font-bold text-carbon-gray-100 transition-colors motion-reduce:transition-none hover:bg-carbon-gray-10 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60"
              >
                Keep connected
              </button>
              <button
                type="button"
                onClick={() => void handleRevoke(deviceToRevoke)}
                className="min-h-12 bg-carbon-gray-100 px-4 text-sm font-bold text-white transition-colors motion-reduce:transition-none hover:bg-black focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60"
              >
                Revoke agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
