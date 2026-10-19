import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Trình phân tích & kiểm tra tính hợp lệ của mã G-code GRBL Laser
 */
function parseGCode(gcodeText) {
  if (!gcodeText) {
    return {
      segments: [],
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      cutLengthMm: 0,
      rapidLengthMm: 0,
      estimatedSeconds: 0,
      hasLaserMode: false,
      hasSafeM5End: false,
      hasAbsoluteCoords: false,
      isWithinBounds: true,
      cutLinesCount: 0
    };
  }

  const lines = gcodeText.split('\n');
  let curX = 0;
  let curY = 0;
  let isLaserOn = false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const segments = [];
  let cutLengthMm = 0;
  let rapidLengthMm = 0;
  let feedRate = 1500;
  let hasLaserMode = false;
  let hasSafeM5End = false;
  let hasAbsoluteCoords = false;
  let cutLinesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Phân tích chú thích & Header
    if (raw.includes('$32=1')) hasLaserMode = true;
    if (raw.includes('G90')) hasAbsoluteCoords = true;
    if (raw.includes('M5')) isLaserOn = false;
    if (raw.includes('M3') || raw.includes('M4')) isLaserOn = true;

    if (raw.startsWith(';')) continue;

    // Đọc feed rate F
    const fMatch = raw.match(/F([0-9.]+)/i);
    if (fMatch) feedRate = parseFloat(fMatch[1]) || 1500;

    const isG0 = raw.startsWith('G0');
    const isG1 = raw.startsWith('G1') || raw.startsWith('G2') || raw.startsWith('G3');

    if (isG0 || isG1) {
      const xMatch = raw.match(/X([0-9.-]+)/i);
      const yMatch = raw.match(/Y([0-9.-]+)/i);

      let nextX = curX;
      let nextY = curY;

      if (xMatch) nextX = parseFloat(xMatch[1]);
      if (yMatch) nextY = parseFloat(yMatch[1]);

      const dist = Math.hypot(nextX - curX, nextY - curY);
      const activeLaser = isG1 && (isLaserOn || raw.includes('S'));

      if (dist > 0.001) {
        segments.push({
          x1: curX,
          y1: curY,
          x2: nextX,
          y2: nextY,
          laser: activeLaser
        });

        if (activeLaser) {
          cutLengthMm += dist;
          cutLinesCount++;
          minX = Math.min(minX, nextX, curX);
          maxX = Math.max(maxX, nextX, curX);
          minY = Math.min(minY, nextY, curY);
          maxY = Math.max(maxY, nextY, curY);
        } else {
          rapidLengthMm += dist;
        }
      }

      curX = nextX;
      curY = nextY;
    }
  }

  // Kiểm tra lệnh tắt laser an toàn ở cuối
  const tail = lines.slice(-20).join(' ');
  if (tail.includes('M5') && (tail.includes('M2') || tail.includes('M30') || tail.includes('G0 X0 Y0'))) {
    hasSafeM5End = true;
  }

  const validBounds = isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY);
  const realMinX = validBounds ? minX : 0;
  const realMaxX = validBounds ? maxX : 0;
  const realMinY = validBounds ? minY : 0;
  const realMaxY = validBounds ? maxY : 0;

  const width = Math.max(0, realMaxX - realMinX);
  const height = Math.max(0, realMaxY - realMinY);

  const estimatedSeconds = Math.round(
    (cutLengthMm / (feedRate || 1500)) * 60 + (rapidLengthMm / 3000) * 60 + 2
  );

  return {
    segments,
    minX: realMinX,
    maxX: realMaxX,
    minY: realMinY,
    maxY: realMaxY,
    width,
    height,
    cutLengthMm: Math.round(cutLengthMm),
    rapidLengthMm: Math.round(rapidLengthMm),
    estimatedSeconds,
    hasLaserMode,
    hasSafeM5End,
    hasAbsoluteCoords,
    isWithinBounds: realMinX >= 0 && realMaxX <= 300 && realMinY >= 0 && realMaxY <= 200,
    cutLinesCount
  };
}

