/**
 * Client API kết nối với Spring Boot Backend cho Project Management (http://localhost:8080/api/v1/projects)
 */
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/auth$/, '') + '/projects';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = localStorage.getItem('laser_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
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

export const projectApi = {
  /**
   * Lưu dự án lên server CSDL
   */
  async saveProject(email, projectData) {
    const rawId = projectData.projectId ?? projectData.id;
    const numericId = typeof rawId === 'number' ? rawId : (!isNaN(Number(rawId)) ? Number(rawId) : null);

    return request(`?email=${encodeURIComponent(email)}`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: numericId,
        projectName: projectData.name || projectData.projectName,
        elementCount: projectData.elementCount || (projectData.elements ? projectData.elements.length : 0),
        elementsJson: typeof projectData.elements === 'string' ? projectData.elements : JSON.stringify(projectData.elements),
        parametersJson: typeof projectData.parameters === 'string' ? projectData.parameters : JSON.stringify(projectData.parameters),
        thumbnailUrl: projectData.thumbnailUrl || null
      })
    });
  },

  /**
   * Lấy danh sách dự án của người dùng
   */
  async getProjects(email) {
    return request(`?email=${encodeURIComponent(email)}`, {
      method: 'GET'
    });
  },

  /**
   * Xem chi tiết một dự án
   */
  async getProjectDetail(projectId, email) {
    return request(`/${projectId}?email=${encodeURIComponent(email)}`, {
      method: 'GET'
    });
  },

  /**
   * Xóa dự án
   */
  async deleteProject(projectId, email) {
    return request(`/${projectId}?email=${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
  }
};
