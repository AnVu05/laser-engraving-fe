/**
 * Laser Studio Image Processing Utility
 * Chuẩn ITU-R BT.601 Grayscale & Thuật toán Floyd-Steinberg Error Diffusion Dithering
 */

/**
 * Xử lý ảnh sang ma trận điểm ảnh khắc laser nhị phân
 * @param {HTMLImageElement} img - Phần tử ảnh gốc
 * @param {number} widthMm - Chiều rộng khắc thực tế (mm)
 * @param {number} heightMm - Chiều cao khắc thực tế (mm)
 * @param {number} dpi - Mật độ khắc (DPI: 150, 254, 300)
 * @param {Object} options - Tùy chỉnh (brightness, contrast, invert, mode)
 */
export function processLaserImage(img, widthMm, heightMm, dpi = 254, options = {}) {
  const {
    brightness = 0,     // -100 to 100
    contrast = 0,       // -100 to 100
    invert = false,     // đảo ngược âm bản
    previewMode = 'dither' // 'dither' | 'grayscale' | 'original'
  } = options;

  // Tính số pixel raster dựa trên mm và DPI (1 inch = 25.4 mm)
  // Giới hạn max dimension để xử lý thời gian thực mượt mà (max 900px)
  const dotsPerMm = dpi / 25.4;
  let targetW = Math.round(widthMm * dotsPerMm);
  let targetH = Math.round(heightMm * dotsPerMm);

  const maxDimension = 800;
  if (targetW > maxDimension || targetH > maxDimension) {
    const scaleDown = maxDimension / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scaleDown);
    targetH = Math.round(targetH * scaleDown);
  }

  // Tối thiểu 10x10 px
  targetW = Math.max(10, targetW);
  targetH = Math.max(10, targetH);

  // Tạo canvas ảo
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Vẽ ảnh thu phóng vào canvas
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // Ma trận 2D chứa độ sáng xám float
  const gray = new Float32Array(targetW * targetH);

  // Hệ số tương phản
  // contrast factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  // 1. Chuyển sang Grayscale theo chuẩn ITU-R BT.601 + Điều chỉnh sáng/tương phản
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const idx = (y * targetW + x) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];
      const a = data[idx + 3];

      // Nếu pixel trong suốt hoàn toàn, coi như nền trắng (không khắc)
      if (a < 32) {
        gray[y * targetW + x] = 255;
        continue;
      }

      // Điều chỉnh sáng
      if (brightness !== 0) {
        r = Math.min(255, Math.max(0, r + brightness));
        g = Math.min(255, Math.max(0, g + brightness));
        b = Math.min(255, Math.max(0, b + brightness));
      }

      // Điều chỉnh tương phản
      if (contrast !== 0) {
        r = Math.min(255, Math.max(0, cFactor * (r - 128) + 128));
        g = Math.min(255, Math.max(0, cFactor * (g - 128) + 128));
        b = Math.min(255, Math.max(0, cFactor * (b - 128) + 128));
      }

      // ITU-R BT.601
      let yVal = 0.299 * r + 0.587 * g + 0.114 * b;

      if (invert) {
        yVal = 255 - yVal;
      }

      gray[y * targetW + x] = yVal;
    }
  }

  // Nếu chỉ yêu cầu xem grayscale
  if (previewMode === 'grayscale') {
    for (let i = 0; i < targetW * targetH; i++) {
      const val = Math.round(Math.min(255, Math.max(0, gray[i])));
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      targetW,
      targetH,
      burnCount: 0,
      burnPercent: 0,
      binaryMatrix: null
    };
  }

  // 2. Thuật toán Floyd-Steinberg Dithering (Khuếch tán sai số)
  // Tạo ma trận nhị phân: 1 = Đốt laser, 0 = Không đốt
  const binaryMatrix = [];
  let burnCount = 0;

  for (let y = 0; y < targetH; y++) {
    const row = new Uint8Array(targetW);
    for (let x = 0; x < targetW; x++) {
      const currIdx = y * targetW + x;
      const oldPixel = gray[currIdx];

      // Ngưỡng lượng tử hóa 128
      const newPixel = oldPixel < 128 ? 0 : 255;
      const isBurn = newPixel === 0 ? 1 : 0;
      row[x] = isBurn;
      if (isBurn) burnCount++;

      const error = oldPixel - newPixel;

      // Khuếch tán sai số sang 4 pixel lân cận:
      // (x+1, y)   += error * 7/16
      // (x-1, y+1) += error * 3/16
      // (x, y+1)   += error * 5/16
      // (x+1, y+1) += error * 1/16
      if (x + 1 < targetW) {
        gray[y * targetW + (x + 1)] += error * (7 / 16);
      }
      if (x - 1 >= 0 && y + 1 < targetH) {
        gray[(y + 1) * targetW + (x - 1)] += error * (3 / 16);
      }
      if (y + 1 < targetH) {
        gray[(y + 1) * targetW + x] += error * (5 / 16);
      }
      if (x + 1 < targetW && y + 1 < targetH) {
        gray[(y + 1) * targetW + (x + 1)] += error * (1 / 16);
      }

      // Tô pixel lên canvas kết quả:
      // Màu vết cháy laser chân thực: Đen than chì (#18181b)
      // Điểm trắng: Màu nền trong suốt hoặc trắng phôi (#ffffff)
      const outIdx = currIdx * 4;
      if (isBurn) {
        data[outIdx] = 20;     // R
        data[outIdx + 1] = 16; // G
        data[outIdx + 2] = 14; // B
        data[outIdx + 3] = 255;
      } else {
        data[outIdx] = 255;
        data[outIdx + 1] = 255;
        data[outIdx + 2] = 255;
        data[outIdx + 3] = 230; // Hơi mờ để nhìn thấy lưới bàn cắt bên dưới
      }
    }
    binaryMatrix.push(row);
  }

  ctx.putImageData(imgData, 0, 0);

  const totalPixels = targetW * targetH;
  const burnPercent = totalPixels > 0 ? parseFloat(((burnCount / totalPixels) * 100).toFixed(1)) : 0;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    targetW,
    targetH,
    burnCount,
    burnPercent,
    binaryMatrix
  };
}

