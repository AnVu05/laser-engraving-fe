/**
 * Client API kết nối với Spring Boot Backend cho G-code Generation (http://localhost:8080/api/v1/gcode)
 */
import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/gcode`;

export const gcodeApi = {
  /**
   * Tải ảnh lên và yêu cầu Backend sinh mã G-code bất đồng bộ (Java Virtual Threads)
   */
  async generateGCode(file, params = {}) {
    const formData = new FormData();
    formData.append('image', file);

    if (params.originXMm !== undefined) formData.append('originXMm', params.originXMm);
    if (params.originYMm !== undefined) formData.append('originYMm', params.originYMm);
    if (params.targetWidthMm !== undefined) formData.append('targetWidthMm', params.targetWidthMm);
    if (params.targetHeightMm !== undefined) formData.append('targetHeightMm', params.targetHeightMm);
    if (params.engravingSpeed !== undefined) formData.append('engravingSpeed', params.engravingSpeed);
    if (params.laserPower !== undefined) formData.append('laserPower', params.laserPower);
    if (params.dpi !== undefined) formData.append('dpi', params.dpi);
    if (params.materialName) formData.append('materialName', params.materialName);
    if (params.ditherAlgorithm) formData.append('ditherAlgorithm', params.ditherAlgorithm);

    try {
      const res = await fetch(`${BASE_URL}/generate`, {
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
        throw new Error('Không thể kết nối đến máy chủ backend (http://localhost:8080).');
      }
      throw err;
    }
  },

  /**
   * Tải tệp .nc vật lý từ máy chủ
   */
  getDownloadUrl(historyId) {
    return `${BASE_URL}/download/${historyId}`;
  }
};
