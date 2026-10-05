import React, { useState } from 'react';

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
  { pct: 0, s: 0, label: '0%', hint: 'Tắt tia laser (S0)' },
  { pct: 0.5, s: 5, label: '0.5%', hint: 'Tia định vị / Lấy nét yếu (S5)' },
  { pct: 5, s: 50, label: '5%', hint: 'Khắc nhạt (S50)' },
  { pct: 25, s: 250, label: '25%', hint: 'Khắc vừa (S250)' },
  { pct: 50, s: 500, label: '50%', hint: 'Khắc sâu (S500)' },
  { pct: 100, s: 1000, label: '100%', hint: 'Cắt đứt tối đa (S1000)' }
];

export default function ParameterPanel({
  elements = [],
  selectedId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onAddRectangle,
  onAddCircle,
  onAddText,
  onTriggerFileInput,
  onFileChange,
  fileInputRef,
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
  previewMode = 'dither',
  setPreviewMode,
  contrast = 15,
  setContrast,
  brightness = 0,
  setBrightness,
  invert = false,
  setInvert,
  burnCount = 0,
  burnPercent = 0,
  rasterDims = '',
  onGenerateGCode,
  onDownloadNC,
  isConnected = false,
  onFlashParameters = null,
  isTestLaserOn = false,
  onToggleTestLaser = null
}) {
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashStatus, setFlashStatus] = useState(null);

  const handleTriggerFlash = async () => {
    if (onFlashParameters) {
      setIsFlashing(true);
      setFlashStatus(null);
      const ok = await onFlashParameters(feedRate, laserPower, acceleration);
      setIsFlashing(false);
      if (ok) {
        setFlashStatus('success');
        setTimeout(() => setFlashStatus(null), 3000);
      } else {
        setFlashStatus('error');
        setTimeout(() => setFlashStatus(null), 3000);
      }
    }
  };

  const selectedElem = elements.find((e) => e.id === selectedId) || elements[0] || null;

  // Aspect ratio handlers for current selected element (X, Y1, Y2)
  const handleDimWChange = (newW) => {
    if (!selectedElem) return;
    const isLocked = selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image');
    let newH = selectedElem.height;
    if (isLocked && newW > 0) {
      const ratio = selectedElem.aspectRatio || (selectedElem.width / (selectedElem.height || 1));
      newH = parseFloat((newW / ratio).toFixed(1));
    }
    const finalW = Math.max(1, newW);
    const finalH = Math.max(1, newH);
    onUpdateElement(selectedElem.id, {
      width: finalW,
      height: finalH,
      y1: isLocked ? finalH : (selectedElem.y1 ?? finalH),
      y2: isLocked ? finalH : (selectedElem.y2 ?? finalH)
    });
  };

  const handleDimY1Change = (newY1) => {
    if (!selectedElem) return;
    const isLocked = selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image');
    let newW = selectedElem.width;
    let newY2 = selectedElem.y2 ?? selectedElem.height;
    if (isLocked && newY1 > 0) {
      const ratio = selectedElem.aspectRatio || (selectedElem.width / (selectedElem.height || 1));
      newW = parseFloat((newY1 * ratio).toFixed(1));
      newY2 = newY1;
    }
    const finalY1 = Math.max(1, newY1);
    onUpdateElement(selectedElem.id, {
      width: Math.max(1, newW),
      height: finalY1,
      y1: finalY1,
      y2: Math.max(1, newY2)
    });
  };

  const handleDimY2Change = (newY2) => {
    if (!selectedElem) return;
    const isLocked = selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image');
    let newW = selectedElem.width;
    let newY1 = selectedElem.y1 ?? selectedElem.height;
    if (isLocked && newY2 > 0) {
      const ratio = selectedElem.aspectRatio || (selectedElem.width / (selectedElem.height || 1));
      newW = parseFloat((newY2 * ratio).toFixed(1));
      newY1 = newY2;
    }
    const finalY2 = Math.max(1, newY2);
    onUpdateElement(selectedElem.id, {
      width: Math.max(1, newW),
      height: Math.max(1, newY1),
      y1: Math.max(1, newY1),
      y2: finalY2
    });
  };

  const handleToggleAspectLocked = () => {
    if (!selectedElem) return;
    const curLocked = selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image');
    const ratio = selectedElem.width / (selectedElem.height || 1);
    onUpdateElement(selectedElem.id, {
      isAspectLocked: !curLocked,
      aspectRatio: ratio > 0 ? ratio : 1
    });
  };

  return (
    <aside className="parameter-panel">
      <div className="panel-content-scroll">
        {/* Hidden File Input for Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/png,image/jpeg,image/svg+xml,.dxf"
          onChange={onFileChange}
        />

        {/* SECTION 1: LAYER MANAGER & QUICK ADD TOOLBAR */}
        <div className="layer-manager-container">
          <div className="layer-manager-header">
            <span className="section-label">Đối tượng trên bàn</span>
            <span className="layer-count-badge">{elements.length} đối tượng</span>
          </div>

          {/* Quick Add Toolbar */}
          <div className="quick-add-group">
            <button
              type="button"
              className="quick-add-btn"
              title="Thêm khung chữ nhật vào bàn cắt"
              onClick={onAddRectangle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#2563eb' }}>
                crop_square
              </span>
              <span>+ Khung</span>
            </button>

            <button
              type="button"
              className="quick-add-btn"
              title="Thêm đường tròn vào bàn cắt"
              onClick={onAddCircle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#2563eb' }}>
                circle
              </span>
              <span>+ Tròn</span>
            </button>

            <button
              type="button"
              className="quick-add-btn"
              title="Thêm văn bản vào bàn cắt"
              onClick={onAddText}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#a855f7' }}>
                title
              </span>
              <span>+ Chữ</span>
            </button>

            <button
              type="button"
              className="quick-add-btn"
              title="Nhập ảnh (PNG, JPG, SVG)"
              onClick={onTriggerFileInput}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#f59e0b' }}>
                upload_file
              </span>
              <span>+ Ảnh</span>
            </button>
          </div>

          {/* Active Layer Pills List */}
          <div className="layer-pills-list">
            {elements.map((elem) => {
              const isSelected = elem.id === selectedElem?.id;
              let iconName = 'crop_square';
              if (elem.type === 'circle') iconName = 'circle';
              if (elem.type === 'text') iconName = 'title';
              if (elem.type === 'image') iconName = 'image';

              return (
                <div
                  key={elem.id}
                  className={`layer-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectElement(elem.id)}
                  title={`${elem.name} (${elem.width.toFixed(1)}×${elem.height.toFixed(1)} mm)`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {iconName}
                  </span>
                  <span className="layer-pill-name">{elem.name}</span>
                  {elements.length > 1 && (
                    <button
                      type="button"
                      className="layer-pill-del"
                      title="Xóa đối tượng này"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement(elem.id);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                        close
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: DYNAMIC INSPECTOR FOR CURRENT SELECTED ELEMENT */}
        {selectedElem && (
          <>
            {/* TYPE A: BITMAP IMAGE CONTROLS */}
            {selectedElem.type === 'image' && (
              <div className="form-group">
                <div className="panel-section-title-row">
                  <span className="section-label">Tệp phôi hình ảnh</span>
                  <button
                    type="button"
                    className="section-action-link"
                    onClick={onTriggerFileInput}
                  >
                    Thay đổi
                  </button>
                </div>

                <div className="artwork-card">
                  <div className="artwork-meta-row">
                    <div className="artwork-thumbnail-box">
                      {selectedElem.previewUrl ? (
                        <img
                          src={selectedElem.previewUrl}
                          alt="Preview"
                          className="artwork-thumbnail-img"
                        />
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--secondary)' }}>
                          image
                        </span>
                      )}
                    </div>
                    <div className="artwork-info-col">
                      <div className="artwork-title-badge">
                        <span className="artwork-name" title={selectedElem.name}>
                          {selectedElem.name}
                        </span>
                        <span className="file-type-pill">{selectedElem.ext || 'IMG'}</span>
                      </div>
                      <span className="artwork-dims">{selectedElem.pixelDims || 'Kích thước gốc'}</span>
                      <span className="artwork-desc">{selectedElem.desc || 'Tệp hình ảnh'}</span>
                    </div>
                  </div>

                  <div className="artwork-hints">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary-container)' }}>
                        info
                      </span>
                      Hỗ trợ PNG, JPG, SVG, DXF
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>1:1 Calib</span>
                  </div>
                </div>
              </div>
            )}

            {/* TYPE B: RECTANGLE VECTOR CONTROLS */}
            {selectedElem.type === 'rect' && (
              <div className="shape-prop-card">
                <div className="shape-prop-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#2563eb' }}>
                    crop_square
                  </span>
                  <input
                    type="text"
                    className="shape-name-input"
                    value={selectedElem.name}
                    onChange={(e) => onUpdateElement(selectedElem.id, { name: e.target.value })}
                    title="Đặt tên khung chữ nhật"
                  />
                </div>

                <div className="tuning-slider-row" style={{ marginTop: 2 }}>
                  <span className="tuning-slider-label">Bo góc (R):</span>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    className="tuning-slider-input"
                    value={selectedElem.cornerRadius || 0}
                    onChange={(e) => onUpdateElement(selectedElem.id, { cornerRadius: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="tuning-val-badge">{(selectedElem.cornerRadius || 0).toFixed(1)} mm</span>
                </div>
              </div>
            )}

            {/* TYPE C: CIRCLE VECTOR CONTROLS */}
            {selectedElem.type === 'circle' && (
              <div className="shape-prop-card">
                <div className="shape-prop-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#2563eb' }}>
                    circle
                  </span>
                  <input
                    type="text"
                    className="shape-name-input"
                    value={selectedElem.name}
                    onChange={(e) => onUpdateElement(selectedElem.id, { name: e.target.value })}
                    title="Đặt tên đường tròn"
                  />
                </div>

                <div className="tuning-slider-row" style={{ marginTop: 2 }}>
                  <span className="tuning-slider-label">Đường kính (Ø):</span>
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="1"
                    className="tuning-slider-input"
                    value={selectedElem.width}
                    onChange={(e) => {
                      const d = parseFloat(e.target.value) || 10;
                      onUpdateElement(selectedElem.id, { width: d, height: d });
                    }}
                  />
                  <span className="tuning-val-badge">{selectedElem.width.toFixed(1)} mm</span>
                </div>
              </div>
            )}

            {/* TYPE D: TEXT CONTROLS */}
            {selectedElem.type === 'text' && (
              <div className="shape-prop-card">
                <div className="shape-prop-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#a855f7' }}>
                    title
                  </span>
                  <input
                    type="text"
                    className="shape-name-input"
                    value={selectedElem.name}
                    onChange={(e) => onUpdateElement(selectedElem.id, { name: e.target.value })}
                    title="Đặt tên lớp chữ"
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="section-label" style={{ fontSize: 11, margin: 0 }}>
                      Nội dung chữ cần khắc
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--primary-container)', fontWeight: 500 }}>
                      💡 Nhấp đúp vào chữ trên bàn vẽ
                    </span>
                  </div>
                  <input
                    type="text"
                    className="text-content-input"
                    value={selectedElem.text || ''}
                    placeholder="Nhập chữ cần khắc..."
                    onChange={(e) => onUpdateElement(selectedElem.id, { text: e.target.value })}
                  />
                </div>

                <div className="custom-select-wrap" style={{ marginTop: 4 }}>
                  <select
                    className="custom-select"
                    value={selectedElem.fontFamily || 'sans'}
                    onChange={(e) => onUpdateElement(selectedElem.id, { fontFamily: e.target.value })}
                  >
                    <option value="sans">Phông hiện đại (Inter Sans-serif)</option>
                    <option value="mono">Phông kỹ thuật (JetBrains Mono)</option>
                    <option value="serif">Phông cổ điển (Serif / Georgia)</option>
                  </select>
                  <span className="material-symbols-outlined select-arrow-icon">
                    expand_more
                  </span>
                </div>
              </div>
            )}

            {/* SECTION 3: PHYSICAL DIMENSIONS & POSITION (ON BED) */}
            <div className="panel-header-block">
              <h2>Kích thước & Vị trí</h2>
              <p>Toạ độ milimét trên bàn cắt (G90 Tuyệt đối)</p>
            </div>

            {/* Real Dimensions with Aspect Lock: X, Y1, Y2 */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="section-label">Kích thước (X, Y1, Y2)</label>
                <span style={{ fontSize: 10, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                  mm
                </span>
              </div>
              <div className="dim-input-cluster">
                <div className="dim-input-box" title="Kích thước chiều ngang trục X (mm)">
                  <span className="dim-axis">X</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="300"
                    className="dim-number-input"
                    value={selectedElem.width}
                    onChange={(e) => handleDimWChange(parseFloat(e.target.value) || 0)}
                  />
                  <span className="dim-unit">mm</span>
                </div>

                <button
                  type="button"
                  className={`btn-lock-aspect ${!(selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image')) ? 'unlocked' : ''}`}
                  title={
                    selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image')
                      ? 'Đang khóa tỷ lệ khung hình'
                      : 'Tỷ lệ khung hình tự do'
                  }
                  onClick={handleToggleAspectLocked}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {selectedElem.isAspectLocked ?? (selectedElem.type === 'circle' || selectedElem.type === 'image')
                      ? 'lock'
                      : 'lock_open'}
                  </span>
                </button>

                <div className="dim-input-box" title="Kích thước chiều cao trục Y1 (mm)">
                  <span className="dim-axis">Y1</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="200"
                    className="dim-number-input"
                    value={selectedElem.y1 !== undefined ? selectedElem.y1 : selectedElem.height}
                    onChange={(e) => handleDimY1Change(parseFloat(e.target.value) || 0)}
                  />
                  <span className="dim-unit">mm</span>
                </div>

                <div className="dim-input-box" title="Kích thước chiều cao trục Y2 (mm)">
                  <span className="dim-axis">Y2</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="200"
                    className="dim-number-input"
                    value={selectedElem.y2 !== undefined ? selectedElem.y2 : selectedElem.height}
                    onChange={(e) => handleDimY2Change(parseFloat(e.target.value) || 0)}
                  />
                  <span className="dim-unit">mm</span>
                </div>
              </div>
            </div>

            {/* Position X & Y on Bed */}
            <div className="form-group">
              <label className="section-label">Tọa độ đặt (Gốc phôi)</label>
              <div className="dim-input-cluster">
                <div className="dim-input-box">
                  <span className="dim-axis">X0</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="300"
                    className="dim-number-input"
                    value={selectedElem.x}
                    onChange={(e) => onUpdateElement(selectedElem.id, { x: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="dim-unit">mm</span>
                </div>

                <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--secondary)' }}>
                    location_on
                  </span>
                </div>

                <div className="dim-input-box">
                  <span className="dim-axis">Y0</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="200"
                    className="dim-number-input"
                    value={selectedElem.y}
                    onChange={(e) => onUpdateElement(selectedElem.id, { y: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="dim-unit">mm</span>
                </div>
              </div>
            </div>

            {/* DITHERING CONTROLS FOR IMAGE TYPE */}
            {selectedElem.type === 'image' && (
              <div className="form-group" style={{ marginTop: 4 }}>
                <div className="form-label-row">
                  <label className="section-label">Mô phỏng hạt in thực tế</label>
                  <span style={{ fontSize: 10, color: 'var(--primary-container)', fontWeight: 600 }}>
                    Floyd-Steinberg
                  </span>
                </div>

                <div className="pixel-preview-single-mode">
                  <div className="single-mode-badge" title="Chế độ mô phỏng hạt laser cố định (Floyd-Steinberg Dithering)">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>
                      grain
                    </span>
                    <span className="single-mode-title">Hạt laser</span>
                    <span className="single-mode-tag">Dither Mode</span>
                  </div>
                </div>

                {/* Contrast & Brightness Tuning Box */}
                <div className="pixel-tuning-card">
                  <div className="tuning-slider-row">
                    <span className="tuning-slider-label">Tương phản:</span>
                    <input
                      type="range"
                      min="-80"
                      max="80"
                      step="5"
                      className="tuning-slider-input"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value) || 0)}
                    />
                    <span className="tuning-val-badge">{contrast > 0 ? `+${contrast}` : contrast}</span>
                  </div>

                  <div className="tuning-slider-row">
                    <span className="tuning-slider-label">Độ sáng:</span>
                    <input
                      type="range"
                      min="-80"
                      max="80"
                      step="5"
                      className="tuning-slider-input"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value) || 0)}
                    />
                    <span className="tuning-val-badge">{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </div>

                  <div className="invert-toggle-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--on-surface)' }}>
                      <input
                        type="checkbox"
                        checked={invert}
                        onChange={(e) => setInvert(e.target.checked)}
                        style={{ accentColor: 'var(--primary-container)', cursor: 'pointer' }}
                      />
                      <span>Đảo ngược âm bản (Invert)</span>
                    </label>
                    <button
                      type="button"
                      className="section-action-link"
                      style={{ fontSize: 10 }}
                      onClick={() => { setContrast(15); setBrightness(0); setInvert(false); }}
                    >
                      Đặt lại
                    </button>
                  </div>

                  {burnCount > 0 && (
                    <div className="burn-stats-banner">
                      <span>🔥 {burnCount.toLocaleString()} hạt đốt ({burnPercent}%)</span>
                      <span>{rasterDims}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* SECTION 4: COMMON MACHINING PARAMETERS & HARDWARE BOARD SYNC */}
        <div className="panel-header-block" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Thông số phát Laser</h2>
            <div className={`board-sync-badge ${isConnected ? 'online' : 'offline'}`} title={isConnected ? 'Bo mạch CNC GRBL đang kết nối sẵn sàng' : 'Chưa kết nối cổng COM'}>
              <span className={`sync-status-dot ${isConnected ? 'online' : 'offline'}`} />
              <span>{isConnected ? 'Bo mạch Online' : 'Chưa kết nối'}</span>
            </div>
          </div>
        </div>

        {/* Feed Rate (Speed) - Hardware Presets: Low speed, Mid speed, High speed */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="section-label">Tốc độ chạy (Feed Rate)</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--secondary)' }}>
              F{feedRate}
            </span>
          </div>

          {/* 3 Mức chuẩn phần cứng: Low speed, Mid speed, High speed */}
          <div className="speed-preset-grid">
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
                  <span className="speed-preset-val">{preset.speed} <small>mm/phút</small></span>
                </button>
              );
            })}
          </div>

          {/* Ô nhập thông số chi tiết */}
          <div className="feed-rate-box" style={{ marginTop: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--secondary)' }}>
              speed
            </span>
            <input
              type="number"
              min="50"
              max="6000"
              step="50"
              className="feed-rate-input"
              value={feedRate}
              onChange={(e) => setFeedRate(Math.max(50, parseInt(e.target.value) || 50))}
              title="Nhập tốc độ chạy tùy chỉnh (F mm/phút)"
            />
            <span className="feed-rate-unit">mm/phút</span>
          </div>
        </div>

        {/* Acceleration - Hardware Presets: Êm ái (500), Tiêu chuẩn (1000), Tốc độ cao (2000) */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="section-label">Gia tốc động cơ (Acceleration)</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--secondary)' }}>
              {acceleration} mm/s²
            </span>
          </div>

          {/* 3 Mức chuẩn phần cứng cho gia tốc MKS DLC32 / GRBL */}
          <div className="speed-preset-grid">
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

          {/* Ô nhập thông số gia tốc chi tiết */}
          <div className="feed-rate-box" style={{ marginTop: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--secondary)' }}>
              rocket_launch
            </span>
            <input
              type="number"
              min="100"
              max="5000"
              step="100"
              className="feed-rate-input"
              value={acceleration}
              onChange={(e) => setAcceleration && setAcceleration(Math.max(100, Math.min(5000, parseInt(e.target.value) || 100)))}
              title="Nhập gia tốc trục X/Y tùy chỉnh ($120/$121 mm/s²)"
            />
            <span className="feed-rate-unit">mm/s²</span>
          </div>
        </div>

        {/* Laser Power PWM Slider & Hardware Presets: 0%, 0.5%, 5%, 25%, 50%, 100% */}
        <div className="form-group">
          <div className="form-label-row">
            <label className="section-label">Công suất Laser (PWM)</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--primary-container)' }}>
              {laserPower}% (S{Math.round((laserPower / 100) * 1000)})
            </span>
          </div>

          {/* 6 Mức chuẩn màn hình phần cứng */}
          <div className="power-preset-grid">
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

          <div className="power-control-card" style={{ marginTop: 6 }}>
            <div className="power-slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                className="power-range-input"
                value={laserPower}
                onChange={(e) => setLaserPower(parseFloat(e.target.value) || 0)}
              />
              <div className="power-pwm-badge">
                <span>S{Math.round((laserPower / 100) * 1000)}</span>
              </div>
            </div>
            <div className="power-ticks-row">
              <span>0% (Tắt)</span>
              <span style={{ color: 'var(--primary-container)', fontWeight: 600 }}>0.5% (Định vị)</span>
              <span>25%</span>
              <span>50%</span>
              <span>100% (Tối đa)</span>
            </div>
          </div>
        </div>

        {/* DPI / Scan Line Density */}
        <div className="form-group">
          <label className="section-label">Mật độ khắc (DPI / Bước bước)</label>
          <div className="custom-select-wrap">
            <select
              className="custom-select"
              value={dpi}
              onChange={(e) => setDpi(parseInt(e.target.value))}
            >
              <option value={254}>254 DPI — 0.10mm (Khuyên dùng gỗ / da)</option>
              <option value={300}>300 DPI — 0.08mm (Khắc nét cao / kim loại)</option>
              <option value={150}>150 DPI — 0.17mm (Bản nháp nhanh)</option>
            </select>
            <span className="material-symbols-outlined select-arrow-icon">
              expand_more
            </span>
          </div>
        </div>

        {/* Machining Mode Segmented Control */}
        <div className="form-group">
          <label className="section-label">Chế độ đường dẫn</label>
          <div className="mode-segmented-control">
            <button
              type="button"
              className={`mode-tab-btn ${mode === 'raster' ? 'active' : ''}`}
              onClick={() => setMode('raster')}
            >
              Đốt mảng (Raster)
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${mode === 'vector' ? 'active' : ''}`}
              onClick={() => setMode('vector')}
            >
              Cắt viền (Vector)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: ACTION GENERATION BUTTONS */}
      <div className="panel-actions-dock">
        <button
          type="button"
          className="btn-generate-gcode"
          onClick={onGenerateGCode}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            terminal
          </span>
          <span>Tạo mã G-Code</span>
        </button>

        <button
          type="button"
          className="btn-download-nc"
          onClick={onDownloadNC}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--secondary)' }}>
            file_download
          </span>
          <span>Tải file .NC về máy</span>
        </button>
      </div>
    </aside>
  );
}
