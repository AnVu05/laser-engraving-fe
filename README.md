<div align="center">

# ⚡ LaserGUI — Web Controller & Laser Studio

### Hệ thống Web Studio điều khiển máy khắc Laser 2 trục X-Y trực tiếp qua Web Serial API

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Web Serial API](https://img.shields.io/badge/Web_Serial_API-Enabled-00C853?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
[![GRBL](https://img.shields.io/badge/Firmware-GRBL_v1.1f-orange?style=for-the-badge&logo=arduino&logoColor=white)](https://github.com/gnea/grbl)
[![Author](https://img.shields.io/badge/Tác_giả-Vũ_Đình_Ân-blue?style=for-the-badge&logo=github)](https://github.com/AnVu05)
[![OJT](https://img.shields.io/badge/Đơn_vị_OJT-HYPERDATA_LAB-purple?style=for-the-badge)](https://github.com/AnVu05)
[![License](https://img.shields.io/badge/Giấy_phép-MIT-brightgreen?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <b>LaserGUI</b> là ứng dụng Web Single-Page Application (SPA) hiện đại được thiết kế để điều khiển, thiết kế và truyền phát mã G-code trực tiếp xuống máy khắc Laser CNC 2 trục từ trình duyệt Web thông qua <b>Web Serial API</b> mà không cần cài đặt phần mềm bên thứ ba như LightBurn hay LaserGRBL.
</p>

</div>

---

## 📸 Giao diện Ứng dụng Thực tế (Showcase)

### 1. Toàn cảnh Không gian làm việc Laser Studio (Workspace Overview)
Giao diện trực quan hóa bàn khắc 300 × 200 mm, bảng điều khiển thông số phát Laser PWM, hệ thống Jogging 4 hướng và thanh công cụ điều khiển thời gian thực:

![Laser Studio Workspace Overview](./docs/images/laser-studio-overview.png)

### 2. Thuật toán Xử lý ảnh Dithering Floyd-Steinberg trên Bàn cắt
Minh họa đưa ảnh bitmap (Tranh dân gian gà Đông Hồ) lên bàn khắc vật lý, xử lý ma trận điểm ảnh raster và định vị gốc phôi chuẩn xác:

![Dithering Canvas Preview](./docs/images/dithering-canvas-preview.png)

---

## 🌟 Tính Năng Nổi Bật (Key Features)

### 1. 🎨 Bàn Làm Việc 2D Canvas Studio Chuyên Nghiệp
- **Khổ cắt vật lý chuẩn hóa**: Khổ làm việc $300 \times 200\text{ mm}$ khớp với chuẩn cơ khí máy khắc Laser CNC (CNC Shield V3 / MKS DLC32).
- **Thước đo & Hệ tọa độ thời gian thực (WPos)**: Hiển thị tọa độ đầu laser chính xác từng $0.1\text{ mm}$, lưới kẻ ô millimeter hỗ trợ căn chỉnh phôi.
- **Đa dạng đối tượng thiết kế**:
  - Đối tượng hình học vector (Khung chữ nhật, Hình tròn/Ellipse).
  - Khắc chữ (Text Vector) tự động tính toán tỷ lệ.
  - Ảnh Bitmap (PNG, JPG, BMP) tự động tính toán kích thước tối ưu theo tỷ lệ gốc.
- **Công cụ điều hướng mạnh mẽ**: Phóng to/thu nhỏ (Zoom in/out), Vừa khung hình (Fit view), căn giữa và khóa tỷ lệ khung hình (Aspect Ratio Lock).

### 2. 🖼️ Thuật Toán Xử Lý Ảnh Số Chuyên Biệt Cho Khắc Laser Diode
- **Chuyển đổi Grayscale chuẩn ITU-R BT.601**: Áp dụng trọng số quang học chính xác ($Y = 0.299R + 0.587G + 0.114B$).
- **Khuếch tán sai số Floyd-Steinberg Dithering**: Phân phối sai số điểm ảnh sang 4 pixel lân cận theo ma trận $\frac{7}{16}, \frac{3}{16}, \frac{5}{16}, \frac{1}{16}$, triệt tiêu hiện tượng răng cưa và tạo chiều sâu sắc nét cho tranh khắc gỗ/da.
- **Tinh chỉnh ảnh thời gian thực**: Điều chỉnh độ tương phản (Contrast), độ sáng (Brightness) và chế độ đảo màu âm bản (Invert) phù hợp cho khắc bề mặt mica đen hoặc nhôm phủ sơn.

### 3. ⚡ Bộ Sinh Mã G-Code Chuẩn GRBL Laser Mode ($32=1)
- **Tương thích GRBL v1.1f Laser Mode**: Tự động chèn `$32=1`, đơn vị milimét `G21`, tọa độ tuyệt đối `G90`.
- **Điều chế xung công suất Laser PWM**: Điều khiển bật/tắt tia theo mã `M3 S[0..1000]` và `M5`, loại bỏ vệt cháy sém khi di chuyển không tải `G0`.
- **Trình mô phỏng đường chạy dao (Toolpath Visualizer)**: Hiển thị trực quan đường cắt laser G1 (màu đỏ) và đường di chuyển nhanh G0 (vàng ngắt nét), kiểm tra tràn vùng làm việc (Bounds Checker) và ước tính thời gian gia công.

### 4. 🔌 Kết Nối Trực Tiếp Qua Web Serial API & Chống Tràn Buffer
- **Giao tiếp cổng COM trực tiếp từ trình duyệt**: Kết nối phần cứng thông qua Web Serial API với tốc độ Baud rate tiêu chuẩn `115200`.
- **Thuật toán Call-and-Response chống tràn bộ đệm**: Kiểm soát dòng lệnh chờ phản hồi `ok` từ GRBL, giải quyết triệt để vấn đề tràn bộ đệm phần cứng giới hạn $127\text{ bytes}$ của vi điều khiển ATmega328P.
- **Bàn phím Jogging 4 hướng**: Di chuyển đầu khắc theo trục X±, Y± với bước nhảy linh hoạt ($0.1\text{ mm}$, $1\text{ mm}$, $10\text{ mm}$, $50\text{ mm}$).
- **Chạy khung thử (Framing Bounding Box)**: Quét viền ngoài phôi với công suất tia định vị cực yếu ($S5 - 0.5\%$) giúp người dùng căn phôi an toàn trước khi bấm khắc.
- **Dừng khẩn cấp (E-Stop)**: Ngắt phát tia laser ngay lập tức và dừng động cơ bước.

### 5. 🔬 Căn Chỉnh Tiêu Cự & Hiệu Chuẩn Nhiệt Quang Học (LM-C40)
- Tích hợp mô-đun tính toán vật lý quang học và mật độ năng lượng nhiệt dựa trên thông số thực tế của đầu khắc **LM-C40 5.5W**:
  - Tiêu cự làm việc chuẩn: $D_0 = 40.0\text{ mm}$
  - Bán kính eo chùm tia tại tiêu điểm: $W_0 = 0.04\text{ mm}$ (Đường kính spot $0.08\text{ mm}$)
  - Vùng hội tụ hiệu dụng (Rayleigh Range): $Z_R = 3.0\text{ mm}$
- Tự động cảnh báo suy giảm quang thông và đề xuất bù công suất khi khoảng cách lấy nét bị lệch.

### 6. 📚 Thư Viện Vật Liệu Mẫu Chuẩn Hệ Thống (Material Presets)
Tích hợp sẵn thông số tốc độ (Feed Rate), công suất (PWM Power), số lượt cắt (Passes) và độ phân giải (DPI) tối ưu cho 6 loại vật liệu phổ biến:
- 🌲 **Gỗ ép Plywood (3mm)**: Cắt vector $350\text{ mm/min} - 100\%$, Khắc $2000\text{ mm/min} - 65\%$.
- 💎 **Mica Acrylic trong suốt (2.5mm)**: Cắt mép bóng gương $250\text{ mm/min} - 95\%$.
- 👜 **Da thuộc tự nhiên & Simili**: Khắc sắc nét chống cháy viền $3200\text{ mm/min} - 30\%$.
- 🪵 **Gỗ công nghiệp MDF (3mm)**: Bề mặt phẳng mịn, khắc logo tương phản cao $1800\text{ mm/min} - 70\%$.
- 📦 **Bìa Carton cứng & Giấy Kraft**: Tốc độ cắt cao $1200\text{ mm/min} - 60\%$.
- 🛡️ **Nhôm sơn tĩnh điện / Anodized**: Khắc bóc lớp oxit màu $1600\text{ mm/min} - 85\%$.

### 7. 🔐 Bảo Mật & Đồng Bộ Cloud CSDL
- **Xác thực bảo mật**: Quản lý phiên đăng nhập qua **HttpOnly Cookie** (ngăn chặn tấn công XSS) kết hợp đăng ký xác thực qua Gmail OTP 6 số.
- **Lưu trữ đám mây**: Tự động đồng bộ và nạp lại cấu hình dự án, bàn khắc và lịch sử tạo mã G-code trên CSDL Microsoft SQL Server thông qua Spring Boot Backend.

---

## 🛠️ Ngăn Xếp Công Nghệ (Tech Stack)

| Lớp (Layer) | Công nghệ / Thư viện sử dụng | Mục đích chính |
| :--- | :--- | :--- |
| **Framework** | **React 18** | Quản lý Component trạng thái và giao diện người dùng |
| **Build Tool** | **Vite 8** | Trình đóng gói siêu tốc với Hot Module Replacement (HMR) |
| **Hardware I/O** | **Web Serial API** | Giao tiếp nhị phân / ký tự với bo mạch điều khiển CNC qua USB |
| **Graphics** | **HTML5 Canvas 2D API** | Vẽ bàn cắt, hiển thị điểm ảnh Dithering & Toolpath G-Code |
| **Styling** | **Vanilla CSS + Laser Studio Design System** | Giao diện Cyber-Industrial sắc sảo, tối ưu hiệu năng hiển thị |
| **Icons** | **Google Material Symbols Outlined** | Bộ biểu tượng đồ họa công nghiệp hiện đại |
| **Backend Integration** | **Fetch API / RESTful API** | Tích hợp máy chủ Java 21 Spring Boot 3 (Project Loom) |

---

## 📁 Cấu Trúc Thư Mục Frontend

```text
src/frontend/laser-engraving/
├── docs/                               # Tài liệu & hình ảnh chụp giao diện
│   └── images/
│       ├── laser-studio-overview.png   # Ảnh chụp toàn cảnh màn hình làm việc
│       └── dithering-canvas-preview.png# Ảnh chụp chi tiết thuật toán Dithering
├── public/                             # Tài nguyên tĩnh (favicon.svg, icons.svg)
├── src/
│   ├── assets/                         # Vector & tài nguyên ảnh giao diện
│   ├── components/                     # Các thành phần giao diện chính
│   │   ├── App.jsx                     # Component trung tâm điều phối toàn bộ State
│   │   ├── Header.jsx                  # Thanh tiêu đề, trạng thái kết nối & Auth
│   │   ├── ToolRail.jsx                # Thanh công cụ bên trái (Chọn, Hình học, Text, Ảnh)
│   │   ├── LaserCanvas.jsx             # Bàn làm việc Canvas 2D 300x200mm
│   │   ├── ParameterPanel.jsx          # Cấu hình Feed rate, PWM, Gia tốc, DPI, Dithering
│   │   ├── BottomDock.jsx              # Cụm điều khiển Jogging X/Y, Khung thử, Bắt đầu, Dừng
│   │   ├── GCodeModal.jsx              # Xem trước G-code & mô phỏng Toolpath chạy dao
│   │   ├── ConsoleModal.jsx            # Cửa sổ dòng lệnh Terminal GRBL Serial trực tiếp
│   │   ├── HistoryModal.jsx            # Quản lý lịch sử gia công và tải file .NC
│   │   ├── ProjectsModal.jsx           # Quản lý & nạp lại các dự án đã lưu
│   │   ├── NewProjectModal.jsx         # Tạo dự án mới cho người dùng hoặc khách vãn lai
│   │   ├── LaserParametersView.jsx     # Thư viện quản lý vật liệu mẫu (Material Presets)
│   │   ├── FocusCalibrationModal.jsx   # Căn chỉnh tiêu cự & hiệu chuẩn nhiệt quang học
│   │   └── AuthModal.jsx               # Đăng nhập, Đăng ký Gmail OTP, Google OAuth
│   ├── services/                       # Tầng kết nối REST API với Spring Boot
│   │   ├── authApi.js                  # Xác thực, đăng ký OTP, HttpOnly Cookie session
│   │   ├── gcodeApi.js                 # Yêu cầu sinh mã G-code từ Backend
│   │   ├── historyApi.js               # Lưu và truy vấn lịch sử gia công
│   │   ├── materialApi.js              # Quản lý danh mục vật liệu mẫu
│   │   ├── projectApi.js               # Lưu trữ và nạp dữ liệu bàn khắc dự án
│   │   └── settingsApi.js              # Đồng bộ cấu hình tham số máy laser
│   ├── utils/                          # Bộ tiện ích thuật toán chuyên sâu
│   │   ├── grblSerialDriver.js         # Trình điều khiển Web Serial, Buffer 127 bytes
│   │   ├── laserImageProcessor.js      # Grayscale ITU-R BT.601, Floyd-Steinberg Dithering
│   │   └── laserThermalCalibrator.js   # Mô hình tính toán tiêu cự & nhiệt quang học LM-C40
│   ├── App.css                         # Bộ phong cách Laser Studio Design System
│   ├── index.css                       # Reset CSS & biến màu hệ thống
│   └── main.jsx                        # Điểm khởi động ứng dụng React
├── index.html                          # Trang HTML gốc
├── package.json                        # Khai báo phụ thuộc và kịch bản chạy
└── vite.config.js                      # Cấu hình Vite
```

---

## 💻 Yêu Cầu Phần Cứng & Trình Duyệt

### 1. Trình duyệt Web hỗ trợ Web Serial API
Để ứng dụng có thể kết nối trực tiếp với cổng USB COM của máy khắc laser, bạn cần sử dụng các trình duyệt hỗ trợ Web Serial API trên máy tính:
- ✅ **Google Chrome** (Phiên bản 89 trở lên)
- ✅ **Microsoft Edge** (Phiên bản 89 trở lên)
- ✅ **Opera** (Phiên bản 75 trở lên)
- ⚠️ *Lưu ý: Firefox và Safari hiện chưa kích hoạt mặc định chuẩn Web Serial API.*

### 2. Phần cứng Máy Khắc Laser
- **Bo mạch điều khiển**: Arduino Nano + CNC Shield V3 hoặc bo mạch 32-bit Makerbase MKS DLC32 / ESP32.
- **Firmware**: **GRBL v1.1f** trở lên (Đã cấu hình Laser Mode `$32=1`).
- **Module phát Laser**: Laser Diode 445nm công suất quang $5.5\text{ W}$ (Ví dụ: Laser Tree LM-C40) điều chế PWM qua chân Spindle (D11/Pin PWM).
- **Cáp kết nối**: Cáp USB truyền dữ liệu chống nhiễu kết nối máy tính với bo điều khiển.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Quick Start)

### 1. Yêu cầu môi trường
- Đã cài đặt **Node.js** (Khuyến nghị phiên bản `>= 18.x` hoặc `20.x LTS`).
- Trình quản lý gói **npm** hoặc **yarn** / **pnpm**.

### 2. Các bước khởi chạy

```bash
# 1. Di chuyển vào thư mục dự án frontend
cd src/frontend/laser-engraving

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ phát triển (Development Server)
npm run dev
```

Mở trình duyệt Web và truy cập vào địa chỉ:
```text
http://localhost:5173/
```

### 3. Đóng gói cho môi trường Production

```bash
npm run build
```
Mã nguồn sau khi tối ưu hóa sẽ được lưu trữ trong thư mục `dist/`, sẵn sàng đưa lên các máy chủ web như Nginx, Vercel hoặc Spring Boot Static Resource.

---

## 👨‍💻 Thông Tin Tác Giả & Đơn Vị Phát Triển

- **Tác giả phát triển**: **Vũ Đình Ân**
- **GitHub**: [@AnVu05](https://github.com/AnVu05)
- **Đơn vị OJT / Nghiên cứu**: **HYPERDATA LAB**
- **Dự án**: Nghiên cứu & Chế tạo Ứng dụng Web Điều khiển Máy Khắc Laser CNC phục vụ đồ án OJT.

---

## 📄 Giấy Phép (License)

Dự án được phân phối dưới giấy phép **MIT License**. Bạn được tự do sử dụng, chỉnh sửa và tích hợp cho mục đích học tập và nghiên cứu. Chi tiết xem tại tệp `LICENSE`.

<div align="center">
  <sub>Xây dựng với niềm đam mê cơ điện tử và công nghệ Web hiện đại 🚀</sub>
</div>
