/**
 * Module tính toán quang học & nhiệt học chuẩn hóa cho Module Laser LM-C40
 * 
 * THÔNG SỐ PHẦN CỨNG THỰC TẾ:
 * - Model: LM-C40
 * - Công suất quang cực đại: P_MAX = 5.5 W (5500 mW)
 * - Bước sóng phát xạ: WAVELENGTH = 445 nm (0.445 um)
 * - Tiêu cự làm việc chuẩn: D0 = 40.0 mm
 * - Bán kính eo chùm tia tại tiêu điểm: W0 = 0.04 mm (Đường kính vết spot 0.08 mm)
 * - Độ sâu hội tụ hiệu dụng (Rayleigh range): ZR = 3.0 mm
 */

export const LM_C40_HARDWARE = {
  model: 'LM-C40',
  powerMaxW: 5.5,
  wavelengthNm: 445,
  focalDistanceMm: 40.0,
  spotRadiusMm: 0.04,    // 0.08mm spot diameter
  rayleighRangeMm: 3.0,  // effective Rayleigh range
  voltageV: 12,
  currentA: 1.8
};

export const MATERIAL_PROFILES = {
  wood: {
    id: 'wood',
    name: 'Gỗ (Plywood, Bồ đề, MDF)',
    icon: 'forest',
    minPowerDensity: 260, // W/mm² - Ngưỡng tối thiểu phân hủy nhiệt & hóa than
    recommendedBasePower: 650, // S650 (65%)
    recommendedBaseFeed: 2000, // 2000 mm/min
    factor: 1.0,
    note: 'Cần nhiệt độ ≥ 280°C để phân hủy nhiệt cellulose tạo vết khắc đen sắc nét.'
  },
  leather: {
    id: 'leather',
    name: 'Da thuộc tự nhiên & Simili',
    icon: 'inventory_2',
    minPowerDensity: 90, // W/mm² - Rất nhạy nhiệt
    recommendedBasePower: 350, // S350 (35%)
    recommendedBaseFeed: 3000, // 3000 mm/min
    factor: 0.7,
    note: 'Bắt cháy và đổi màu sẫm ở ~180°C. Cần công suất vừa phải để không bị cháy lem viền.'
  },
  acrylic: {
    id: 'acrylic',
    name: 'Nhựa Mica Acrylic (Đục / Đen)',
    icon: 'view_in_ar',
    minPowerDensity: 220, // W/mm² - Ngưỡng nóng chảy & bốc hơi
    recommendedBasePower: 450, // S450 (45%)
    recommendedBaseFeed: 2400, // 2400 mm/min
    factor: 0.9,
    note: 'Hấp thụ tốt ánh sáng 445nm ở Mica đen/đục. Lưu ý: Mica trong suốt sẽ xuyên quang 99%.'
  }
};

/**
 * Đánh giá nhiệt học và tính toán thông số đề xuất dựa trên khoảng cách đo được
 * 
 * @param {number} actualDistanceMm - Khoảng cách thực tế từ đầu laser đến phôi (mm)
 * @param {number} focalDistanceMm - Tiêu cự lấy nét chuẩn do người dùng cấu hình/đo được (mm)
 * @param {string} materialKey - 'wood' | 'leather' | 'acrylic'
 * @param {number} currentPower - Công suất PWM hiện tại (0 - 1000)
 * @param {number} currentFeed - Tốc độ Feedrate hiện tại (mm/phút)
 * @returns {object} Kết quả phân tích nhiệt và thông số đề xuất
 */
