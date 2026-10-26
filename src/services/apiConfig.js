const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '').replace(/\/auth$/, '');
  if (typeof window === 'undefined') return 'http://localhost:8080/api/v1';
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return `${window.location.protocol}//${window.location.hostname}${local ? ':8080' : ''}/api/v1`;
};

export const API_BASE_URL = getApiBaseUrl();

export const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window === 'undefined') return 'ws://localhost:8080/ws/client';
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${window.location.hostname}${local ? ':8080' : ''}/ws/client`;
};
