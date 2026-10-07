import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../services/authApi';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [view, setView] = useState('signin'); // 'signin' | 'register' | 'otp'
  const [isLoading, setIsLoading] = useState(false);
  
  // Sign in state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [gmailError, setGmailError] = useState('');

  // OTP state
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // Toast / feedback message
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Auto clear message after 4s
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer = null;
    if (view === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, countdown]);

  if (!isOpen) return null;

  // Real-time Gmail validation
  const handleRegEmailChange = (val) => {
    setRegEmail(val);
    const trimmed = val.trim().toLowerCase();
    if (trimmed && !trimmed.endsWith('@gmail.com')) {
      setGmailError('⚠️ Email đăng ký bắt buộc phải có đuôi @gmail.com');
    } else {
      setGmailError('');
    }
  };



  // Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    if (!email.includes('@') || !email.includes('.')) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập địa chỉ email hợp lệ!'
      });
      return;
    }
    if (!loginPassword) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập mật khẩu!'
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.login(email, loginPassword);
      if (res.data) {
        // Token được lưu an toàn trong HttpOnly Cookie bởi Backend (chống XSS)
        localStorage.setItem('laser_user_email', res.data?.user?.email || email);
        localStorage.setItem('laser_user_name', res.data?.user?.username || email.split('@')[0]);
      }
      setMessage({
        type: 'success',
        text: res.message || `Đăng nhập thành công! Chào mừng ${email}`
      });
      setTimeout(() => {
        if (onAuthSuccess) {
          onAuthSuccess({
            email: res.data?.user?.email || email,
            name: res.data?.user?.username || email.split('@')[0],
            provider: 'gmail'
          });
        }
        onClose();
      }, 1000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc kết nối máy chủ.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Register Submit Handler -> Navigate to OTP
  const handleRegister = async (e) => {
    e.preventDefault();
    const email = regEmail.trim().toLowerCase();
    if (!email.endsWith('@gmail.com')) {
      setMessage({
        type: 'error',
        text: 'Chỉ chấp nhận đăng ký bằng tài khoản @gmail.com!'
      });
      return;
    }
    if (regPassword.length < 6) {
      setMessage({
        type: 'error',
        text: 'Mật khẩu phải có ít nhất 6 ký tự!'
      });
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setMessage({
        type: 'error',
        text: 'Mật khẩu và xác nhận mật khẩu không trùng khớp!'
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.register(email, regPassword, regConfirmPassword);
      setOtpTargetEmail(email);
      setOtpDigits(['', '', '', '', '', '']);
      setCountdown(59);
      setCanResend(false);
      setView('otp');
      const otpCodeInfo = res.data?.otpCode ? ` (Mã OTP xác thực: ${res.data.otpCode})` : '';
      setMessage({
        type: 'success',
        text: (res.message || `Mã OTP xác thực 6 chữ số đã được gửi tới ${email}`) + otpCodeInfo
      });
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Đăng ký thất bại. Vui lòng thử lại!' });
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Input Cell Handler
  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextEmptyIndex = newDigits.findIndex((d) => !d);
    if (nextEmptyIndex !== -1) {
      otpInputRefs.current[nextEmptyIndex]?.focus();
    } else {
      otpInputRefs.current[5]?.focus();
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setIsLoading(true);
    try {
      const res = await authApi.resendOtp(otpTargetEmail);
      setCountdown(59);
      setCanResend(false);
      const otpCodeInfo = res.data?.otpCode ? ` (Mã OTP mới: ${res.data.otpCode})` : '';
      setMessage({
        type: 'success',
        text: (res.message || `Đã gửi lại mã OTP mới tới ${otpTargetEmail}!`) + otpCodeInfo
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại!' });
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP Handler
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập đầy đủ 6 chữ số mã OTP!'
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp(otpTargetEmail, code);
      if (res.data) {
        // Token được lưu an toàn trong HttpOnly Cookie bởi Backend (chống XSS)
        localStorage.setItem('laser_user_email', res.data?.user?.email || otpTargetEmail);
        localStorage.setItem('laser_user_name', res.data?.user?.username || otpTargetEmail.split('@')[0]);
      }
      setMessage({
        type: 'success',
        text: res.message || 'Xác thực tài khoản thành công! Đang đăng nhập...'
      });
      setTimeout(() => {
        if (onAuthSuccess) {
          onAuthSuccess({
            email: res.data?.user?.email || otpTargetEmail,
            name: res.data?.user?.username || otpTargetEmail.split('@')[0],
            provider: 'gmail_otp'
          });
        }
        onClose();
      }, 1000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Mã xác thực OTP không chính xác hoặc đã hết hạn!' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay auth-modal-overlay" onClick={onClose}>
      <div 
        className="auth-modal-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(11, 28, 48, 0.12), 0 1px 3px rgba(11, 28, 48, 0.05)',
          border: '1px solid rgba(195, 198, 215, 0.6)',
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
          animation: 'modal-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close Button Top-Right */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: '#737686',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s'
          }}
          title="Đóng cửa sổ"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>

        {/* Ambient Top Glow */}
        <div 
          style={{
            position: 'absolute',
            top: -40,
            left: -40,
            width: 140,
            height: 140,
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderRadius: '50%',
            filter: 'blur(30px)',
            pointerEvents: 'none'
          }} 
        />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div 
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#eff4ff',
              border: '1px solid rgba(195, 198, 215, 0.5)',
              color: '#2563eb',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              position: 'relative'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>adjust</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0b1c30', letterSpacing: '-0.02em' }}>
            Laser<span style={{ color: '#2563eb' }}>Studio</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#565e74' }}>
            Hệ thống điều khiển máy khắc laser chuẩn xác & tinh gọn
          </p>
        </div>

        {/* Feedback Alert Toast */}
        {message && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: message.type === 'error' ? '#b91c1c' : '#15803d',
              border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {message.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span style={{ flex: 1 }}>{message.text}</span>
          </div>
        )}

        {/* View Switcher Tabs (Only visible on Sign In & Register) */}
        {view !== 'otp' && (
          <div 
            style={{
              display: 'flex',
              backgroundColor: '#eff4ff',
              padding: 3,
              borderRadius: 8,
              marginBottom: 18,
              border: '1px solid rgba(195, 198, 215, 0.4)'
            }}
          >
            <button
              type="button"
              onClick={() => { setView('signin'); setMessage(null); }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: view === 'signin' ? 600 : 500,
                backgroundColor: view === 'signin' ? '#ffffff' : 'transparent',
                color: view === 'signin' ? '#0b1c30' : '#565e74',
                boxShadow: view === 'signin' ? '0 1px 3px rgba(11, 28, 48, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setView('register'); setMessage(null); }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: view === 'register' ? 600 : 500,
                backgroundColor: view === 'register' ? '#ffffff' : 'transparent',
                color: view === 'register' ? '#0b1c30' : '#565e74',
                boxShadow: view === 'register' ? '0 1px 3px rgba(11, 28, 48, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Đăng ký
            </button>
          </div>
        )}

        {/* ===================== VIEW 1: SIGN IN ===================== */}
        {view === 'signin' && (
          <div>
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#434655', marginBottom: 4 }}>
                  Địa chỉ Gmail
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}>
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="username@gmail.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 10,
                      borderRadius: 6,
                      border: '1px solid #c3c6d7',
                      fontSize: 12,
                      color: '#0b1c30',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                    onBlur={(e) => (e.target.style.borderColor = '#c3c6d7')}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#434655', marginBottom: 4 }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}>
                    lock
                  </span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 34,
                      borderRadius: 6,
                      border: '1px solid #c3c6d7',
                      fontSize: 12,
                      color: '#0b1c30',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                    onBlur={(e) => (e.target.style.borderColor = '#c3c6d7')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      color: '#737686',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#565e74' }}>
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Ghi nhớ</span>
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.'); }} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 38,
                  marginTop: 6,
                  borderRadius: 8,
                  backgroundColor: isLoading ? '#93c5fd' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#004ac6'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {isLoading ? 'sync' : 'arrow_forward'}
                </span>
              </button>

              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#565e74' }}>
                <span>Chưa có tài khoản Gmail? </span>
                <button
                  type="button"
                  onClick={() => { setView('register'); setMessage(null); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Đăng ký ngay
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== VIEW 2: REGISTER ===================== */}
        {view === 'register' && (
          <div>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#434655', marginBottom: 4 }}>
                  Địa chỉ Gmail xác thực
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}>
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="username@gmail.com"
                    value={regEmail}
                    onChange={(e) => handleRegEmailChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 10,
                      borderRadius: 6,
                      border: `1px solid ${gmailError ? '#ba1a1a' : '#c3c6d7'}`,
                      fontSize: 12,
                      color: '#0b1c30',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = gmailError ? '#ba1a1a' : '#2563eb')}
                    onBlur={(e) => (e.target.style.borderColor = gmailError ? '#ba1a1a' : '#c3c6d7')}
                  />
                </div>
                {gmailError && (
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ba1a1a', fontFamily: 'var(--font-mono, monospace)' }}>
                    {gmailError}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#434655', marginBottom: 4 }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}>
                    lock
                  </span>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 34,
                      borderRadius: 6,
                      border: '1px solid #c3c6d7',
                      fontSize: 12,
                      color: '#0b1c30',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      color: '#737686',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {showRegPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#434655', marginBottom: 4 }}>
                  Xác nhận mật khẩu
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}>
                    verified_user
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 10,
                      borderRadius: 6,
                      border: '1px solid #c3c6d7',
                      fontSize: 12,
                      color: '#0b1c30',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 38,
                  marginTop: 6,
                  borderRadius: 8,
                  backgroundColor: isLoading ? '#93c5fd' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#004ac6'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                <span>{isLoading ? 'Đang gửi mã OTP...' : 'Tiếp tục & Nhận mã OTP qua Gmail'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {isLoading ? 'sync' : 'send'}
                </span>
              </button>

              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#565e74' }}>
                <span>Đã có tài khoản Gmail? </span>
                <button
                  type="button"
                  onClick={() => { setView('signin'); setMessage(null); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Đăng nhập ngay
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== VIEW 3: OTP VERIFICATION ===================== */}
        {view === 'otp' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: '#eff4ff',
                border: '1px solid rgba(195, 198, 215, 0.5)',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                mark_email_read
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0b1c30' }}>
              Xác thực mã OTP Gmail
            </h3>
            <p style={{ margin: '4px auto 18px', fontSize: 12, color: '#565e74', maxWidth: 320, lineHeight: 1.4 }}>
              Nhập mã xác thực 6 chữ số vừa được gửi tới hộp thư:
              <strong style={{ display: 'block', color: '#2563eb', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                {otpTargetEmail}
              </strong>
            </p>

            <form onSubmit={handleVerifyOtp}>
              {/* 6 Digit Cells */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  marginBottom: 16 
                }}
                onPaste={handleOtpPaste}
              >
                {[0, 1, 2].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpDigits[idx]}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: 40,
                      height: 44,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#0b1c30',
                      backgroundColor: '#ffffff',
                      borderRadius: 6,
                      border: '1.5px solid #c3c6d7',
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#c3c6d7';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}

                <span style={{ color: '#737686', fontWeight: 700 }}>–</span>

                {[3, 4, 5].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpDigits[idx]}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: 40,
                      height: 44,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#0b1c30',
                      backgroundColor: '#ffffff',
                      borderRadius: 6,
                      border: '1.5px solid #c3c6d7',
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#c3c6d7';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}
              </div>

              {/* Countdown / Resend */}
              <div style={{ marginBottom: 18, fontSize: 11, color: '#565e74', fontFamily: 'var(--font-mono, monospace)' }}>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Gửi lại mã OTP qua Gmail
                  </button>
                ) : (
                  <span>
                    Chưa nhận được mã? Gửi lại sau (
                    <strong style={{ color: '#2563eb' }}>
                      00:{countdown < 10 ? `0${countdown}` : countdown}
                    </strong>
                    )
                  </span>
                )}
              </div>

              {/* Submit & Back buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: isLoading ? '#93c5fd' : '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#004ac6'; }}
                  onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isLoading ? 'sync' : 'verified'}
                  </span>
                  <span>{isLoading ? 'Đang kích hoạt tài khoản...' : 'Xác thực & Kích hoạt tài khoản'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView('register');
                    setMessage(null);
                  }}
                  style={{
                    width: '100%',
                    height: 34,
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#565e74',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff4ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                  <span>Quay lại thay đổi Gmail</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Footer */}
        <div 
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: '1px solid rgba(195, 198, 215, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: '#737686'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563eb' }}>
            lock
          </span>
          <span>Bảo mật HttpOnly Cookie & Chuẩn xác thực RFC 7519 JWT</span>
        </div>
      </div>
    </div>
  );
}
