/**
 * Web Serial API Driver cho Bo mạch điều khiển GRBL CNC / Laser (Makerbase MKS, Arduino, ESP32)
 * Hỗ trợ giao tiếp 2 chiều UART, bắt tay khởi tạo, Call-and-Response streaming chống tràn bộ đệm,
 * và Status Polling (?) đồng bộ tọa độ WPos/MPos thời gian thực.
 */

class GrblSerialDriver {
  constructor() {
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.writer = null;
    this.isConnected = false;
    this.onLineReceived = null;
    this.onStatusReceived = null;
    this.onError = null;
    this.responseQueue = []; // Chứa các resolver đang đợi 'ok' hoặc 'error'
    this.statusPollTimer = null;
    this.lastWco = { x: 0, y: 0, z: 0 };
    this._writeChain = Promise.resolve();
  }

  /**
   * Kiểm tra trình duyệt có hỗ trợ Web Serial API không
   */
  isSupported() {
    return 'serial' in navigator;
  }

  /**
   * Phân tích chuỗi phản hồi trạng thái từ GRBL:
   * Ví dụ: <Idle|MPos:107.800,104.400,0.000|FS:0,0>
   * hoặc <Run|WPos:107.800,104.400,0.000|Bf:15,127|FS:1500,800|Pn:P|WCO:0.000,0.000,0.000>
   */
  parseStatusReport(line) {
    if (!line.startsWith('<') || !line.endsWith('>')) return null;
    const content = line.slice(1, -1);
    const parts = content.split('|');
    const state = parts[0];
    let mpos = null;
    let wpos = null;
    let wco = null;
    let feedRate = 0;
    let laserPower = 0;
    let buffer = null;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('MPos:')) {
        const c = part.substring(5).split(',').map(Number);
        mpos = { x: c[0] || 0, y: c[1] || 0, z: c[2] || 0 };
      } else if (part.startsWith('WPos:')) {
        const c = part.substring(5).split(',').map(Number);
        wpos = { x: c[0] || 0, y: c[1] || 0, z: c[2] || 0 };
      } else if (part.startsWith('WCO:')) {
        const c = part.substring(4).split(',').map(Number);
        this.lastWco = { x: c[0] || 0, y: c[1] || 0, z: c[2] || 0 };
      } else if (part.startsWith('FS:')) {
        const fs = part.substring(3).split(',').map(Number);
        feedRate = fs[0] || 0;
        laserPower = fs[1] || 0;
      } else if (part.startsWith('F:')) {
        feedRate = Number(part.substring(2)) || 0;
      } else if (part.startsWith('Bf:')) {
        const bf = part.substring(3).split(',').map(Number);
        buffer = { plan: bf[0] || 0, rx: bf[1] || 0 };
      }
    }

    // Luôn tính toán và đồng bộ WPos/MPos thông qua lastWco ổn định
    if (wpos && mpos) {
      this.lastWco = {
        x: parseFloat((mpos.x - wpos.x).toFixed(3)),
        y: parseFloat((mpos.y - wpos.y).toFixed(3)),
        z: parseFloat((mpos.z - wpos.z).toFixed(3))
      };
    } else if (!wpos && mpos) {
      wpos = {
        x: parseFloat((mpos.x - this.lastWco.x).toFixed(3)),
        y: parseFloat((mpos.y - this.lastWco.y).toFixed(3)),
        z: parseFloat((mpos.z - this.lastWco.z).toFixed(3))
      };
    } else if (wpos && !mpos) {
      mpos = {
        x: parseFloat((wpos.x + this.lastWco.x).toFixed(3)),
        y: parseFloat((wpos.y + this.lastWco.y).toFixed(3)),
        z: parseFloat((wpos.z + this.lastWco.z).toFixed(3))
      };
    }

    return {
      state,
      mpos,
      wpos,
      wco: this.lastWco,
      feedRate,
      laserPower,
      buffer,
      raw: line
    };
  }

  /**
   * Mở hộp thoại chọn cổng COM và kết nối vật lý với bo mạch
   * @param {number} baudRate - Tốc độ Baud (mặc định 115200 cho GRBL v1.1)
   */
  async connect(baudRate = 115200) {
    if (!this.isSupported()) {
      throw new Error('Trình duyệt không hỗ trợ Web Serial API. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge.');
    }

    // Yêu cầu người dùng chọn cổng COM thực tế cắm trên máy tính
    const port = await navigator.serial.requestPort();

    // Mở cổng với cấu hình chuẩn 8-N-1 của GRBL
    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      bufferSize: 255
    });

    this.port = port;
    this.writer = port.writable.getWriter();
    this.isConnected = true;

    // Bắt đầu luồng đọc dữ liệu từ cổng COM
    this._startReading();

    // Bắt tay khởi tạo: Gửi ngắt dòng để đánh thức GRBL
    await this.sendRaw('\r\n\r\n');
    // Gửi lệnh bật chế độ Laser Mode an toàn
    await this.sendCommand('$32=1');
    // Thăm dò trạng thái ban đầu
    await this.sendRaw('?');

    // Khởi động đồng bộ trạng thái định kỳ 300ms
    this.startStatusPolling(300);

    return port;
  }

  /**
   * Bắt đầu luồng đọc bất đồng bộ từ cổng nối tiếp
   */
  async _startReading() {
    if (!this.port || !this.port.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      this.reader = reader;

      let lineBuffer = '';

      while (this.isConnected) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop(); // Giữ lại phần chưa đủ 1 dòng ở cuối buffer

          for (const line of lines) {
            let trimmed = line.trim();
            if (!trimmed) continue;

            // 1. Tách và xử lý báo cáo trạng thái định kỳ nếu có trong dòng: <...>
            const statusMatch = trimmed.match(/<[^>]+>/);
            if (statusMatch) {
              const status = this.parseStatusReport(statusMatch[0]);
              if (status && this.onStatusReceived) {
                this.onStatusReceived(status);
              }
              // Loại bỏ chuỗi trạng thái ra khỏi dòng để kiểm tra tiếp ok/error
              trimmed = trimmed.replace(statusMatch[0], '').trim();
              if (!trimmed) continue;
            }

            // 2. Xử lý hàng đợi phản hồi (cho streaming G-code: ok hoặc error hoặc ALARM)
            if (trimmed === 'ok' || trimmed.startsWith('error:') || trimmed.startsWith('ALARM:')) {
              if (this.responseQueue.length > 0) {
                const resolveResponse = this.responseQueue.shift();
                resolveResponse(trimmed);
              }
            }

            // 3. Chuyển các phản hồi có ý nghĩa ra Terminal/Console UI (tránh spam "ok" ngập tràn)
            if (this.onLineReceived && trimmed && trimmed !== 'ok') {
              this.onLineReceived(trimmed);
            }
          }
        }
      }
    } catch (err) {
      this.stopStatusPolling();
      this.isConnected = false;
      this.responseQueue.forEach(resolve => resolve('error:DeviceLost'));
      this.responseQueue = [];
      if (this.writer) {
        try { this.writer.releaseLock(); } catch (_) {}
        this.writer = null;
      }
      this.reader = null;
      this.port = null;
      if (err.name !== 'TypeError') {
        console.error('Lỗi luồng đọc Web Serial:', err);
        if (this.onError) this.onError(err);
      }
    }
  }

  /**
   * Bắt đầu định kỳ gửi lệnh '?' để thăm dò tọa độ WPos/MPos máy thật
   */
  startStatusPolling(intervalMs = 500) {
    this.stopStatusPolling();
    this.statusPollTimer = setInterval(() => {
      if (this.isConnected && this.writer) {
        this.sendRaw('?').catch(() => {});
      } else {
        this.stopStatusPolling();
      }
    }, intervalMs);
  }

  /**
   * Dừng thăm dò trạng thái
   */
  stopStatusPolling() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  }

  /**
   * Gửi chuỗi ký tự thô ra cổng COM thông qua Writer thường trực
   * Tuần tự hóa các thao tác ghi (write serialization) để không xung đột giữa lệnh G-code và '?'
   */
  async sendRaw(text) {
    if (!this.isConnected || !this.writer) {
      throw new Error('Chưa kết nối cổng COM hoặc thiết bị đã bị ngắt');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const prevWrite = this._writeChain || Promise.resolve();
    this._writeChain = prevWrite
      .then(async () => {
        if (!this.writer) return;
        await this.writer.write(data);
      })
      .catch((err) => {
        if (err.name === 'NetworkError' || (err.message && err.message.includes('lost'))) {
          this.stopStatusPolling();
          this.isConnected = false;
          if (this.onError) this.onError(err);
        }
        throw err;
      });

    return this._writeChain;
  }

  /**
   * Gửi một dòng lệnh G-code hoặc lệnh cấu hình ($)
   */
  async sendCommand(command) {
    const cleanCmd = command.trim();
    if (!cleanCmd) return;
    await this.sendRaw(cleanCmd + '\r\n');
  }

  /**
   * Gửi một lệnh và đợi phản hồi 'ok' hoặc 'error' từ bo mạch GRBL (Call-and-Response)
   */
  async sendCommandAndWait(command, timeoutMs = 30000) {
    return new Promise(async (resolve, reject) => {
      let resolveHandler;
      const timer = setTimeout(() => {
        const idx = this.responseQueue.indexOf(resolveHandler);
        if (idx !== -1) this.responseQueue.splice(idx, 1);
        reject(new Error(`Quá thời gian phản hồi (${timeoutMs / 1000}s) cho lệnh: ${command}`));
      }, timeoutMs);

      resolveHandler = (resp) => {
        clearTimeout(timer);
        resolve(resp);
      };

      this.responseQueue.push(resolveHandler);

      try {
        await this.sendCommand(command);
      } catch (err) {
        clearTimeout(timer);
        const idx = this.responseQueue.indexOf(resolveHandler);
        if (idx !== -1) this.responseQueue.splice(idx, 1);
        reject(err);
      }
    });
  }

  /**
   * Gửi lệnh khẩn cấp (Emergency Stop)
   */
  async emergencyStop() {
    // Giải phóng toàn bộ Promise đang chờ trong hàng đợi
    this.responseQueue.forEach(resolve => resolve('error:EmergencyStop'));
    this.responseQueue = [];

    if (!this.isConnected) return;
    try {
      // 0x18 là Ctrl+X (Soft Reset của GRBL) + M5 tắt laser ngay lập tức
      await this.sendRaw('M5\r\n\x18');
    } catch (err) {
      console.error('Lỗi khi gửi lệnh E-Stop:', err);
    }
  }

  /**
   * Ngắt kết nối và giải phóng tài nguyên cổng COM
   */
  async disconnect() {
    this.stopStatusPolling();
    this.isConnected = false;
    this.lastWco = { x: 0, y: 0, z: 0 };
    this._writeChain = Promise.resolve();
    this.responseQueue.forEach(resolve => resolve('disconnected'));
    this.responseQueue = [];

    try {
      if (this.writer) {
        try {
          this.writer.releaseLock();
        } catch (_) {}
        this.writer = null;
      }
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => {});
        this.readableStreamClosed = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err) {
      console.warn('Lỗi khi đóng cổng COM:', err);
    }
  }
}

export const grblSerial = new GrblSerialDriver();
