import { Client } from '@stomp/stompjs';
import { getWebSocketUrl } from './apiConfig';

/**
 * Service quản lý kết nối STOMP WebSocket tới Cloud Broker (Spring Boot)
 * Endpoint: ws://localhost:8080/ws/client
 */

// Xác định WS URL dựa trên biến môi trường hoặc host hiện tại
const getDefaultBrokerUrl = () => {
  return getWebSocketUrl();
};

class StompWebSocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionListeners = new Set();
    this.activeSubscriptions = new Map(); // key -> stompSubscription
  }

  /**
   * Khởi tạo và kích hoạt kết nối STOMP
   */
  connect() {
    if (this.client && this.client.active) {
      return this.client;
    }

    const brokerUrl = getDefaultBrokerUrl();

    this.client = new Client({
      brokerURL: brokerUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (str) => {
        if (import.meta.env.DEV && import.meta.env.VITE_WS_DEBUG === 'true') {
          console.debug('[STOMP-WS]', str);
        }
      },
      onConnect: (frame) => {
        this.isConnected = true;
        console.log('[STOMP-WS] Đã kết nối thành công tới Cloud Broker:', brokerUrl);
        this._notifyConnectionListeners(true, null);
      },
      onDisconnect: () => {
        this.isConnected = false;
        console.warn('[STOMP-WS] Đã ngắt kết nối STOMP.');
        this._notifyConnectionListeners(false, null);
      },
      onStompError: (frame) => {
        this.isConnected = false;
        const errMsg = frame.headers['message'] || 'STOMP error';
        console.error('[STOMP-WS] Lỗi giao thức STOMP:', errMsg, frame.body);
        this._notifyConnectionListeners(false, errMsg);
      },
      onWebSocketError: (event) => {
        this.isConnected = false;
        console.error('[STOMP-WS] Lỗi WebSocket Socket connection:', event);
        this._notifyConnectionListeners(false, 'Lỗi kết nối Socket');
      }
    });

    this.client.activate();
    return this.client;
  }

  /**
   * Đóng kết nối
   */
  disconnect() {
    if (this.client) {
      this.activeSubscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (_) {}
      });
      this.activeSubscriptions.clear();
      this.client.deactivate();
      this.isConnected = false;
      this._notifyConnectionListeners(false, null);
    }
  }

  /**
   * Đăng ký lắng nghe trạng thái kết nối
   */
  addConnectionListener(callback) {
    this.connectionListeners.add(callback);
    // Báo ngay trạng thái hiện tại
    callback(this.isConnected, null);
    return () => this.connectionListeners.delete(callback);
  }

  _notifyConnectionListeners(connected, error) {
    this.connectionListeners.forEach((cb) => {
      try {
        cb(connected, error);
      } catch (err) {
        console.error('[STOMP-WS] Lỗi trong connection listener:', err);
      }
    });
  }

  /**
   * Đăng ký nhận dữ liệu từ một Destination Topic
   * @param {string} destination - Ví dụ: /topic/jobs/JOB-001/progress
   * @param {Function} callback - Hàm nhận payload đã JSON.parse
   * @returns {Function} Hàm unsubscribe
   */
  subscribe(destination, callback) {
    // Đảm bảo client đã kích hoạt kết nối
    if (!this.client || !this.client.active) {
      this.connect();
    }

    const subKey = `${destination}_${Math.random().toString(36).slice(2, 7)}`;

    const performSubscription = () => {
      if (!this.client || !this.client.connected) return null;

      try {
        const stompSub = this.client.subscribe(destination, (message) => {
          try {
            const data = JSON.parse(message.body);
            callback(data);
          } catch (e) {
            callback(message.body);
          }
        });
        this.activeSubscriptions.set(subKey, stompSub);
        return stompSub;
      } catch (err) {
        console.error(`[STOMP-WS] Không thể subscribe ${destination}:`, err);
        return null;
      }
    };

    // Nếu đã kết nối thì subscribe ngay
    if (this.isConnected) {
      performSubscription();
    }

    // Lắng nghe kết nối lại để tự động re-subscribe
    const unsubConn = this.addConnectionListener((connected) => {
      if (connected) {
        performSubscription();
      }
    });

    // Trả về hàm hủy đăng ký
    return () => {
      unsubConn();
      const existing = this.activeSubscriptions.get(subKey);
      if (existing) {
        try {
          existing.unsubscribe();
        } catch (_) {}
        this.activeSubscriptions.delete(subKey);
      }
    };
  }

  /**
   * Helper: Lắng nghe tiến độ riêng của một Job
   * Destination: /topic/jobs/{jobCode}/progress
   */
  subscribeToJobProgress(jobCode, callback) {
    if (!jobCode) return () => {};
    return this.subscribe(`/topic/jobs/${jobCode}/progress`, callback);
  }

  /**
   * Helper: Lắng nghe trạng thái riêng của một Job
   * Destination: /topic/jobs/{jobCode}/status
   */
  subscribeToJobStatus(jobCode, callback) {
    if (!jobCode) return () => {};
    return this.subscribe(`/topic/jobs/${jobCode}/status`, callback);
  }

  /**
   * Helper: Lắng nghe tiến độ chung của toàn hệ thống Web Client
   * Destination: /topic/client/progress
   */
  subscribeToClientProgress(callback) {
    return this.subscribe('/topic/client/progress', callback);
  }

  /**
   * Helper: Lắng nghe thông báo Job mới được Dispatch
   * Destination: /topic/client/jobs
   */
  subscribeToClientJobs(callback) {
    return this.subscribe('/topic/client/jobs', callback);
  }

  /**
   * Helper: Lắng nghe trạng thái thay đổi của các Thiết bị khắc
   * Destination: /topic/devices/status
   */
  subscribeToDeviceStatus(callback) {
    return this.subscribe('/topic/devices/status', callback);
  }
}

// Khởi tạo instance Singleton dùng xuyên suốt ứng dụng
export const websocketService = new StompWebSocketService();
export default websocketService;
