import React from 'react';

export default function ToolRail({
  activeTool,
  setActiveTool,
  onAddRectangle,
  onAddCircle,
  onAddText,
  onTriggerFileInput,
  onSetOrigin,
  onFramingCheck,
  onEmergencyStop
}) {
  return (
    <aside className="tool-rail">
      <div className="rail-tool-group">
        {/* Tool 1: Select / Move */}
        <button
          type="button"
          className={`rail-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          title="Chọn đối tượng (Con trỏ)"
          onClick={() => setActiveTool('select')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            near_me
          </span>
        </button>

        {/* Tool 2: Rectangle Vector */}
        <button
          type="button"
          className={`rail-tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
          title="Vẽ khung / hình chữ nhật (Bấm để thêm vào bàn cắt)"
          onClick={() => {
            setActiveTool('rect');
            if (onAddRectangle) onAddRectangle();
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            crop_square
          </span>
        </button>

        {/* Tool 3: Circle Vector */}
        <button
          type="button"
          className={`rail-tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
          title="Vẽ đường tròn (Bấm để thêm vào bàn cắt)"
          onClick={() => {
            setActiveTool('circle');
            if (onAddCircle) onAddCircle();
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            circle
          </span>
        </button>

        {/* Tool 4: Laser Text */}
        <button
          type="button"
          className={`rail-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
          title="Văn bản laser (Bấm để thêm chữ vào bàn cắt)"
          onClick={() => {
            setActiveTool('text');
            if (onAddText) onAddText();
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            title
          </span>
        </button>

        {/* Tool 5: Upload Image / Vector */}
        <button
          type="button"
          className="rail-tool-btn"
          title="Nhập file véc-tơ / ảnh (PNG, JPG, SVG)"
          onClick={onTriggerFileInput}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            upload_file
          </span>
        </button>

        <div className="rail-divider" />

        {/* Tool 6: Set Origin */}
        <button
          type="button"
          className="rail-tool-btn"
          title="Gốc toạ độ (Set Origin: G92 X0 Y0)"
          onClick={onSetOrigin}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            filter_center_focus
          </span>
        </button>

        {/* Tool 7: Framing Test */}
        <button
          type="button"
          className="rail-tool-btn"
          title="Khung bao (Framing Test)"
          onClick={onFramingCheck}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            aspect_ratio
          </span>
        </button>
      </div>

      <div className="rail-tool-group">
        <button
          type="button"
          className="rail-emergency-btn"
          title="Tạm dừng khẩn cấp (E-Stop)"
          onClick={onEmergencyStop}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            emergency_home
          </span>
        </button>
      </div>
    </aside>
  );
}
