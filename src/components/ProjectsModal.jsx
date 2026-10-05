import React, { useState, useEffect } from 'react';
import { projectApi } from '../services/projectApi';

export default function ProjectsModal({
  isOpen,
  onClose,
  currentUser,
  onLoadProject,
  onOpenAuth
}) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tải danh sách dự án từ Cloud CSDL SQL Server (Chỉ tải dự án của tài khoản ĐÃ ĐĂNG NHẬP)
  const fetchProjects = async () => {
    if (!currentUser?.email) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await projectApi.getProjects(currentUser.email);
      if (res && res.data && Array.isArray(res.data)) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.warn('Lỗi khi tải dự án từ server:', err.message);
      setErrorMsg(err.message);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, currentUser?.email]);

  if (!isOpen) return null;

  const handleSelectProject = (project) => {
    if (onLoadProject) {
      onLoadProject(project);
    }
    onClose();
  };

  const handleDeleteProject = async (e, project) => {
    e.stopPropagation();
    const projName = project.projectName || project.name || 'dự án';
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dự án "${projName}" khỏi CSDL?`)) {
      return;
    }

    const projectId = project.projectId || project.id;
    if (projectId && currentUser?.email) {
      try {
        await projectApi.deleteProject(projectId, currentUser.email);
      } catch (err) {
        console.warn('Xóa dự án trên server lỗi:', err.message);
      }
    }

    // Cập nhật state và localStorage
    setProjects((prev) => prev.filter((p) => (p.projectId || p.id) !== projectId));
    try {
      const storageKey = currentUser?.email ? `laser_projects_${currentUser.email}` : 'laser_projects_guest';
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = existing.filter((p) => (p.projectId || p.id) !== projectId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: 'var(--primary-container)' }}
            >
              folder_special
            </span>
            <span className="modal-title">Dự án bàn khắc đã lưu (Cloud CSDL)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={fetchProjects}
              title="Làm mới danh sách từ máy chủ"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--secondary)',
                display: 'flex',
                alignItems: 'center',
                padding: 4
              }}
            >
              <span className={`material-symbols-outlined ${isLoading ? 'spinning' : ''}`} style={{ fontSize: 20 }}>
                refresh
              </span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                close
              </span>
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {!currentUser ? (
            <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--secondary)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--primary)',
                  marginBottom: 14
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                  lock
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 6 }}>
                Bạn chưa đăng nhập
              </h3>
              <p style={{ fontSize: 13, maxWidth: 380, margin: '0 auto 20px auto', lineHeight: 1.5, color: 'var(--on-surface-variant)' }}>
                Bạn đang thao tác với tư cách <strong>Khách vãng lai</strong> nên chưa có dự án nào được lưu. Đăng nhập Gmail để lưu trữ và quản lý các dự án bàn khắc của riêng bạn trên Cloud CSDL.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  className="btn-header-action"
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: 'var(--primary-container)',
                    color: '#ffffff',
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    login
                  </span>
                  <span>Đăng nhập ngay</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--error)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    marginBottom: 10
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--secondary)' }}>
                  <span className="material-symbols-outlined spinning" style={{ fontSize: 32, marginBottom: 8 }}>
                    progress_activity
                  </span>
                  <p style={{ fontSize: 13 }}>Đang tải danh sách dự án từ SQL Server...</p>
                </div>
              ) : projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4, marginBottom: 10 }}>
                    folder_off
                  </span>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 4 }}>
                    Chưa có dự án nào được lưu
                  </h4>
                  <p style={{ fontSize: 12, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                    Hãy sắp xếp các đối tượng trên bàn khắc (hình ảnh, hình khối, văn bản) và bấm nút <strong>"Lưu dự án"</strong> ở góc bàn vẽ để lưu lại.
                  </p>
                </div>
              ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projects.map((proj, idx) => {
                const projId = proj.projectId || proj.id || idx;
                const rawName = proj.projectName || proj.name || `Dự án bàn khắc #${projId}`;
                const projName = rawName
                  .replace(/kh\?c/gi, 'khắc')
                  .replace(/thuong hi\?u/gi, 'thương hiệu')
                  .replace(/th\?c/gi, 'thực')
                  .replace(/Kh\? A5/gi, 'Khổ A5')
                  .replace(/Bi\?n/gi, 'Biển')
                  .replace(/d\? bàn/gi, 'để bàn')
                  .replace(/trang tr\?/gi, 'trang trí')
                  .replace(/s\?u/gi, 'sâu');
                const elemCount = proj.elementCount || (proj.elements ? proj.elements.length : 0);
                const dateStr = proj.createdAt
                  ? new Date(proj.createdAt).toLocaleString('vi-VN')
                  : proj.date || 'Vừa lưu gần đây';

                let paramsSummary = '';
                try {
                  const p = typeof proj.parametersJson === 'string' ? JSON.parse(proj.parametersJson) : (proj.parameters || {});
                  if (p.feedRate || p.laserPower) {
                    paramsSummary = `F${p.feedRate || 1500} · S${p.laserPower || 75}% · ${p.dpi || 254} DPI · ${p.mode === 'vector' ? 'Cắt Vector' : 'Khắc Raster'}`;
                  }
                } catch (e) {
                  // ignore parse error
                }

                return (
                  <div
                    key={projId}
                    style={{
                      backgroundColor: 'var(--surface-container-low)',
                      border: '1px solid rgba(195, 198, 215, 0.4)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--on-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-container)' }}>
                          view_in_ar
                        </span>
                        <span>{projName}</span>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 15, color: '#10b981' }}
                          title="Đã đồng bộ lên CSDL SQL Server"
                        >
                          cloud_done
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>📅 {dateStr}</span>
                        <span>·</span>
                        <span>🧩 {elemCount} đối tượng</span>
                        {paramsSummary && (
                          <>
                            <span>·</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>⚡ {paramsSummary}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn-primary-upload"
                        onClick={() => handleSelectProject(proj)}
                        title="Nạp dự án này lên bàn khắc 2D"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          file_open
                        </span>
                        <span>Nạp lên bàn khắc</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(e, proj)}
                        title="Xóa dự án này"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--secondary)',
                          cursor: 'pointer',
                          padding: 6,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--secondary)')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--secondary)' }}>
            {currentUser ? (
              <>Tổng cộng: <strong>{projects.length}</strong> dự án đã lưu</>
            ) : (
              <>Chế độ: <strong>Khách vãng lai (Chưa đăng nhập)</strong></>
            )}
          </span>
          <button type="button" className="btn-header-action" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
