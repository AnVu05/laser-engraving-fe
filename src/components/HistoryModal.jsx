export default function HistoryModal({
  isOpen,
  onClose,
  historyList = [],
  currentUser,
  onOpenAuth,
  onDownloadItem,
  onDeleteItem
}) {
  if (!isOpen) return null;

  const handleDownloadItem = (item) => {
    if (onDownloadItem) {
      onDownloadItem(item);
      return;
    }

    let content = item.gcode;
    if (!content) {
      const speed = item.feedRate || 1500;
      const pwr = item.power || 750;
      content = [
        '; ========================================================',
        '; PhotonCraft GRBL Web Controller - Tệp G-code từ Lịch sử',
        `; Đối tượng: ${item.name}`,
        `; Thời gian lưu: ${item.date}`,
        `; Tốc độ Feed rate: ${speed} mm/min`,
        `; Công suất Laser PWM: S${pwr}`,
        `; Tổng số dòng lệnh: ${item.lines || 'N/A'}`,
        '; ========================================================',
        '$32=1       ; Bật Laser Mode chuẩn GRBL',
        'G21         ; Đơn vị tọa độ milimét',
        'G90         ; Tọa độ tuyệt đối',
        'M5          ; Đảm bảo tắt laser trước khi di chuyển nhanh',
        `G0 X0 Y0 F${speed}`,
        `M3 S${pwr}  ; Bật tia laser công suất S${pwr}`,
        '; --- Hành trình gia công mẫu ---',
        `G1 X60.00 Y0.00 F${speed}`,
        `G1 X60.00 Y50.00`,
        `G1 X0.00 Y50.00`,
        `G1 X0.00 Y0.00`,
        'M5          ; Tắt tia laser',
        'G0 X0 Y0    ; Quay về gốc phôi',
        'M2          ; Kết thúc chương trình gia công'
      ].join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = item.name ? item.name.replace(/\.[^/.]+$/, '') : 'laser_job';
    link.download = `${baseName}_history.nc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-container)' }}>
              history
            </span>
            <span className="modal-title">Lịch sử gia công laser (Cloud CSDL)</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>

        <div className="modal-body">
          {/* Banner hướng dẫn nếu chưa đăng nhập */}
          {!currentUser && (
            <div
              style={{
                backgroundColor: 'rgba(238, 242, 255, 0.65)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-container)' }}>
                  account_circle
                </span>
                <span>
                  Bạn đang ở chế độ <strong>Khách vãng lai (Chưa đăng nhập)</strong>. Đăng nhập để tự động lưu & đồng bộ lịch sử khắc cá nhân trên Cloud CSDL.
                </span>
              </div>
              {onOpenAuth && (
                <button
                  type="button"
                  className="btn-header-action"
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: 12 }}
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                >
                  Đăng nhập
                </button>
              )}
            </div>
          )}

          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 42, opacity: 0.45, marginBottom: 8, color: 'var(--primary)' }}>
                history_toggle_off
              </span>
              <p style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 14 }}>
                {currentUser ? 'Chưa có lịch sử gia công' : 'Chưa có lịch sử trong phiên làm việc này'}
              </p>
              <p style={{ fontSize: 12, marginTop: 4, maxWidth: 360, margin: '6px auto 0 auto', lineHeight: 1.5 }}>
                {currentUser
                  ? 'Bàn làm việc mới tinh chưa xuất lệnh khắc nào. Các lần khắc laser tiếp theo sẽ tự động ghi lại tại đây.'
                  : 'Bàn làm việc đang ở trạng thái mới. Lịch sử sẽ chỉ được ghi lại khi bạn kết nối máy và thực hiện lệnh khắc.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historyList.map((item, index) => (
                <div
                  key={item.id || index}
                  style={{
                    backgroundColor: 'var(--surface-container-low)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--on-surface)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.name}</span>
                      {item.isCloud && (
                        <span 
                          className="material-symbols-outlined" 
                          style={{ fontSize: 14, color: 'var(--primary-container)' }}
                          title="Đã đồng bộ lên CSDL SQL Server"
                        >
                          cloud_done
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {item.date} · {item.lines} dòng lệnh · F{item.feedRate} · S{item.power}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: item.status === 'Hoàn tất' ? 'var(--success)' : 'var(--error)',
                        backgroundColor: 'var(--surface-container-lowest)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {item.status}
                    </div>

                    <button
                      type="button"
                      className="btn-download-history"
                      onClick={() => handleDownloadItem(item)}
                      title="Tải tệp mã G-code (.nc) này về máy tính"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        download
                      </span>
                      <span>Tải G-code</span>
                    </button>

                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--secondary)')}
                        title="Xóa bản ghi này"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          delete
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-header-action" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
