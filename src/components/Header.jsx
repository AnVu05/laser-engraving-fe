import React from 'react';

export default function Header({
  activeTab,
  setActiveTab,
  isConnected,
  isConnecting,
  portName,
  onConnect,
  onDisconnect,
  onNewWorkspace,
  onOpenProjects,
  onOpenHistory,
  onOpenConsole,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  return (
    <header className="studio-header">
      <div className="header-left">
        <div className="brand-badge" onClick={() => setActiveTab('canvas-studio')}>
          <span className="material-symbols-outlined brand-icon">target</span>
          <span className="brand-title">Laser Studio</span>
        </div>

        <nav className="nav-tabs">
          <button
            type="button"
            className="nav-tab-btn"
            onClick={onNewWorkspace}
            title="Khởi tạo một bàn làm việc mới sạch sẽ (300 × 200 mm)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              add_circle
            </span>
            <span>Bàn mới</span>
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'canvas-studio' ? 'active' : ''}`}
            onClick={() => setActiveTab('canvas-studio')}
          >
            Bàn cắt
          </button>
          <button
            type="button"
            className="nav-tab-btn"
            onClick={onOpenProjects}
            title="Xem và nạp lại các dự án đã lưu trên máy chủ SQL Server"
          >
            Dự án đã lưu
          </button>
          <button
            type="button"
            className="nav-tab-btn"
            onClick={onOpenHistory}
          >
            Lịch sử
          </button>
          <button
            type="button"
            className="nav-tab-btn"
            onClick={onOpenConsole}
          >
            Console GRBL
          </button>
        </nav>
      </div>

      <div className="header-right">
        {/* Machine Status Pill */}
        <div className="connection-status-pill">
          <span
            className={`status-dot ${
              isConnected ? 'connected' : isConnecting ? 'busy' : 'disconnected'
            }`}
          />
          <span>
            {isConnected
              ? `Máy khắc: Đã kết nối (${portName || 'COM3'})`
              : isConnecting
              ? 'Đang kết nối...'
              : 'Máy khắc: Chưa kết nối'}
          </span>
        </div>

        {isConnected ? (
          <button
            type="button"
            className="btn-header-action connected"
            onClick={onDisconnect}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              link_off
            </span>
            <span>Ngắt kết nối</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-header-action"
            onClick={onConnect}
            disabled={isConnecting}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              usb
            </span>
            <span>Kết nối máy</span>
          </button>
        )}

        {/* User Auth Profile & Logout Button */}
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div 
              className="user-profile-badge" 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-container-low)',
                border: '1px solid rgba(195, 198, 215, 0.4)'
              }}
              title={`Đã đăng nhập: ${currentUser.email}`}
            >
              <div
                className="user-avatar"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-container)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_circle</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name || currentUser.fullName || currentUser.email.split('@')[0]}
              </span>
            </div>

            <button
              type="button"
              className="btn-header-action"
              onClick={() => {
                if (window.confirm(`Đăng xuất khỏi tài khoản ${currentUser.email}?`)) {
                  onLogout();
                }
              }}
              title="Đăng xuất khỏi tài khoản này"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444' }}>
                logout
              </span>
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-header-action"
            onClick={onOpenAuth}
            style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'var(--outline-variant)' }}
            title="Đăng nhập / Đăng ký Gmail"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary-container)' }}>
              login
            </span>
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
}
