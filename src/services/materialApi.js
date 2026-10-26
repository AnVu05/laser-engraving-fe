/**
 * Client API kết nối với Spring Boot Backend cho Material Presets (http://localhost:8080/api/v1/materials)
 */
import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/materials`;

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

export const materialApi = {
  /**
   * Lấy danh sách vật liệu mẫu (bao gồm vật liệu hệ thống + của user)
   */
  async getMaterials(email) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(query, {
      method: 'GET'
    });
  },

  /**
   * Xem chi tiết 1 vật liệu theo ID
   */
  async getMaterialById(id) {
    return request(`/${id}`, {
      method: 'GET'
    });
  },

  /**
   * Xem chi tiết 1 vật liệu theo mã khóa key (VD: mat-plywood)
   */
  async getMaterialByKey(key) {
    return request(`/key/${encodeURIComponent(key)}`, {
      method: 'GET'
    });
  },

  /**
   * Tạo mới vật liệu mẫu tùy chỉnh
   */
  async createMaterial(email, materialData) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(query, {
      method: 'POST',
      body: JSON.stringify(materialData)
    });
  },

  /**
   * Cập nhật vật liệu mẫu tùy chỉnh
   */
  async updateMaterial(id, email, materialData) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(`/${id}${query}`, {
      method: 'PUT',
      body: JSON.stringify(materialData)
    });
  },

  /**
   * Xóa vật liệu mẫu tùy chỉnh
   */
  async deleteMaterial(id, email) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return request(`/${id}${query}`, {
      method: 'DELETE'
    });
  },

  /**
   * Khởi tạo lại các vật liệu chuẩn hệ thống
   */
  async initDefaults() {
    return request('/init-defaults', {
      method: 'POST'
    });
  }
};