/**
 * Sinh mã G-code chuẩn GRBL từ ma trận điểm ảnh nhị phân với thuật toán gom cụm Run-Length
 */
export function generateRasterGCodeFromMatrix(
  binaryMatrix,
  startX,
  startY,
  widthMm,
  heightMm,
  feedRate = 1500,
  laserPower = 75,
  artworkName = 'laser_job'
) {
  if (!binaryMatrix || binaryMatrix.length === 0) return '';

  const rows = binaryMatrix.length;
  const cols = binaryMatrix[0].length;
  const stepX = widthMm / cols;
  const stepY = heightMm / rows;
  const S_val = Math.round((laserPower / 100) * 1000);

  const lines = [
    `; --- Bắt đầu quét Raster: ${artworkName} ---`,
    `; Kích thước: ${widthMm.toFixed(1)} x ${heightMm.toFixed(1)} mm (${cols} x ${rows} pixel)`,
    `; Điểm bắt đầu: X${startX.toFixed(2)} Y${startY.toFixed(2)} mm | F${feedRate} | S${S_val}`,
    `G0 X${startX.toFixed(2)} Y${startY.toFixed(2)} F3000`,
    `M4 S${S_val} ; Bật chế độ Dynamic Laser Power (G0 tắt, G1 tự động phát theo tốc độ)`
  ];

  // Quét từng dòng từ dưới lên trên (CNC Y tăng dần)
  // Trong ảnh raster: dòng 0 là đỉnh trên, dòng rows-1 là đáy dưới
  for (let r = rows - 1; r >= 0; r--) {
    const row = binaryMatrix[r];
    const cncY = startY + (rows - 1 - r) * stepY;

    // Quét dòng tìm các đoạn đốt liên tục (Run-length)
    let inRun = false;
    let runStartCol = 0;

    for (let c = 0; c < cols; c++) {
      const isBurn = row[c] === 1;

      if (isBurn && !inRun) {
        // Bắt đầu một đoạn đốt
        inRun = true;
        runStartCol = c;
      } else if (!isBurn && inRun) {
        // Kết thúc một đoạn đốt -> ghi lệnh
        const runEndCol = c - 1;
        const x1 = startX + runStartCol * stepX;
        const x2 = startX + (runEndCol + 1) * stepX;

        // Di chuyển không tải tới đầu đoạn đốt (Laser tự tắt ở G0 chuẩn Laser Mode)
        lines.push(`G0 X${x1.toFixed(2)} Y${cncY.toFixed(2)}`);
        // Khắc tia laser tới cuối đoạn (Laser tự bật ở G1)
        lines.push(`G1 X${x2.toFixed(2)} Y${cncY.toFixed(2)} F${feedRate}`);

        inRun = false;
      }
    }

    // Nếu dòng kết thúc khi vẫn đang đốt
    if (inRun) {
      const x1 = startX + runStartCol * stepX;
      const x2 = startX + cols * stepX;
      lines.push(`G0 X${x1.toFixed(2)} Y${cncY.toFixed(2)}`);
      lines.push(`G1 X${x2.toFixed(2)} Y${cncY.toFixed(2)} F${feedRate}`);
    }
  }

  lines.push('M5 ; Tắt chùm tia laser sau khi quét xong đối tượng');

  return lines.join('\n');
}

