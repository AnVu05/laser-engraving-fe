import React, { useEffect, useState, useCallback } from 'react';
import { useJobWebSocket } from '../hooks/useJobWebSocket';
import { jobApi } from '../services/jobApi';

/**
 * Các giai đoạn vòng đời của một Job IoT
 * Thứ tự và màu sắc tuân thủ design tokens đã định nghĩa trong index.css / App.css
 */
const JOB_STAGES = [
  {
    key: 'SUBMITTED',
    label: 'Đã điều phối',
    desc: 'Job đã gửi lên Cloud & sinh mã băm SHA-256',
    icon: 'cloud_upload'
  },
  {
    key: 'DOWNLOADING',
    label: 'Đang tải file',
    desc: 'Bo mạch MKS DLC32 đang kéo file G-code qua HTTPS',
    icon: 'download'
  },
  {
    key: 'VERIFYING',
    label: 'Đối soát & Kiểm tra',
    desc: 'Xác minh SHA-256 phần cứng & quét Soft Limits (X≤300mm, Y≤200mm)',
    icon: 'verified_user'
  },
  {
    key: 'AWAITING_ONSITE_CONFIRMATION',
    label: 'Chờ xác nhận tại chỗ',
    desc: 'Người vận hành kiểm tra phôi và nhấn nút vật lý trên máy',
    icon: 'warning'
  },
  {
    key: 'PRINTING',
    label: 'Đang khắc laser',
    desc: 'Máy đang phát tia – theo dõi tiến độ thời gian thực',
    icon: 'bolt'
  },
  {
    key: 'COMPLETED',
    label: 'Hoàn thành',
    desc: 'Gia công hoàn tất, đã lưu vào lịch sử',
    icon: 'task_alt'
  }
];

const STAGE_INDEX = Object.fromEntries(JOB_STAGES.map((s, i) => [s.key, i]));

/** Chuyển số giây sang chuỗi mm:ss */
function fmtTime(secs) {
  if (!secs || secs <= 0) return '--:--';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Rút ngắn chuỗi SHA-256 để hiển thị */
function shortHash(hash) {
  if (!hash || hash.length < 12) return hash || '—';
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

/**
 * Component Badge trạng thái – hỗ trợ các trạng thái thời gian thực
 */
function StatusBadge({ status }) {
  const map = {
    QUEUED:                       { label: 'Hàng đợi',     bg: '#fef3c7',                      color: '#b45309' },
    SUBMITTED:                    { label: 'Đã gửi',       bg: 'var(--surface-container)',     color: 'var(--on-surface-variant)' },
    DOWNLOADING:                  { label: 'Đang tải',     bg: 'rgba(99,102,241,0.12)',         color: '#4f46e5' },
    VERIFYING:                    { label: 'Đối soát',     bg: 'rgba(99,102,241,0.12)',         color: '#4f46e5' },
    AWAITING_ONSITE_CONFIRMATION: { label: 'Chờ xác nhận', bg: 'var(--warning-bg)',            color: 'var(--warning)' },
    PRINTING:                     { label: 'Đang khắc',    bg: 'var(--success-bg)',            color: 'var(--success)' },
    PAUSED:                       { label: 'Tạm dừng',     bg: '#fef3c7',                      color: '#d97706' },
    COMPLETED:                    { label: 'Hoàn thành',   bg: 'var(--success-bg)',            color: 'var(--success)' },
    FAILED:                       { label: 'Thất bại',     bg: 'var(--error-container)',       color: 'var(--error)' },
    CANCELLED:                    { label: 'Đã hủy',       bg: 'var(--error-container)',       color: 'var(--error)' },
  };
  const s = map[status] || map.SUBMITTED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      backgroundColor: s.bg, color: s.color,
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
      letterSpacing: '0.04em', textTransform: 'uppercase'
    }}>
      {s.label}
    </span>
  );
}

/**
 * Dòng thông tin kỹ thuật (label + value)
 */
