import React, { useState, useEffect } from 'react';
import { materialApi } from '../services/materialApi';

const DEFAULT_PRESETS = [
  {
    id: 'mat-plywood',
    presetId: 1,
    name: 'Gỗ ép Plywood (3mm)',
    icon: 'forest',
    badge: 'Phổ biến nhất',
    desc: 'Ván ép bạch dương / bồ đề chuyên dụng cho cắt mô hình và khắc tranh.',
    cutFeed: 350,
    cutPower: 100,
    cutPasses: 2,
    engraveFeed: 2000,
    engravePower: 65,
    dpi: 254,
    mode: 'vector',
    isSystem: true
  },
  {
    id: 'mat-acrylic',
    presetId: 2,
    name: 'Mica Acrylic trong suốt (2.5mm)',
    icon: 'view_in_ar',
    badge: 'Cắt sắc cạnh',
    desc: 'Mica đúc cho mép cắt bóng gương, khắc bề mặt mờ trắng đục.',
    cutFeed: 250,
    cutPower: 95,
    cutPasses: 1,
    engraveFeed: 2400,
    engravePower: 45,
    dpi: 300,
    mode: 'vector',
    isSystem: true
  },
  {
    id: 'mat-leather',
    presetId: 3,
    name: 'Da thuộc tự nhiên & Simili',
    icon: 'inventory_2',
    badge: 'Thời trang',
    desc: 'Ví da, thắt lưng, móc khóa da. Khắc sắc nét không bị cháy lem mép.',
    cutFeed: 600,
    cutPower: 55,
    cutPasses: 1,
    engraveFeed: 3200,
    engravePower: 30,
    dpi: 254,
    mode: 'raster',
    isSystem: true
  },
  {
    id: 'mat-mdf',
    presetId: 4,
    name: 'Gỗ công nghiệp MDF (3mm)',
    icon: 'dashboard',
    badge: 'Độ mịn cao',
    desc: 'Gỗ ép sợi đồng nhất, bề mặt phẳng tuyệt đối, khắc logo độ tương phản cao.',
    cutFeed: 220,
    cutPower: 100,
    cutPasses: 2,
    engraveFeed: 1800,
    engravePower: 70,
    dpi: 254,
    mode: 'vector',
    isSystem: true
  },
  {
    id: 'mat-cardboard',
    presetId: 5,
    name: 'Bìa Carton cứng & Giấy Kraft',
    icon: 'description',
    badge: 'Cắt cực nhanh',
    desc: 'Bao bì, hộp quà, thiệp cưới laser. Tốc độ cắt cao chống cháy mép.',
    cutFeed: 1200,
    cutPower: 60,
    cutPasses: 1,
    engraveFeed: 4000,
    engravePower: 25,
    dpi: 150,
    mode: 'vector',
    isSystem: true
  },
  {
    id: 'mat-anodized',
    presetId: 6,
    name: 'Nhôm phủ sơn / Anodized',
    icon: 'shield',
    badge: 'Khắc kim loại',
    desc: 'Khắc bóc lớp oxit màu tạo nét khắc trắng sáng vĩnh viễn trên kim loại.',
    cutFeed: 0,
    cutPower: 0,
    cutPasses: 0,
    engraveFeed: 1600,
    engravePower: 85,
    dpi: 300,
    mode: 'raster',
    isSystem: true
  }
];

const SPEED_PRESETS = [
  { id: 'low', label: 'Low speed', speed: 600, hint: '600 mm/phút' },
  { id: 'mid', label: 'Mid speed', speed: 1500, hint: '1500 mm/phút' },
  { id: 'high', label: 'High speed', speed: 3000, hint: '3000 mm/phút' }
];

const ACCEL_PRESETS = [
  { id: 'soft', label: 'Êm ái', accel: 500, hint: '500 mm/s² — Giảm rung chấn, triệt tiêu bóng ma / ghosting' },
  { id: 'std', label: 'Tiêu chuẩn', accel: 1000, hint: '1000 mm/s² — Chuẩn khuyến nghị cho bo mạch MKS DLC32' },
  { id: 'fast', label: 'Tốc độ cao', accel: 2000, hint: '2000 mm/s² — Tăng tốc dứt khoát, tối ưu thời gian quét raster' }
];

