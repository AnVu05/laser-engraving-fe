import React, { useState, useRef, useEffect } from 'react';

export default function LaserCanvas({
  laserX,
  laserY,
  elements = [],
  selectedId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  displayUrl,
  previewMode = 'dither',
  onTogglePreviewMode,
  isFraming,
  isRunning,
  laserPower,
  activeTool = 'select',
  onCanvasClickAdd,
  onSaveProject,
  onOpenProjects,
  onNewWorkspace,
  activeProject,
  currentUser,
  onOpenAuth
}) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFineGrid, setShowFineGrid] = useState(true);
  const [isRecentlySaved, setIsRecentlySaved] = useState(false);
  const [saveToast, setSaveToast] = useState(null);

  // Inline text editing state
  const [editingTextId, setEditingTextId] = useState(null);

  // Dragging (moving) state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, elemId: null });

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const activeHandleRef = useRef(null);
  const [activeHandle, setActiveHandle] = useState(null);
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    aspectRatio: 1,
    elemId: null
  });

  const canvasRef = useRef(null);

  // Calibration: 1.8 pixels per mm at 100% zoom
  const scale = 1.8 * (zoomLevel / 100);

  const bedWidthMm = 300;
  const bedHeightMm = 200;

  // Find currently selected element
  const selectedElem = elements.find((e) => e.id === selectedId) || elements[0] || null;

  // Auto exit text editing if selection changes
  useEffect(() => {
    if (selectedId !== editingTextId) {
      setEditingTextId(null);
    }
  }, [selectedId, editingTextId]);

  // Keyboard shortcut: Press Enter or F2 when a text element is selected to edit directly
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (!selectedElem || selectedElem.type !== 'text') return;

      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setEditingTextId(selectedElem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElem]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(200, z + 15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(50, z - 15));
  const handleZoomFit = () => setZoomLevel(100);

  // Save project handler with authentication check (Cập nhật đè dự án cũ hoặc lưu mới)
  const handleSaveClick = (saveAsNew = false) => {
    if (!currentUser) {
      setSaveToast({
        type: 'error',
        text: 'Cần đăng nhập tài khoản Gmail để lưu dự án!'
      });
      setTimeout(() => setSaveToast(null), 3500);
      if (onOpenAuth) {
        onOpenAuth();
      }
      return;
    }

    if (elements.length === 0) {
      setSaveToast({
        type: 'error',
        text: 'Bàn làm việc đang trống, không có đối tượng để lưu!'
      });
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    if (onSaveProject) {
      onSaveProject(saveAsNew);
    }
    setIsRecentlySaved(true);
    setSaveToast({
      type: 'success',
      text: (!saveAsNew && activeProject)
        ? `Đã cập nhật thay đổi vào dự án "${activeProject.name}"!`
        : `Đã lưu dự án thành công lên CSDL SQL Server!`
    });
    setTimeout(() => {
      setIsRecentlySaved(false);
      setSaveToast(null);
    }, 3000);
  };

  // 1. Dragging element to move
  const handleMouseDownMove = (e, elem) => {
    if (e.button !== 0 || isResizing || editingTextId === elem.id) return;
    e.stopPropagation();

    if (elem.id !== selectedId) {
      onSelectElement(elem.id);
    }

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: elem.x,
      startY: elem.y,
      elemId: elem.id
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && dragStartRef.current.elemId) {
        const target = elements.find((el) => el.id === dragStartRef.current.elemId);
        if (!target) return;

        const dxPixels = e.clientX - dragStartRef.current.mouseX;
        const dyPixels = e.clientY - dragStartRef.current.mouseY;

        // In CNC coords: Y goes upwards, screen Y goes downwards
        const dxMm = dxPixels / scale;
        const dyMm = -dyPixels / scale;

        const newX = Math.max(0, Math.min(bedWidthMm - target.width, dragStartRef.current.startX + dxMm));
        const newY = Math.max(0, Math.min(bedHeightMm - target.height, dragStartRef.current.startY + dyMm));

        onUpdateElement(target.id, {
          x: parseFloat(newX.toFixed(1)),
          y: parseFloat(newY.toFixed(1))
        });
      } else if (isResizing && activeHandle && resizeStartRef.current.elemId) {
        const target = elements.find((el) => el.id === resizeStartRef.current.elemId);
        if (!target) return;

        const dxPixels = e.clientX - resizeStartRef.current.mouseX;
        const dyPixels = e.clientY - resizeStartRef.current.mouseY;

        const dxMm = dxPixels / scale;
        const dyMm = -dyPixels / scale;

        const { startX, startY, startW, startH, aspectRatio } = resizeStartRef.current;
        let newW = startW;
        let newH = startH;
        let newX = startX;
        let newY = startY;

        const minSize = 5; // mm minimum dimension
        const isAspectLocked = target.isAspectLocked !== undefined ? target.isAspectLocked : (target.type === 'circle' || target.type === 'image');

        switch (activeHandle) {
          case 'tr': { // Top-Right corner
            if (isAspectLocked) {
              const delta = Math.abs(dxMm) > Math.abs(dyMm) ? dxMm : dyMm * aspectRatio;
              newW = Math.max(minSize, startW + delta);
              newH = newW / aspectRatio;
            } else {
              newW = Math.max(minSize, startW + dxMm);
              newH = Math.max(minSize, startH + dyMm);
            }
            break;
          }
          case 'tl': { // Top-Left corner
            if (isAspectLocked) {
              const delta = Math.abs(dxMm) > Math.abs(dyMm) ? -dxMm : dyMm * aspectRatio;
              newW = Math.max(minSize, startW + delta);
              newH = newW / aspectRatio;
              newX = startX + (startW - newW);
            } else {
              newW = Math.max(minSize, startW - dxMm);
              newH = Math.max(minSize, startH + dyMm);
              newX = startX + (startW - newW);
            }
            break;
          }
          case 'br': { // Bottom-Right corner
            if (isAspectLocked) {
              const delta = Math.abs(dxMm) > Math.abs(dyMm) ? dxMm : -dyMm * aspectRatio;
              newW = Math.max(minSize, startW + delta);
              newH = newW / aspectRatio;
              newY = startY + (startH - newH);
            } else {
              newW = Math.max(minSize, startW + dxMm);
              newH = Math.max(minSize, startH - dyMm);
              newY = startY + (startH - newH);
            }
            break;
          }
          case 'bl': { // Bottom-Left corner
            if (isAspectLocked) {
              const delta = Math.abs(dxMm) > Math.abs(dyMm) ? -dxMm : -dyMm * aspectRatio;
              newW = Math.max(minSize, startW + delta);
              newH = newW / aspectRatio;
              newX = startX + (startW - newW);
              newY = startY + (startH - newH);
            } else {
              newW = Math.max(minSize, startW - dxMm);
              newH = Math.max(minSize, startH - dyMm);
              newX = startX + (startW - newW);
              newY = startY + (startH - newH);
            }
            break;
          }
          case 'mr': { // Middle-Right edge
            newW = Math.max(minSize, startW + dxMm);
            if (isAspectLocked) {
              newH = newW / aspectRatio;
              newY = startY + (startH - newH) / 2;
            }
            break;
          }
          case 'ml': { // Middle-Left edge
            newW = Math.max(minSize, startW - dxMm);
            newX = startX + (startW - newW);
            if (isAspectLocked) {
              newH = newW / aspectRatio;
              newY = startY + (startH - newH) / 2;
            }
            break;
          }
          case 'mt': { // Middle-Top edge
            newH = Math.max(minSize, startH + dyMm);
            if (isAspectLocked) {
              newW = newH * aspectRatio;
              newX = startX + (startW - newW) / 2;
            }
            break;
          }
          case 'mb': { // Middle-Bottom edge
            newH = Math.max(minSize, startH - dyMm);
            newY = startY + (startH - newH);
            if (isAspectLocked) {
              newW = newH * aspectRatio;
              newX = startX + (startW - newW) / 2;
            }
            break;
          }
          default:
            break;
        }

        // Constrain to physical bed (300 x 200 mm)
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (newX + newW > bedWidthMm) {
          newW = bedWidthMm - newX;
          if (isAspectLocked) newH = newW / aspectRatio;
        }
        if (newY + newH > bedHeightMm) {
          newH = bedHeightMm - newY;
          if (isAspectLocked) newW = newH * aspectRatio;
        }

        onUpdateElement(target.id, {
          width: parseFloat(Math.max(minSize, newW).toFixed(1)),
          height: parseFloat(Math.max(minSize, newH).toFixed(1)),
          x: parseFloat(Math.max(0, newX).toFixed(1)),
          y: parseFloat(Math.max(0, newY).toFixed(1))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setActiveHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, activeHandle, elements, scale, onUpdateElement]);

  // 2. Start resizing from handle
  const handleResizeStart = (e, handle, elem) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setActiveHandle(handle);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: elem.x,
      startY: elem.y,
      startW: elem.width,
      startH: elem.height,
      aspectRatio: elem.width > 0 && elem.height > 0 ? elem.width / elem.height : 1,
      elemId: elem.id
    };
  };

  // Compute pixel positions for bed elements
  const bedPixelWidth = bedWidthMm * scale;
  const bedPixelHeight = bedHeightMm * scale;

  // Origin offset from viewport edges (padding)
  const originOffsetX = 36;
  const originOffsetY = 36;

  return (
    <section className="cad-workspace-section" style={{ position: 'relative' }}>
      {/* Floating Save Project Toast */}
      {saveToast && (
        <div
          style={{
            position: 'absolute',
            top: 46,
            right: 16,
            zIndex: 80,
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 16px rgba(11, 28, 48, 0.15)',
            backgroundColor: saveToast.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: saveToast.type === 'error' ? '#b91c1c' : '#15803d',
            border: `1px solid ${saveToast.type === 'error' ? '#fca5a5' : '#86efac'}`,
            animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {saveToast.type === 'error' ? 'lock' : 'check_circle'}
          </span>
          <span>{saveToast.text}</span>
        </div>
      )}

      {/* Top Inspector Bar */}
      <div className="top-inspector-hud">
        <div className="hud-coords-cluster">
          <div className="hud-pos-group">
            <span className="hud-pos-label">WPos:</span>
            <span className="hud-pos-badge">
              X: <span>{laserX.toFixed(2)}</span> mm
            </span>
            <span className="hud-pos-badge">
              Y: <span>{laserY.toFixed(2)}</span> mm
            </span>
            <span className="hud-pos-badge" style={{ color: 'var(--secondary)' }}>
              Z: 0.00 mm
            </span>
          </div>

          <div className="hud-firmware-badge">
            <span className="status-dot connected" style={{ width: 6, height: 6 }} />
            <span>Khung chuẩn GRBL v1.1f · {elements.length} đối tượng</span>
          </div>
        </div>

        {/* Zoom & Viewport Controls */}
        <div className="hud-view-controls">
          <div className="zoom-btn-cluster">
            <button
              type="button"
              className="zoom-btn"
              title="Thu nhỏ"
              onClick={handleZoomOut}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                remove
              </span>
            </button>
            <span className="zoom-val-text">{zoomLevel}%</span>
            <button
              type="button"
              className="zoom-btn"
              title="Phóng to"
              onClick={handleZoomIn}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                add
              </span>
            </button>
          </div>

          <button
            type="button"
            className="btn-icon-labeled"
            onClick={handleZoomFit}
            title="Khôi phục góc nhìn chuẩn 100%"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--secondary)' }}>
              fit_screen
            </span>
            <span>Vừa khung</span>
          </button>

          <button
            type="button"
            className="btn-icon-labeled"
            onClick={() => setShowFineGrid(!showFineGrid)}
            title="Bật/Tắt lưới phụ 10mm"
            style={{ backgroundColor: showFineGrid ? 'var(--surface-container)' : 'var(--surface)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              grid_4x4
            </span>
          </button>

          {/* Badge Dự án đang mở trên bàn khắc */}
          {activeProject && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontSize: 12,
                color: 'var(--primary-container)',
                fontWeight: 600,
                maxWidth: 180
              }}
              title={`Dự án đang mở: "${activeProject.name}" (Bấm 'Cập nhật' để lưu đè)`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                edit_document
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.name}
              </span>
            </div>
          )}

          {/* Nút Bàn mới có đặt tên lưu CSDL */}
          {onNewWorkspace && (
            <button
              type="button"
              className="btn-icon-labeled"
              onClick={onNewWorkspace}
              title="Khởi tạo một bàn khắc mới, đặt tên và lưu vào CSDL"
              style={{
                backgroundColor: 'var(--surface-container-low)',
                border: '1px solid rgba(195, 198, 215, 0.45)',
                color: 'var(--primary)',
                fontWeight: 600,
                gap: 6,
                padding: '0 10px',
                transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>
                add_circle
              </span>
              <span>Bàn mới</span>
            </button>
          )}

          {/* Nút Mở dự án đã lưu */}
          {onOpenProjects && (
            <button
              type="button"
              className="btn-icon-labeled"
              onClick={onOpenProjects}
              title="Mở danh sách các dự án bàn khắc đã lưu từ máy chủ CSDL"
              style={{
                backgroundColor: 'var(--surface-container-low)',
                border: '1px solid rgba(195, 198, 215, 0.45)',
                color: 'var(--on-surface)',
                fontWeight: 600,
                gap: 6,
                padding: '0 10px',
                transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary-container)' }}>
                folder_open
              </span>
              <span>Mở dự án</span>
            </button>
          )}

          {/* Nút Lưu / Cập nhật dự án */}
          <button
            type="button"
            className="btn-icon-labeled btn-save-project"
            onClick={() => handleSaveClick(false)}
            title={
              currentUser
                ? (activeProject ? `Cập nhật thay đổi vào dự án "${activeProject.name}"` : 'Lưu dự án mới lên Cloud CSDL')
                : 'Yêu cầu đăng nhập để lưu dự án'
            }
            style={{
              backgroundColor: isRecentlySaved ? '#10b981' : 'var(--primary-container)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              gap: 6,
              padding: '0 12px',
              transition: 'all 0.2s ease',
              boxShadow: isRecentlySaved ? '0 1px 4px rgba(16, 185, 129, 0.4)' : '0 1px 4px rgba(37, 99, 235, 0.3)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
              {isRecentlySaved ? 'check' : (activeProject ? 'sync' : 'save')}
            </span>
            <span>
              {isRecentlySaved
                ? (activeProject ? 'Đã cập nhật' : 'Đã lưu')
                : (activeProject ? 'Cập nhật' : 'Lưu dự án')}
            </span>
          </button>

          {/* Nút Lưu bản mới (Save As) nếu đang mở dự án cũ */}
          {activeProject && (
            <button
              type="button"
              className="btn-icon-labeled"
              onClick={() => handleSaveClick(true)}
              title="Lưu các thay đổi này thành một bản sao dự án mới riêng biệt"
              style={{
                backgroundColor: 'var(--surface-container-low)',
                border: '1px solid rgba(195, 198, 215, 0.45)',
                color: 'var(--on-surface)',
                fontWeight: 500,
                gap: 4,
                padding: '0 8px',
                fontSize: 11
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                post_add
              </span>
              <span>Lưu bản mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Workbed Canvas Container (300 x 200 mm laser bed) */}
      <div className="laser-bed-container" ref={canvasRef}>
        {/* Horizontal Ruler (0 to 300 mm) */}
        <div className="ruler-horizontal">
          <div className="ruler-h-track" style={{ width: bedPixelWidth }}>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>0</span>
              <span className="ruler-subtick">25</span>
            </div>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>50</span>
              <span className="ruler-subtick">75</span>
            </div>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>100</span>
              <span className="ruler-subtick">125</span>
            </div>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>150</span>
              <span className="ruler-subtick">175</span>
            </div>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>200</span>
              <span className="ruler-subtick">225</span>
            </div>
            <div className="ruler-h-tick" style={{ width: 50 * scale }}>
              <span>250</span>
              <span>300 mm</span>
            </div>
          </div>
        </div>

        <div className="bed-workspace-inner">
          {/* Vertical Ruler (0 to 200 mm, bottom-up CNC coords) */}
          <div className="ruler-vertical" style={{ height: bedPixelHeight }}>
            <div className="ruler-v-tick">200 mm</div>
            <div className="ruler-v-tick">150</div>
            <div className="ruler-v-tick">100</div>
            <div className="ruler-v-tick">50</div>
            <div className="ruler-v-tick" style={{ borderTop: 'none' }}>0</div>
          </div>

          {/* Precision Laser Bed Workspace */}
          <div
            className="laser-viewport-area"
            style={{ cursor: activeTool && activeTool !== 'select' ? 'crosshair' : 'default' }}
            onClick={(e) => {
              if (activeTool && activeTool !== 'select' && onCanvasClickAdd) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPxX = e.clientX - rect.left - originOffsetX;
                const clickPxY = rect.bottom - e.clientY - originOffsetY;
                const xMm = Math.max(0, Math.min(bedWidthMm - 40, clickPxX / scale));
                const yMm = Math.max(0, Math.min(bedHeightMm - 30, clickPxY / scale));
                onCanvasClickAdd(activeTool, parseFloat(xMm.toFixed(1)), parseFloat(yMm.toFixed(1)));
              }
            }}
          >
            {/* SVG Millimeter Grid */}
            <svg className="grid-svg-layer" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="fine-grid-10"
                  width={10 * scale}
                  height={10 * scale}
                  patternUnits="userSpaceOnUse"
                >
                  {showFineGrid && (
                    <path
                      d={`M ${10 * scale} 0 L 0 0 0 ${10 * scale}`}
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="0.75"
                    />
                  )}
                </pattern>
                <pattern
                  id="main-grid-50"
                  width={50 * scale}
                  height={50 * scale}
                  patternUnits="userSpaceOnUse"
                >
                  <rect width={50 * scale} height={50 * scale} fill="url(#fine-grid-10)" />
                  <path
                    d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`}
                    fill="none"
                    stroke="#CBD5E1"
                    strokeWidth="1.25"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#main-grid-50)" />
            </svg>

            {/* Virtual Bed Material Limit (300 x 200 mm) */}
            <div
              className="bed-boundary-box"
              style={{
                left: originOffsetX,
                bottom: originOffsetY,
                width: bedPixelWidth,
                height: bedPixelHeight
              }}
            >
              <div className="bed-boundary-badge">
                Bàn cắt vật lý: 300 × 200 mm
              </div>
            </div>

            {/* Origin Marker (0,0) */}
            <div
              className="origin-marker"
              style={{
                left: originOffsetX - 12,
                bottom: originOffsetY - 12
              }}
            >
              <div className="origin-marker-circle">
                <span className="material-symbols-outlined origin-marker-icon">
                  adjust
                </span>
              </div>
              <span className="origin-marker-label">X0 Y0</span>
            </div>

            {/* Framing boundary box animation */}
            {isFraming && (selectedElem || elements[0]) && (() => {
              const target = selectedElem || elements[0];
              return (
                <div
                  className="framing-active-box"
                  style={{
                    left: originOffsetX + target.x * scale,
                    bottom: originOffsetY + target.y * scale,
                    width: target.width * scale,
                    height: target.height * scale
                  }}
                />
              );
            })()}

            {/* RENDER ALL ELEMENTS ON BED */}
            {elements.map((elem) => {
              const isSelected = elem.id === selectedId;
              const leftPx = originOffsetX + elem.x * scale;
              const bottomPx = originOffsetY + elem.y * scale;
              const widthPx = elem.width * scale;
              const heightPx = elem.height * scale;

              return (
                <div
                  key={elem.id}
                  className="artwork-object-canvas"
                  style={{
                    left: leftPx,
                    bottom: bottomPx,
                    width: widthPx,
                    height: heightPx,
                    cursor: editingTextId === elem.id ? 'default' : (isDragging && isSelected ? 'grabbing' : 'move'),
                    zIndex: isSelected ? 20 : 10
                  }}
                  onMouseDown={(e) => handleMouseDownMove(e, elem)}
                  onDoubleClick={(e) => {
                    if (elem.type === 'text') {
                      e.stopPropagation();
                      setEditingTextId(elem.id);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectElement(elem.id);
                  }}
                >
                  <div
                    className="artwork-bounding-box"
                    style={{
                      border: isSelected
                        ? '1.5px solid var(--primary-container)'
                        : '1px dashed rgba(115, 118, 134, 0.4)',
                      backgroundColor: isSelected
                        ? 'rgba(180, 197, 255, 0.15)'
                        : 'rgba(255, 255, 255, 0.4)',
                      boxShadow: isSelected && isResizing ? '0 0 0 2px var(--primary)' : undefined
                    }}
                  >
                    {/* Transform Handles (Only shown on selected element) */}
                    {isSelected && (
                      <>
                        <div
                          className="knob-handle knob-tl"
                          title="Kéo chỉnh kích thước (Góc trên-trái)"
                          onMouseDown={(e) => handleResizeStart(e, 'tl', elem)}
                        />
                        <div
                          className="knob-handle knob-tr"
                          title="Kéo chỉnh kích thước (Góc trên-phải)"
                          onMouseDown={(e) => handleResizeStart(e, 'tr', elem)}
                        />
                        <div
                          className="knob-handle knob-bl"
                          title="Kéo chỉnh kích thước (Góc dưới-trái)"
                          onMouseDown={(e) => handleResizeStart(e, 'bl', elem)}
                        />
                        <div
                          className="knob-handle knob-br"
                          title="Kéo chỉnh kích thước (Góc dưới-phải)"
                          onMouseDown={(e) => handleResizeStart(e, 'br', elem)}
                        />

                        <div
                          className="knob-mid knob-ml"
                          title="Kéo chỉnh chiều rộng (Trái)"
                          onMouseDown={(e) => handleResizeStart(e, 'ml', elem)}
                        />
                        <div
                          className="knob-mid knob-mr"
                          title="Kéo chỉnh chiều rộng (Phải)"
                          onMouseDown={(e) => handleResizeStart(e, 'mr', elem)}
                        />
                        <div
                          className="knob-mid knob-mt"
                          title="Kéo chỉnh chiều cao (Trên)"
                          onMouseDown={(e) => handleResizeStart(e, 'mt', elem)}
                        />
                        <div
                          className="knob-mid knob-mb"
                          title="Kéo chỉnh chiều cao (Dưới)"
                          onMouseDown={(e) => handleResizeStart(e, 'mb', elem)}
                        />

                        {/* Floating Action Tag above selected element */}
                        <div
                          className="canvas-burn-floating-tag"
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {elem.type === 'image' && (
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Chế độ mô phỏng hạt laser (Floyd-Steinberg Dithering)"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#f59e0b' }}>
                                grain
                              </span>
                              <span>Hạt laser (Floyd-Steinberg)</span>
                            </span>
                          )}

                          {elem.type === 'rect' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38bdf8' }}>
                                crop_square
                              </span>
                              Khung chữ nhật (Vector)
                            </span>
                          )}

                          {elem.type === 'circle' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#38bdf8' }}>
                                circle
                              </span>
                              Đường tròn Ø {elem.width.toFixed(1)} mm
                            </span>
                          )}

                          {elem.type === 'text' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#a855f7' }}>
                                title
                              </span>
                              <input
                                type="text"
                                className="canvas-floating-tag-input"
                                value={elem.text || ''}
                                placeholder="Nhập nội dung chữ..."
                                title="Nhập nội dung chữ khắc tại đây hoặc nhấp đúp trực tiếp vào chữ trên bàn vẽ"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => onUpdateElement(elem.id, { text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                }}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.18)',
                                  border: '1px solid rgba(255, 255, 255, 0.4)',
                                  borderRadius: 4,
                                  color: '#ffffff',
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  width: 140,
                                  outline: 'none',
                                  fontWeight: 600
                                }}
                              />
                              <button
                                type="button"
                                title={editingTextId === elem.id ? "Xong (hoặc nhấn Enter)" : "Chỉnh sửa trực tiếp trên bàn vẽ (hoặc nhấp đúp vào chữ)"}
                                style={{
                                  background: editingTextId === elem.id ? '#22c55e' : 'rgba(255, 255, 255, 0.18)',
                                  border: 'none',
                                  color: '#ffffff',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 6px',
                                  gap: 3,
                                  fontSize: 11,
                                  fontWeight: 500
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTextId(editingTextId === elem.id ? null : elem.id);
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                  {editingTextId === elem.id ? 'check' : 'edit'}
                                </span>
                                <span>{editingTextId === elem.id ? 'Xong' : 'Sửa'}</span>
                              </button>
                            </div>
                          )}

                          {/* Delete element button if more than 1 or if not default */}
                          <button
                            type="button"
                            title="Xóa đối tượng này"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#f87171',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0 2px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteElement) onDeleteElement(elem.id);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                              delete
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* CONTENT RENDERING BASED ON TYPE */}
                    <div className="artwork-render-preview">
                      {/* TYPE 1: BITMAP IMAGE */}
                      {elem.type === 'image' && (
                        ((elem.id === selectedId && displayUrl) || elem.previewUrl || displayUrl) ? (
                          <img
                            src={(elem.id === selectedId && displayUrl) ? displayUrl : (elem.previewUrl || displayUrl)}
                            alt={elem.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              mixBlendMode: 'multiply',
                              userSelect: 'none',
                              pointerEvents: 'none',
                              imageRendering: previewMode === 'dither' ? 'pixelated' : 'auto'
                            }}
                            draggable={false}
                          />
                        ) : (
                          <svg className="artwork-svg-crest" viewBox="0 0 100 100" fill="currentColor">
                            <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="none" stroke="currentColor" strokeWidth="2.5" />
                            <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
                            <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" />
                            <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" />
                            <polygon points="50,38 58,54 42,54" fill="currentColor" />
                          </svg>
                        )
                      )}

                      {/* TYPE 2: RECTANGLE VECTOR */}
                      {elem.type === 'rect' && (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            border: '2px solid #2563eb',
                            borderRadius: elem.cornerRadius ? `${elem.cornerRadius * scale}px` : '2px',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>
                            crop_square
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--secondary)' }}>
                            {elem.width.toFixed(1)} × {elem.height.toFixed(1)} mm
                          </span>
                        </div>
                      )}

                      {/* TYPE 3: CIRCLE VECTOR */}
                      {elem.type === 'circle' && (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            border: '2px solid #2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>
                            circle
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--secondary)' }}>
                            Ø {elem.width.toFixed(1)} mm
                          </span>
                        </div>
                      )}

                      {/* TYPE 4: TEXT LAYER */}
                      {elem.type === 'text' && (
                        editingTextId === elem.id ? (
                          <textarea
                            autoFocus
                            className="canvas-inline-text-editor"
                            value={elem.text || ''}
                            placeholder="Nhập nội dung chữ..."
                            onChange={(e) => onUpdateElement(elem.id, { text: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                setEditingTextId(null);
                              } else if (e.key === 'Escape') {
                                setEditingTextId(null);
                              }
                            }}
                            onBlur={() => setEditingTextId(null)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              height: '100%',
                              textAlign: 'center',
                              fontFamily: elem.fontFamily === 'mono' ? 'var(--font-mono)' : (elem.fontFamily === 'serif' ? 'serif' : 'var(--font-sans)'),
                              fontSize: `${Math.max(13, elem.height * scale * 0.52)}px`,
                              fontWeight: 700,
                              color: '#0b1c30',
                              backgroundColor: 'rgba(255, 255, 255, 0.96)',
                              border: '2px solid var(--primary-container)',
                              borderRadius: '4px',
                              outline: 'none',
                              resize: 'none',
                              boxSizing: 'border-box',
                              padding: '4px 6px',
                              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
                              zIndex: 50
                            }}
                          />
                        ) : (
                          <div
                            title="Nhấp đúp chuột để chỉnh sửa nội dung chữ"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingTextId(elem.id);
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              fontFamily: elem.fontFamily === 'mono' ? 'var(--font-mono)' : (elem.fontFamily === 'serif' ? 'serif' : 'var(--font-sans)'),
                              fontSize: `${Math.max(12, elem.height * scale * 0.55)}px`,
                              fontWeight: 700,
                              color: '#0b1c30',
                              textShadow: '0 0 1px rgba(0,0,0,0.5)',
                              cursor: isSelected ? 'text' : 'move',
                              wordBreak: 'break-word',
                              lineHeight: 1.2,
                              boxSizing: 'border-box',
                              padding: '2px 4px',
                              userSelect: 'none'
                            }}
                          >
                            {elem.text || 'PhotonCraft'}
                          </div>
                        )
                      )}

                      {elem.type === 'image' && (
                        <span
                          className="artwork-preview-caption"
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '90%',
                            pointerEvents: 'none'
                          }}
                        >
                          {elem.name} (Khắc bề mặt)
                        </span>
                      )}
                    </div>

                    {/* Dimension Ribbon Badge (Revealed on hover or while resizing/dragging) */}
                    {isSelected && (
                      <div
                        className={`artwork-dim-ribbon ${isResizing || (isDragging && dragStartRef.current.elemId === elem.id) ? 'always-visible' : ''}`}
                        style={{
                          backgroundColor: isResizing ? 'var(--primary-container)' : undefined,
                          color: isResizing ? '#ffffff' : undefined,
                          fontWeight: isResizing ? 600 : undefined
                        }}
                      >
                        {elem.width.toFixed(1)} × {elem.height.toFixed(1)} mm (Tại X:{elem.x.toFixed(1)}, Y:{elem.y.toFixed(1)})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
