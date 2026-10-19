import { useState, useEffect, useRef, useCallback } from 'react';
import { websocketService } from '../services/websocketService';

/**
 * Custom React Hook theo dõi tiến độ và trạng thái thời gian thực của một Job khắc
 * @param {string|null} jobCode - Mã định danh của Job (VD: JOB-20261019-XXXX)
 * @returns {Object} { isConnected, progressData, statusData, lastUpdated, error }
 */
export function useJobWebSocket(jobCode) {
  const [isConnected, setIsConnected] = useState(websocketService.isConnected);
  const [connectionError, setConnectionError] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Lưu trữ mã Job hiện tại để tránh cập nhật dữ liệu của Job cũ
  const currentJobRef = useRef(jobCode);
  currentJobRef.current = jobCode;

  // 1. Lắng nghe trạng thái kết nối STOMP
  useEffect(() => {
    const unsubConn = websocketService.addConnectionListener((connected, err) => {
      setIsConnected(connected);
      if (err) {
        setConnectionError(err);
      } else if (connected) {
        setConnectionError(null);
      }
    });

    return () => {
      unsubConn();
    };
  }, []);

  // 2. Tự động subscribe theo jobCode
  useEffect(() => {
    if (!jobCode) {
      setProgressData(null);
      setStatusData(null);
      return;
    }

    // Reset dữ liệu khi đổi Job
    setProgressData(null);
    setStatusData(null);

    // Subscribe nhận tiến độ
    const unsubProgress = websocketService.subscribeToJobProgress(jobCode, (payload) => {
      if (currentJobRef.current === jobCode) {
        setProgressData(payload);
        setLastUpdated(Date.now());
      }
    });

    // Subscribe nhận thay đổi trạng thái
    const unsubStatus = websocketService.subscribeToJobStatus(jobCode, (payload) => {
      if (currentJobRef.current === jobCode) {
        setStatusData(payload);
        setLastUpdated(Date.now());
      }
    });

    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, [jobCode]);

  const reconnect = useCallback(() => {
    websocketService.disconnect();
    websocketService.connect();
  }, []);

  return {
    isConnected,
    connectionError,
    progressData,
    statusData,
    lastUpdated,
    reconnect
  };
}

export default useJobWebSocket;