const POWER_PRESETS = [
  { pct: 0, s: 0, label: '0%', hint: 'Tắt laser (S0)' },
  { pct: 0.5, s: 5, label: '0.5%', hint: 'Tia định vị / Lấy nét yếu (S5)' },
  { pct: 5, s: 50, label: '5%', hint: 'Khắc nhạt (S50)' },
  { pct: 25, s: 250, label: '25%', hint: 'Khắc vừa (S250)' },
  { pct: 50, s: 500, label: '50%', hint: 'Khắc sâu (S500)' },
  { pct: 100, s: 1000, label: '100%', hint: 'Cắt đứt tối đa (S1000)' }
];

export default function LaserParametersView({
  feedRate,
  setFeedRate,
  acceleration = 1000,
  setAcceleration,
  laserPower,
  setLaserPower,
  dpi,
  setDpi,
  mode,
  setMode,
  currentUser,
  onBackToStudio,
  onNotify,
  isConnected = false,
  onFlashParameters = null
}) {
  const [materials, setMaterials] = useState(DEFAULT_PRESETS);
  const [selectedMaterialId, setSelectedMaterialId] = useState('mat-plywood');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);

  const handleFlashToBoard = async () => {
    if (!onFlashParameters) return;
    setIsFlashing(true);
    setFlashSuccess(false);
    const ok = await onFlashParameters(feedRate, laserPower, acceleration);
    setIsFlashing(false);
    if (ok) {
      setFlashSuccess(true);
      setFeedbackMsg(`✓ Đã nạp thành công thông số (F${feedRate}, A${acceleration} mm/s², ${laserPower}%) vào bo mạch!`);
      setTimeout(() => {
        setFlashSuccess(false);
        setFeedbackMsg('');
      }, 3500);
    }
  };

  // Form tạo vật liệu mới
  const [newMat, setNewMat] = useState({
    name: '',
    badge: 'Tùy chỉnh',
    description: '',
    icon: 'layers',
    cutFeed: feedRate || 350,
    cutPower: laserPower || 90,
    cutPasses: 1,
    engraveFeed: feedRate || 2000,
    engravePower: laserPower || 60,
    dpi: dpi || 254,
    mode: mode || 'vector'
  });

  // Tải danh sách vật liệu từ Backend API
  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const res = await materialApi.getMaterials(currentUser?.email);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        setMaterials(res.data);
      }
    } catch (err) {
      console.warn('Dùng danh sách vật liệu mẫu mặc định (offline):', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [currentUser?.email]);

  const handleApplyPreset = (mat) => {
    const matId = mat.id || mat.materialKey || mat.presetId;
    setSelectedMaterialId(matId);

    const isRaster = mat.mode === 'raster';
    const targetFeed = isRaster ? mat.engraveFeed : (mat.cutFeed > 0 ? mat.cutFeed : mat.engraveFeed);
    const targetPower = isRaster ? mat.engravePower : (mat.cutPower > 0 ? mat.cutPower : mat.engravePower);

    setFeedRate(targetFeed);
    setLaserPower(targetPower);
    setDpi(mat.dpi || 254);
    setMode(mat.mode || 'vector');

    const msg = `Đã áp dụng vật liệu: ${mat.name} (F${targetFeed} mm/phút, S${Math.round((targetPower / 100) * 1000)} - ${mat.dpi || 254} DPI)`;
    setFeedbackMsg(msg);
    if (onNotify) onNotify(msg, 'sys');

    setTimeout(() => {
      setFeedbackMsg('');
    }, 4000);
  };

  const handleOpenAddModal = () => {
    setNewMat({
      name: '',
      badge: 'Cá nhân',
      description: 'Cấu hình vật liệu riêng cho xưởng khắc.',
      icon: 'category',
      cutFeed: feedRate,
      cutPower: laserPower,
      cutPasses: 1,
      engraveFeed: feedRate,
      engravePower: laserPower,
      dpi: dpi,
      mode: mode
    });
    setIsAddModalOpen(true);
  };

  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    if (!newMat.name.trim()) {
      alert('Vui lòng nhập tên vật liệu!');
      return;
    }

    try {
      const res = await materialApi.createMaterial(currentUser?.email, newMat);
      if (res && res.success && res.data) {
        setMaterials((prev) => [...prev, res.data]);
        setSelectedMaterialId(res.data.id || res.data.presetId);
        setIsAddModalOpen(false);
        const successMsg = `Đã lưu thành công vật liệu mới: "${res.data.name}" vào thư viện!`;
        setFeedbackMsg(successMsg);
        if (onNotify) onNotify(successMsg, 'sys');
      }
    } catch (err) {
      alert(`Không thể lưu vật liệu: ${err.message}`);
    }
  };

  const handleDeleteMaterial = async (e, mat) => {
    e.stopPropagation();
    if (mat.isSystem) {
      alert('Không thể xóa vật liệu mẫu chuẩn của hệ thống!');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa vật liệu "${mat.name}"?`)) {
      return;
    }

    try {
      await materialApi.deleteMaterial(mat.presetId || mat.id, currentUser?.email);
      setMaterials((prev) => prev.filter((m) => (m.presetId || m.id) !== (mat.presetId || mat.id)));
      const msg = `Đã xóa vật liệu "${mat.name}" thành công!`;
      setFeedbackMsg(msg);
      if (onNotify) onNotify(msg, 'sys');
    } catch (err) {
      alert(`Lỗi khi xóa vật liệu: ${err.message}`);
    }
  };

  return (
    <div className="parameters-page-view">
      {/* Top Breadcrumb & Action Bar */}
      <div className="view-sub-header">
        <div className="sub-header-left">
          <button
            type="button"
            className="btn-back-to-canvas"
            onClick={onBackToStudio}
            title="Quay lại bàn khắc 2D"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_back
            </span>
            <span>Trở về bàn khắc</span>
          </button>
          <div className="sub-header-title-block">
            <h1>Cài đặt Thông số khắc & Thư viện vật liệu</h1>
            <p>Chọn phôi gia công để tự động nạp tốc độ và công suất tia laser tối ưu</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-back-to-canvas"
            onClick={handleOpenAddModal}
            title="Thêm vật liệu mới vào thư viện"
            style={{ borderColor: 'var(--primary-container)', color: 'var(--primary-container)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              add_circle
            </span>
            <span>Lưu vật liệu mới</span>
          </button>

          <button
            type="button"
            className="btn-primary-upload"
            onClick={onBackToStudio}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              check_circle
            </span>
            <span>Áp dụng & Quay lại</span>
          </button>
        </div>
      </div>

      <div className="view-scroll-body">
        {/* Feedback Alert Toast */}
        {feedbackMsg && (
          <div className="param-alert-banner">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>
              verified
            </span>
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* SECTION 1: MATERIAL PRESET LIBRARY */}
        <div className="file-section-block">
          <div className="section-heading-row">
            <div>
              <h2>Thư viện vật liệu mẫu (Material Presets) {isLoading && <small style={{ fontSize: 11, color: 'var(--secondary)' }}>(Đang tải...)</small>}</h2>
              <p>Nhấp vào loại phôi để hệ thống tự động đồng bộ tốc độ và công suất máy khắc</p>
            </div>
            <button
              type="button"
              className="btn-link-action"
              onClick={loadMaterials}
              title="Đồng bộ danh sách từ máy chủ"
            >
              Làm mới thư viện
            </button>
          </div>

          <div className="materials-grid">
            {materials.map((mat) => {
              const currentKey = mat.id || mat.materialKey || mat.presetId;
              const isSelected = currentKey === selectedMaterialId;

              return (
                <div
                  key={currentKey}
                  className={`material-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleApplyPreset(mat)}
                >
                  <div className="mat-card-header">
                    <div className="mat-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                        {mat.icon || 'layers'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="mat-badge">{mat.badge || (mat.isSystem ? 'Hệ thống' : 'Tùy chỉnh')}</span>
                      {!mat.isSystem && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMaterial(e, mat)}
                          title="Xóa vật liệu này"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3>{mat.name}</h3>
                  <p>{mat.desc || mat.description || 'Chưa có mô tả chi tiết'}</p>

                  <div className="mat-specs-table">
                    <div className="mat-spec-item">
                      <span className="spec-label">Cắt (Vector):</span>
                      <span className="spec-val">
                        {mat.cutFeed > 0 ? `F${mat.cutFeed} · S${mat.cutPower}% (${mat.cutPasses || 1} lần)` : 'Không hỗ trợ cắt'}
                      </span>
                    </div>
                    <div className="mat-spec-item">
                      <span className="spec-label">Khắc (Raster):</span>
                      <span className="spec-val">F{mat.engraveFeed} · S{mat.engravePower}%</span>
                    </div>
                    <div className="mat-spec-item">
                      <span className="spec-label">Độ mịn:</span>
                      <span className="spec-val">{mat.dpi || 254} DPI</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn-select-mat ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyPreset(mat);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {isSelected ? 'check' : 'touch_app'}
                    </span>
                    <span>{isSelected ? 'Đang kích hoạt' : 'Chọn vật liệu này'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: CURRENT APPLIED PARAMETERS & DETAILED TUNING */}
        <div className="file-section-block" style={{ marginTop: 24 }}>
          <div className="section-heading-row">
            <div>
              <h2>Thông số công nghệ đang áp dụng</h2>
              <p>Tinh chỉnh chính xác từng thông số di chuyển của đầu phát Laser GRBL</p>
            </div>
          </div>

          <div className="detailed-tuning-grid">
            {/* Box 1: Feed Rate */}
            <div className="tuning-box-card">
              <div className="tuning-box-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-container)' }}>
                  speed
                </span>
                <h4>Tốc độ di chuyển (Feed Rate)</h4>
              </div>
              <p>Tốc độ dẫn động trục X-Y tính bằng milimét / phút (Lệnh F)</p>

              {/* 3 Mức chuẩn phần cứng */}
              <div className="speed-preset-grid" style={{ marginBottom: 8 }}>
                {SPEED_PRESETS.map((preset) => {
                  const isActive = feedRate === preset.speed;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`speed-preset-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setFeedRate(preset.speed)}
                      title={`${preset.label} — ${preset.hint}`}
                    >
                      <span className="speed-preset-name">{preset.label}</span>
                      <span className="speed-preset-val">{preset.speed} <small>mm/m</small></span>
                    </button>
                  );
                })}
              </div>

              <div className="tuning-control-row">
                <input
                  type="range"
                  min="50"
                  max="6000"
                  step="50"
                  className="power-range-input"
                  value={feedRate}
                  onChange={(e) => setFeedRate(parseInt(e.target.value) || 50)}
                />
                <div className="tuning-input-badge">
                  <span>{feedRate}</span>
                  <small>mm/min</small>
                </div>
              </div>
              <span className="tuning-hint-text">
                Khuyên dùng: Low speed (600 mm/min), Mid speed (1500 mm/min), High speed (3000 mm/min)
              </span>
            </div>

            {/* Box: Acceleration ($120/$121) */}
            <div className="tuning-box-card">
              <div className="tuning-box-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#8b5cf6' }}>
                  rocket_launch
                </span>
                <h4>Gia tốc động cơ (Acceleration - $120/$121)</h4>
              </div>
              <p>Quy định gia tốc trục X-Y tính bằng mm/s² trong GRBL, giảm rung cơ khí và thời gian đổi chiều</p>

              {/* 3 Mức chuẩn phần cứng */}
              <div className="speed-preset-grid" style={{ marginBottom: 8 }}>
                {ACCEL_PRESETS.map((preset) => {
                  const isActive = acceleration === preset.accel;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`speed-preset-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setAcceleration && setAcceleration(preset.accel)}
                      title={preset.hint}
                    >
                      <span className="speed-preset-name">{preset.label}</span>
                      <span className="speed-preset-val">{preset.accel} <small>mm/s²</small></span>
                    </button>
                  );
                })}
              </div>

              <div className="tuning-control-row">
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="100"
                  className="power-range-input"
                  value={acceleration}
                  onChange={(e) => setAcceleration && setAcceleration(parseInt(e.target.value) || 100)}
                />
                <div className="tuning-input-badge">
                  <span>{acceleration}</span>
                  <small>mm/s²</small>
                </div>
              </div>
              <span className="tuning-hint-text">
                Khuyên dùng: 500 mm/s² (êm ái, chống rung), 1000 mm/s² (chuẩn MKS DLC32), 2000 mm/s² (tốc độ cao)
              </span>
            </div>

            {/* Box 2: Laser Power PWM */}
            <div className="tuning-box-card">
              <div className="tuning-box-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#dc2626' }}>
                  bolt
                </span>
                <h4>Công suất phát tia Laser (PWM)</h4>
              </div>
              <p>Mức điều chế độ rộng xung từ 0% đến 100% (Lệnh S0 đến S1000)</p>

              {/* 6 Mức chuẩn màn hình phần cứng */}
              <div className="power-preset-grid" style={{ marginBottom: 8 }}>
                {POWER_PRESETS.map((preset) => {
                  const isActive = Math.abs(laserPower - preset.pct) < 0.1;
                  return (
                    <button
                      key={preset.pct}
                      type="button"
                      className={`power-preset-btn ${isActive ? 'active' : ''} ${preset.pct === 0.5 ? 'focus-weak' : ''}`}
                      onClick={() => setLaserPower(preset.pct)}
                      title={preset.hint}
                    >
                      <span className="power-preset-pct">{preset.label}</span>
                      <span className="power-preset-s">S{preset.s}</span>
                    </button>
                  );
                })}
              </div>

              <div className="tuning-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  className="power-range-input"
                  value={laserPower}
                  onChange={(e) => setLaserPower(parseFloat(e.target.value) || 0)}
                />
                <div className="tuning-input-badge" style={{ color: '#dc2626' }}>
                  <span>{laserPower}%</span>
                  <small>S{Math.round((laserPower / 100) * 1000)}</small>
                </div>
              </div>
              <span className="tuning-hint-text">
                Chuẩn phần cứng: 0% (Tắt), 0.5% (Định vị lấy nét), 5%, 25%, 50%, 100% (Cắt tối đa)
              </span>

              {/* Nút nạp thông số vào bo mạch */}
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`btn-flash-board ${flashSuccess ? 'success' : ''}`}
                  onClick={handleFlashToBoard}
                  disabled={isFlashing}
                  style={{ width: '100%' }}
                  title={isConnected ? 'Nạp thông số xuống bo mạch điều khiển' : 'Cần kết nối bo mạch'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isFlashing ? 'sync' : flashSuccess ? 'check_circle' : 'memory'}
                  </span>
                  <span>
                    {isFlashing
                      ? 'Đang nạp vào bo mạch...'
                      : flashSuccess
                      ? '✓ Đã nạp vào bo mạch thành công!'
                      : 'Nạp thông số vào bo mạch'}
                  </span>
                </button>
              </div>
            </div>

            {/* Box 3: DPI Density */}
            <div className="tuning-box-card">
              <div className="tuning-box-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f59e0b' }}>
                  grain
                </span>
                <h4>Mật độ bước khắc (DPI / Bước dịch trục Y)</h4>
              </div>
              <p>Khoảng cách giữa các dòng quét raster liên tiếp</p>

              <div className="dpi-buttons-group">
                <button
                  type="button"
                  className={`dpi-btn ${dpi === 254 ? 'active' : ''}`}
                  onClick={() => setDpi(254)}
                >
                  <strong>254 DPI</strong>
                  <small>0.10 mm / dòng (Chuẩn)</small>
                </button>
                <button
                  type="button"
                  className={`dpi-btn ${dpi === 300 ? 'active' : ''}`}
                  onClick={() => setDpi(300)}
                >
                  <strong>300 DPI</strong>
                  <small>0.08 mm / dòng (Nét cao)</small>
                </button>
                <button
                  type="button"
                  className={`dpi-btn ${dpi === 150 ? 'active' : ''}`}
                  onClick={() => setDpi(150)}
                >
                  <strong>150 DPI</strong>
                  <small>0.17 mm / dòng (Bản nháp)</small>
                </button>
              </div>
            </div>

            {/* Box 4: Machining Mode */}
            <div className="tuning-box-card">
              <div className="tuning-box-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>
                  timeline
                </span>
                <h4>Chế độ đường dẫn tia (Machining Mode)</h4>
              </div>
              <p>Quy định phương pháp dịch chuyển đầu phát tia laser</p>

              <div className="dpi-buttons-group">
                <button
                  type="button"
                  className={`dpi-btn ${mode === 'vector' ? 'active' : ''}`}
                  onClick={() => setMode('vector')}
                >
                  <strong>Cắt viền (Vector Line)</strong>
                  <small>Chạy theo đường bao khép kín</small>
                </button>
                <button
                  type="button"
                  className={`dpi-btn ${mode === 'raster' ? 'active' : ''}`}
                  onClick={() => setMode('raster')}
                >
                  <strong>Đốt mảng (Raster Engrave)</strong>
                  <small>Quét ngang ziczac từng dòng</small>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: GRBL SAFETY CHECKLIST */}
        <div className="safety-checklist-card">
          <div className="safety-title-row">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--success)' }}>
              verified_user
            </span>
            <h4>Tiêu chuẩn An toàn Laser CNC GRBL v1.1</h4>
          </div>
          <ul className="safety-items-list">
            <li>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
              <span>Gia tốc <strong>$120 / $121</strong> được đồng bộ chuẩn xác để hạn chế hiện tượng gián đoạn và quá tải động cơ bước.</span>
            </li>
            <li>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
              <span>Lệnh <strong>$32=1 (Laser Mode)</strong> luôn được bật tự động để ngăn cháy phôi khi đầu máy dừng.</span>
            </li>
            <li>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
              <span>Lệnh di chuyển nhanh <strong>G0</strong> luôn tự động đi kèm <strong>M5</strong> tắt laser để không để lại vệt xước.</span>
            </li>
            <li>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
              <span>Giới hạn tọa độ phần mềm vật lý tối đa <strong>X: 300 mm, Y: 200 mm</strong> chống va đập cơ khí.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* MODAL THÊM VẬT LIỆU MỚI */}
      {isAddModalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="modal-card"
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '90%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(195, 198, 215, 0.4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-container)', fontSize: 24 }}>
                  layers
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thêm vật liệu phôi mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tên vật liệu *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Gỗ Thông Pallet (4mm)"
                  value={newMat.name}
                  onChange={(e) => setNewMat({ ...newMat, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(195, 198, 215, 0.5)',
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Huy hiệu / Badge</label>
                  <input
                    type="text"
                    value={newMat.badge}
                    onChange={(e) => setNewMat({ ...newMat, badge: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Chế độ ưu tiên</label>
                  <select
                    value={newMat.mode}
                    onChange={(e) => setNewMat({ ...newMat, mode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  >
                    <option value="vector">Cắt viền (Vector)</option>
                    <option value="raster">Đốt ảnh (Raster)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mô tả đặc tính</label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú về thớ gỗ, tốc độ thử nghiệm..."
                  value={newMat.description}
                  onChange={(e) => setNewMat({ ...newMat, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(195, 198, 215, 0.5)',
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tốc độ cắt (F mm/m)</label>
                  <input
                    type="number"
                    min="0"
                    max="6000"
                    value={newMat.cutFeed}
                    onChange={(e) => setNewMat({ ...newMat, cutFeed: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Công suất cắt (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newMat.cutPower}
                    onChange={(e) => setNewMat({ ...newMat, cutPower: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tốc độ khắc (F mm/m)</label>
                  <input
                    type="number"
                    min="100"
                    max="6000"
                    value={newMat.engraveFeed}
                    onChange={(e) => setNewMat({ ...newMat, engraveFeed: parseInt(e.target.value) || 100 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Công suất khắc (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newMat.engravePower}
                    onChange={(e) => setNewMat({ ...newMat, engravePower: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(195, 198, 215, 0.5)',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-back-to-canvas"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-primary-upload"
                >
                  Lưu vào thư viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