function InfoRow({ label, value, mono = false, accent = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
      <span style={{ color: 'var(--secondary)' }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontWeight: 600,
        color: accent ? 'var(--primary-container)' : 'var(--on-surface)',
        fontSize: mono ? 11 : 12
      }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Stepper – hiển thị 6 giai đoạn vòng đời Job
 */
function JobStepper({ currentStatus, isFailed }) {
  const normalizedStatus = currentStatus === 'PAUSED' ? 'PRINTING' : currentStatus;
  const currentIdx = STAGE_INDEX[normalizedStatus] ?? 0;
  const failedIdx = isFailed ? currentIdx : -1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
      {JOB_STAGES.map((stage, idx) => {
        const isDone    = !isFailed && idx < currentIdx;
        const isActive  = !isFailed && idx === currentIdx;
        const isFail    = isFailed  && idx === failedIdx;
        const isWarn    = stage.key === 'AWAITING_ONSITE_CONFIRMATION' && isActive;

        let dotBg = 'var(--surface-container)';
        let dotColor = 'var(--outline)';
        let labelColor = 'var(--secondary)';

        if (isDone) {
          dotBg = 'var(--success)'; dotColor = '#fff'; labelColor = 'var(--success)';
        } else if (isFail) {
          dotBg = 'var(--error)'; dotColor = '#fff'; labelColor = 'var(--error)';
        } else if (isWarn) {
          dotBg = 'var(--warning)'; dotColor = '#fff'; labelColor = 'var(--warning)';
        } else if (isActive) {
          dotBg = currentStatus === 'PAUSED' ? '#f59e0b' : 'var(--primary-container)';
          dotColor = '#fff';
          labelColor = currentStatus === 'PAUSED' ? '#d97706' : 'var(--primary-container)';
        }

        return (
          <div key={stage.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Connector line trái */}
            {idx > 0 && (
              <div style={{
                position: 'absolute', top: 14, right: '50%',
                width: '100%', height: 2,
                backgroundColor: isDone ? 'var(--success)' : 'var(--surface-container-high)',
                transition: 'background-color 0.4s ease'
              }} />
            )}

            {/* Dot */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: dotBg, color: dotColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, position: 'relative', zIndex: 1, flexShrink: 0,
              transition: 'all 0.3s ease',
              boxShadow: isActive || isWarn ? `0 0 0 4px ${dotBg}22` : 'none'
            }}>
              {isFail ? (
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
              ) : isDone ? (
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{stage.icon}</span>
              )}
            </div>

            {/* Label */}
            <span style={{
              marginTop: 5, fontSize: 9.5, fontWeight: isActive ? 700 : 500,
              color: labelColor, textAlign: 'center',
              lineHeight: 1.3, transition: 'color 0.3s ease',
              maxWidth: 72, wordBreak: 'keep-all'
            }}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Panel cảnh báo "Chờ xác nhận tại chỗ"
 */
function AwaitingConfirmationBanner() {
  return (
    <div style={{
      backgroundColor: 'var(--warning-bg)',
      border: '1.5px solid var(--warning)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12
    }}>
      <span className="material-symbols-outlined"
        style={{ fontSize: 24, color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>
        warning
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>
          Yêu cầu xác nhận tại chỗ trước khi phát tia laser
        </div>
        <ul style={{
          fontSize: 11, color: 'var(--on-surface-variant)',
          listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3
        }}>
          <li>✓ Kiểm tra phôi gỗ Plywood 3mm đã đặt đúng vị trí (100×100 mm)</li>
          <li>✓ Đảm bảo tiêu cự đã cân chỉnh chuẩn (40mm với LM-C40)</li>
          <li>✓ Đeo kính bảo hộ laser 450nm</li>
          <li>✓ Bảo đảm khu vực an toàn, không có người đứng gần</li>
        </ul>
        <div style={{
          marginTop: 8, fontSize: 12, fontWeight: 600,
          color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>touch_app</span>
          Nhấn nút vật lý trên bo mạch MKS DLC32 để bắt đầu khắc
        </div>
      </div>
    </div>
  );
}

/**
 * Thanh tiến độ khắc thời gian thực
 */
function PrintingProgressPanel({ progressData, isPaused }) {
  const pct = progressData?.progressPercent ?? 0;
  const currentLine = progressData?.currentLine ?? 0;
  const totalLines  = progressData?.totalLines  ?? 0;
  const etaSecs     = progressData?.remainingSeconds ?? 0;

  return (
    <div style={{
      backgroundColor: 'var(--surface-container-low)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid rgba(195, 198, 215, 0.4)',
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      {/* Phần trăm + ETA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
            color: isPaused ? '#d97706' : 'var(--primary-container)'
          }}>
            {pct.toFixed(1)}%
          </span>
          {isPaused && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#b45309',
              backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: 4
            }}>
              ĐANG TẠM DỪNG
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--secondary)' }}>
          Còn lại ~{fmtTime(etaSecs)}
        </span>
      </div>

      {/* Thanh tiến trình */}
      <div className="progress-track" style={{ height: 8, backgroundColor: 'var(--surface-container-highest)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            backgroundColor: isPaused ? '#f59e0b' : 'var(--primary-container)',
            transition: 'width 0.4s ease-out'
          }}
        />
      </div>

      {/* Dòng lệnh / tổng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--secondary)' }}>
        <span>
          Dòng lệnh: <strong style={{ color: 'var(--on-surface)' }}>{currentLine.toLocaleString()}</strong> / {totalLines.toLocaleString()}
        </span>
        <span>
          Tiến độ: <strong style={{ color: isPaused ? '#d97706' : 'var(--primary-container)' }}>{pct.toFixed(1)}%</strong>
        </span>
      </div>
    </div>
  );
}

/**
 * HUD Bảng điều khiển toạ độ và cảm biến thời gian thực
 */
function MachineTelemetryHUD({ telemetryData, progressData }) {
  const x = telemetryData?.x ?? progressData?.x ?? 0.0;
  const y = telemetryData?.y ?? progressData?.y ?? 0.0;
  const feed = telemetryData?.feedRate ?? progressData?.feedRate ?? 1500;
  const power = telemetryData?.laserPower ?? progressData?.laserPower ?? 1000;
  const powerPct = Math.round((power / 1000) * 100);

  const sensors = telemetryData?.sensors ?? progressData?.sensors ?? {};
  const temp = sensors.temperature ?? 25.0;
  const flame = Boolean(sensors.flameDetected);
  const door = Boolean(sensors.doorOpen);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10
    }}>
      {/* Box 1: Toạ độ X/Y thời gian thực */}
      <div style={{
        backgroundColor: 'var(--surface-container-low)',
        border: '1px solid rgba(195, 198, 215, 0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary-container)' }}>navigation</span>
          <span>Toạ độ đầu khắc (X, Y)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 2 }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>X: </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--on-surface)' }}>
              {x.toFixed(2)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--secondary)', marginLeft: 2 }}>mm</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>Y: </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--on-surface)' }}>
              {y.toFixed(2)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--secondary)', marginLeft: 2 }}>mm</span>
          </div>
        </div>
      </div>

      {/* Box 2: Tốc độ & Công suất laser */}
      <div style={{
        backgroundColor: 'var(--surface-container-low)',
        border: '1px solid rgba(195, 198, 215, 0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>speed</span>
          <span>Tốc độ & Công suất Laser</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 2 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--on-surface)' }}>
              {feed}
            </span>
            <span style={{ fontSize: 10, color: 'var(--secondary)', marginLeft: 2 }}>mm/p</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>S: </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
              {power}
            </span>
            <span style={{ fontSize: 10, color: 'var(--secondary)', marginLeft: 2 }}>({powerPct}%)</span>
          </div>
        </div>
      </div>

      {/* Box 3: Nhiệt độ đầu laser */}
      <div style={{
        backgroundColor: 'var(--surface-container-low)',
        border: '1px solid rgba(195, 198, 215, 0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: temp > 50 ? '#dc2626' : '#10b981' }}>thermostat</span>
          <span>Nhiệt độ đầu laser</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 700,
            color: temp > 50 ? '#dc2626' : 'var(--on-surface)'
          }}>
            {temp.toFixed(1)}°C
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: temp > 50 ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)',
            color: temp > 50 ? '#dc2626' : '#10b981'
          }}>
            {temp > 50 ? 'Cảnh báo nhiệt' : 'Bình thường'}
          </span>
        </div>
      </div>

      {/* Box 4: Cảm biến an toàn */}
      <div style={{
        backgroundColor: 'var(--surface-container-low)',
        border: '1px solid rgba(195, 198, 215, 0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: flame ? '#dc2626' : '#10b981' }}>security</span>
          <span>Cảm biến an toàn</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: flame ? '#fee2e2' : '#d1fae5',
            color: flame ? '#dc2626' : '#059669',
            display: 'inline-flex', alignItems: 'center', gap: 3
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              {flame ? 'local_fire_department' : 'check_circle'}
            </span>
            {flame ? 'LỬA BÁO ĐỘNG!' : 'Không có lửa'}
          </span>

          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: door ? '#fef3c7' : '#d1fae5',
            color: door ? '#d97706' : '#059669',
            display: 'inline-flex', alignItems: 'center', gap: 3
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              {door ? 'door_front' : 'lock'}
            </span>
            {door ? 'Cửa mở' : 'Nắp an toàn'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Component: JobProgressModal
 */
export default function JobProgressModal({
  isOpen,
  onClose,
  jobCode,
  deviceCode = 'LASER-HN-001',
  sha256 = '',
  fileName = '',
  initialStatus = null,
  queuePosition = 1,
  onAbortJob
}) {
  if (!isOpen) return null;

  const {
    isConnected,
    connectionError,
    progressData,
    statusData,
    telemetryData
  } = useJobWebSocket(jobCode);

  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState(null);

  // Tổng hợp trạng thái hiện tại từ các kênh WS & Telemetry
  const currentStatus = telemetryData?.status
    ?? statusData?.status
    ?? progressData?.status
    ?? initialStatus
    ?? 'SUBMITTED';

  const isFailed = currentStatus === 'FAILED' || currentStatus === 'CANCELLED';
  const isCompleted = currentStatus === 'COMPLETED';
  const isPrinting = currentStatus === 'PRINTING';
  const isPaused = currentStatus === 'PAUSED';
  const isAwaiting = currentStatus === 'AWAITING_ONSITE_CONFIRMATION';

  // Đóng modal khi nhấn Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSendCommand = async (action, reason = '') => {
    setIsSendingCommand(true);
    setCommandFeedback(null);
    try {
      await jobApi.sendJobCommand(jobCode, action, reason);
      setCommandFeedback({ type: 'success', text: `Đã gửi lệnh "${action}" thành công tới máy ${deviceCode}` });
      setTimeout(() => setCommandFeedback(null), 4000);
    } catch (err) {
      setCommandFeedback({ type: 'error', text: `Gửi lệnh "${action}" thất bại: ${err.message}` });
      setTimeout(() => setCommandFeedback(null), 6000);
    } finally {
      setIsSendingCommand(false);
    }
  };



  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: 580, width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="material-symbols-outlined"
              style={{ fontSize: 20, color: 'var(--primary-container)' }}>
              precision_manufacturing
            </span>
            <div>
              <span className="modal-title">Giám sát Khắc Laser IoT</span>
              <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 1 }}>
                Theo dõi tiến độ thời gian thực – {deviceCode}
              </div>
            </div>
          </div>

          {/* Chấm kết nối WebSocket */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--secondary)' }}>
              <span
                className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}
                title={isConnected ? 'Kênh WebSocket máy chủ đã kết nối' : 'Mất kết nối máy chủ'}
              />
              {isConnected ? 'Kênh Web: Sẵn sàng' : 'Kênh Web: Mất kết nối'}
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>

        {/* ── BODY ────────────────────────────────────────────────── */}
        <div className="modal-body" style={{ gap: 14 }}>

          {/* Thông báo kết quả gửi lệnh tức thời */}
          {commandFeedback && (
            <div style={{
              backgroundColor: commandFeedback.type === 'success' ? 'var(--success-bg)' : 'var(--error-container)',
              color: commandFeedback.type === 'success' ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${commandFeedback.type === 'success' ? '#10b981' : '#dc2626'}`,
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {commandFeedback.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{commandFeedback.text}</span>
            </div>
          )}

          {/* Thông tin Job */}
          <div style={{
            backgroundColor: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(195, 198, 215, 0.4)',
            padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                fontSize: 13, color: 'var(--on-surface)'
              }}>
                {jobCode || '—'}
              </span>
              <StatusBadge status={currentStatus} />
            </div>

            {fileName && (
              <InfoRow label="Tên file" value={fileName} />
            )}
            <InfoRow label="Máy thực thi" value={deviceCode} mono />
            {sha256 && (
              <InfoRow
                label="SHA-256"
                value={shortHash(sha256)}
                mono
                accent
              />
            )}
          </div>

          {/* Stepper vòng đời */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--secondary)', marginBottom: 10 }}>
              Tiến trình vòng đời Job
            </div>
            <JobStepper currentStatus={currentStatus} isFailed={isFailed} />
          </div>

          {/* Thông báo hàng đợi khi Job đang chờ máy rảnh */}
          {currentStatus === 'QUEUED' && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#d97706', marginTop: 1 }}>
                hourglass_top
              </span>
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>
                  Job đang trong Hàng đợi gia công (Vị trí #{queuePosition || 1})
                </strong>
                Máy khắc hiện đang bận xử lý job khác. Yêu cầu của bạn đã được ghi nhận an toàn trên máy chủ. Quản máy sẽ kiểm tra phôi và phê duyệt nạp vào máy ngay khi máy rảnh.
              </div>
            </div>
          )}

          {/* Cảnh báo an toàn khi chờ xác nhận */}
          {isAwaiting && <AwaitingConfirmationBanner />}

          {/* Thanh tiến trình đang khắc hoặc tạm dừng */}
          {(isPrinting || isPaused || isCompleted) && (
            <PrintingProgressPanel progressData={progressData} isPaused={isPaused} />
          )}

          {/* HUD toạ độ & cảm biến thời gian thực */}
          {(isPrinting || isPaused || telemetryData) && (
            <MachineTelemetryHUD telemetryData={telemetryData} progressData={progressData} />
          )}

          {/* Bảng điều khiển lệnh máy tức thời (Khi đang khắc hoặc tạm dừng) */}
          {(isPrinting || isPaused) && (
            <div style={{
              backgroundColor: 'var(--surface-container-low)',
              border: '1px solid rgba(195, 198, 215, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary)' }}>
                Điều khiển máy tức thời:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPrinting && (
                  <button
                    type="button"
                    disabled={isSendingCommand}
                    onClick={() => handleSendCommand('PAUSE', 'Tạm dừng từ Web UI')}
                    style={{
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #f59e0b',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 12px',
                      fontSize: 12, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      cursor: isSendingCommand ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Tạm dừng khắc và ngắt tia laser ngay lập tức"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pause_circle</span>
                    Tạm dừng
                  </button>
                )}

                {isPaused && (
                  <>
                    <button
                      type="button"
                      disabled={isSendingCommand}
                      onClick={() => handleSendCommand('RESUME', 'Tiếp tục khắc')}
                      style={{
                        backgroundColor: '#d1fae5',
                        color: '#047857',
                        border: '1px solid #10b981',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 12px',
                        fontSize: 12, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        cursor: isSendingCommand ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      title="Tiếp tục khắc lại từ điểm dừng"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_circle</span>
                      Tiếp tục
                    </button>

                    <button
                      type="button"
                      disabled={isSendingCommand}
                      onClick={() => handleSendCommand('HOME', 'Về gốc toạ độ')}
                      style={{
                        backgroundColor: 'var(--surface-container)',
                        color: 'var(--on-surface)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 12px',
                        fontSize: 12, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        cursor: isSendingCommand ? 'not-allowed' : 'pointer'
                      }}
                      title="Đưa đầu laser về vị trí gốc máy (0, 0)"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home</span>
                      Về Home
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Thông báo lỗi kết nối */}
          {connectionError && (
            <div style={{
              backgroundColor: 'var(--error-container)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: 11, color: 'var(--on-error-container)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>signal_disconnected</span>
              {connectionError}
            </div>
          )}

          {/* Thông báo hoàn thành */}
          {isCompleted && (
            <div style={{
              backgroundColor: 'var(--success-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 22, color: 'var(--success)' }}>
                task_alt
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                  Gia công hoàn tất!
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                  Job đã được lưu vào lịch sử gia công.
                </div>
              </div>
            </div>
          )}

          {/* Thông báo thất bại */}
          {isFailed && (
            <div style={{
              backgroundColor: 'var(--error-container)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 22, color: 'var(--error)' }}>
                error
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>
                  {currentStatus === 'CANCELLED' ? 'Job đã bị hủy' : 'Job thất bại'}
                </div>
                {statusData?.message && (
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    {statusData.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn-header-action" onClick={onClose}>
            {isCompleted || isFailed ? 'Đóng' : 'Thu nhỏ'}
          </button>
        </div>
      </div>
    </div>
  );
}
