import React, { useState, useRef, useEffect } from 'react';

export default function ConsoleModal({
  isOpen,
  onClose,
  terminalLogs,
  onSendCommand,
  onClearLogs,
  isConnected
}) {
  const [cmdInput, setCmdInput] = useState('');
  const logEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    onSendCommand(cmdInput.trim());
    setCmdInput('');
  };

  const handleQuickCmd = (cmd) => {
    onSendCommand(cmd);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-container)' }}>
              terminal
            </span>
            <span className="modal-title">Console điều khiển GRBL (Serial Terminal)</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>

        <div className="modal-body">
          {/* Quick command buttons */}
          <div className="quick-cmds-bar">
            <span style={{ fontSize: 11, color: 'var(--secondary)', alignSelf: 'center' }}>Lệnh nhanh:</span>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('?')}>?</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('$H')}>$H (Home)</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('$X')}>$X (Mở khóa)</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('$$')}>$$ (Cấu hình)</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('$32=1')}>$32=1 (Laser)</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('G92 X0 Y0')}>G92 X0 Y0</button>
            <button type="button" className="quick-cmd-btn" onClick={() => handleQuickCmd('M5')} style={{ color: 'var(--error)' }}>M5 (Tắt tia)</button>
          </div>

          {/* Terminal log output */}
          <div className="terminal-log-box">
            {terminalLogs.map((log, index) => (
              <div key={index} className={`terminal-line ${log.type}`}>
                <span style={{ opacity: 0.5, marginRight: 8 }}>{log.time}</span>
                {log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Command input form */}
          <form onSubmit={handleSubmit} className="terminal-input-bar">
            <input
              type="text"
              className="terminal-input"
              placeholder={isConnected ? "Nhập lệnh G-code gửi xuống máy (ví dụ: G0 X10 Y10 hoặc ?)..." : "Chưa kết nối máy khắc qua cổng COM (vui lòng kết nối trước)..."}
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
            />
            <button type="submit" className="btn-trigger-start">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                send
              </span>
              <span>Gửi</span>
            </button>
          </form>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn-link" onClick={onClearLogs}>
            Xóa màn hình console
          </button>
          <button type="button" className="btn-header-action" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
