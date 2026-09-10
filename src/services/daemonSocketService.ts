import { io, Socket } from 'socket.io-client';

export type DaemonStatus = 'CONNECTED' | 'OFFLINE' | 'RECONNECTING';

class DaemonSocketService {
  private socket: Socket | null = null;
  private statusListeners: ((status: DaemonStatus) => void)[] = [];
  private jobProgressListeners: ((data: { orderId: string, status: string }) => void)[] = [];
  private printersListeners: ((printers: string[]) => void)[] = [];
  
  // Update this to match your backend URL
  private readonly BACKEND_URL = 'https://printflow-backend-wen3.onrender.com/daemon'; 

  connect(shopId: string) {
    if (this.socket) {
      return;
    }

    this.socket = io(this.BACKEND_URL, {
      query: { shopId, role: 'clerk' },
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      // Check status immediately upon connection
      this.socket?.emit('check_daemon_status', { shopId });
    });

    this.socket.on('disconnect', () => {
      this.notifyStatus('OFFLINE');
    });

    this.socket.on('connect_error', () => {
      this.notifyStatus('RECONNECTING');
    });

    this.socket.on('daemon_status', (data: { status: string }) => {
      if (data.status === 'CONNECTED' || data.status === 'OFFLINE') {
        this.notifyStatus(data.status);
      }
    });

    this.socket.on('job_progress', (data: { orderId: string, status: string }) => {
      this.jobProgressListeners.forEach(fn => fn(data));
    });

    this.socket.on('printers_list', (printers: string[]) => {
      this.printersListeners.forEach(fn => fn(printers));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.notifyStatus('OFFLINE');
    }
  }

  onStatusChange(callback: (status: DaemonStatus) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(fn => fn !== callback);
    };
  }

  onJobProgress(callback: (data: { orderId: string, status: string }) => void) {
    this.jobProgressListeners.push(callback);
    return () => {
      this.jobProgressListeners = this.jobProgressListeners.filter(fn => fn !== callback);
    };
  }

  onPrintersList(callback: (printers: string[]) => void) {
    this.printersListeners.push(callback);
    return () => {
      this.printersListeners = this.printersListeners.filter(fn => fn !== callback);
    };
  }

  private notifyStatus(status: DaemonStatus) {
    this.statusListeners.forEach(fn => fn(status));
  }
}

export const daemonSocketService = new DaemonSocketService();
