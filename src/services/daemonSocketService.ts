import { io, Socket } from "socket.io-client";
import { API_URL } from "../config/runtime";

export type DaemonStatus = "CONNECTED" | "OFFLINE" | "RECONNECTING";

const STATUS_CHECK_INTERVAL_MS = 10_000;
const STATUS_STALE_AFTER_MS = 30_000;

class DaemonSocketService {
  private socket: Socket | null = null;
  private shopId: string | null = null;
  private status: DaemonStatus = "OFFLINE";
  private printers: string[] = [];
  private lastStatusAt = 0;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private statusListeners: ((status: DaemonStatus) => void)[] = [];
  private jobProgressListeners: ((data: {
    orderId: string;
    status: string;
  }) => void)[] = [];
  private printersListeners: ((printers: string[]) => void)[] = [];

  private readonly BACKEND_URL = `${API_URL}/daemon`;

  connect(shopId: string) {
    if (this.socket && this.shopId === shopId) {
      this.checkStatus();
      return;
    }
    this.disconnect();
    this.shopId = shopId;
    this.notifyStatus("RECONNECTING");

    this.socket = io(this.BACKEND_URL, {
      query: { shopId, role: "clerk" },
      withCredentials: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    });

    this.socket.on("connect", () => {
      this.lastStatusAt = Date.now();
      this.checkStatus();
    });

    this.socket.on("disconnect", () => {
      this.notifyStatus("RECONNECTING");
    });

    this.socket.on("connect_error", () => {
      this.notifyStatus("RECONNECTING");
    });

    this.socket.on("daemon_status", (data: { status: string }) => {
      if (data.status === "CONNECTED" || data.status === "OFFLINE") {
        this.lastStatusAt = Date.now();
        this.notifyStatus(data.status);
      }
    });

    this.socket.on(
      "job_progress",
      (data: { orderId: string; status: string }) => {
        this.jobProgressListeners.forEach((fn) => fn(data));
      },
    );

    this.socket.on("printers_list", (printers: string[]) => {
      if (this.status === "CONNECTED") this.notifyPrinters(printers);
    });

    this.statusTimer = setInterval(this.checkStatus, STATUS_CHECK_INTERVAL_MS);
    window.addEventListener("online", this.checkStatus);
    window.addEventListener("focus", this.checkStatus);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private checkStatus = () => {
    const socket = this.socket;
    if (!socket) return;
    if (!socket.connected) {
      this.notifyStatus("RECONNECTING");
      // Server-initiated disconnects do not use Socket.IO's automatic retries.
      if (!socket.active) socket.connect();
      return;
    }
    if (Date.now() - this.lastStatusAt >= STATUS_STALE_AFTER_MS) {
      this.notifyStatus("RECONNECTING");
    }
    socket.emit("check_daemon_status", { shopId: this.shopId });
  };

  private onVisibilityChange = () => {
    if (document.visibilityState === "visible") this.checkStatus();
  };

  disconnect() {
    if (this.statusTimer !== null) clearInterval(this.statusTimer);
    this.statusTimer = null;
    window.removeEventListener("online", this.checkStatus);
    window.removeEventListener("focus", this.checkStatus);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.shopId = null;
    this.lastStatusAt = 0;
    this.notifyStatus("OFFLINE");
  }

  onStatusChange(callback: (status: DaemonStatus) => void) {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  onJobProgress(callback: (data: { orderId: string; status: string }) => void) {
    this.jobProgressListeners.push(callback);
    return () => {
      this.jobProgressListeners = this.jobProgressListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  onPrintersList(callback: (printers: string[]) => void) {
    this.printersListeners.push(callback);
    callback(this.printers);
    return () => {
      this.printersListeners = this.printersListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  private notifyStatus(status: DaemonStatus) {
    this.status = status;
    if (status !== "CONNECTED") this.notifyPrinters([]);
    this.statusListeners.forEach((fn) => fn(status));
  }

  private notifyPrinters(printers: string[]) {
    this.printers = printers;
    this.printersListeners.forEach((fn) => fn(printers));
  }
}

export const daemonSocketService = new DaemonSocketService();
