/**
 * Client API kết nối với Spring Boot Backend (http://localhost:8080/api/v1/auth)
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1/auth';

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
    // If backend is not running or network failed
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Không thể kết nối đến máy chủ backend (http://localhost:8080). Vui lòng kiểm tra lại dịch vụ Spring Boot!');
    }
    throw err;
  }
}

export const authApi = {
  /**
   * Đăng ký tài khoản với Gmail & Mật khẩu (Phát mã OTP 6 số)
   */
  async register(email, password, confirmPassword) {
    return request('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirmPassword })
    });
  },

  /**
   * Xác thực mã OTP 6 số để kích hoạt tài khoản
   */
  async verifyOtp(email, otp) {
    return request('/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  /**
   * Gửi lại mã OTP sau thời gian đếm ngược 59s
   */
  async resendOtp(email) {
    return request('/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  /**
   * Đăng nhập với Gmail & Mật khẩu
   */
  async login(email, password) {
    return request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  /**
   * Đăng nhập hoặc đăng ký nhanh thông qua Google OAuth
   */
  async googleAuth(email, name, googleId) {
    return request('/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, googleId })
    });
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe(email) {
    const targetEmail = email || localStorage.getItem('laser_user_email');
    if (!targetEmail || targetEmail === 'undefined') {
      throw new Error('Chưa có thông tin email để truy vấn tài khoản.');
    }
    return request(`/me?email=${encodeURIComponent(targetEmail)}`, {
      method: 'GET'
    });
  }
};
