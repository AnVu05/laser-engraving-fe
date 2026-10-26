import React, { useState, useEffect, useCallback } from 'react';
import { jobApi } from '../services/jobApi';

/**
 * Giao diện Quản trị & Điều hành Máy Laser (Admin & Machine Operator View)
 * Sử dụng 100% design system và tokens hiện có (không tạo system design mới).
 */
export default function AdminDashboardView({
  onBackToStudio,
  onNotify,
  onOpenJobProgress
}) {
  const [devices, setDevices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('ALL'); // 'ALL' | 'AWAITING' | 'PRINTING' | 'COMPLETED'
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [configDrafts, setConfigDrafts] = useState({});
  const [configBusy, setConfigBusy] = useState(null);
  const [issuedToken, setIssuedToken] = useState(null);

  // Tải danh sách thiết bị và jobs từ CSDL
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Tải danh sách thiết bị
      try {
        const devList = await jobApi.getDevices();
        if (Array.isArray(devList)) {
          setDevices(devList);
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách thiết bị:', err.message);
      }

      // 2. Tải danh sách Jobs
      try {
        const jobListRes = await jobApi.getAllJobs();
        const jobList = jobListRes?.data || jobListRes || [];
        if (Array.isArray(jobList)) {
          setJobs(jobList);
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách Jobs:', err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // Polling đồng bộ định kỳ
    return () => clearInterval(interval);
  }, [loadData]);

  // Phê duyệt & Xác nhận An toàn Vật liệu tại chỗ (Chuyển AWAITING sang PRINTING)
  const handleConfirmSafety = async (jobCode) => {
    if (!window.confirm(`Xác nhận an toàn vật liệu phôi và cấp phép bắt đầu phát tia laser cho Job ${jobCode}?`)) {
      return;
    }

    setActionLoadingId(jobCode);
    try {
      await jobApi.confirmJob(jobCode);
      setFeedback(`✅ Đã phê duyệt an toàn và phát lệnh gia công cho Job ${jobCode}!`);
      onNotify?.(`[Admin] Đã phê duyệt an toàn Job ${jobCode}, máy bắt đầu khắc`, 'sys');
      await loadData();
    } catch (err) {
      alert(`Lỗi phê duyệt an toàn: ${err.message}`);
      onNotify?.(`[Admin Lỗi] Phê duyệt Job thất bại: ${err.message}`, 'err');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Hủy bỏ / Dừng khẩn cấp một Job
  const handleCancelJob = async (jobCode) => {
    if (!window.confirm(`Bạn có chắc chắn muốn DỪNG KHẨN CẤP / HỦY BỎ Job ${jobCode}?`)) {
      return;
    }

    setActionLoadingId(jobCode);
    try {
      await jobApi.cancelJob(jobCode);
      setFeedback(`🛑 Đã phát lệnh hủy Job ${jobCode} thành công.`);
      onNotify?.(`[Admin] Đã hủy Job ${jobCode}`, 'err');
      await loadData();
    } catch (err) {
      alert(`Lỗi hủy Job: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveDeviceConfig = async (device) => {
    const draft = configDrafts[device.deviceCode] || device;
    setConfigBusy(device.deviceCode);
    try {
      const updated = await jobApi.updateDeviceConfig(device.deviceCode, {
        maxWidthMm: Number(draft.maxWidthMm),
        maxHeightMm: Number(draft.maxHeightMm),
        maxSpeedMmMin: Number(draft.maxSpeedMmMin),
        maxPowerS: Number(draft.maxPowerS)
      });
      setDevices((current) => current.map((item) => item.deviceCode === device.deviceCode ? updated : item));
      setConfigDrafts((current) => ({ ...current, [device.deviceCode]: updated }));
      setFeedback(`Đã lưu cấu hình ${device.deviceCode}. Đang chờ thiết bị xác nhận phiên bản ${updated.configVersion}.`);
    } catch (err) {
      setFeedback(`Không thể cập nhật cấu hình máy: ${err.message}`);
    } finally {
      setConfigBusy(null);
    }
  };

  const handleRotateDeviceToken = async (deviceCode) => {
    if (!window.confirm(`Tạo token mới cho ${deviceCode}? Thiết bị đang dùng token cũ sẽ mất kết nối cho tới khi được cấu hình lại.`)) return;
    setConfigBusy(deviceCode);
    try {
      const response = await jobApi.rotateDeviceToken(deviceCode);
      setIssuedToken(response.deviceToken);
      setFeedback(`Đã tạo token mới cho ${deviceCode}. Sao chép và nhập token vào captive portal của máy.`);
    } catch (err) {
      setFeedback(`Không thể tạo token thiết bị: ${err.message}`);
    } finally {
      setConfigBusy(null);
    }
  };

  // Lọc danh sách Jobs theo trạng thái
  const filteredJobs = jobs.filter((job) => {
    if (selectedFilter === 'AWAITING') return job.status === 'AWAITING_ONSITE_CONFIRMATION';
    if (selectedFilter === 'PRINTING') return job.status === 'PRINTING';
    if (selectedFilter === 'COMPLETED') return job.status === 'COMPLETED';
    return true;
  });

  const awaitingCount = jobs.filter((j) => j.status === 'AWAITING_ONSITE_CONFIRMATION').length;
  const printingCount = jobs.filter((j) => j.status === 'PRINTING').length;
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;

  return (
    <div className="laser-parameters-view" style={{ flex: 1, overflowY: 'auto' }}>
      {/* 1. VIEW TOP HEADER */}
      <div className="view-top-header">
        <div className="view-title-cluster">
          <div className="view-title-icon-badge" style={{ backgroundColor: 'var(--primary-container)', color: '#ffffff' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              admin_panel_settings
            </span>
          </div>
          <div>
            <h1>Điều Hành Trạm Máy & Phê Duyệt An Toàn</h1>
            <p>Bảng điều khiển vai trò Quản lý / Admin giám sát trạm máy IoT và xác nhận an toàn vật liệu</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-back-to-canvas"
            onClick={loadData}
            title="Làm mới dữ liệu từ CSDL"
            disabled={isLoading}
          >
            <span className={`material-symbols-outlined ${isLoading ? 'spinning' : ''}`} style={{ fontSize: 18 }}>
              sync
            </span>
            <span>{isLoading ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            className="btn-primary-upload"
            onClick={onBackToStudio}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_back
            </span>
            <span>Quay lại Bàn cắt</span>
          </button>
        </div>
      </div>

      <div className="view-scroll-body">
        {/* Feedback Alert Toast */}
        {feedback && (
          <div className="param-alert-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>
                verified
              </span>
              <span>{feedback}</span>
            </div>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)' }}
              onClick={() => setFeedback(null)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        )}

        {/* 2. STATS OVERVIEW CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Card 1: Máy trạm */}
          <div style={{
            backgroundColor: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(195, 198, 215, 0.4)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: 'var(--primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>precision_manufacturing</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 500 }}>TRẠNG THÁI TRẠM MÁY</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span>LASER-HN-001</span>
                <span className="status-pulse-dot running" style={{ width: 8, height: 8 }} />
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>Makerbase MKS DLC32 V2.1</div>
            </div>
          </div>

          {/* Card 2: Chờ xác nhận an toàn */}
          <div style={{
            backgroundColor: awaitingCount > 0 ? 'var(--warning-container)' : 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)',
            border: awaitingCount > 0 ? '1px solid var(--warning)' : '1px solid rgba(195, 198, 215, 0.4)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer'
          }} onClick={() => setSelectedFilter('AWAITING')}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: awaitingCount > 0 ? 'var(--warning)' : 'rgba(217, 119, 6, 0.12)',
              color: awaitingCount > 0 ? '#ffffff' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>verified_user</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: awaitingCount > 0 ? 'var(--warning-on-container)' : 'var(--secondary)', fontWeight: 500 }}>CHỜ DUYỆT AN TOÀN TẠI CHỖ</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: awaitingCount > 0 ? 'var(--warning-on-container)' : 'var(--on-surface)', marginTop: 2 }}>
                {awaitingCount} <span style={{ fontSize: 12, fontWeight: 500 }}>Job cần phê duyệt</span>
              </div>
              <div style={{ fontSize: 11, color: awaitingCount > 0 ? 'var(--warning-on-container)' : 'var(--secondary)', marginTop: 1 }}>
                {awaitingCount > 0 ? '👉 Nhấp để duyệt ngay' : 'Không có Job chờ duyệt'}
              </div>
            </div>
          </div>

          {/* Card 3: Đang khắc laser */}
          <div style={{
            backgroundColor: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(195, 198, 215, 0.4)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer'
          }} onClick={() => setSelectedFilter('PRINTING')}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: 'var(--primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>bolt</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 500 }}>ĐANG GIA CÔNG KHẮC</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>
                {printingCount} <span style={{ fontSize: 12, fontWeight: 500 }}>Job đang phát tia</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 1 }}>
                Theo dõi tiến độ thời gian thực
              </div>
            </div>
          </div>

          {/* Card 4: Hoàn thành */}
          <div style={{
            backgroundColor: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(195, 198, 215, 0.4)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer'
          }} onClick={() => setSelectedFilter('COMPLETED')}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(22, 163, 74, 0.12)',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>task_alt</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 500 }}>ĐÃ HOÀN TẤT THÀNH CÔNG</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>
                {completedCount} <span style={{ fontSize: 12, fontWeight: 500 }}>Sản phẩm</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 1 }}>
                Đã lưu nhật ký CSDL
              </div>
            </div>
          </div>
        </div>

        {/* 3. SECTION: DANH SÁCH THIẾT BỊ TRẠM */}
        <div className="file-section-block">
          <div className="section-heading-row">
            <div>
              <h2>Thông số trạm máy gia công (IoT Laser Station)</h2>
              <p>Trạm máy Makerbase MKS DLC32 V2.1 kết nối qua giao thức WebSocket STOMP</p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            marginTop: 10
          }}>
            {devices.map((dev) => {
              const draft = configDrafts[dev.deviceCode] || dev;
              const synced = dev.configAppliedVersion === dev.configVersion;
              return (
              <div
                key={dev.deviceCode}
                style={{
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(195, 198, 215, 0.4)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-container)' }}>
                      router
                    </span>
                    <strong style={{ fontSize: 14, color: 'var(--on-surface)' }}>{dev.deviceCode}</strong>
                  </div>
                  <span className={`status-indicator-tag ${dev.connectionStatus === 'ONLINE' ? 'ready' : dev.connectionStatus === 'BUSY' ? 'running' : 'stopped'}`}>
                    <span className={`status-pulse-dot ${dev.connectionStatus === 'ONLINE' ? 'ready' : dev.connectionStatus === 'BUSY' ? 'running' : 'stopped'}`} />
                    <span>{dev.connectionStatus || 'ONLINE'}</span>
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                  {dev.deviceName || 'Máy Khắc Laser MKS DLC32 V2.1'}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  fontSize: 11,
                  backgroundColor: 'var(--surface-container-low)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 4
                }}>
                  <div>Bàn máy: <strong>{dev.maxWidthMm ?? 300} × {dev.maxHeightMm ?? 200} mm</strong></div>
                  <div>Tốc độ Max: <strong>{dev.maxSpeedMmMin ?? 1500} mm/m</strong></div>
                  <div>Công suất Max: <strong>S{dev.maxPowerS ?? 1000} (PWM)</strong></div>
                  <div>IP Mạng: <strong>{dev.ipAddress || '10.83.8.79'}</strong></div>
                  <div>Sóng WiFi: <strong style={{ color: dev.wifiRssi ? '#16a34a' : 'inherit' }}>{dev.wifiRssi ? `${dev.wifiRssi} dBm` : '-72 dBm'}</strong></div>
                  <div>Bộ nhớ RAM: <strong>{dev.freeHeap ? `${Math.round(dev.freeHeap / 1024)} KB` : '197 KB'}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: synced ? '#16a34a' : 'var(--warning)' }}>
                  Cấu hình v{dev.configVersion ?? 1}: {synced ? 'Đã áp dụng trên máy' : `Máy đã xác nhận v${dev.configAppliedVersion ?? 0}`}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['maxWidthMm', 'Khổ X (mm)', 10, 300],
                    ['maxHeightMm', 'Khổ Y (mm)', 10, 200],
                    ['maxSpeedMmMin', 'Feed tối đa', 100, 5000],
                    ['maxPowerS', 'Power tối đa', 0, 1000]
                  ].map(([key, label, min, max]) => (
                    <label key={key} style={{ display: 'grid', gap: 3, fontSize: 11, color: 'var(--secondary)' }}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={draft[key] ?? ''}
                        onChange={(event) => setConfigDrafts((current) => ({
                          ...current,
                          [dev.deviceCode]: { ...draft, [key]: event.target.value }
                        }))}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(195,198,215,.5)', background: 'var(--surface-container-low)', color: 'var(--on-surface)' }}
                      />
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-primary-upload" disabled={configBusy === dev.deviceCode} onClick={() => handleSaveDeviceConfig(dev)}>
                    {configBusy === dev.deviceCode ? 'Đang gửi...' : 'Lưu và đồng bộ cấu hình'}
                  </button>
                  <button type="button" className="btn-back-to-canvas" disabled={configBusy === dev.deviceCode} onClick={() => handleRotateDeviceToken(dev.deviceCode)}>
                    Tạo token thiết bị mới
                  </button>
                </div>
              </div>
            );})}
            {devices.length === 0 && <div style={{ color: 'var(--secondary)', padding: 14 }}>Chưa có thiết bị được đăng ký.</div>}
          </div>
          {issuedToken && (
            <div className="param-alert-banner" style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <strong>Token mới — chỉ hiển thị trong phiên này. Sao chép vào captive portal của bo mạch.</strong>
              <input readOnly value={issuedToken} onFocus={(event) => event.target.select()} style={{ width: '100%', padding: 8, fontFamily: 'monospace' }} />
              <button type="button" className="btn-back-to-canvas" onClick={() => setIssuedToken(null)}>Đã lưu token</button>
            </div>
          )}
        </div>

        {/* 4. SECTION: HÀNG ĐỢI JOB & BẢNG PHÊ DUYỆT AN TOÀN */}
        <div className="file-section-block">
          <div className="section-heading-row" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2>Quản lý Hàng đợi & Phê duyệt An toàn Vật liệu</h2>
              <p>Admin kiểm tra phôi gia công và phê duyệt cho máy phát tia laser an toàn</p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`quick-cmd-btn ${selectedFilter === 'ALL' ? 'active' : ''}`}
                style={{
                  backgroundColor: selectedFilter === 'ALL' ? 'var(--primary-container)' : 'var(--surface-container-low)',
                  color: selectedFilter === 'ALL' ? '#ffffff' : 'var(--on-surface)',
                  fontWeight: selectedFilter === 'ALL' ? 600 : 400
                }}
                onClick={() => setSelectedFilter('ALL')}
              >
                Tất cả ({jobs.length})
              </button>
              <button
                type="button"
                className="quick-cmd-btn"
                style={{
                  backgroundColor: selectedFilter === 'AWAITING' ? 'var(--warning)' : 'var(--surface-container-low)',
                  color: selectedFilter === 'AWAITING' ? '#ffffff' : 'var(--warning)',
                  fontWeight: selectedFilter === 'AWAITING' ? 600 : 500
                }}
                onClick={() => setSelectedFilter('AWAITING')}
              >
                ⚠️ Cần phê duyệt ({awaitingCount})
              </button>
              <button
                type="button"
                className="quick-cmd-btn"
                style={{
                  backgroundColor: selectedFilter === 'PRINTING' ? 'var(--primary-container)' : 'var(--surface-container-low)',
                  color: selectedFilter === 'PRINTING' ? '#ffffff' : 'var(--on-surface)',
                  fontWeight: selectedFilter === 'PRINTING' ? 600 : 400
                }}
                onClick={() => setSelectedFilter('PRINTING')}
              >
                Đang khắc ({printingCount})
              </button>
              <button
                type="button"
                className="quick-cmd-btn"
                style={{
                  backgroundColor: selectedFilter === 'COMPLETED' ? '#16a34a' : 'var(--surface-container-low)',
                  color: selectedFilter === 'COMPLETED' ? '#ffffff' : 'var(--on-surface)',
                  fontWeight: selectedFilter === 'COMPLETED' ? 600 : 400
                }}
                onClick={() => setSelectedFilter('COMPLETED')}
              >
                Hoàn tất ({completedCount})
              </button>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '36px 20px',
              color: 'var(--secondary)',
              fontSize: 13,
              backgroundColor: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed rgba(195, 198, 215, 0.6)',
              marginTop: 12
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.5, marginBottom: 8 }}>
                inbox
              </span>
              <div>Không có Job nào trong trạng thái đã chọn.</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Khi người dùng nhấn "Gửi đến máy IoT", Job sẽ hiển thị tại đây.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                backgroundColor: 'var(--surface-container-lowest)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: 'var(--surface-container)',
                    borderBottom: '1px solid rgba(195, 198, 215, 0.5)',
                    textAlign: 'left'
                  }}>
                    <th style={{ padding: '10px 14px' }}>Mã Job</th>
                    <th style={{ padding: '10px 14px' }}>Tệp G-code</th>
                    <th style={{ padding: '10px 14px' }}>Phôi / Vùng khắc</th>
                    <th style={{ padding: '10px 14px' }}>Thông số F/S</th>
                    <th style={{ padding: '10px 14px' }}>SHA-256</th>
                    <th style={{ padding: '10px 14px' }}>Trạng thái & Tiến độ</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Hành động Quản trị</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const isAwaiting = job.status === 'AWAITING_ONSITE_CONFIRMATION';
                    const isPrinting = job.status === 'PRINTING';
                    const isCompleted = job.status === 'COMPLETED';
                    const pct = job.currentProgress || 0;

                    return (
                      <tr
                        key={job.jobCode || job.jobId}
                        style={{
                          borderBottom: '1px solid rgba(195, 198, 215, 0.3)',
                          backgroundColor: isAwaiting ? 'rgba(217, 119, 6, 0.05)' : 'transparent'
                        }}
                      >
                        {/* Mã Job */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <strong style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-mono)' }}>
                            {job.jobCode}
                          </strong>
                          <div style={{ fontSize: 10, color: 'var(--secondary)', marginTop: 2 }}>
                            {job.deviceCode || 'LASER-HN-001'}
                          </div>
                        </td>

                        {/* Tệp G-code */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
                            {job.originalFilename || 'logo.gcode'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--secondary)', marginTop: 2 }}>
                            {job.totalLines ? `${job.totalLines.toLocaleString()} dòng` : ''} · {job.fileSizeBytes ? `${Math.round(job.fileSizeBytes / 1024)} KB` : ''}
                          </div>
                        </td>

                        {/* Phôi / Vùng khắc */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: 'var(--surface-container-low)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: 11
                          }}>
                            {job.materialType || 'Gỗ Plywood 3mm'}
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--secondary)', marginTop: 3 }}>
                            {job.targetWidthMm || 100} × {job.targetHeightMm || 100} mm
                          </div>
                        </td>

                        {/* Thông số F/S */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontFamily: 'var(--font-mono)' }}>
                          <div>F{job.feedRate || 1500}</div>
                          <div style={{ fontSize: 10, color: 'var(--secondary)' }}>S{job.laserPower || 800}</div>
                        </td>

                        {/* SHA-256 */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            title={job.sha256Checksum}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              backgroundColor: 'var(--surface-container)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-xs)',
                              display: 'inline-block'
                            }}
                          >
                            {job.sha256Checksum ? `${job.sha256Checksum.slice(0, 6)}…${job.sha256Checksum.slice(-6)}` : '—'}
                          </span>
                        </td>

                        {/* Trạng thái & Tiến độ */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', minWidth: 160 }}>
                          {isAwaiting ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              color: 'var(--warning-on-container)',
                              backgroundColor: 'var(--warning-bg)',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-xs)',
                              fontWeight: 600,
                              fontSize: 11
                            }}>
                              <span className="status-pulse-dot" style={{ backgroundColor: 'var(--warning)' }} />
                              Chờ phê duyệt an toàn
                            </span>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, color: isCompleted ? '#16a34a' : 'var(--primary-container)' }}>
                                  {job.status}
                                </span>
                                <span>{pct.toFixed(0)}%</span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: 6,
                                backgroundColor: 'var(--surface-container-high)',
                                borderRadius: 3,
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, Math.max(0, pct))}%`,
                                  height: '100%',
                                  backgroundColor: isCompleted ? '#16a34a' : 'var(--primary-container)',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Hành động Quản trị */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            {/* Nút Phê duyệt An toàn cho Job đang AWAITING */}
                            {isAwaiting && (
                              <button
                                type="button"
                                className="btn-trigger-start"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  backgroundColor: '#16a34a'
                                }}
                                disabled={actionLoadingId === job.jobCode}
                                onClick={() => handleConfirmSafety(job.jobCode)}
                                title="Kiểm tra phôi gỗ, kính bảo hộ và cấp phép bắt đầu phát tia khắc"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                  verified
                                </span>
                                <span>{actionLoadingId === job.jobCode ? 'Đang duyệt...' : 'Phê duyệt & Bắt đầu'}</span>
                              </button>
                            )}

                            {/* Nút xem Live Progress Modal */}
                            {isPrinting && (
                              <button
                                type="button"
                                className="btn-header-action"
                                style={{ padding: '6px 10px', fontSize: 11 }}
                                onClick={() => onOpenJobProgress?.(job)}
                                title="Mở bảng giám sát tiến độ Live"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary-container)' }}>
                                  visibility
                                </span>
                                <span>Xem Live</span>
                              </button>
                            )}

                            {/* Nút Hủy khẩn cấp nếu chưa hoàn thành */}
                            {!isCompleted && job.status !== 'CANCELLED' && job.status !== 'FAILED' && (
                              <button
                                type="button"
                                className="btn-trigger-stop"
                                style={{ padding: '6px 8px', fontSize: 11 }}
                                disabled={actionLoadingId === job.jobCode}
                                onClick={() => handleCancelJob(job.jobCode)}
                                title="Dừng khẩn cấp / Hủy Job"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                  cancel
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
