/**
 * Client API kết nối với Spring Boot Backend cho History Management (http://localhost:8080/api/v1/history)
 */
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/auth$/, '') + '/history';

async function request(endpoint, options = {}) {
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

export const historyApi = {
  /**
   * Lưu lịch sử gia công từ Frontend lên CSDL Backend (POST /api/v1/history)
   */
  async saveHistory(email, historyData) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(query, {
      method: 'POST',
      body: JSON.stringify(historyData)
    });
  },

  /**
   * Lấy danh sách lịch sử gia công có phân trang
   */
  async getHistory(email, page = 0, size = 20) {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (email) {
      params.append('email', email);
    }
    return request(`?${params.toString()}`, {
      method: 'GET'
    });
  },

  /**
   * Xem chi tiết 1 bản ghi lịch sử
   */
  async getHistoryDetail(historyId, email) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(`/${historyId}${query}`, {
      method: 'GET'
    });
  },

  /**
   * Xóa bản ghi lịch sử
   */
  async deleteHistory(historyId, email) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(`/${historyId}${query}`, {
      method: 'DELETE'
    });
  }
};
