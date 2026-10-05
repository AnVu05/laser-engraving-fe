import React, { useState, useEffect, useRef } from 'react';

export default function NewProjectModal({
  isOpen,
  onClose,
  currentUser,
  currentElementCount = 0,
  initialParams = {},
  onCreateProject,
  onGuestNewWorkspace,
  onOpenAuth
}) {
  const [projectName, setProjectName] = useState('');
  const [feedRate, setFeedRate] = useState(initialParams.feedRate || 1500);
  const [laserPower, setLaserPower] = useState(initialParams.laserPower || 75);
  const [dpi, setDpi] = useState(initialParams.dpi || 254);
  const [mode, setMode] = useState(initialParams.mode || 'raster');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  // Sinh tên dự án gợi ý thông minh khi mở modal
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const datePart = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const defaultName = `Bàn khắc mới ${datePart} #${randomSuffix}`;
      setProjectName(defaultName);
      setErrorMsg('');
      setIsSubmitting(false);

      if (initialParams.feedRate) setFeedRate(initialParams.feedRate);
      if (initialParams.laserPower) setLaserPower(initialParams.laserPower);
      if (initialParams.dpi) setDpi(initialParams.dpi);
      if (initialParams.mode) setMode(initialParams.mode);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, initialParams]);

  if (!isOpen) return null;

  const handleGenerateQuickName = (prefix = 'Dự án Laser') => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setProjectName(`${prefix} #${randomSuffix}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên cho dự án bàn khắc mới!');
      return;
    }

    if (!currentUser?.email) {
      setErrorMsg('Bạn cần đăng nhập tài khoản Gmail để lưu dự án mới vào CSDL!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const projectPayload = {
        name: trimmedName,
        userEmail: currentUser.email,
        elementCount: 0,
        elements: [], // Khởi tạo bàn làm việc mới sạch sẽ
        parameters: {
          feedRate: Number(feedRate),
          laserPower: Number(laserPower),
          dpi: Number(dpi),
          mode: mode,
          bedWidth: 300,
          bedHeight: 200
        }
      };

      if (onCreateProject) {
        await onCreateProject(projectPayload);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi lưu dự án vào cơ sở dữ liệu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: 540,
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(11, 28, 48, 0.25)',
          overflow: 'hidden',
          animation: 'modal-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid rgba(195, 198, 215, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                add_box
              </span>
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#0b1c30' }}>
                Thêm bàn khắc mới & Lưu dự án
              </div>
              <div style={{ fontSize: 11, color: '#565e74' }}>
                Khởi tạo không gian làm việc sạch sẽ và lưu trữ bản ghi vào SQL Server
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-dialog-close"
            onClick={onClose}
            title="Đóng cửa sổ"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px', maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
          {!currentUser ? (
            /* Khi chưa đăng nhập (Chế độ Khách vãn lai) */
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#eff4ff',
                  color: '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                  person
                </span>
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#0b1c30' }}>
                Chế độ Khách vãn lai
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#565e74', lineHeight: 1.5, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                Bạn có thể khởi tạo bàn làm việc mới (300 × 200 mm), tự do thiết kế chữ, hình học, ảnh raster, <strong>tạo mã G-code và tải file .NC về máy</strong> hoàn toàn bình thường mà không bắt buộc đăng nhập.
              </p>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 16,
                  fontSize: 11,
                  color: '#64748b'
                }}
              >
                ℹ️ Lưu ý: Dự án của bạn sẽ không được lưu lại nếu không đăng nhập
              </div>

              {currentElementCount > 0 && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 16,
                    fontSize: 11,
                    color: '#92400e',
                    textAlign: 'left'
                  }}
                >
                  ⚠️ Bàn làm việc hiện tại đang có <strong>{currentElementCount} đối tượng</strong>. Khi tạo bàn mới, các đối tượng này sẽ được làm sạch để bạn bắt đầu bản vẽ mới.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-header-action"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    fontSize: 12
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (onGuestNewWorkspace) {
                      onGuestNewWorkspace();
                    } else {
                      onClose();
                    }
                  }}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 20px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    play_circle
                  </span>
                  <span>Tạo bàn mới ngay (Khách vãn lai)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Khi đã đăng nhập -> Form tạo dự án */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Error Message */}
              {errorMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tên dự án input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#0b1c30' }}>
                    Tên dự án bàn khắc <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleGenerateQuickName('Biển hiệu')}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 11,
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: '0 2px'
                      }}
                    >
                      + Biển hiệu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateQuickName('Khắc Logo')}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 11,
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: '0 2px'
                      }}
                    >
                      + Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateQuickName('Móc khóa')}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 11,
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: '0 2px'
                      }}
                    >
                      + Móc khóa
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ position: 'absolute', left: 10, fontSize: 18, color: '#737686' }}
                  >
                    drive_file_rename_outline
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="VD: Khắc gỗ sồi 150x100mm, Biển tên Mica..."
                    style={{
                      width: '100%',
                      height: 38,
                      paddingLeft: 36,
                      paddingRight: 10,
                      borderRadius: 8,
                      border: '1px solid #c3c6d7',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#0b1c30',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box'
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
                </div>
              </div>

              {/* Thông tin bàn khắc & tài khoản lưu trữ */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid rgba(195, 198, 215, 0.5)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#2563eb' }}>
                    aspect_ratio
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0b1c30' }}>
                      Khổ bàn khắc Laser: 300 × 200 mm
                    </div>
                    <div style={{ fontSize: 11, color: '#565e74' }}>
                      Gốc tọa độ X0 Y0 CNC tiêu chuẩn
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#565e74' }}>Tài khoản lưu:</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>
                    {currentUser.email}
                  </div>
                </div>
              </div>

              {/* Cấu hình thông số ban đầu */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0b1c30', marginBottom: 8 }}>
                  Cấu hình thông số gia công mặc định
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#565e74', display: 'block', marginBottom: 3 }}>
                      Tốc độ khắc (Feed Rate)
                    </span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="no-spin-button"
                        min="100"
                        max="8000"
                        step="100"
                        value={feedRate}
                        onChange={(e) => setFeedRate(e.target.value)}
                        style={{
                          width: '100%',
                          height: 32,
                          paddingLeft: 10,
                          paddingRight: 64,
                          borderRadius: 6,
                          border: '1px solid #c3c6d7',
                          fontSize: 12,
                          color: '#0b1c30',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ position: 'absolute', right: 10, fontSize: 11, color: '#737686', pointerEvents: 'none' }}>
                        mm/min
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#565e74', display: 'block', marginBottom: 3 }}>
                      Công suất Laser
                    </span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="no-spin-button"
                        min="5"
                        max="100"
                        step="5"
                        value={laserPower}
                        onChange={(e) => setLaserPower(e.target.value)}
                        style={{
                          width: '100%',
                          height: 32,
                          paddingLeft: 10,
                          paddingRight: 32,
                          borderRadius: 6,
                          border: '1px solid #c3c6d7',
                          fontSize: 12,
                          color: '#0b1c30',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ position: 'absolute', right: 10, fontSize: 11, color: '#737686', pointerEvents: 'none' }}>
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#565e74', display: 'block', marginBottom: 3 }}>
                      Độ phân giải DPI
                    </span>
                    <select
                      value={dpi}
                      onChange={(e) => setDpi(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: 32,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid #c3c6d7',
                        fontSize: 12,
                        color: '#0b1c30',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value={127}>127 DPI (0.2 mm / pixel)</option>
                      <option value={254}>254 DPI (0.1 mm / pixel - Chuẩn)</option>
                      <option value={318}>318 DPI (0.08 mm / pixel)</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#565e74', display: 'block', marginBottom: 3 }}>
                      Chế độ gia công
                    </span>
                    <div style={{ display: 'flex', gap: 6, height: 32 }}>
                      <button
                        type="button"
                        onClick={() => setMode('raster')}
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          border: `1px solid ${mode === 'raster' ? '#2563eb' : '#c3c6d7'}`,
                          backgroundColor: mode === 'raster' ? '#eff4ff' : '#ffffff',
                          color: mode === 'raster' ? '#2563eb' : '#565e74',
                          fontWeight: mode === 'raster' ? 600 : 500,
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        Raster (Điểm)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('vector')}
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          border: `1px solid ${mode === 'vector' ? '#2563eb' : '#c3c6d7'}`,
                          backgroundColor: mode === 'vector' ? '#eff4ff' : '#ffffff',
                          color: mode === 'vector' ? '#2563eb' : '#565e74',
                          fontWeight: mode === 'vector' ? 600 : 500,
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        Vector (Cắt)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cảnh báo xóa các đối tượng hiện có nếu đang có */}
              {currentElementCount > 0 && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 11,
                    color: '#92400e'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#b45309', marginTop: 1 }}>
                    warning
                  </span>
                  <div>
                    Bàn làm việc hiện đang có <strong>{currentElementCount} đối tượng</strong>. Khi khởi tạo bàn mới, các đối tượng này sẽ được làm sạch để bạn bắt đầu dự án mới.
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(195, 198, 215, 0.4)'
                }}
              >
                <button
                  type="button"
                  className="btn-header-action"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !projectName.trim()}
                  style={{
                    backgroundColor: isSubmitting || !projectName.trim() ? '#93c5fd' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isSubmitting || !projectName.trim() ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {isSubmitting ? 'sync' : 'add_box'}
                  </span>
                  <span>{isSubmitting ? 'Đang tạo bảng mới...' : 'Tạo bảng mới'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
