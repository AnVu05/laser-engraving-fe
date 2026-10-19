/**
 * Client API kết nối với Spring Boot Backend cho IoT Job Dispatching & Kiểm tra SHA-256
 * Endpoint: http://localhost:8080/api/v1/jobs
 */
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/auth$/, '') + '/jobs';

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
        throw new Error('Không thể kết nối đến Cloud Backend (http://localhost:8080).');
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
        throw new Error('Không thể kết nối đến Cloud Backend (http://localhost:8080).');
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
   * Lấy đường dẫn tải file bảo mật
   */
  getDownloadUrl(jobId) {
    return `${BASE_URL}/${jobId}/download`;
  }
};
