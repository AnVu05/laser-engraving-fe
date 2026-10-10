import React, { useState, useMemo } from 'react';
import {
  LM_C40_HARDWARE,
  MATERIAL_PROFILES,
  evaluateThermalFeasibility
} from '../utils/laserThermalCalibrator';

export default function FocusCalibrationModal({
  isOpen,
  onClose,
  feedRate,
  setFeedRate,
  laserPower,
  setLaserPower,
  onStartJob,
  onNotify
}) {
  // Tiêu cự lấy nét chuẩn của máy do người dùng nhập (không hardcode)
  const [focalDistance, setFocalDistance] = useState(() => {
    const saved = localStorage.getItem('laser_focal_distance');
    return saved ? parseFloat(saved) : 30.0;
  });

  // Khoảng cách thực tế từ mũi laser đến phôi (sau khi kê đế phôi)
  const [actualDistance, setActualDistance] = useState(() => {
    const saved = localStorage.getItem('laser_focal_distance');
    return saved ? parseFloat(saved) : 30.0;
  });

  const [selectedMaterial, setSelectedMaterial] = useState('wood');

  const handleFocalChange = (val) => {
    const num = Math.max(1, parseFloat(val) || 1);
    setFocalDistance(num);
    try {
      localStorage.setItem('laser_focal_distance', num.toString());
    } catch (_) {}
  };

  // Đánh giá nhiệt học tự động dựa trên Tiêu cự (D0) và Khoảng cách thực tế (d) do người dùng nhập
  const analysis = useMemo(() => {
    // laserPower trong App.jsx là 0 - 100%, quy đổi sang S-value (0 - 1000)
    const currentS = Math.round((laserPower || 75) * 10);
    return evaluateThermalFeasibility(
      actualDistance,
      focalDistance,
      selectedMaterial,
      currentS,
      feedRate
    );
  }, [actualDistance, focalDistance, selectedMaterial, laserPower, feedRate]);

  if (!isOpen) return null;

  // Áp dụng thông số đề xuất vào hệ thống
  const handleApplyParameters = (startEngrave = false) => {
    if (analysis && analysis.isFeasible) {
      // Lưu dưới dạng % (0 - 100) cho laserPower trong App.jsx
      setLaserPower(analysis.proposedPowerPercent);
      setFeedRate(analysis.proposedFeed);
      if (onNotify) {
        onNotify(
          `[Hiệu chuẩn LM-C40] Đã cập nhật công suất ${analysis.proposedPowerPercent}% (S${analysis.proposedPower}) và tốc độ F${analysis.proposedFeed} mm/phút cho cự ly ${actualDistance}mm (Tiêu cự ${focalDistance}mm).`,
          'sys'
        );
      }
      onClose();
      if (startEngrave && onStartJob) {
        setTimeout(() => {
          onStartJob();
        }, 200);
      }
    }
  };

  const currentPowerPct = Math.round(laserPower || 75);
  const deltaZ = Math.abs(actualDistance - focalDistance);

  return (
    <div className="modal-overlay focus-modal-overlay" onClick={onClose}>
      <div
        className="focus-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 740,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(11, 28, 48, 0.18), 0 2px 8px rgba(11, 28, 48, 0.08)',
          border: '1px solid rgba(195, 198, 215, 0.7)',
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
          animation: 'modal-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Ambient Top Glow */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            left: -40,
            width: 160,
            height: 160,
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderRadius: '50%',
            filter: 'blur(35px)',
            pointerEvents: 'none'
          }}
        />

        {/* Brand & Hardware Badge Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#eff4ff',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                center_focus_strong
              </span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0b1c30', letterSpacing: '-0.02em' }}>
                Trợ lý Tiêu cự & Đề xuất Công suất Khắc
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#565e74' }}>
                Nhập cự ly thực tế để tự động thẩm định nhiệt lượng & bù trừ công suất laser theo độ cao phôi
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#334155',
                textAlign: 'right'
              }}
            >
              <div><strong>LM-C40</strong> · 5.5W (445nm)</div>
              <div style={{ color: '#2563eb' }}>Tiêu cự nét: <strong>{focalDistance} mm</strong></div>
            </div>

            {/* Close Button Inline in Header */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#737686',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s'
              }}
              title="Đóng cửa sổ"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>

        {/* Grid Layout: Left Input & Simulation, Right Feasibility & Proposal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          
          {/* COLUMN 1: Inputs & Ray Beam Simulation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {/* 1. Chọn loại bề mặt vật liệu */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0b1c30', marginBottom: 4 }}>
                1. Bề mặt vật liệu cắt / khắc:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {Object.values(MATERIAL_PROFILES).map((mat) => {
                  const isSelected = selectedMaterial === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setSelectedMaterial(mat.id)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 8,
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                        backgroundColor: isSelected ? '#eff4ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: isSelected ? '#2563eb' : '#64748b' }}>
                        {mat.icon}
                      </span>
                      <div style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1e40af' : '#334155', marginTop: 1 }}>
                        {mat.id === 'wood' ? 'Gỗ' : mat.id === 'leather' ? 'Da' : 'Mica đục'}
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, fontFamily: 'var(--font-mono, monospace)' }}>
                        ≥{mat.minPowerDensity} W/mm²
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Tiêu cự lấy nét của máy (D0) - Người dùng tự nhập */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#0b1c30' }}>
                  2. Tiêu cự lấy nét của đầu laser (D₀):
                </label>
                <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                  Cự ly nét nhất theo cữ gạt
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="5"
                  max="100"
                  step="0.5"
                  value={focalDistance}
                  onChange={(e) => handleFocalChange(e.target.value)}
                  style={{
                    width: 75,
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#2563eb'
                  }}
                />
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>mm</span>

                {/* Các nút gợi ý cữ thông dụng */}
                <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                  {[20, 30, 40, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleFocalChange(val)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: focalDistance === val ? '#2563eb' : '#cbd5e1',
                        backgroundColor: focalDistance === val ? '#eff4ff' : '#f8fafc',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: focalDistance === val ? 700 : 500,
                        color: focalDistance === val ? '#2563eb' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {val}mm
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Khoảng cách thực tế đến mặt phôi (d) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#0b1c30' }}>
                  3. Khoảng cách thực tế mũi laser đến phôi (d):
                </label>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: deltaZ === 0 ? '#16a34a' : deltaZ <= 2 ? '#d97706' : '#dc2626'
                  }}
                >
                  {actualDistance} mm {deltaZ === 0 ? '(Đúng tiêu điểm)' : `(Lệch ${deltaZ.toFixed(1)}mm)`}
                </span>
              </div>

              {/* Slider + Numeric Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="0.5"
                  value={actualDistance}
                  onChange={(e) => setActualDistance(parseFloat(e.target.value) || 30)}
                  style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="5"
                  max="120"
                  step="0.5"
                  value={actualDistance}
                  onChange={(e) => setActualDistance(parseFloat(e.target.value) || focalDistance)}
                  style={{
                    width: 65,
                    height: 30,
                    padding: '0 6px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#0b1c30'
                  }}
                />
              </div>

              {/* Nút đặt nhanh d = D0 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Đo từ mép dưới đầu laser tới mặt phôi</span>
                <button
                  type="button"
                  onClick={() => setActualDistance(focalDistance)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #93c5fd',
                    backgroundColor: '#eff4ff',
                    color: '#1d4ed8',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ↺ Đặt bằng tiêu cự ({focalDistance}mm)
                </button>
              </div>
            </div>

            {/* 4. Mô phỏng hình nón chùm tia Laser (Gaussian Beam Visualizer) */}
            <div
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#f8fafc',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Mô phỏng hội tụ bước sóng 445nm:</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#38bdf8' }}>
                  Vết tia: <strong>Ø {analysis.spotDiameter} mm</strong>
                </span>
              </div>

              <svg width="100%" height="75" viewBox="0 0 300 75" style={{ display: 'block' }}>
                <defs>
                  {/* Laser Beam Gradient */}
                  <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* Laser Head Top */}
                <rect x="110" y="2" width="80" height="12" rx="3" fill="#334155" stroke="#475569" strokeWidth="1" />
                <text x="150" y="10" fontSize="7" fill="#cbd5e1" textAnchor="middle" fontFamily="monospace">ĐẦU LASER LM-C40</text>

                {/* Gaussian Cone Beam */}
                <path
                  d="M 130 14 Q 146 42 148 42 Q 146 42 130 72 L 170 72 Q 154 42 152 42 Q 154 42 170 14 Z"
                  fill="url(#laserBeamGrad)"
                  opacity="0.35"
                />

                {/* Focal Waist line at focalDistance */}
                <line x1="80" y1="42" x2="220" y2="42" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 3" />
                <text x="75" y="45" fontSize="8" fill="#22c55e" textAnchor="end" fontFamily="monospace">
                  {focalDistance}mm (Tiêu cự)
                </text>

                {/* Target Workpiece Line (Relative to focalDistance) */}
                {(() => {
                  // Calculate Y relative to focal waist (Y=42)
                  // Offset by (actualDistance - focalDistance) * scale
                  const offset = (actualDistance - focalDistance) * 1.5;
                  const targetY = Math.min(70, Math.max(16, 42 + offset));
                  const spotR = Math.max(2, Math.min(9, (parseFloat(analysis.spotDiameter) / 0.08) * 2.5));

                  return (
                    <g>
                      <line x1="95" y1={targetY} x2="205" y2={targetY} stroke="#f59e0b" strokeWidth="2" />
                      <circle cx="150" cy={targetY} r={spotR} fill="#ef4444" opacity="0.9" />
                      <text x="210" y={targetY + 3} fontSize="8" fill="#f59e0b" fontFamily="monospace">
                        Phôi ({actualDistance}mm)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* COLUMN 2: Thermal Feasibility & Parameter Proposal */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            
            <div>
              {/* Feasibility Alert Card */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginBottom: 12,
                  backgroundColor: !analysis.isFeasible ? '#fef2f2' : analysis.status === 'optimal' ? '#f0fdf4' : '#fffbeb',
                  border: `1.5px solid ${!analysis.isFeasible ? '#f87171' : analysis.status === 'optimal' ? '#86efac' : '#fde047'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: !analysis.isFeasible ? '#b91c1c' : analysis.status === 'optimal' ? '#15803d' : '#b45309' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {!analysis.isFeasible ? 'dangerous' : analysis.status === 'optimal' ? 'verified' : 'auto_fix_high'}
                  </span>
                  <span>{analysis.badgeText}</span>
                </div>

                <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.45, color: !analysis.isFeasible ? '#991b1b' : analysis.status === 'optimal' ? '#166534' : '#92400e' }}>
                  {analysis.message}
                </p>

                {/* Energy Stats Pills */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono, monospace)' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.06)' }}>
                    Mật độ cực đại: <strong>{analysis.maxPowerDensity} W/mm²</strong>
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.06)' }}>
                    Yêu cầu vật liệu: <strong>≥{analysis.material.minPowerDensity} W/mm²</strong>
                  </span>
                </div>
              </div>

              {/* Parameter Proposal Side-by-Side Table */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0b1c30', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#2563eb' }}>
                    tune
                  </span>
                  <span>Thông số đề xuất tối ưu:</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {/* Power Box */}
                  <div
                    style={{
                      padding: 10,
                      backgroundColor: '#ffffff',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Công suất Laser (PWM)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>
                        {currentPowerPct}% (S{laserPower})
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#2563eb' }}>arrow_forward</span>
                      <strong style={{ fontSize: 15, color: '#1d4ed8', fontFamily: 'var(--font-mono, monospace)' }}>
                        {analysis.proposedPowerPercent}%
                      </strong>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                      Lệnh G-code: <strong>S{analysis.proposedPower}</strong>
                    </div>
                  </div>

                  {/* Feedrate Box */}
                  <div
                    style={{
                      padding: 10,
                      backgroundColor: '#ffffff',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Tốc độ quét (Feedrate)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: analysis.feedRateAdjusted ? 'line-through' : 'none' }}>
                        {feedRate}
                      </span>
                      {analysis.feedRateAdjusted && (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#2563eb' }}>arrow_forward</span>
                          <strong style={{ fontSize: 15, color: '#d97706', fontFamily: 'var(--font-mono, monospace)' }}>
                            {analysis.proposedFeed}
                          </strong>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                      {analysis.feedRateAdjusted ? 'Đã giảm tốc để bù nhiệt' : 'Giữ nguyên tốc độ'} (mm/phút)
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 10, color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#0ea5e9' }}>info</span>
                  <span>{analysis.recommendation}</span>
                </div>
              </div>
            </div>

            {/* Actions: Start Job, Apply or Cancel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={!analysis.isFeasible}
                onClick={() => handleApplyParameters(true)}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: !analysis.isFeasible ? '#94a3b8' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !analysis.isFeasible ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: analysis.isFeasible ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { if (analysis.isFeasible) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseLeave={(e) => { if (analysis.isFeasible) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
                <span>Áp dụng thông số & Bắt đầu khắc thật ngay</span>
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={!analysis.isFeasible}
                  onClick={() => handleApplyParameters(false)}
                  style={{
                    flex: 1,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !analysis.isFeasible ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                  onMouseEnter={(e) => { if (analysis.isFeasible) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                  onMouseLeave={(e) => { if (analysis.isFeasible) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                  <span>Chỉ lưu thông số</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Đóng / Giữ nguyên
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
