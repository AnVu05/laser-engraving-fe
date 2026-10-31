/**
 * Client API kết nối với Spring Boot Backend cho IoT Job Dispatching & Kiểm tra SHA-256
 * Endpoint: http://localhost:8080/api/v1/jobs
 */
import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/jobs`;

export const jobApi = {
  /**
   * Điều phối Job khắc laser tới máy (JSON Body với chuỗi G-code)
   * @param {Object} jobData - { deviceCode, originalFilename, gcodeContent, targetWidthMm, targetHeightMm, feedRate, laserPower, materialType, userId }
   */
  async dispatchJobJson(jobData) {
    try {
      const res = await fetch(`${BASE_URL}/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(jobData)
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Không thể kết nối tới API máy chủ. Kiểm tra URL dịch vụ và trạng thái Cloudflare Tunnel.');
      }
      throw err;
    }
  },

  /**
   * Điều phối Job khắc laser tới máy (Tải file Multipart)
   * @param {File|Blob} file - Tệp G-code (.gcode, .nc)
   * @param {Object} params - Tham số vùng khắc và tốc độ
   */
  async dispatchJobMultipart(file, params = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deviceCode', params.deviceCode || 'LASER-HN-001');

    if (params.targetWidthMm !== undefined) formData.append('targetWidthMm', params.targetWidthMm);
    if (params.targetHeightMm !== undefined) formData.append('targetHeightMm', params.targetHeightMm);
    if (params.feedRate !== undefined) formData.append('feedRate', params.feedRate);
    if (params.laserPower !== undefined) formData.append('laserPower', params.laserPower);
    if (params.materialType) formData.append('materialType', params.materialType);
    if (params.userId) formData.append('userId', params.userId);

    try {
      const res = await fetch(`${BASE_URL}/dispatch`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Không thể kết nối tới API máy chủ. Kiểm tra URL dịch vụ và trạng thái Cloudflare Tunnel.');
      }
      throw err;
    }
  },

  /**
   * Tra cứu chi tiết một Job theo Job Code
   */
  async getJobByCode(jobCode) {
    try {
      const res = await fetch(`${BASE_URL}/code/${jobCode}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lấy danh sách Jobs theo máy khắc
   */
  async getJobsByDevice(deviceCode = 'LASER-HN-001') {
    try {
      const res = await fetch(`${BASE_URL}?deviceCode=${encodeURIComponent(deviceCode)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Hủy bỏ / Dừng khẩn cấp một Job gia công
   */
  async cancelJob(jobCode) {
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(jobCode)}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lấy Telemetry thời gian thực từ Cloud Gateway (toạ độ X/Y, tiến độ %, cảm biến)
   * GET /api/v1/jobs/{jobCode}/telemetry
   */
  async getJobTelemetry(jobCode) {
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(jobCode)}/telemetry`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Gửi lệnh điều khiển máy tức thời qua Cloud (PAUSE, RESUME, CANCEL, HOME)
   * POST /api/v1/jobs/{jobCode}/command
   */
  async sendJobCommand(jobCode, action, reason = '') {
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(jobCode)}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ action, reason })
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Xác nhận an toàn vật liệu tại chỗ bởi Quản máy / Admin
   */
  async confirmJob(jobCode) {
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(jobCode)}/confirm`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lấy danh sách toàn bộ các Jobs trong hệ thống
   */
  async getAllJobs() {
    try {
      const res = await fetch(`${BASE_URL}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || (data && data.success === false)) {
        throw new Error((data && data.message) || `Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lấy danh sách toàn bộ các máy khắc Laser IoT
   */
  async getDevices() {
    const devicesUrl = BASE_URL.replace(/\/jobs$/, '/devices');
    try {
      const res = await fetch(devicesUrl, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Tra cứu thông số và trạng thái kết nối thời gian thực của máy khắc cụ thể (VD: LASER-HN-001)
   */
  async getDeviceByCode(deviceCode) {
    const deviceUrl = `${BASE_URL.replace(/\/jobs$/, '/devices')}/${encodeURIComponent(deviceCode)}`;
    try {
      const res = await fetch(deviceUrl, {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Lỗi HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  async updateDeviceConfig(deviceCode, config) {
    const res = await fetch(`${BASE_URL.replace(/\/jobs$/, `/devices/${encodeURIComponent(deviceCode)}/config`)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Lỗi HTTP ${res.status}`);
    return data;
  },

  async rotateDeviceToken(deviceCode) {
    const res = await fetch(`${BASE_URL.replace(/\/jobs$/, `/devices/${encodeURIComponent(deviceCode)}/token`)}`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Lỗi HTTP ${res.status}`);
    return data;
  },

  /**
   * Gửi lệnh trực tiếp xuống thiết bị (FRAME, HOME, PAUSE, RESUME, CANCEL)
   */
  async sendDeviceCommand(deviceCode, payload) {
    const url = `${BASE_URL.replace(/\/jobs$/, `/devices/${encodeURIComponent(deviceCode)}/commands`)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Lỗi HTTP ${res.status}`);
    return data;
  },

  /**
   * Lấy đường dẫn tải file bảo mật
   */
  getDownloadUrl(jobId) {
    return `${BASE_URL}/${jobId}/download`;
  }
};