export default function GCodeModal({
  isOpen,
  onClose,
  gcode = '',
  totalLines = 0,
  onDownloadNC,
  onDispatchIoT,
  isDispatching = false,
  deviceCode = 'LASER-HN-001'
}) {
  const [activeTab, setActiveTab] = useState('visualizer'); // 'visualizer' | 'code' | 'validator'
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  // Phân tích mã G-code để lấy thông số và đường vẽ
  const analysis = useMemo(() => parseGCode(gcode), [gcode]);

  // Vẽ mô phỏng Toolpath lên Canvas khi mở tab Visualizer
  useEffect(() => {
    if (!isOpen || activeTab !== 'visualizer') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    // Nền tối chuẩn Studio
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Tỉ lệ scale bàn cắt (300 x 200 mm) vào canvas với padding
    const padding = 36;
    const bedW = 300;
    const bedH = 200;
    const scaleX = (W - padding * 2) / bedW;
    const scaleY = (H - padding * 2) / bedH;
    const scale = Math.min(scaleX, scaleY);

    const originX = padding + (W - padding * 2 - bedW * scale) / 2;
    // CNC: Y=0 ở dưới cùng, Canvas: Y=0 ở trên cùng
    const originY = H - padding - (H - padding * 2 - bedH * scale) / 2;

    // Hàm chuyển đổi tọa độ CNC (mm) sang Canvas Pixel
    const toPx = (xMm, yMm) => ({
      x: originX + xMm * scale,
      y: originY - yMm * scale
    });

    // 1. Vẽ lưới bàn cắt vật lý (300 x 200 mm)
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let x = 0; x <= 300; x += 50) {
      const p1 = toPx(x, 0);
      const p2 = toPx(x, 200);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${x}`, p1.x, p1.y + 12);
    }
    for (let y = 0; y <= 200; y += 50) {
      const p1 = toPx(0, y);
      const p2 = toPx(300, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${y}`, p1.x - 6, p1.y + 3);
    }

    // Viền khung bàn cắt 300 x 200
    const bedTL = toPx(0, 200);
    const bedBR = toPx(300, 0);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bedTL.x, bedTL.y, bedBR.x - bedTL.x, bedBR.y - bedTL.y);

    // Gốc tọa độ X0, Y0
    const originPt = toPx(0, 0);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(originPt.x, originPt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('X0 Y0', originPt.x + 8, originPt.y - 4);

    // 2. Vẽ các đường chạy dao Toolpath
    // a) Đường di chuyển nhanh G0 (Laser tắt)
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    analysis.segments.forEach((seg) => {
      if (!seg.laser) {
        const p1 = toPx(seg.x1, seg.y1);
        const p2 = toPx(seg.x2, seg.y2);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    });
    ctx.stroke();

    // b) Đường đốt laser G1 (Laser bật - Nét vẽ thật của chi tiết)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    ctx.beginPath();
    analysis.segments.forEach((seg) => {
      if (seg.laser) {
        const p1 = toPx(seg.x1, seg.y1);
        const p2 = toPx(seg.x2, seg.y2);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    });
    ctx.stroke();

    // c) Khung Bounding Box bao quanh chi tiết
    if (analysis.cutLinesCount > 0) {
      const boxTL = toPx(analysis.minX, analysis.maxY);
      const boxW = (analysis.maxX - analysis.minX) * scale;
      const boxH = (analysis.maxY - analysis.minY) * scale;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(boxTL.x, boxTL.y, boxW, boxH);

      // Nhãn kích thước
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Kích thước: ${analysis.width.toFixed(1)} × ${analysis.height.toFixed(1)} mm`,
        boxTL.x + boxW / 2,
        boxTL.y - 6
      );
    }
  }, [isOpen, activeTab, analysis]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(gcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs) => {
    if (secs < 60) return `${secs} giây`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} phút ${s > 0 ? `${s}s` : ''}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: 860, width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary-container)' }}>
              preview
            </span>
            <div>
              <span className="modal-title">Kiểm thử & Thẩm định Mã G-Code (GRBL Laser)</span>
              <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 2 }}>
                Mô phỏng đường chạy dao thực tế và kiểm tra độ an toàn trước khi khắc
              </div>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(195, 198, 215, 0.4)',
          padding: '0 24px',
          gap: 16,
          backgroundColor: 'var(--surface-container-low)'
        }}>
          <button
            type="button"
            className="tab-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 4px',
              borderBottom: activeTab === 'visualizer' ? '2.5px solid var(--primary-container)' : '2.5px solid transparent',
              color: activeTab === 'visualizer' ? 'var(--primary-container)' : 'var(--secondary)',
              fontWeight: activeTab === 'visualizer' ? 600 : 500,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              fontSize: 13
            }}
            onClick={() => setActiveTab('visualizer')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              route
            </span>
            <span>Mô phỏng đường chạy tia (Simulator)</span>
          </button>

          <button
            type="button"
            className="tab-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 4px',
              borderBottom: activeTab === 'code' ? '2.5px solid var(--primary-container)' : '2.5px solid transparent',
              color: activeTab === 'code' ? 'var(--primary-container)' : 'var(--secondary)',
              fontWeight: activeTab === 'code' ? 600 : 500,
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              fontSize: 13
            }}
            onClick={() => setActiveTab('code')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              data_object
            </span>
            <span>Mã G-Code chi tiết ({totalLines.toLocaleString()} dòng)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 24px', maxHeight: '72vh', overflowY: 'auto' }}>
          {activeTab === 'visualizer' && (
            <div>
              {/* Top Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
                marginBottom: 14
              }}>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 8,
                  border: '1px solid rgba(195, 198, 215, 0.4)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--secondary)' }}>Kích thước khắc thực tế</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>
                    {analysis.width.toFixed(1)} × {analysis.height.toFixed(1)} mm
                  </div>
                </div>

                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 8,
                  border: '1px solid rgba(195, 198, 215, 0.4)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--secondary)' }}>Tọa độ phôi (X, Y)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', marginTop: 2 }}>
                    X{analysis.minX.toFixed(1)} → X{analysis.maxX.toFixed(1)} mm
                  </div>
                </div>

                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 8,
                  border: '1px solid rgba(195, 198, 215, 0.4)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--secondary)' }}>Tổng đường khắc laser (G1)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', marginTop: 2 }}>
                    {analysis.cutLengthMm.toLocaleString()} mm ({analysis.cutLinesCount} nét)
                  </div>
                </div>

                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 8,
                  border: '1px solid rgba(195, 198, 215, 0.4)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--secondary)' }}>Thời gian ước tính</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
                    ~{formatTime(analysis.estimatedSeconds)}
                  </div>
                </div>
              </div>

              {/* 2D Canvas Visualizer */}
              <div style={{ position: 'relative', width: '100%', height: 320, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />

                {/* Legend Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  gap: 12,
                  fontSize: 11,
                  color: '#e2e8f0'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 2.5, backgroundColor: '#ef4444', display: 'inline-block' }} />
                    Tia Laser đốt (G1)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 1, borderTop: '2px dashed #eab308', display: 'inline-block' }} />
                    Chạy nhanh tắt tia (G0)
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--secondary)', marginBottom: 8 }}>
                <span>Định dạng: <strong>Mã lệnh NC chuẩn ISO 6983 / GRBL v1.1</strong></span>
                <span>Tổng số dòng: <strong style={{ color: 'var(--on-surface)' }}>{totalLines.toLocaleString()}</strong></span>
              </div>
              <pre className="gcode-code-box" style={{ maxHeight: 380, overflowY: 'auto' }}>
                {gcode}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-header-action"
            onClick={handleCopy}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Đã sao chép!' : 'Sao chép mã'}</span>
          </button>

          <button
            type="button"
            className="btn-header-action"
            onClick={onDownloadNC}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              file_download
            </span>
            <span>Tải file .NC về máy</span>
          </button>

          <button
            type="button"
            className="btn-trigger-start"
            onClick={() => {
              if (!analysis.isWithinBounds) {
                const proceed = window.confirm(
                  'Cảnh báo an toàn: Vùng khắc vượt quá khổ bàn máy (300 x 200 mm). Bạn có chắc chắn muốn gửi lệnh tới máy IoT không?'
                );
                if (!proceed) return;
              }
              onDispatchIoT?.(deviceCode);
            }}
            disabled={isDispatching || !gcode || totalLines === 0}
            title={
              totalLines === 0
                ? 'Chưa có mã G-code để gửi'
                : `Gửi trực tiếp chương trình gia công tới bo mạch ${deviceCode}`
            }
          >
            <span
              className={`material-symbols-outlined ${isDispatching ? 'spinning' : ''}`}
              style={{ fontSize: 16 }}
            >
              {isDispatching ? 'sync' : 'precision_manufacturing'}
            </span>
            <span>
              {isDispatching
                ? 'Đang gửi tới máy...'
                : `Gửi đến máy IoT (${deviceCode})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