export function evaluateThermalFeasibility(
  actualDistanceMm = 30.0,
  focalDistanceMm = 30.0,
  materialKey = 'wood',
  currentPower = 650,
  currentFeed = 2000
) {
  const { rayleighRangeMm: ZR, powerMaxW: P_MAX, spotRadiusMm: W0 } = LM_C40_HARDWARE;
  const material = MATERIAL_PROFILES[materialKey] || MATERIAL_PROFILES.wood;

  const D0 = Math.max(1, parseFloat(focalDistanceMm) || 30.0);
  const d = Math.max(1, parseFloat(actualDistanceMm) || D0);
  const deltaZ = Math.abs(d - D0);

  // 1. Tính toán vết tia bị loe theo phương trình truyền chùm tia Gaussian
  const spotRadius = W0 * Math.sqrt(1 + Math.pow(deltaZ / ZR, 2));
  const spotDiameter = +(spotRadius * 2).toFixed(3);
  const spotAreaMm2 = Math.PI * Math.pow(spotRadius, 2);

  // 2. Mật độ công suất đỉnh ở 100% công suất (5.5W)
  const maxPowerDensity = Math.round(P_MAX / spotAreaMm2); // W/mm²

  // 3. Mật độ công suất ở mức phát hiện tại (currentPower)
  const actualPowerW = (Math.max(0, Math.min(1000, currentPower)) / 1000) * P_MAX;
  const currentPowerDensity = Math.round(actualPowerW / spotAreaMm2);

  // 4. Kiểm tra tính khả thi
  const isFeasible = maxPowerDensity >= material.minPowerDensity;

  // 5. Nếu không khả thi (ngay cả bật 100% 5.5W cũng không đủ nhiệt)
  if (!isFeasible) {
    return {
      d: +d.toFixed(1),
      d0: D0,
      deltaZ: +deltaZ.toFixed(1),
      spotDiameter,
      spotAreaMm2: +spotAreaMm2.toFixed(4),
      maxPowerDensity,
      currentPowerDensity,
      material,
      isFeasible: false,
      status: 'infeasible',
      badgeText: '🔴 BẤT KHẢ THI (Không đủ nhiệt năng)',
      message: `Khoảng cách ${d.toFixed(1)}mm bị lệch ${deltaZ.toFixed(1)}mm so với tiêu cự lấy nét ${D0.toFixed(1)}mm làm tia loe quá to (${spotDiameter}mm). Mật độ cực đại chỉ đạt ${maxPowerDensity} W/mm² (dưới ngưỡng ${material.minPowerDensity} W/mm² của ${material.name}). Laser 5.5W bật 100% cũng không đủ nhiệt để khắc!`,
      recommendation: `Vui lòng nới lỏng núm xoay bên hông đầu khắc để nâng/hạ hoặc đổi đế kê đưa khoảng cách về gần tiêu cự ${D0}mm.`,
      proposedPower: 1000,
      proposedPowerPercent: 100,
      proposedFeed: Math.max(200, Math.round(currentFeed * 0.4)),
      feedRateAdjusted: true
    };
  }

  // 6. Trường hợp khả thi -> Tính toán thông số đề xuất bù trừ
  const optimalSpotArea = Math.PI * Math.pow(W0, 2);
  const expansionRatio = spotAreaMm2 / optimalSpotArea;

  const baseP = currentPower > 0 ? currentPower : material.recommendedBasePower;
  const baseF = currentFeed > 0 ? currentFeed : material.recommendedBaseFeed;

  // Bù công suất theo tỷ lệ loe diện tích và hệ số vật liệu
  let proposedPower = Math.round(baseP * (1 + (expansionRatio - 1) * 0.35 * material.factor));
  let proposedFeed = baseF;
  let feedRateAdjusted = false;

  // Nếu công suất đề xuất vượt quá 100% (S > 1000) -> Khóa ở 1000 và giảm tốc độ để bù nhiệt
  if (proposedPower > 1000) {
    const overflow = proposedPower / 1000;
    proposedPower = 1000;
    proposedFeed = Math.max(200, Math.round(baseF / overflow));
    feedRateAdjusted = true;
  }

  // Đánh giá trạng thái
  let status = 'optimal';
  let badgeText = '🟢 ĐÚNG TIÊU ĐIỂM (Khả thi 100%)';
  let message = `Khoảng cách ${d.toFixed(1)}mm trùng khớp với tiêu cự lấy nét ${D0.toFixed(1)}mm. Vết tia siêu mịn (${spotDiameter}mm), mật độ nhiệt đạt ${maxPowerDensity} W/mm². Nét khắc sẽ rất sắc sảo và sạch mép!`;

  if (deltaZ > 1.5) {
    status = 'marginal';
    badgeText = `🟡 LỆCH TIÊU CỰ ${deltaZ.toFixed(1)}mm (Tự động bù nhiệt)`;
    message = `Khoảng cách ${d.toFixed(1)}mm lệch ${deltaZ.toFixed(1)}mm so với tiêu cự lấy nét ${D0.toFixed(1)}mm. Vết tia loe nhẹ thành ${spotDiameter}mm. Hệ thống đề xuất bù công suất lên ${Math.round(proposedPower / 10)}% ${feedRateAdjusted ? `và giảm tốc độ còn ${proposedFeed} mm/phút` : ''} để đảm bảo độ ăn sâu đồng đều.`;
  }

  return {
    d: +d.toFixed(1),
    d0: D0,
    deltaZ: +deltaZ.toFixed(1),
    spotDiameter,
    spotAreaMm2: +spotAreaMm2.toFixed(4),
    maxPowerDensity,
    currentPowerDensity,
    material,
    isFeasible: true,
    status,
    badgeText,
    message,
    recommendation: deltaZ <= 2 
      ? 'Có thể bắt đầu khắc ngay với chất lượng cao nhất.' 
      : 'Chấp nhận thông số đề xuất bên dưới để bù trừ độ loe của tia laser.',
    proposedPower,
    proposedPowerPercent: Math.round(proposedPower / 10),
    proposedFeed,
    feedRateAdjusted
  };
}
