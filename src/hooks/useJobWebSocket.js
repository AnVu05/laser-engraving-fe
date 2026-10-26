import { useState, useEffect, useRef, useCallback } from 'react';
import { websocketService } from '../services/websocketService';
import { jobApi } from '../services/jobApi';

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
  const [telemetryData, setTelemetryData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Lưu trữ mã Job hiện tại để tránh cập nhật dữ liệu của Job cũ
  const currentJobRef = useRef(jobCode);
  currentJobRef.current = jobCode;
  const updateSequenceRef = useRef(0);

  const loadSnapshot = useCallback(async (expectedJobCode) => {
    if (!expectedJobCode) return;
    const sequenceAtRequest = updateSequenceRef.current;
    try {
      const response = await jobApi.getJobByCode(expectedJobCode);
      const job = response?.data || response;
      if (currentJobRef.current !== expectedJobCode || sequenceAtRequest !== updateSequenceRef.current) return;
      setProgressData({
        jobCode: job.jobCode,
        deviceCode: job.deviceCode,
        status: job.status,
        progressPercent: job.currentProgress ?? 0,
        currentLine: job.currentLine ?? 0,
        totalLines: job.totalLines ?? 0,
        remainingSeconds: job.remainingSeconds ?? null
      });
      setStatusData({ jobCode: job.jobCode, deviceCode: job.deviceCode, status: job.status });
      setLastUpdated(Date.now());
    } catch (err) {
      setConnectionError(err.message || 'Không thể tải trạng thái job mới nhất.');
    }
  }, []);

  // 1. Lắng nghe trạng thái kết nối STOMP
  useEffect(() => {
    const unsubConn = websocketService.addConnectionListener((connected, err) => {
      setIsConnected(connected);
      if (err) {
        setConnectionError(err);
      } else if (connected) {
        setConnectionError(null);
        loadSnapshot(currentJobRef.current);
      }
    });

    return () => {
      unsubConn();
    };
  }, [loadSnapshot]);

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
        updateSequenceRef.current += 1;
        setProgressData(payload);
        setLastUpdated(Date.now());
      }
    });

    // Subscribe nhận thay đổi trạng thái
    const unsubStatus = websocketService.subscribeToJobStatus(jobCode, (payload) => {
      if (currentJobRef.current === jobCode) {
        updateSequenceRef.current += 1;
        setStatusData(payload);
        setLastUpdated(Date.now());
      }
    });

    loadSnapshot(jobCode);

    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, [jobCode, loadSnapshot]);

  // 3. Polling Telemetry thời gian thực từ Cloud Gateway (toạ độ X/Y, F, S, nhiệt độ, cảm biến)
  useEffect(() => {
    if (!jobCode) {
      setTelemetryData(null);
      return;
    }

    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await jobApi.getJobTelemetry(jobCode);
        if (!isMounted) return;
        const data = res?.data;
        if (data) {
          setTelemetryData(data);
          if (data.status) {
            setStatusData(prev => ({ ...(prev || {}), status: data.status, jobCode }));
          }
          if (data.progressPercent !== undefined) {
            setProgressData(prev => ({
              ...(prev || {}),
              progressPercent: data.progressPercent,
              currentLine: data.currentLine,
              totalLines: data.totalLines,
              remainingSeconds: data.remainingSeconds,
              x: data.x,
              y: data.y,
              feedRate: data.feedRate,
              laserPower: data.laserPower,
              sensors: data.sensors
            }));
          }
          setLastUpdated(Date.now());
        }
      } catch (e) {
        // Trạng thái nghỉ hoặc chưa có telemetry
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
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
    telemetryData,
    lastUpdated,
    reconnect
  };
}

export default useJobWebSocket;
