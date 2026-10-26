/**
 * Client API kết nối với Spring Boot Backend cho Laser Machine Settings (http://localhost:8080/api/v1/settings)
 */
import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/settings`;

async function request(endpoint = '', options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });
    const data = await res.json();
    if (!res.ok || (data && data.success === false)) {
      const errMsg = (data && data.message) || `Yêu cầu thất bại với mã lỗi HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return data;
  } catch (err) {
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Không thể kết nối tới API máy chủ. Kiểm tra URL dịch vụ và trạng thái Cloudflare Tunnel.');
    }
    throw err;
  }
}

export const settingsApi = {
  /**
   * Lấy cấu hình tham số mặc định của máy laser từ server CSDL
   */
  async getSettings() {
    return request('', {
      method: 'GET'
    });
  },

  /**
   * Cập nhật cấu hình máy laser
   */
  async updateSettings(settingsData) {
    return request('', {
      method: 'PUT',
      body: JSON.stringify(settingsData)
    });
  }
};
