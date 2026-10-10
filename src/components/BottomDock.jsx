import React from 'react';

export default function BottomDock({
  onJog,
  onJogZero,
  stepSize,
  setStepSize,
  onFramingCheck,
  isFraming,
  onOpenCalibration,
  isRunning,
  isPaused,
  progress,
  currentLine,
  totalLines,
  estimatedTime,
  elapsedTime = '00:00',
  statusText,
  statusType,
  onStartJob,
  onPauseJob,
  onStopJob
}) {
  const stepOptions = [0.1, 1, 10];
  const handleCycleStep = () => {
    const curIdx = stepOptions.indexOf(stepSize);
    const nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % stepOptions.length;
    setStepSize(stepOptions[nextIdx]);
  };

  return (
    <footer className="bottom-operation-dock">
      {/* LEFT: CNC Axis Jog Controls */}
      <div className="jog-section">
        <span className="jog-label-tag">Di chuyển:</span>

        {/* 3x3 D-Pad */}
        <div className="dpad-grid-3x3">
          <div />
          <button
            type="button"
            className="dpad-btn"
            title={`Di chuyển +Y (${stepSize}mm)`}
            onClick={() => onJog(0, stepSize)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_drop_up
            </span>
          </button>
          <div />

          <button
            type="button"
            className="dpad-btn"
            title={`Di chuyển -X (${stepSize}mm)`}
            onClick={() => onJog(-stepSize, 0)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_left
            </span>
          </button>

          <button
            type="button"
            className="dpad-zero-btn"
            title="Thiết lập gốc toạ độ phôi (G92 X0 Y0)"
            onClick={onJogZero}
          >
            0,0
          </button>

          <button
            type="button"
            className="dpad-btn"
            title={`Di chuyển +X (${stepSize}mm)`}
            onClick={() => onJog(stepSize, 0)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_right
            </span>
          </button>

          <div />
          <button
            type="button"
            className="dpad-btn"
            title={`Di chuyển -Y (${stepSize}mm)`}
            onClick={() => onJog(0, -stepSize)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_drop_down
            </span>
          </button>
          <div />
        </div>

        {/* Step increment toggle pill */}
        <div className="step-selector-col">
          <span className="step-small-label">Bước:</span>
          <button
            type="button"
            className="step-toggle-btn"
            onClick={handleCycleStep}
            title="Bấm để đổi bước dịch chuyển (0.1mm / 1mm / 10mm - Chuẩn phần cứng)"
          >
            {stepSize} mm
          </button>
        </div>

        <div className="dock-divider-v" />

        {/* Framing & Boundary Test Button */}
        <button
          type="button"
          className="btn-frame-check"
          onClick={onFramingCheck}
          style={{
            backgroundColor: isFraming ? 'var(--warning-bg)' : undefined,
            borderColor: isFraming ? 'var(--warning)' : undefined
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: isFraming ? 'var(--warning)' : 'var(--primary-container)'
            }}
          >
            crop_free
          </span>
          <span>{isFraming ? 'Đang chạy khung...' : 'Chạy khung thử (Frame)'}</span>
        </button>

        {/* Smart Focus Calibration Button (LM-C40 40mm) */}
        <button
          type="button"
          className="btn-focus-calibrate"
          onClick={onOpenCalibration}
          title="Trợ lý Tiêu cự & Đề xuất công suất thông minh LM-C40 5.5W"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 10px',
            height: 32,
            borderRadius: 6,
            border: '1px solid rgba(37, 99, 235, 0.4)',
            backgroundColor: '#eff4ff',
            color: '#1d4ed8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff4ff'; }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: '#2563eb' }}
          >
            center_focus_strong
          </span>
          <span>Cân chỉnh tiêu cự</span>
        </button>
      </div>

      {/* CENTER: Realtime Progress Stream */}
      <div className="progress-stream-section">
        <div className="progress-header-row">
          <span className="status-indicator-tag">
            <span className={`status-pulse-dot ${statusType}`} />
            <span>{statusText}</span>
          </span>
          <span className="progress-pct-text">
            {progress > 0 ? progress.toFixed(1) : 0}%
          </span>
        </div>

        <div className="progress-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        <div className="progress-footer-stats">
          <span>
            Dòng lệnh: <strong>{currentLine.toLocaleString()}</strong> / {totalLines.toLocaleString()}
          </span>
          <span>
            {isRunning ? (
              <>Thời gian: <strong>{elapsedTime}</strong> · Còn lại: ~<strong>{estimatedTime}</strong></>
            ) : (
              <>Thời gian ước tính: ~<strong>{estimatedTime}</strong></>
            )}
          </span>
        </div>
      </div>

      {/* RIGHT: Machine Triggers */}
      <div className="machine-trigger-cluster">
        {/* Start Button */}
        <button
          type="button"
          className="btn-trigger-start"
          onClick={onStartJob}
          disabled={isRunning && !isPaused}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            play_arrow
          </span>
          <span>{isPaused ? 'Tiếp tục khắc' : 'Bắt đầu khắc'}</span>
        </button>

        {/* Pause Button */}
        <button
          type="button"
          className="btn-trigger-pause"
          onClick={onPauseJob}
          disabled={!isRunning || isPaused}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--secondary)' }}>
            pause
          </span>
          <span>Tạm dừng</span>
        </button>

        {/* Emergency Stop Button */}
        <button
          type="button"
          className="btn-trigger-stop"
          onClick={onStopJob}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--error)' }}>
            stop_circle
          </span>
          <span>Dừng máy</span>
        </button>
      </div>
    </footer>
  );
}
