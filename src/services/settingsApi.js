/**
 * Client API kết nối với Spring Boot Backend cho Laser Machine Settings (http://localhost:8080/api/v1/settings)
 */
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/auth$/, '') + '/settings';

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
      throw new Error('Không thể kết nối đến máy chủ backend (http://localhost:8080).');
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
