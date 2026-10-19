import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ToolRail from './components/ToolRail';
import ParameterPanel from './components/ParameterPanel';
import LaserCanvas from './components/LaserCanvas';
import BottomDock from './components/BottomDock';
import GCodeModal from './components/GCodeModal';
import ConsoleModal from './components/ConsoleModal';
import HistoryModal from './components/HistoryModal';
import ProjectsModal from './components/ProjectsModal';
import AuthModal from './components/AuthModal';
import NewProjectModal from './components/NewProjectModal';
import LaserParametersView from './components/LaserParametersView';
import FocusCalibrationModal from './components/FocusCalibrationModal';
import JobProgressModal from './components/JobProgressModal';
import { processLaserImage, generateRasterGCodeFromMatrix, generateVectorContourGCode, generateTextBinaryMatrix } from './utils/laserImageProcessor';
import { grblSerial } from './utils/grblSerialDriver';
import { projectApi } from './services/projectApi';
import { historyApi } from './services/historyApi';
import { settingsApi } from './services/settingsApi';
import { authApi } from './services/authApi';
import { jobApi } from './services/jobApi';
import './App.css';

export default function App() {
  // Navigation & Tool states
  const [activeTab, setActiveTab] = useState('canvas-studio');
  const [activeTool, setActiveTool] = useState('select');

  // Serial Connection States
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [portName, setPortName] = useState('');
  const serialPortRef = useRef(null);

  // Multi-element bed system (Khởi tạo bàn làm việc mới tinh khi mở ứng dụng)
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const selectedElem = elements.find((e) => e.id === selectedId) || elements[0] || null;

  // Dự án đang mở trên bàn khắc (null nếu là bàn làm việc mới)
  const [activeProject, setActiveProject] = useState(null);

  const fileInputRef = useRef(null);
  const loadedImageElementRef = useRef(null);

  // Laser Dithering & Pixel Preview States
  const [previewMode, setPreviewMode] = useState('dither'); // 'dither' | 'grayscale' | 'original'
  const [contrast, setContrast] = useState(15);
  const [brightness, setBrightness] = useState(0);
  const [invert, setInvert] = useState(false);
  const [processedArtwork, setProcessedArtwork] = useState(null);

  // Engraving Parameters
  const [feedRate, setFeedRate] = useState(1500);
  const [acceleration, setAcceleration] = useState(1000); // GRBL $120/$121 (mm/s²)
  const [laserPower, setLaserPower] = useState(75);
  const [dpi, setDpi] = useState(254);
  const [mode, setMode] = useState('raster'); // 'raster' | 'vector'

  // Machine Telemetry & Laser Head (mm)
  const [laserX, setLaserX] = useState(0.0);
  const [laserY, setLaserY] = useState(0.0);
  const [stepSize, setStepSize] = useState(10);

  // Operation / Execution States
  const [isFraming, setIsFraming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('00:00');
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [statusText, setStatusText] = useState('Trạng thái: Sẵn sàng');
  const [statusType, setStatusType] = useState('ready'); // 'ready' | 'running' | 'paused' | 'stopped'
  const isStreamingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const framingIntervalRef = useRef(null);
  const isFramingRef = useRef(false);

  // Modals
  const [isGCodeOpen, setIsGCodeOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isJobProgressOpen, setIsJobProgressOpen] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [isDispatchingJob, setIsDispatchingJob] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [historyList, setHistoryList] = useState([]);

  // Terminal Logs & Logger Callback (đặt lên đầu để các hàm bên dưới có thể dùng)
  const [terminalLogs, setTerminalLogs] = useState(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return [
      { time: timeStr, type: 'sys', text: 'PhotonCraft GRBL Web Controller đã sẵn sàng.' }
    ];
  });

  const addLog = useCallback((text, type = 'sys') => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setTerminalLogs((prev) => [...prev.slice(-100), { time: timeStr, type, text }]);
  }, []);

  // Fetch History from Backend SQL Server (Chỉ tải lịch sử khi người dùng ĐÃ ĐĂNG NHẬP)
  const loadCloudHistory = useCallback(async () => {
    if (!currentUser?.email) {
      setHistoryList([]);
      return;
    }
    try {
      const res = await historyApi.getHistory(currentUser.email, 0, 30);
      if (res.data?.content && res.data.content.length > 0) {
        const mapped = res.data.content.map((item) => ({
          id: item.historyId,
          name: item.originalFilename,
          date: item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
          lines: (item.totalGcodeLines || 0).toLocaleString(),
          feedRate: item.engravingSpeed,
          power: item.laserPower,
          status: item.status || 'Hoàn tất',
          gcode: item.gcodeContent,
          downloadUrl: item.downloadUrl,
          isCloud: true
        }));
        setHistoryList(mapped);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      console.warn('Chưa thể tải lịch sử từ Cloud CSDL:', err.message);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    loadCloudHistory();
  }, [loadCloudHistory]);

  // Đồng bộ cấu hình máy Laser từ CSDL SQL Server khi khởi động
  useEffect(() => {
    settingsApi.getSettings()
      .then((res) => {
        if (res?.data) {
          const s = res.data;
          if (s.defaultSpeed) setFeedRate(Math.round(s.defaultSpeed));
          if (s.maxPower) setLaserPower(Math.min(100, Math.round((s.maxPower / 1000) * 100)));
          if (s.defaultDpi) setDpi(s.defaultDpi);
          if (s.mode) setMode(s.mode);
          if (s.acceleration || s.defaultAcceleration) setAcceleration(s.acceleration || s.defaultAcceleration);
        }
      })
      .catch((err) => {
        console.debug('Sử dụng cấu hình máy laser mặc định:', err.message);
      });
  }, []);

  const handleDeleteHistoryItem = async (item) => {
    if (item.id && typeof item.id === 'number') {
      try {
        await historyApi.deleteHistory(item.id, currentUser?.email);
        addLog(`Đã xóa bản ghi lịch sử ID ${item.id} trên máy chủ.`, 'sys');
      } catch (err) {
        console.warn('Xóa lịch sử trên server thất bại:', err.message);
      }
    }
    setHistoryList((prev) => prev.filter((h) => h !== item && h.id !== item.id));
  };

  // Khởi tạo bàn làm việc mới (Hỗ trợ cả Khách vãn lai và Người dùng đã đăng nhập)
  const handleNewWorkspace = useCallback(() => {
    setIsNewProjectOpen(true);
  }, []);

  // Khởi tạo bàn làm việc mới cho Khách vãn lai (Không lưu CSDL)
  const handleGuestNewWorkspace = useCallback(() => {
    setElements([]);
    setSelectedId(null);
    setProcessedArtwork(null);
    setActiveProject(null);
    setIsNewProjectOpen(false);
    addLog('[Khách vãn lai] Đã khởi tạo bàn làm việc mới (300 × 200 mm). Bạn có thể thiết kế, tạo mã G-code và tải file .NC về máy!', 'sys');
  }, [addLog]);

  // Xử lý tạo bàn mới và lưu ngay dự án xuống SQL Server
  const handleCreateNewProject = useCallback(async (projectData) => {
    if (!currentUser?.email) {
      throw new Error('Chưa đăng nhập tài khoản người dùng!');
    }

    try {
      const res = await projectApi.saveProject(currentUser.email, projectData);
      const newProjId = res.data?.projectId || res.data?.id;

      // Khởi tạo bàn làm việc mới sạch sẽ
      setElements([]);
      setSelectedId(null);
      setProcessedArtwork(null);

      // Cập nhật thông số từ dự án
      if (projectData.parameters?.feedRate) setFeedRate(projectData.parameters.feedRate);
      if (projectData.parameters?.acceleration) setAcceleration(projectData.parameters.acceleration);
      if (projectData.parameters?.laserPower) setLaserPower(projectData.parameters.laserPower);
      if (projectData.parameters?.dpi) setDpi(projectData.parameters.dpi);
      if (projectData.parameters?.mode) setMode(projectData.parameters.mode);

      // Gán dự án đang mở
      setActiveProject({
        id: newProjId,
        name: projectData.name
      });

      // Cập nhật localStorage
      try {
        const storageKey = `laser_projects_${currentUser.email}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        existing.unshift({
          ...projectData,
          id: newProjId,
          projectId: newProjId,
          savedAt: new Date().toLocaleString('vi-VN')
        });
        localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch (e) {
        console.error('Lỗi khi cập nhật localStorage:', e);
      }

      setActiveTab('canvas-studio');
      addLog(`[Cloud CSDL] Đã khởi tạo bàn mới và lưu thành công dự án "${projectData.name}" (ID: ${newProjId}) vào CSDL!`, 'sys');
      return true;
    } catch (err) {
      console.error('Lỗi tạo dự án mới:', err);
      addLog(`Lỗi tạo dự án mới: ${err.message}`, 'err');
      throw err;
    }
  }, [currentUser, addLog]);

  // Nạp lại dự án đã lưu lên bàn khắc 2D (Chỉ khi người dùng chủ động chọn dự án từ modal)
  const handleLoadProject = useCallback((project) => {
    try {
      let loadedElements = [];
      if (typeof project.elementsJson === 'string') {
        loadedElements = JSON.parse(project.elementsJson);
      } else if (Array.isArray(project.elements)) {
        loadedElements = project.elements;
      }

      if (Array.isArray(loadedElements) && loadedElements.length > 0) {
        setElements(loadedElements);
        setSelectedId(loadedElements[0]?.id || null);
      } else {
        setElements([]);
        setSelectedId(null);
      }

      let params = {};
      if (typeof project.parametersJson === 'string') {
        params = JSON.parse(project.parametersJson);
      } else if (project.parameters) {
        params = project.parameters;
      }

      if (params.feedRate) setFeedRate(params.feedRate);
      if (params.acceleration) setAcceleration(params.acceleration);
      if (params.laserPower) setLaserPower(params.laserPower);
      if (params.dpi) setDpi(params.dpi);
      if (params.mode) setMode(params.mode);

      const projId = project.projectId ?? project.id;
      const projTitle = project.projectName || project.name || 'Dự án bàn khắc';

      // Ghi nhớ dự án đang được nạp để các lần bấm "Lưu dự án" sau sẽ CẬP NHẬT ĐÈ vào dự án này
      setActiveProject({
        id: projId,
        name: projTitle
      });

      setActiveTab('canvas-studio');
      setIsProjectsOpen(false);
      addLog(`[Cloud CSDL] Đã nạp thành công dự án "${projTitle}" (${loadedElements.length} đối tượng) lên bàn khắc!`, 'sys');
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu dự án:', err);
      addLog(`Lỗi khi nạp dữ liệu dự án: ${err.message}`, 'err');
    }
  }, [addLog]);

  // Tự động kiểm tra phiên đăng nhập bằng HttpOnly Cookie khi khởi chạy ứng dụng
  useEffect(() => {
    const savedEmail = localStorage.getItem('laser_user_email');
    authApi.getMe(savedEmail && savedEmail !== 'undefined' ? savedEmail : undefined)
      .then((res) => {
        if (res?.data) {
          setCurrentUser(res.data);
          addLog(`Chào mừng trở lại! Đã đăng nhập: ${res.data.email}`, 'sys');
        }
      })
      .catch(() => {
        localStorage.removeItem('laser_auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('laser_user_email');
        localStorage.removeItem('laser_user_name');
        setCurrentUser(null);
      });
  }, [addLog]);

  // Xử lý đăng xuất tài khoản an toàn: Gọi API xóa HttpOnly Cookie trên server
  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Lỗi khi gọi logout từ máy chủ:', err);
    }
    localStorage.removeItem('laser_auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('laser_user_email');
    localStorage.removeItem('laser_user_name');
    setCurrentUser(null);
    setHistoryList([]);
    setElements([]);
    setSelectedId(null);
    setProcessedArtwork(null);
    setActiveProject(null);
    addLog('[Tài khoản] Đã đăng xuất thành công (HttpOnly Cookie đã được thu hồi). Trở về bàn làm việc mới (Khách vãng lai).', 'sys');
  }, [addLog]);

  // Update element handler
  const handleUpdateElement = useCallback((id, patch) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...patch } : el))
    );
  }, []);

  // Delete element handler
  const handleDeleteElement = useCallback(
    (id) => {
      setElements((prev) => {
        const filtered = prev.filter((el) => el.id !== id);
        if (selectedId === id) {
          setSelectedId(filtered[0]?.id || null);
        }
        return filtered;
      });
      addLog('Đã xóa đối tượng khỏi bàn cắt.', 'sys');
    },
    [selectedId, addLog]
  );

  // 1. Add Rectangle Vector
  const handleAddRectangle = useCallback(
    (posX, posY) => {
      const id = `rect-${Date.now()}`;
      const count = elements.filter((e) => e.type === 'rect').length + 1;
      const offset = (elements.length * 12) % 60;
      const newX = posX !== undefined ? posX : Math.min(230, 35.0 + offset);
      const newY = posY !== undefined ? posY : Math.min(150, 35.0 + offset);
      const newRect = {
        id,
        type: 'rect',
        name: `Khung chữ nhật #${count}`,
        x: newX,
        y: newY,
        width: 60.0,
        height: 40.0,
        cornerRadius: 0,
        aspectRatio: 60.0 / 40.0,
        isAspectLocked: false,
        mode: 'vector'
      };
      setElements((prev) => [...prev, newRect]);
      setSelectedId(id);
      setActiveTool('select');
      addLog(`Đã thêm khung chữ nhật 60×40 mm (X${newX.toFixed(1)}, Y${newY.toFixed(1)})`, 'sys');
    },
    [elements, addLog]
  );

  // 2. Add Circle Vector
  const handleAddCircle = useCallback(
    (posX, posY) => {
      const id = `circle-${Date.now()}`;
      const count = elements.filter((e) => e.type === 'circle').length + 1;
      const offset = (elements.length * 12) % 60;
      const newX = posX !== undefined ? posX : Math.min(240, 40.0 + offset);
      const newY = posY !== undefined ? posY : Math.min(140, 40.0 + offset);
      const newCircle = {
        id,
        type: 'circle',
        name: `Đường tròn #${count}`,
        x: newX,
        y: newY,
        width: 50.0,
        height: 50.0,
        aspectRatio: 1.0,
        isAspectLocked: true,
        mode: 'vector'
      };
      setElements((prev) => [...prev, newCircle]);
      setSelectedId(id);
      setActiveTool('select');
      addLog(`Đã thêm đường tròn Ø 50 mm (X${newX.toFixed(1)}, Y${newY.toFixed(1)})`, 'sys');
    },
    [elements, addLog]
  );

  // 3. Add Laser Text
  const handleAddText = useCallback(
    (posX, posY) => {
      const id = `text-${Date.now()}`;
      const count = elements.filter((e) => e.type === 'text').length + 1;
      const offset = (elements.length * 12) % 60;
      const newX = posX !== undefined ? posX : Math.min(210, 30.0 + offset);
      const newY = posY !== undefined ? posY : Math.min(160, 50.0 + offset);
      const newText = {
        id,
        type: 'text',
        name: `Văn bản #${count}`,
        text: 'PhotonCraft GRBL',
        fontFamily: 'sans',
        x: newX,
        y: newY,
        width: 80.0,
        height: 22.0,
        aspectRatio: 80.0 / 22.0,
        isAspectLocked: false,
        mode: 'vector'
      };
      setElements((prev) => [...prev, newText]);
      setSelectedId(id);
      setActiveTool('select');
      addLog(`Đã thêm văn bản laser: "${newText.text}". Nhấp đúp vào chữ hoặc gõ vào ô nổi để đổi nội dung.`, 'sys');
    },
    [elements, addLog]
  );

  // Click on canvas to drop shape when tool is active
  const handleCanvasClickAdd = useCallback(
    (tool, xMm, yMm) => {
      if (tool === 'rect') handleAddRectangle(xMm, yMm);
      else if (tool === 'circle') handleAddCircle(xMm, yMm);
      else if (tool === 'text') handleAddText(xMm, yMm);
    },
    [handleAddRectangle, handleAddCircle, handleAddText]
  );

  // File Upload Handler (Image / Vector)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    const sizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        loadedImageElementRef.current = img;
        const imgRatio = img.width / img.height;
        let initW = 80.0;
        let initH = parseFloat((initW / imgRatio).toFixed(1));
        if (initH > 140) {
          initH = 140.0;
          initW = parseFloat((initH * imgRatio).toFixed(1));
        }

        const id = `image-${Date.now()}`;
        const newImgElem = {
          id,
          type: 'image',
          name: file.name,
          ext,
          pixelDims: `${img.width} × ${img.height} px`,
          desc: `Tệp tải lên · ${sizeKb} KB`,
          previewUrl: event.target.result,
          aspectRatio: imgRatio,
          isAspectLocked: true,
          x: 35.0,
          y: 30.0,
          width: initW,
          height: initH,
          mode: 'raster'
        };

        setElements((prev) => {
          const placeholderIdx = prev.findIndex((el) => el.type === 'image' && !el.previewUrl);
          if (placeholderIdx !== -1) {
            const next = [...prev];
            next[placeholderIdx] = newImgElem;
            return next;
          }
          return [...prev, newImgElem];
        });

        setSelectedId(id);
        setActiveTool('select');
        addLog(`Đã tải tệp: ${file.name} (${img.width}×${img.height}px) - Tỉ lệ: ${imgRatio.toFixed(2)}`, 'sys');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Real-time Laser Dithering & Pixel Processing for current image element
  const activeImageElem = elements.find((el) => el.type === 'image' && el.id === selectedId) ||
    elements.find((el) => el.type === 'image' && el.previewUrl) ||
    elements.find((el) => el.type === 'image');

  useEffect(() => {
    if (!loadedImageElementRef.current || !activeImageElem) return;

    const timer = setTimeout(() => {
      const result = processLaserImage(
        loadedImageElementRef.current,
        activeImageElem.width,
        activeImageElem.height,
        dpi,
        {
          brightness,
          contrast,
          invert,
          previewMode
        }
      );
      if (result) {
        setProcessedArtwork(result);
      }
    }, 30);

    return () => clearTimeout(timer);
  }, [activeImageElem?.previewUrl, activeImageElem?.width, activeImageElem?.height, dpi, brightness, contrast, invert, previewMode]);

  const handleTogglePreviewMode = () => {
    setPreviewMode('dither');
  };

  // Web Serial API Handlers (Kết nối thật 100%, loại bỏ hoàn toàn giả lập)
  const handleConnect = async () => {
    if (!grblSerial.isSupported()) {
      addLog('⚠️ Trình duyệt hiện tại không hỗ trợ Web Serial API. Vui lòng mở trang web trên Google Chrome hoặc Microsoft Edge để kết nối bo mạch máy khắc CNC.', 'err');
      setIsConnected(false);
      setPortName('');
      return;
    }

    try {
      setIsConnecting(true);
      addLog('Đang mở hộp thoại chọn cổng USB Serial COM...', 'sys');

      // Đăng ký listener nhận dữ liệu thật từ bo mạch GRBL
      grblSerial.onLineReceived = (line) => {
        const isError = line.startsWith('error') || line.startsWith('ALARM');
        addLog(line, isError ? 'err' : 'resp');

        // Tự động phân tích và đồng bộ thông số từ phản hồi lệnh $G của bo mạch GRBL
        // Ví dụ: [GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F1500 S800]
        const gcMatch = line.match(/\[GC:.*?F([\d.]+).*?S([\d.]+).*?\]/i);
        if (gcMatch) {
          const f = parseFloat(gcMatch[1]);
          const s = parseFloat(gcMatch[2]);
          if (f > 0) {
            setFeedRate(Math.round(f));
          }
          if (s >= 0) {
            const p = parseFloat(((s / 1000) * 100).toFixed(1));
            setLaserPower(Math.min(100, Math.max(0, p)));
          }
          addLog(`⚡ [Tự động đồng bộ] Bo mạch GRBL: Tốc độ F${Math.round(f)} mm/phút, Công suất Laser ${((s / 1000) * 100).toFixed(1)}% (S${s})`, 'sys');
        }
      };

      // Đăng ký listener nhận tọa độ và trạng thái thời gian thực từ GRBL '?'
      grblSerial.onStatusReceived = (status) => {
        if (status.wpos) {
          const nx = parseFloat(status.wpos.x.toFixed(2));
          const ny = parseFloat(status.wpos.y.toFixed(2));
          setLaserX((prev) => (Math.abs(prev - nx) >= 0.02 ? nx : prev));
          setLaserY((prev) => (Math.abs(prev - ny) >= 0.02 ? ny : prev));
        }
        if (status.state) {
          if (status.state.startsWith('Alarm')) {
            setStatusText('CẢNH BÁO (ALARM)');
            setStatusType('alarm');
          } else if (status.state.startsWith('Hold')) {
            setStatusText('Tạm dừng máy (Hold)');
            setStatusType('paused');
          }
        }
      };

      grblSerial.onError = (err) => {
        addLog(`[Lỗi phần cứng Serial]: ${err.message}`, 'err');
        setIsConnected(false);
        setPortName('');
      };

      // Mở cổng COM vật lý thật
      await grblSerial.connect(115200);

      setIsConnected(true);
      setPortName('USB-Serial (115200 Baud)');
      addLog('Đã kết nối thành công với cổng COM vật lý của máy khắc!', 'sys');
      addLog('Khởi tạo chuẩn GRBL Laser Mode ($32=1)...', 'cmd');

      // Tự động truy vấn thông số parser modal hiện tại ($G) để đồng bộ vào giao diện
      try {
        await grblSerial.sendCommand('$G');
      } catch (_) {}
    } catch (err) {
      if (err.name === 'NotFoundError') {
        addLog('Người dùng đã hủy bỏ thao tác chọn cổng COM.', 'sys');
      } else {
        addLog(`Không thể mở cổng COM: ${err.message}. Hãy kiểm tra xem cáp USB đã cắm chưa hoặc cổng COM có bị phần mềm khác (như LaserGRBL, Arduino IDE) chiếm giữ không.`, 'err');
      }
      setIsConnected(false);
      setPortName('');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    isStreamingRef.current = false;
    isCancelledRef.current = true;
    await grblSerial.disconnect();
    setIsConnected(false);
    setPortName('');
    addLog('Đã ngắt kết nối cổng COM máy khắc.', 'sys');
  };

  // Trạng thái bật tia laser thử nghiệm / lấy nét
  const [isTestLaserOn, setIsTestLaserOn] = useState(false);

  // Bật / Tắt tia laser thử nghiệm ở mức công suất đã chọn
  const handleToggleTestLaser = async () => {
    if (!isConnected) {
      addLog('⚠️ Bo mạch chưa kết nối. Vui lòng cắm cáp USB và nhấn nút "Kết nối máy" trước.', 'err');
      return;
    }

    if (isTestLaserOn) {
      try {
        await grblSerial.sendCommand('M5');
        setIsTestLaserOn(false);
        addLog('M5 ; Đã tắt tia laser thử nghiệm', 'cmd');
      } catch (err) {
        addLog(`Lỗi tắt tia laser: ${err.message}`, 'err');
      }
    } else {
      const S_val = Math.max(1, Math.round((laserPower / 100) * 1000));
      try {
        await grblSerial.sendCommand(`M3 S${S_val}`);
        setIsTestLaserOn(true);
        addLog(`M3 S${S_val} ; Đang bật tia laser công suất ${laserPower}% (S${S_val}) để định vị / lấy nét`, 'cmd');
      } catch (err) {
        addLog(`Lỗi bật tia laser: ${err.message}`, 'err');
      }
    }
  };

  // Nạp thông số người dùng đã điều chỉnh vào trong bo mạch điều khiển
  const handleFlashParameters = async (targetFeed = feedRate, targetPower = laserPower, targetAccel = acceleration) => {
    const S_val = Math.round((targetPower / 100) * 1000);
    if (!isConnected) {
      addLog('⚠️ Bo mạch chưa kết nối. Vui lòng cắm cáp USB và nhấn nút "Kết nối máy" ở thanh trên.', 'err');
      return false;
    }

    try {
      addLog(`[Nạp vào bo mạch] Đang ghi cấu hình vào EEPROM & Modal: F${targetFeed} mm/phút, A${targetAccel} mm/s², S${S_val} (${targetPower}%)...`, 'cmd');
      // 1. Lưu cấu hình tốc độ tối đa trục X/Y vào bộ nhớ EEPROM vĩnh viễn của bo mạch ($110, $111)
      await grblSerial.sendCommand(`$110=${targetFeed}`);
      await grblSerial.sendCommand(`$111=${targetFeed}`);
      // 2. Lưu cấu hình gia tốc trục X/Y vào bộ nhớ EEPROM vĩnh viễn của bo mạch ($120, $121)
      await grblSerial.sendCommand(`$120=${targetAccel}`);
      await grblSerial.sendCommand(`$121=${targetAccel}`);
      // 3. Cấu hình thang đo công suất tối đa $30=1000 và Laser Mode $32=1 vào EEPROM
      await grblSerial.sendCommand('$30=1000');
      await grblSerial.sendCommand('$32=1');
      // 4. Ghi tốc độ mặc định và công suất vào Parser Modal của GRBL
      await grblSerial.sendCommand(`G1 F${targetFeed}`);
      await grblSerial.sendCommand(`S${S_val}`);
      // 5. Đọc lại để kiểm tra đồng bộ
      await grblSerial.sendCommand('$G');

      addLog(`✓ ĐÃ GHI VÀO EEPROM BO MẠCH: Tốc độ $110/$111=${targetFeed} mm/phút, Gia tốc $120/$121=${targetAccel} mm/s², Công suất Laser S${S_val} (${targetPower}%)`, 'sys');
      return true;
    } catch (err) {
      addLog(`Lỗi khi nạp thông số vào bo mạch: ${err.message}`, 'err');
      return false;
    }
  };

  // Jog Controls (Điều khiển di chuyển đầu phát Laser X/Y)
  const handleJog = async (dx, dy) => {
    // 1. Luôn cập nhật vị trí đầu laser trực quan trên bàn cắt theo thời gian thực (0 <= X <= 300, 0 <= Y <= 200)
    const newX = Math.max(0, Math.min(300, parseFloat((laserX + dx).toFixed(2))));
    const newY = Math.max(0, Math.min(200, parseFloat((laserY + dy).toFixed(2))));
    setLaserX(newX);
    setLaserY(newY);

    const dirLabel = dx !== 0 ? (dx > 0 ? `+X ${dx}` : `-X ${Math.abs(dx)}`) : (dy > 0 ? `+Y ${dy}` : `-Y ${Math.abs(dy)}`);

    // 2. Nếu đã kết nối cổng COM -> Gửi lệnh Jog chuẩn GRBL v1.1 xuống máy thật
    if (isConnected) {
      const cmd = `$J=G21G91X${dx}Y${dy}F${feedRate}`;
      addLog(cmd, 'cmd');
      try {
        await grblSerial.sendCommand(cmd);
      } catch (err) {
        addLog(`Lỗi gửi lệnh Jog máy thật: ${err.message}`, 'err');
      }
    } else {
      addLog(`[Di chuyển Jog] Đầu Laser: X${newX.toFixed(1)}, Y${newY.toFixed(1)} mm (${dirLabel} mm). Cắm cáp USB & bấm "Kết nối máy" để máy thật di chuyển cùng lúc.`, 'sys');
    }
  };

  // Thiết lập gốc tọa độ phôi (G92 X0 Y0 hoặc reset đầu laser về 0,0)
  const handleJogZero = async () => {
    setLaserX(0);
    setLaserY(0);

    if (isConnected) {
      const cmd = 'G92 X0 Y0';
      addLog(`${cmd} ; Thiết lập gốc phôi`, 'cmd');
      try {
        await grblSerial.sendCommand(cmd);
      } catch (err) {
        addLog(`Lỗi thiết lập gốc phôi: ${err.message}`, 'err');
      }
    } else {
      addLog('[Tọa độ phôi] Đã đưa đầu laser về gốc tọa độ X0 Y0.', 'sys');
    }
  };

  // Framing Test (Quét viền kiểm tra phôi bằng tia laser công suất yếu)
  const handleFramingCheck = async () => {
    // Nếu đang chạy khung mà bấm lại -> Dừng khung ngay lập tức
    if (isFraming || isFramingRef.current) {
      isFramingRef.current = false;
      setIsFraming(false);
      if (framingIntervalRef.current) {
        clearInterval(framingIntervalRef.current);
        framingIntervalRef.current = null;
      }
      addLog('M5 ; Tắt laser lấy nét & dừng quét khung', 'cmd');
      if (isConnected) {
        try {
          await grblSerial.sendRaw('!\r\nM5\r\n');
        } catch (_) {}
      }
      return;
    }

    // Xác định vùng bao: Nếu có chọn đối tượng thì quét đối tượng đó, nếu không thì quét toàn bộ phôi
    let target = selectedElem;
    if (!target && elements.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      target = {
        name: 'Toàn bộ phôi',
        x: parseFloat(minX.toFixed(2)),
        y: parseFloat(minY.toFixed(2)),
        width: parseFloat((maxX - minX).toFixed(2)),
        height: parseFloat((maxY - minY).toFixed(2))
      };
    }

    if (!target) {
      addLog('Không có đối tượng nào trên bàn cắt để chạy khung bao.', 'err');
      return;
    }

    isFramingRef.current = true;
    setIsFraming(true);

    const x0 = target.x;
    const y0 = target.y;
    const x1 = parseFloat((target.x + target.width).toFixed(2));
    const y1 = parseFloat((target.y + target.height).toFixed(2));
    const frameFeed = Math.min(feedRate || 1500, 2500);

    addLog(
      `Bắt đầu chạy khung bao [${target.name}]: (${x0}, ${y0}) -> (${x1}, ${y1}) mm`,
      'sys'
    );

    if (isConnected) {
      // 1. KHI ĐÃ KẾT NỐI MÁY THẬT:
      // Gửi tập lệnh di chuyển theo chu vi chữ nhật tuyệt đối (G90) với laser định vị S10 (1%)
      // LƯU Ý: KHÔNG dùng timer setLaserX giả lập để tránh xung đột với status polling '?'
      const cmds = [
        'G21 G90', // Đơn vị mm, tọa độ tuyệt đối
        'M5',      // Tắt laser trước khi chạy tới điểm xuất phát
        `G0 X${x0} Y${y0} F3000`, // Chạy nhanh tới góc dưới-trái
        'M3 S10',  // Bật laser mức cực nhỏ để định vị mắt nhìn (PWM 1%)
        `G1 X${x1} Y${y0} F${frameFeed}`, // Cạnh dưới
        `G1 X${x1} Y${y1}`,               // Cạnh phải
        `G1 X${x0} Y${y1}`,               // Cạnh trên
        `G1 X${x0} Y${y0}`,               // Cạnh trái về gốc
        'M5',                             // Tắt laser
        `G0 X${x0} Y${y0}`
      ];

      for (const cmd of cmds) {
        if (!isFramingRef.current) break;
        try {
          await grblSerial.sendCommandAndWait(cmd, 15000);
        } catch (err) {
          addLog(`Lỗi lệnh khung [${cmd}]: ${err.message}`, 'err');
          break;
        }
      }

      try { await grblSerial.sendCommand('M5'); } catch (_) {}
      isFramingRef.current = false;
      setIsFraming(false);
      addLog('Hoàn tất chạy khung bao trên máy thật.', 'sys');
      setTimeout(() => setIsCalibrationOpen(true), 350);
    } else {
      // 2. KHI MÔ PHỎNG OFFLINE (Chưa cắm máy thật):
      // Quét mượt mà liên tục dọc theo 4 cạnh chu vi (33 FPS), không nhảy giật 4 góc
      const W = target.width;
      const H = target.height;
      const totalPerimeter = 2 * (W + H);

      const durationMs = 3500;
      const intervalMs = 30;
      const totalSteps = durationMs / intervalMs;
      let step = 0;

      if (framingIntervalRef.current) clearInterval(framingIntervalRef.current);

      framingIntervalRef.current = setInterval(() => {
        if (!isFramingRef.current || step >= totalSteps) {
          clearInterval(framingIntervalRef.current);
          framingIntervalRef.current = null;
          isFramingRef.current = false;
          setIsFraming(false);
          setLaserX(x0);
          setLaserY(y0);
          addLog('Hoàn tất chạy khung bao (mô phỏng).', 'sys');
          setTimeout(() => setIsCalibrationOpen(true), 350);
          return;
        }

        step++;
        const progress = step / totalSteps;
        const d = progress * totalPerimeter;

        let curX = x0;
        let curY = y0;

        if (d <= W) {
          curX = x0 + d;
          curY = y0;
        } else if (d <= W + H) {
          curX = x1;
          curY = y0 + (d - W);
        } else if (d <= 2 * W + H) {
          curX = x1 - (d - W - H);
          curY = y1;
        } else {
          curX = x0;
          curY = y1 - (d - 2 * W - H);
        }

        setLaserX(parseFloat(curX.toFixed(2)));
        setLaserY(parseFloat(curY.toFixed(2)));
      }, intervalMs);
    }
  };

  // Generate G-Code String for all elements on bed
  const generateGCodeText = useCallback(() => {
    const S_val = Math.round((laserPower / 100) * 1000);
    const header = [
      '; ========================================================',
      '; PhotonCraft GRBL Web Controller - Laser Studio',
      `; Số lượng đối tượng gia công: ${elements.length}`,
      `; Tốc độ Feed rate: ${feedRate} mm/min`,
      `; Gia tốc cấu hình: ${acceleration} mm/s² ($120/$121)`,
      `; Công suất Laser PWM: ${laserPower}% (S${S_val})`,
      '; ========================================================',
      `$120=${acceleration} ; Cấu hình gia tốc trục X (mm/s²)`,
      `$121=${acceleration} ; Cấu hình gia tốc trục Y (mm/s²)`,
      '$32=1       ; Bật Laser Mode chuẩn GRBL',
      'G21         ; Đơn vị tọa độ milimét',
      'G90         ; Tọa độ tuyệt đối',
      'M5          ; Đảm bảo tắt laser trước khi di chuyển nhanh'
    ];

    const body = [];

    elements.forEach((elem, index) => {
      body.push(`\n; --- Đối tượng #${index + 1}: ${elem.name} (${elem.type}) ---`);

      if (elem.type === 'image') {
        if (mode === 'raster' && processedArtwork?.binaryMatrix) {
          const rasterGCode = generateRasterGCodeFromMatrix(
            processedArtwork.binaryMatrix,
            elem.x,
            elem.y,
            elem.width,
            elem.height,
            feedRate,
            laserPower,
            elem.name
          );
          body.push(rasterGCode);
        } else if (mode === 'vector' && processedArtwork?.binaryMatrix) {
          const vectorGCode = generateVectorContourGCode(
            processedArtwork.binaryMatrix,
            elem.x,
            elem.y,
            elem.width,
            elem.height,
            feedRate,
            laserPower,
            elem.name
          );
          body.push(vectorGCode);
        } else {
          body.push(`M5 ; Tắt laser di chuyển tới góc đối tượng`);
          body.push(`G0 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
          body.push(`M3 S${S_val} ; Bật laser viền ngoài`);
          body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
          body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
          body.push(`G1 X${elem.x.toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
          body.push(`G1 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)}`);
          body.push(`M5`);
        }
      } else if (elem.type === 'rect') {
        body.push(`M5 ; Tắt laser di chuyển`);
        body.push(`G0 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
        body.push(`M3 S${S_val} ; Khắc/Cắt khung chữ nhật`);
        body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
        body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
        body.push(`G1 X${elem.x.toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
        body.push(`G1 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)}`);
        body.push(`M5`);
      } else if (elem.type === 'circle') {
        const radius = elem.width / 2;
        const centerX = elem.x + radius;
        const centerY = elem.y + radius;
        body.push(`M5 ; Di chuyển tới cạnh đường tròn`);
        body.push(`G0 X${(centerX + radius).toFixed(2)} Y${centerY.toFixed(2)} F${feedRate}`);
        body.push(`M3 S${S_val} ; Cắt đường tròn bán kính ${radius.toFixed(1)}mm`);
        body.push(`G2 X${(centerX + radius).toFixed(2)} Y${centerY.toFixed(2)} I${(-radius).toFixed(2)} J0.00 F${feedRate}`);
        body.push(`M5`);
      } else if (elem.type === 'text') {
        const textMatrix = generateTextBinaryMatrix(elem.text || 'PhotonCraft', elem.width, elem.height, elem.fontFamily, dpi);
        if (textMatrix && textMatrix.length > 0) {
          if (mode === 'vector') {
            const textVectorGCode = generateVectorContourGCode(
              textMatrix,
              elem.x,
              elem.y,
              elem.width,
              elem.height,
              feedRate,
              laserPower,
              `Text: ${elem.text || 'text'}`
            );
            body.push(textVectorGCode);
          } else {
            const textRasterGCode = generateRasterGCodeFromMatrix(
              textMatrix,
              elem.x,
              elem.y,
              elem.width,
              elem.height,
              feedRate,
              laserPower,
              `Text: ${elem.text || 'text'}`
            );
            body.push(textRasterGCode);
          }
        } else {
          body.push(`M5 ; Di chuyển tới vị trí văn bản "${elem.text || 'Text'}"`);
          body.push(`G0 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
          body.push(`M3 S${S_val}`);
          body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${elem.y.toFixed(2)} F${feedRate}`);
          body.push(`G1 X${(elem.x + elem.width).toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
          body.push(`G1 X${elem.x.toFixed(2)} Y${(elem.y + elem.height).toFixed(2)}`);
          body.push(`G1 X${elem.x.toFixed(2)} Y${elem.y.toFixed(2)}`);
          body.push(`M5`);
        }
      }
    });

    const footer = [
      '\n; --- Kết thúc chương trình ---',
      'M5          ; Tắt chùm tia laser',
      'G0 X0 Y0    ; Quay trở về toạ độ gốc phôi',
      'M2          ; Kết thúc chương trình gia công'
    ];

    return [...header, ...body, ...footer].join('\n');
  }, [elements, mode, feedRate, acceleration, laserPower, dpi, processedArtwork]);

  // Cập nhật thống kê dòng lệnh và thời gian ước tính thật khi thay đổi thiết kế
  useEffect(() => {
    if (isRunning) return;
    try {
      if (elements.length === 0) {
        setTotalLines(0);
        setCurrentLine(0);
        setProgress(0);
        setEstimatedTime('00:00');
        setElapsedTime('00:00');
        setStatusText('Trạng thái: Sẵn sàng');
        setStatusType('ready');
        return;
      }

      const gcode = generateGCodeText();
      const lines = gcode.split(/\r?\n/).filter((l) => l.split(';')[0].trim());
      setTotalLines(lines.length);

      // Khi người dùng thay đổi thiết kế hoặc thêm/sửa/xóa thành phần sau khi khắc xong -> Reset về Sẵn sàng
      setCurrentLine(0);
      setProgress(0);
      setElapsedTime('00:00');
      setStatusText('Trạng thái: Sẵn sàng');
      setStatusType('ready');

      let cutLengthMm = 0;
      let rapidLengthMm = 0;
      let curX = 0;
      let curY = 0;
      for (const line of lines) {
        const clean = line.split(';')[0].trim();
        const isG0 = clean.startsWith('G0');
        const isG1 = clean.startsWith('G1');
        if (isG0 || isG1) {
          const xMatch = clean.match(/X([0-9.-]+)/);
          const yMatch = clean.match(/Y([0-9.-]+)/);
          const nextX = xMatch ? parseFloat(xMatch[1]) : curX;
          const nextY = yMatch ? parseFloat(yMatch[1]) : curY;
          const dist = Math.hypot(nextX - curX, nextY - curY);
          if (isG1) cutLengthMm += dist;
          else rapidLengthMm += dist;
          curX = nextX;
          curY = nextY;
        }
      }
      const estSec = Math.round(
        (cutLengthMm / (feedRate || 1500)) * 60 + (rapidLengthMm / 3000) * 60 + 2
      );
      const mins = String(Math.floor(estSec / 60)).padStart(2, '0');
      const secs = String(estSec % 60).padStart(2, '0');
      setEstimatedTime(`${mins}:${secs}`);
    } catch (_) {}
  }, [elements, generateGCodeText, isRunning, feedRate]);

  // Start Job / Streaming thật xuống máy qua Web Serial Call-and-Response
  const handleStartJob = async () => {
    if (isRunning && !isPaused) return;

    if (!isConnected) {
      addLog('⚠️ Máy khắc Laser chưa được kết nối qua cổng COM! Vui lòng cắm cáp USB và nhấn nút "Kết nối máy" trước khi bắt đầu gia công thật.', 'err');
      addLog('💡 Mẹo: Nếu bạn chỉ muốn lấy file mã G-Code để nạp vào thẻ nhớ hoặc máy khác, hãy nhấn nút "Tạo mã G-Code" hoặc "Tải file .NC".', 'sys');
      return;
    }

    if (elements.length === 0) {
      addLog('⚠️ Bàn cắt chưa có đối tượng nào để gia công. Vui lòng thêm chữ hoặc hình vẽ trước khi bắt đầu!', 'warn');
      return;
    }

    const target = selectedElem || elements[0];
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      setStatusText('Đang gia công...');
      setStatusType('running');
      addLog('~ (Resume / Tiếp tục khắc)', 'cmd');
      try { await grblSerial.sendRaw('~'); } catch (_) {}
      return;
    }

    const gcodeText = generateGCodeText();
    const allLines = gcodeText.split(/\r?\n/);
    const commands = [];
    for (const raw of allLines) {
      const clean = raw.split(';')[0].trim();
      if (clean) {
        commands.push(clean);
      }
    }

    if (commands.length === 0) {
      addLog('Không có lệnh G-code nào để thực thi.', 'err');
      return;
    }

    setTotalLines(commands.length);
    setCurrentLine(0);
    setProgress(0);
    setElapsedTime('00:00');
    setIsRunning(true);
    setIsPaused(false);
    setStatusText('Đang gia công...');
    setStatusType('running');

    isStreamingRef.current = true;
    isPausedRef.current = false;
    isCancelledRef.current = false;

    // Duy trì status polling đều đặn (200ms - 5Hz) để đồng bộ telemetry
    if (grblSerial.isConnected) {
      grblSerial.startStatusPolling(200);
    }

    addLog(`Bắt đầu truyền phát ${commands.length} lệnh G-Code xuống bo mạch GRBL qua cổng COM...`, 'sys');

    const startTime = Date.now();
    let sentCount = 0;

    for (let i = 0; i < commands.length; i++) {
      if (isCancelledRef.current || !isStreamingRef.current) {
        addLog('Đã dừng truyền mã G-code.', 'warn');
        break;
      }

      while (isPausedRef.current && isStreamingRef.current && !isCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (isCancelledRef.current || !isStreamingRef.current) break;

      const cmd = commands[i];

      try {
        const resp = await grblSerial.sendCommandAndWait(cmd, 30000);

        if (resp === 'error:DeviceLost' || !grblSerial.isConnected) {
          addLog('⚠️ Mất kết nối USB với bo mạch ("The device has been lost"). Hiện tượng này xảy ra khi nguồn 12V/24V bị sụt áp lúc Laser phát công suất khiến bo mạch vi điều khiển tự khởi động lại, hoặc cáp USB bị nhiễu điện từ (EMI). Hãy kiểm tra lại nguồn cấp hoặc hạ công suất Laser PWM.', 'err');
          break;
        }

        sentCount++;

        if (resp && (resp.startsWith('error') || resp.startsWith('ALARM'))) {
          addLog(`[Lỗi GRBL dòng ${i + 1}]: ${resp} (Lệnh: ${cmd})`, 'err');
        }

        // Cập nhật tiến độ sau mỗi 5 lệnh hoặc lệnh cuối
        if (sentCount % 5 === 0 || sentCount === commands.length) {
          const percent = Math.min(100, parseFloat(((sentCount / commands.length) * 100).toFixed(1)));
          setProgress(percent);
          setCurrentLine(sentCount);

          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          const elMins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
          const elSecs = String(elapsedSec % 60).padStart(2, '0');
          setElapsedTime(`${elMins}:${elSecs}`);

          const linesPerSec = sentCount / (elapsedSec || 1);
          if (linesPerSec > 0) {
            const remainSec = Math.max(0, Math.round((commands.length - sentCount) / linesPerSec));
            const mins = String(Math.floor(remainSec / 60)).padStart(2, '0');
            const secs = String(remainSec % 60).padStart(2, '0');
            setEstimatedTime(`${mins}:${secs}`);
          }
        }
      } catch (err) {
        addLog(`Lỗi truyền lệnh G-code [${cmd}]: ${err.message}`, 'err');
        if (grblSerial.isConnected) {
          try { await grblSerial.sendCommand('M5'); } catch (_) {}
        }
        break;
      }
    }

    isStreamingRef.current = false;
    setIsRunning(false);
    setIsPaused(false);

    // Kích hoạt lại polling sau khi gia công xong nếu cổng vẫn còn kết nối
    if (grblSerial.isConnected) {
      grblSerial.startStatusPolling(500);
    }

    if (!isCancelledRef.current && sentCount === commands.length) {
      setProgress(100);
      setCurrentLine(commands.length);
      setStatusText('Hoàn tất khắc');
      setStatusType('ready');
      setEstimatedTime('00:00');
      addLog('M5 ; Tắt tia laser', 'cmd');
      addLog('G0 X0 Y0 ; Về gốc phôi', 'cmd');
      addLog('Gia công hoàn tất thành công 100%!', 'sys');
      try {
        await grblSerial.sendCommand('M5');
        await grblSerial.sendCommand('G0 X0 Y0');
      } catch (_) {}

      const targetObj = target || elements[0];
      const historyPayload = {
        originalFilename: targetObj ? targetObj.name : 'Dự án tổng hợp',
        totalGcodeLines: commands.length,
        engravingSpeed: feedRate,
        laserPower: Math.round((laserPower / 100) * 1000),
        dpi,
        outputWidthMm: targetObj?.width || 0.0,
        outputHeightMm: targetObj?.height || 0.0,
        originXMm: targetObj?.x || 0.0,
        originYMm: targetObj?.y || 0.0,
        mode,
        materialName: targetObj?.type === 'image' ? 'Ảnh Dithering' : 'Vector',
        status: 'Hoàn tất',
        gcodeContent: gcodeText
      };

      const newLocalItem = {
        name: historyPayload.originalFilename,
        date: new Date().toLocaleString('vi-VN'),
        lines: commands.length.toLocaleString(),
        feedRate,
        power: Math.round((laserPower / 100) * 1000),
        status: 'Hoàn tất',
        gcode: gcodeText
      };

      setHistoryList((prevList) => [newLocalItem, ...prevList]);

      historyApi.saveHistory(currentUser?.email, historyPayload)
        .then((res) => {
          addLog(`[Cloud CSDL] Đã lưu lịch sử gia công "${historyPayload.originalFilename}" (ID: ${res.data?.historyId}) lên CSDL thành công!`, 'sys');
          loadCloudHistory();
        })
        .catch((err) => {
          console.warn('Lưu lịch sử lên server thất bại, đã giữ bản ghi cục bộ:', err.message);
        });
    }
  };

  // Pause Job
  const handlePauseJob = async () => {
    if (!isRunning || isPaused) return;
    isPausedRef.current = true;
    setIsPaused(true);
    setStatusText('Tạm dừng máy');
    setStatusType('paused');
    addLog('! (Feed Hold / Tạm dừng)', 'cmd');
    if (isConnected) {
      try { await grblSerial.sendRaw('!'); } catch (_) {}
    }
  };

  // Stop / E-Stop Job
  const handleStopJob = async () => {
    isCancelledRef.current = true;
    isStreamingRef.current = false;
    if (framingIntervalRef.current) clearInterval(framingIntervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setIsFraming(false);
    setStatusText('Đã dừng khẩn cấp');
    setStatusType('stopped');

    addLog('! (DỪNG KHẨN CẤP / E-STOP)', 'err');
    addLog('M5 (CẮT TIA LASER NGAY LẬP TỨC)', 'err');
    if (isConnected) {
      try {
        await grblSerial.emergencyStop();
      } catch (err) {
        console.error('Lỗi khi gửi lệnh dừng khẩn cấp:', err);
      }
    }
  };

  // Download .NC File
  const handleDownloadNC = () => {
    const gcodeText = generateGCodeText();
    const blob = new Blob([gcodeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = selectedElem ? selectedElem.name.replace(/\.[^/.]+$/, '') : 'photoncraft';
    link.download = `${baseName}_laser.nc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`Đã tải file .NC: ${link.download}`, 'sys');
  };

  // Điều phối Job khắc laser tới máy IoT (MKS DLC32 V2.1) qua Cloud Backend
  const handleDispatchIoTJob = async (targetDevice = 'LASER-HN-001') => {
    if (isDispatchingJob) return;

    const gcodeText = generateGCodeText();
    if (!gcodeText || elements.length === 0) {
      addLog('Bàn làm việc đang trống hoặc chưa tạo được mã G-code!', 'err');
      alert('Không có mã G-code để gửi tới máy IoT.');
      return;
    }

    const targetObj = selectedElem || elements[0];
    const fileName = targetObj?.name
      ? (targetObj.name.endsWith('.gcode') || targetObj.name.endsWith('.nc')
          ? targetObj.name
          : `${targetObj.name.replace(/\.[^/.]+$/, '')}.gcode`)
      : 'logo.gcode';

    const targetW = targetObj?.width ? Number(targetObj.width.toFixed(2)) : 100.0;
    const targetH = targetObj?.height ? Number(targetObj.height.toFixed(2)) : 100.0;
    const sPower = Math.round((laserPower / 100) * 1000);

    setIsDispatchingJob(true);
    addLog(`[IoT Cloud] Đang chuẩn bị điều phối Job tới thiết bị ${targetDevice}...`, 'sys');

    try {
      const payload = {
        deviceCode: targetDevice,
        originalFilename: fileName,
        gcodeContent: gcodeText,
        targetWidthMm: targetW,
        targetHeightMm: targetH,
        feedRate: feedRate || 1500,
        laserPower: sPower,
        materialType: targetObj?.type === 'image' ? 'Gỗ Plywood (Ảnh Dithering)' : 'Gỗ Plywood (Vector)',
        userId: currentUser?.id || null
      };

      const response = await jobApi.dispatchJobJson(payload);
      const jobData = response.data;

      addLog(`✅ [IoT Cloud] Điều phối thành công Job ${jobData.jobCode} tới ${jobData.deviceCode} (SHA-256: ${jobData.sha256Checksum ? jobData.sha256Checksum.slice(0, 8) : '—'}...)`, 'sys');

      setActiveJob({
        jobId: jobData.jobId,
        jobCode: jobData.jobCode,
        deviceCode: jobData.deviceCode || targetDevice,
        sha256Checksum: jobData.sha256Checksum || '',
        originalFilename: jobData.originalFilename || fileName,
        totalLines: jobData.totalLines || totalLines
      });

      setIsGCodeOpen(false);
      setIsJobProgressOpen(true);
    } catch (err) {
      console.error('Lỗi khi điều phối Job IoT:', err);
      addLog(`❌ [IoT Cloud Lỗi] ${err.message}`, 'err');
      alert(`Không thể gửi Job tới máy ${targetDevice}:\n${err.message}`);
    } finally {
      setIsDispatchingJob(false);
    }
  };

  // Dừng khẩn cấp / Hủy Job IoT
  const handleAbortIoTJob = async (jobCode) => {
    addLog(`⚠️ [IoT Cloud] Gửi lệnh dừng khẩn cấp Job ${jobCode}...`, 'err');
    try {
      await jobApi.cancelJob(jobCode);
      addLog(`[IoT Cloud] Đã gửi lệnh hủy Job ${jobCode} lên máy chủ Cloud`, 'sys');
    } catch (err) {
      console.warn('Hủy Job trên backend không thành công:', err.message);
    }

    if (isConnected) {
      try {
        await grblSerial.emergencyStop();
        addLog('Đã phát tín hiệu dừng E-Stop phần cứng cắt tia laser ngay lập tức.', 'err');
      } catch (err) {
        console.error('Lỗi E-Stop phần cứng:', err);
      }
    }
  };

  // Save Project Handler (Cập nhật đè lên dự án cũ nếu đang mở, hoặc tạo mới nếu là bản vẽ mới)
  const handleSaveProject = (saveAsNew = false) => {
    if (!currentUser) {
      addLog('Yêu cầu đăng nhập: Bạn cần đăng nhập tài khoản Gmail để lưu dự án.', 'err');
      setIsAuthOpen(true);
      return;
    }

    if (elements.length === 0) {
      addLog('Bàn làm việc đang trống, không có đối tượng nào để lưu!', 'err');
      return;
    }

    const isUpdating = !saveAsNew && activeProject && activeProject.id;
    let targetId = isUpdating ? activeProject.id : null;
    let targetName = isUpdating ? activeProject.name : '';

    if (!targetName) {
      const defaultName = selectedElem?.name
        ? `Dự án ${selectedElem.name}`
        : `Dự án Laser #${Date.now().toString().slice(-4)}`;
      const promptText = window.prompt('Nhập tên dự án để lưu lên CSDL SQL Server:', defaultName);
      if (promptText === null) return; // Người dùng nhấn Hủy
      targetName = promptText.trim() || defaultName;
    }

    const projectRecord = {
      id: targetId,
      projectId: targetId,
      name: targetName,
      userEmail: currentUser.email,
      savedAt: new Date().toLocaleString('vi-VN'),
      elementCount: elements.length,
      elements: JSON.parse(JSON.stringify(elements)),
      parameters: {
        feedRate,
        acceleration,
        laserPower,
        dpi,
        mode
      }
    };

    // Cập nhật localStorage
    try {
      const storageKey = `laser_projects_${currentUser.email}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (targetId) {
        const idx = existing.findIndex((p) => (p.projectId || p.id) === targetId);
        if (idx >= 0) {
          existing[idx] = projectRecord;
        } else {
          existing.unshift(projectRecord);
        }
      } else {
        existing.unshift(projectRecord);
      }
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) {
      console.error('Lỗi khi lưu vào localStorage:', e);
    }

    // Gửi đồng bộ lên CSDL Backend SQL Server
    projectApi.saveProject(currentUser.email, projectRecord)
      .then((res) => {
        const savedId = res.data?.projectId || res.data?.id || targetId;
        setActiveProject({
          id: savedId,
          name: targetName
        });
        if (isUpdating) {
          addLog(`[Cloud CSDL] Đã cập nhật thành công các thay đổi vào dự án "${targetName}" (ID: ${savedId})!`, 'sys');
        } else {
          addLog(`[Cloud CSDL] Đã tạo mới dự án "${targetName}" (ID: ${savedId}) trên SQL Server!`, 'sys');
        }
      })
      .catch((err) => {
        console.warn('Lưu Cloud thất bại:', err.message);
        addLog(`Lỗi lưu CSDL: ${err.message}`, 'err');
      });
  };

  return (
    <div className="laser-studio-layout">
      {/* 1. TOP HEADER */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        isConnecting={isConnecting}
        portName={portName}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onNewWorkspace={handleNewWorkspace}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenConsole={() => setIsConsoleOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        activeJob={activeJob}
        onOpenJobProgress={() => setIsJobProgressOpen(true)}
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="studio-main-body">
        {/* Hidden File Input for Image Upload accessible across views */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/png,image/jpeg,image/svg+xml,.dxf"
          onChange={handleFileChange}
        />

        {activeTab === 'canvas-studio' && (
          <>
            {/* Left vertical tool rail */}
            <ToolRail
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              onAddRectangle={() => handleAddRectangle()}
              onAddCircle={() => handleAddCircle()}
              onAddText={() => handleAddText()}
              onTriggerFileInput={() => fileInputRef.current?.click()}
              onSetOrigin={handleJogZero}
              onFramingCheck={handleFramingCheck}
              onEmergencyStop={handleStopJob}
            />

            {/* Workspace body (Parameter panel + Canvas + Dock) */}
            <div className="workspace-wrapper">
              {/* Left Parameter Panel (350px) */}
              <ParameterPanel
                elements={elements}
                selectedId={selectedId}
                onSelectElement={setSelectedId}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onAddRectangle={() => handleAddRectangle()}
                onAddCircle={() => handleAddCircle()}
                onAddText={() => handleAddText()}
                onTriggerFileInput={() => fileInputRef.current?.click()}
                onFileChange={handleFileChange}
                fileInputRef={fileInputRef}
                feedRate={feedRate}
                setFeedRate={setFeedRate}
                acceleration={acceleration}
                setAcceleration={setAcceleration}
                laserPower={laserPower}
                setLaserPower={setLaserPower}
                dpi={dpi}
                setDpi={setDpi}
                mode={mode}
                setMode={setMode}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
                contrast={contrast}
                setContrast={setContrast}
                brightness={brightness}
                setBrightness={setBrightness}
                invert={invert}
                setInvert={setInvert}
                burnCount={processedArtwork?.burnCount || 0}
                burnPercent={processedArtwork?.burnPercent || 0}
                rasterDims={processedArtwork ? `${processedArtwork.targetW} × ${processedArtwork.targetH} px` : ''}
                onGenerateGCode={() => setIsGCodeOpen(true)}
                onDownloadNC={handleDownloadNC}
                isConnected={isConnected}
                onFlashParameters={handleFlashParameters}
                isTestLaserOn={isTestLaserOn}
                onToggleTestLaser={handleToggleTestLaser}
              />

              {/* Right CAD Workbed Canvas & Direct Machine Dashboard */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <LaserCanvas
                  laserX={laserX}
                  laserY={laserY}
                  elements={elements}
                  selectedId={selectedId}
                  onSelectElement={setSelectedId}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  displayUrl={previewMode === 'original' ? activeImageElem?.previewUrl : (processedArtwork?.dataUrl || activeImageElem?.previewUrl)}
                  previewMode={previewMode}
                  onTogglePreviewMode={handleTogglePreviewMode}
                  isFraming={isFraming}
                  isRunning={isRunning}
                  laserPower={laserPower}
                  activeTool={activeTool}
                  onCanvasClickAdd={handleCanvasClickAdd}
                  onSaveProject={handleSaveProject}
                  onOpenProjects={() => setIsProjectsOpen(true)}
                  onNewWorkspace={handleNewWorkspace}
                  activeProject={activeProject}
                  currentUser={currentUser}
                  onOpenAuth={() => setIsAuthOpen(true)}
                />

                {/* Bottom Dock Operation */}
                <div style={{ padding: '0 16px 12px 16px' }}>
                  <BottomDock
                    onJog={handleJog}
                    onJogZero={handleJogZero}
                    stepSize={stepSize}
                    setStepSize={setStepSize}
                    onFramingCheck={handleFramingCheck}
                    isFraming={isFraming}
                    onOpenCalibration={() => setIsCalibrationOpen(true)}
                    isRunning={isRunning}
                    isPaused={isPaused}
                    progress={progress}
                    currentLine={currentLine}
                    totalLines={totalLines}
                    estimatedTime={estimatedTime}
                    elapsedTime={elapsedTime}
                    statusText={statusText}
                    statusType={statusType}
                    onStartJob={handleStartJob}
                    onPauseJob={handlePauseJob}
                    onStopJob={handleStopJob}
                  />
                </div>
              </div>
            </div>
          </>
        )}


        {/* Dedicated Laser Parameters & Material Presets Page */}
        {activeTab === 'laser-parameters' && (
          <LaserParametersView
            feedRate={feedRate}
            setFeedRate={setFeedRate}
            acceleration={acceleration}
            setAcceleration={setAcceleration}
            laserPower={laserPower}
            setLaserPower={setLaserPower}
            dpi={dpi}
            setDpi={setDpi}
            mode={mode}
            setMode={setMode}
            currentUser={currentUser}
            onBackToStudio={() => setActiveTab('canvas-studio')}
            onNotify={addLog}
            isConnected={isConnected}
            onFlashParameters={handleFlashParameters}
          />
        )}
      </div>

      {/* 3. MODALS */}
      <GCodeModal
        isOpen={isGCodeOpen}
        onClose={() => setIsGCodeOpen(false)}
        gcode={generateGCodeText()}
        totalLines={totalLines}
        onDownloadNC={handleDownloadNC}
        onDispatchIoT={handleDispatchIoTJob}
        isDispatching={isDispatchingJob}
        deviceCode="LASER-HN-001"
      />

      <JobProgressModal
        isOpen={isJobProgressOpen}
        onClose={() => setIsJobProgressOpen(false)}
        jobCode={activeJob?.jobCode}
        deviceCode={activeJob?.deviceCode || 'LASER-HN-001'}
        sha256={activeJob?.sha256Checksum || ''}
        fileName={activeJob?.originalFilename || ''}
        onAbortJob={handleAbortIoTJob}
      />

      <ConsoleModal
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        terminalLogs={terminalLogs}
        onSendCommand={async (cmd) => {
          addLog(cmd, 'cmd');
          if (isConnected) {
            try {
              await grblSerial.sendCommand(cmd);
            } catch (err) {
              addLog(`Lỗi gửi lệnh qua cổng Serial: ${err.message}`, 'err');
            }
          } else {
            addLog(`⚠️ [Chưa kết nối máy] Không thể gửi lệnh "${cmd}" xuống máy thật. Vui lòng cắm cáp USB và nhấn nút "Kết nối máy" trước.`, 'err');
          }
        }}
        onClearLogs={() => setTerminalLogs([])}
        isConnected={isConnected}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyList={historyList}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onDeleteItem={handleDeleteHistoryItem}
        onDownloadItem={(item) => {
          if (!item.gcode) {
            addLog(`Không tìm thấy nội dung mã G-code lưu trữ cho mục: ${item.name || 'G-code'}`, 'err');
            alert('Không tìm thấy nội dung mã G-code lưu trữ cho mục lịch sử này.');
            return;
          }
          const content = item.gcode;
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const cleanName = item.name ? item.name.replace(/\.[^/.]+$/, '') : 'photoncraft';
          link.download = `${cleanName}_history.nc`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          addLog(`Đã tải file G-code lịch sử: ${link.download}`, 'sys');
        }}
      />

      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        currentUser={currentUser}
        onLoadProject={handleLoadProject}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        currentUser={currentUser}
        currentElementCount={elements.length}
        initialParams={{ feedRate, laserPower, dpi, mode }}
        onCreateProject={handleCreateNewProject}
        onGuestNewWorkspace={handleGuestNewWorkspace}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          addLog(`Đăng nhập thành công với tài khoản: ${user.email} (${user.provider})`, 'sys');
        }}
      />

      {/* 4. SMART FOCUS & THERMAL CALIBRATION MODAL (LM-C40 5.5W - 40mm) */}
      <FocusCalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        feedRate={feedRate}
        setFeedRate={setFeedRate}
        laserPower={laserPower}
        setLaserPower={setLaserPower}
        onStartJob={handleStartJob}
        onNotify={addLog}
      />
    </div>
  );
}