/**
 * Chuyển đổi chuỗi văn bản (Text) thành ma trận điểm ảnh nhị phân để khắc quét Raster từng nét chữ
 * Hỗ trợ tự động ngắt dòng theo từ (word wrap) và xuống dòng (\n) để chữ lấp đầy khung hình chữ nhật
 */
export function generateTextBinaryMatrix(text, widthMm, heightMm, fontFamily = 'sans', dpi = 150) {
  if (!text || text.trim() === '') return null;
  const dotsPerMm = dpi / 25.4;
  let targetW = Math.round(widthMm * dotsPerMm);
  let targetH = Math.round(heightMm * dotsPerMm);

  const maxDimension = 600;
  if (targetW > maxDimension || targetH > maxDimension) {
    const scaleDown = maxDimension / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scaleDown);
    targetH = Math.round(targetH * scaleDown);
  }

  targetW = Math.max(20, targetW);
  targetH = Math.max(20, targetH);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Nền trắng (không đốt laser)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  let fontName = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (fontFamily === 'mono') fontName = '"JetBrains Mono", Consolas, monospace';
  else if (fontFamily === 'serif') fontName = 'Georgia, "Times New Roman", serif';

  const paragraphs = text.split(/\r?\n/);
  const maxWidth = targetW * 0.92;

  // Tìm kiếm fontSize và danh sách dòng phù hợp tối đa với khung chữ nhật
  let bestFontSize = Math.max(12, Math.floor(targetH * 0.7));
  let finalLines = [];

  for (let fSize = bestFontSize; fSize >= 8; fSize -= 2) {
    ctx.font = `bold ${fSize}px ${fontName}`;
    const candidateLines = [];

    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/);
      if (words.length <= 1) {
        candidateLines.push(para.trim());
        continue;
      }

      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        if (ctx.measureText(testLine).width <= maxWidth) {
          currentLine = testLine;
        } else {
          candidateLines.push(currentLine);
          currentLine = words[i];
        }
      }
      if (currentLine) candidateLines.push(currentLine);
    }

    const lineHeight = fSize * 1.25;
    const totalH = candidateLines.length * lineHeight;
    const allFitW = candidateLines.every((l) => ctx.measureText(l).width <= maxWidth);

    if (allFitW && totalH <= targetH * 0.95) {
      bestFontSize = fSize;
      finalLines = candidateLines;
      break;
    }
  }

  if (finalLines.length === 0) {
    finalLines = [text];
    bestFontSize = Math.max(8, Math.floor(targetH * 0.4));
  }

  ctx.font = `bold ${bestFontSize}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';

  const lineHeight = bestFontSize * 1.25;
  const totalH = finalLines.length * lineHeight;
  const startY = (targetH - totalH) / 2 + lineHeight / 2;

  finalLines.forEach((line, idx) => {
    ctx.fillText(line, targetW / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;
  const binaryMatrix = [];

  for (let y = 0; y < targetH; y++) {
    const row = [];
    for (let x = 0; x < targetW; x++) {
      const idx = (y * targetW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 64) {
        row.push(0);
        continue;
      }

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // Pixel nét chữ sẫm màu -> Đốt laser (1), nền trắng -> Tắt (0)
      row.push(gray < 180 ? 1 : 0);
    }
    binaryMatrix.push(row);
  }

  return binaryMatrix;
}

/**
 * Tính khoảng cách vuông góc từ điểm p đến đoạn thẳng (p1, p2)
 */
function perpendicularDistance(p, p1, p2) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p[0] - p1[0], p[1] - p1[1]);
  return Math.abs(dy * p[0] - dx * p[1] + p2[0] * p1[1] - p2[1] * p1[0]) / mag;
}

/**
 * Thuật toán Ramer-Douglas-Peucker làm mượt polyline
 */
function ramerDouglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const rec1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, -1).concat(rec2);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Rút gọn chu trình vector khép kín:
 * 1. Khử các điểm collinear thẳng hàng
 * 2. Làm mượt bậc thang pixel bằng Ramer-Douglas-Peucker (tách tại điểm xa nhất để bảo toàn vòng lặp)
 */
function simplifyClosedLoop(loop, epsilon = 0.65) {
  if (loop.length <= 3) return loop;

  // 1. Khử các điểm collinear thẳng hàng
  const decollinear = [loop[0]];
  for (let i = 1; i < loop.length - 1; i++) {
    const prev = decollinear[decollinear.length - 1];
    const curr = loop[i];
    const next = loop[i + 1];
    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    if (dx1 * dy2 !== dy1 * dx2) {
      decollinear.push(curr);
    }
  }
  decollinear.push(loop[loop.length - 1]);

  if (decollinear.length <= 4) return decollinear;

  // 2. Chạy RDP với vòng lặp khép kín
  const isClosed = (decollinear[0][0] === decollinear[decollinear.length - 1][0] && 
                    decollinear[0][1] === decollinear[decollinear.length - 1][1]);
  if (isClosed) {
    let maxDist = 0;
    let splitIdx = Math.floor(decollinear.length / 2);
    for (let i = 1; i < decollinear.length - 1; i++) {
      const dist = Math.hypot(decollinear[i][0] - decollinear[0][0], decollinear[i][1] - decollinear[0][1]);
      if (dist > maxDist) {
        maxDist = dist;
        splitIdx = i;
      }
    }
    const part1 = ramerDouglasPeucker(decollinear.slice(0, splitIdx + 1), epsilon);
    const part2 = ramerDouglasPeucker(decollinear.slice(splitIdx), epsilon);
    return part1.slice(0, -1).concat(part2);
  } else {
    return ramerDouglasPeucker(decollinear, epsilon);
  }
}

/**
 * Sinh mã G-code Cắt viền Vector (Vector Contour Cut) chuẩn GRBL từ ma trận điểm ảnh nhị phân
 * Thuật toán tách biên cạnh có hướng (Directed Boundary Edge Tracing) & Khép kín chu vi (Closed Loops)
 * Hỗ trợ đồng thời cả đường viền ngoài (Outer Contours) và các lỗ rỗng bên trong (Inner Holes, ví dụ chữ O, A, B...)
 */
export function generateVectorContourGCode(
  binaryMatrix,
  startX,
  startY,
  widthMm,
  heightMm,
  feedRate = 1200,
  laserPower = 80,
  artworkName = 'vector_contour'
) {
  if (!binaryMatrix || binaryMatrix.length === 0 || !binaryMatrix[0] || binaryMatrix[0].length === 0) {
    return '';
  }

  const rows = binaryMatrix.length;
  const cols = binaryMatrix[0].length;
  const S_val = Math.round((laserPower / 100) * 1000);

  // 1. Thu thập tất cả các cạnh biên có hướng theo chiều kim đồng hồ quanh pixel 1
  const adj = new Map();

  function addEdge(x1, y1, x2, y2) {
    const key = `${x1},${y1}`;
    if (!adj.has(key)) adj.set(key, []);
    adj.get(key).push([x2, y2]);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (binaryMatrix[r][c] === 1) {
        // Cạnh trên (hướng sang phải): nếu ô phía trên là 0 hoặc chạm biên trên
        if (r === 0 || binaryMatrix[r - 1][c] === 0) {
          addEdge(c, r, c + 1, r);
        }
        // Cạnh phải (hướng xuống dưới): nếu ô bên phải là 0 hoặc chạm biên phải
        if (c === cols - 1 || binaryMatrix[r][c + 1] === 0) {
          addEdge(c + 1, r, c + 1, r + 1);
        }
        // Cạnh dưới (hướng sang trái): nếu ô phía dưới là 0 hoặc chạm biên dưới
        if (r === rows - 1 || binaryMatrix[r + 1][c] === 0) {
          addEdge(c + 1, r + 1, c, r + 1);
        }
        // Cạnh trái (hướng lên trên): nếu ô bên trái là 0 hoặc chạm biên trái
        if (c === 0 || binaryMatrix[r][c - 1] === 0) {
          addEdge(c, r + 1, c, r);
        }
      }
    }
  }

  // 2. Lần theo các cạnh định hướng để tạo thành các chu trình khép kín (Eulerian loops)
  const rawLoops = [];

  for (const [startKey, edges] of adj.entries()) {
    while (edges.length > 0) {
      const startCoord = startKey.split(',').map(Number);
      const loop = [startCoord];
      let cur = edges.pop();

      let safety = 0;
      const maxSteps = (rows + 1) * (cols + 1) * 4;

      while (cur && safety++ < maxSteps) {
        loop.push(cur);
        if (cur[0] === startCoord[0] && cur[1] === startCoord[1]) {
          break; // Khép kín vòng chu trình
        }

        const nextKey = `${cur[0]},${cur[1]}`;
        const nextEdges = adj.get(nextKey);
        if (nextEdges && nextEdges.length > 0) {
          cur = nextEdges.pop();
        } else {
          break;
        }
      }

      if (loop.length >= 4) {
        rawLoops.push(loop);
      }
    }
  }

  if (rawLoops.length === 0) {
    return `; --- Không tìm thấy đường bao viền nào cho: ${artworkName} ---`;
  }

  const gcodeLines = [
    `; --- Bắt đầu Cắt viền Vector (Contour Cut): ${artworkName} ---`,
    `; Kích thước: ${widthMm.toFixed(2)} x ${heightMm.toFixed(2)} mm (${rawLoops.length} đường bao vector)`,
    `; Tốc độ cắt: F${feedRate} mm/min | Công suất: ${laserPower}% (S${S_val})`,
    `M5 ; Tắt tia laser trước khi di chuyển tới đường viền đầu tiên`
  ];

  let loopCount = 0;

  for (const rawLoop of rawLoops) {
    const loop = simplifyClosedLoop(rawLoop, 0.65);
    if (loop.length < 3) continue;

    // Chuyển đổi tọa độ pixel ma trận sang mm chuẩn CNC (Y0 là đáy bàn cắt, Ymax là đỉnh)
    const pts = loop.map(([c, r]) => ({
      x: +(startX + (c / cols) * widthMm).toFixed(2),
      y: +(startY + ((rows - r) / rows) * heightMm).toFixed(2)
    }));

    // Bỏ qua các đường thoái hóa thành điểm (chiều rộng và chiều cao bằng 0)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (maxX === minX && maxY === minY) continue;

    loopCount++;
    gcodeLines.push(`\n; --- Đường viền vector #${loopCount} (${pts.length} điểm) ---`);
    // 1. Chạy nhanh tới điểm bắt đầu đường viền (Laser tắt ở G0)
    gcodeLines.push(`G0 X${pts[0].x.toFixed(2)} Y${pts[0].y.toFixed(2)} F3000`);
    // 2. Bật laser công suất định mức để cắt (M3 S...)
    gcodeLines.push(`M3 S${S_val}`);
    // 3. Cắt theo viền đường dẫn G1
    gcodeLines.push(`G1 X${pts[1].x.toFixed(2)} Y${pts[1].y.toFixed(2)} F${feedRate}`);
    for (let i = 2; i < pts.length; i++) {
      gcodeLines.push(`G1 X${pts[i].x.toFixed(2)} Y${pts[i].y.toFixed(2)}`);
    }
    // 4. Tắt laser sau khi cắt xong vòng khép kín
    gcodeLines.push(`M5`);
  }

  gcodeLines.push(`; --- Hoàn tất ${loopCount} đường viền vector cho ${artworkName} ---`);
  return gcodeLines.join('\n');
}

