# WARP.md

Tệp này cung cấp hướng dẫn cho WARP (warp.dev) khi làm việc với mã nguồn trong repository này.

## Tổng quan dự án

**LS2** là ứng dụng di động React Native được xây dựng với Expo để giám sát nguy cơ sạt lở đất theo thời gian thực. Ứng dụng hiển thị đánh giá rủi ro dựa trên dữ liệu cảm biến (độ ẩm đất, độ dốc, lượng mưa, rung động nền), cung cấp dự báo và gửi thông báo đẩy khi ngưỡng rủi ro bị vượt quá. Giao diện bằng tiếng Việt và bao gồm cả bảng điều khiển giám sát rủi ro và chế độ xem bản đồ.

## Các lệnh phát triển

### Khởi động phát triển
```bash
npx expo start
```
Mở Metro bundler với các tùy chọn chạy trên iOS simulator, Android emulator hoặc Expo Go.

### Build theo nền tảng
```bash
# Chạy trên iOS (yêu cầu Mac với Xcode)
npm run ios

# Chạy trên Android (yêu cầu Android Studio)
npm run android

# Chạy trên web
npm run web
```

### Linting
```bash
npm run lint
```
Chạy ESLint với cấu hình của Expo.

### EAS Build (Production)
Dự án sử dụng Expo Application Services (EAS) để build production. Cấu hình trong `eas.json`:
```bash
# Build cho iOS simulator (development build với simulator: true)
eas build --profile ios-simulator --platform ios

# Build cho preview (phân phối nội bộ, không phải development client)
eas build --profile preview

# Build cho production (tự động tăng version)
eas build --profile production

# Build development (có dev client, phân phối nội bộ)
eas build --profile development
```

**EAS Build Profiles:**
- `development`: Development client với internal distribution, channel "development"
- `ios-simulator`: Extends development, đặc biệt cho iOS simulator
- `preview`: Internal distribution, channel "preview", không phải dev client
- `production`: Auto-increment version, channel "production", cho App Store/Play Store

## Kiến trúc

### Routing
Ứng dụng sử dụng **Expo Router** với routing dựa trên file và native tabs:
- `app/_layout.tsx`: Layout gốc bọc toàn bộ app với SettingsProvider và định nghĩa Stack navigator
- `app/(tabs)/_layout.tsx`: Layout cho tab navigation với NativeTabs (unstable API)
- `app/(tabs)/index.tsx`: Màn hình giám sát rủi ro chính (tab trang chủ)
- `app/(tabs)/screen.tsx`: Màn hình bản đồ hiển thị dữ liệu sạt lở qua WebView
- `app/settings.tsx`: Màn hình cài đặt (modal/stack screen)

**Thêm màn hình mới:**
- Để thêm tab mới: tạo file trong `app/(tabs)/` và thêm `NativeTabs.Trigger` vào `_layout.tsx`
- Để thêm modal/stack screen: tạo file trong `app/` và thêm `Stack.Screen` vào `app/_layout.tsx`

### Luồng dữ liệu
- **Dữ liệu cảm biến tĩnh**: Tải từ `assets/data/global.json` chứa metadata trạm và số đo cảm biến
- **Cấu hình**: `assets/data/local.json` lưu trữ tùy chọn người dùng (ngôn ngữ, theme, thông báo)
- **Dữ liệu thời gian thực**: Sử dụng cảm biến thiết bị (accelerometer) và dịch vụ vị trí để xác thực ground truth
- **Thông báo**: Triển khai cả Expo Push Notifications và thông báo cục bộ

### Quản lý state
**SettingsProvider** (`providers/settings-context.tsx`):
- Context provider toàn cục quản lý cài đặt người dùng (ngôn ngữ, theme, thông báo)
- Tự động đồng bộ với localStorage (khi có)
- Sử dụng hook `useSettings()` để truy cập và cập nhật settings
- Cấu trúc: `{ id, lang, mode, notifications }`
- Mặc định load từ `assets/data/local.json`, sau đó override bằng localStorage

### Thư viện tiện ích
**`lib/copy.ts`**: Hệ thống đa ngôn ngữ (i18n)
- Chứa tất cả chuỗi UI cho tiếng Việt ("vi") và English ("en")
- Sử dụng `getCopy(lang)` để lấy bản sao theo ngôn ngữ
- Chia thành các namespace: `common`, `home`, `settings`, `map`
- Hỗ trợ cả chuỗi tĩnh và hàm format động (ví dụ: `updatedAt(time)`, `forecastAhead(hours)`)
- Để thêm ngôn ngữ mới: thêm key mới vào `COPY` object và cập nhật type `Lang`

**`lib/theme.ts`**: Hệ thống theme
- Định nghĩa `lightTheme` và `darkTheme` với palette đầy đủ
- Sử dụng `getTheme(mode)` để lấy theme hiện tại
- Palette gồm: background, card, border, text, subtext, icon, accent, danger, track, statusBar
- Tạo styles động theo theme trong component: `useMemo(() => createStyles(theme), [theme])`

### Các thành phần & logic chính

#### Tính toán rủi ro (app/(tabs)/index.tsx)
Thuật toán đánh giá rủi ro cân nhắc bốn yếu tố:
- **Độ ẩm đất** (trọng số 32%): Rủi ro cao khi gần bão hòa (60-100%)
- **Độ dốc** (trọng số 31%): Nguy hiểm ở 25-45 độ
- **Lượng mưa 24h** (trọng số 22%): Ngưỡng cảnh báo ở 80-200mm
- **Rung động nền** (trọng số 15%): Rủi ro hoạt động địa chấn ở 4-6.5 Richter

Điểm xác suất cuối cùng xác định các băng rủi ro:
- **Ổn định**: < 28%
- **Cảnh giác**: 28-45%
- **Tăng cao**: 45-65%
- **Cao**: 65-80%
- **Nguy hiểm**: ≥ 80%

#### Xác thực Ground Truth
Ứng dụng bao gồm chế độ xác minh thực địa 5 phút:
1. Ghi dữ liệu accelerometer (khoảng 100ms) để đo rung động nền
2. Theo dõi tọa độ GPS mỗi 2 giây
3. Tính điểm tin cậy ground truth (0-100%) dựa trên độ ổn định rung động
4. Yêu cầu cả quyền vị trí và mạng

#### Thông báo đẩy
Thông báo được kích hoạt khi:
- Người dùng trong phạm vi 100m của trạm giám sát (`PROXIMITY_THRESHOLD_METERS`)
- Xác suất rủi ro vượt quá 70% (`PUSH_RISK_THRESHOLD`)
- Yêu cầu đăng ký Expo push token (tự động xử lý trên thiết bị thật)

### Tích hợp bản đồ
`app/screen.tsx` nhúng bản đồ giám sát sạt lở Việt Nam (https://luquetsatlo.nchmf.gov.vn/) qua WebView với xử lý lỗi toàn diện.

## Các file cấu hình

### TypeScript
Dự án sử dụng TypeScript strict với path aliases:
- `@/*` ánh xạ tới thư mục gốc dự án (cấu hình trong `tsconfig.json`)

### Cấu hình Expo
Các thiết lập chính trong `app.json`:
- **Bundle identifiers**: iOS: `com.7ncvz.LS2`, Slug: `LS2`
- **EAS Project ID**: `bb189af9-89bd-4799-b53d-8204acfd6b43`
- **React Compiler**: Đã bật (`reactCompiler: true`)
- **New Architecture**: Đã bật (`newArchEnabled: true`)
- **Plugins**: expo-router, expo-splash-screen, expo-notifications

## Làm việc với dữ liệu cảm biến

### Điều chỉnh ngưỡng rủi ro
Cập nhật các hằng số trong `app/index.tsx`:
- `WEIGHTS`: Điều chỉnh trọng số yếu tố (tổng phải bằng 1.0)
- `METRIC_CONFIG`: Thay đổi phạm vi cảm biến và định dạng hiển thị
- `PROXIMITY_THRESHOLD_METERS`: Ngưỡng khoảng cách cho cảnh báo gần
- `PUSH_RISK_THRESHOLD`: Mức rủi ro kích hoạt thông báo
- `FORECAST_HOURS`: Khung thời gian dự báo

### Cập nhật dữ liệu cảm biến
Chỉnh sửa `assets/data/global.json`:
- `ten`: Tên trạm
- `id`: Mã định danh trạm
- `dia_diem`: (tùy chọn) chuỗi truy vấn địa điểm để geocode nếu thiếu tọa độ, ví dụ `"Lao Cai, VN"`
- `toa_do`: Tọa độ {x: lat, y: lon}
- `do_am_dat`: Độ ẩm đất (%)
- `do_doc`: Độ dốc (độ)
- `do_rung_dat`: Rung động nền (cm/s²)
- `mua_24h`: Lượng mưa 24 giờ (mm)
- `khoang_cach`: Khoảng cách từ thiết bị đến trạm (mét)

### Tích hợp OpenWeatherMap (lượng mưa 24h)
- Đặt API key vào biến môi trường `EXPO_PUBLIC_OPENWEATHER_API_KEY` (hoặc thêm `extra.openWeatherApiKey` trong `app.json`).
- Ứng dụng tự động lấy lượng mưa 24h theo tọa độ trong `assets/data/global.json` và ghi đè `mua_24h` cục bộ khi tải thành công.
- App dùng API 2.5: ưu tiên `forecast` 3h để cộng dồn 24h (8 ô 3h), fallback `weather` hiện tại (rain 1h/3h, cho 0mm nếu không có `rain`); nếu cả hai không có dữ liệu mưa thì giữ giá trị tĩnh.
- API gọi một lần khi vào màn hình; log chỉ hiển thị phần `rain` để giảm nhiễu.
- Nếu thiếu tọa độ trạm, app sẽ geocode bằng OpenWeather Direct Geocoding (`/geo/1.0/direct`) dựa trên `dia_diem` hoặc `ten` rồi cập nhật tọa độ trước khi gọi mưa.

### Firebase (lưu trữ global + local)
- Cấu hình URL DB (Realtime Database) và token (tùy chọn) qua biến môi trường `EXPO_PUBLIC_FIREBASE_DB_URL`, `EXPO_PUBLIC_FIREBASE_AUTH_TOKEN` hoặc `app.json > extra.firebaseDbUrl` / `extra.firebaseAuthToken`. Nếu chỉ có `firebaseProjectId`, app tự sinh URL `https://<project>-default-rtdb.firebaseio.com`.
- App sẽ:
  - Đọc `global` từ Firebase (GET `global.json`) và dùng để thay thế `assets/data/global.json` khi có.
  - Đọc/ghi cài đặt + thông tin thiết bị tại `devices/<id>`; cài đặt cũng được lưu localStorage + AsyncStorage để tránh tạo ID mới mỗi lần mở app.
  - Nếu không cấu hình Firebase, app tự động fallback sang file tĩnh và localStorage, không báo lỗi.
- Ưu tiên cấu hình qua biến môi trường (`EXPO_PUBLIC_FIREBASE_*`). Xem `.env.example` để điền giá trị (không commit file `.env` chứa key thật).
- Nếu cần dùng SDK đầy đủ (initializeApp), lấy config qua các biến: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_DB_URL`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`.
- Firebase hiện dùng SDK Realtime Database; nếu SDK không khởi tạo (thiếu env hợp lệ) thì bỏ qua đồng bộ cloud.
- Nếu API trả hợp lệ nhưng không có trường `rain`, app ghi nhận mưa 0mm thay vì giữ giá trị cũ để tránh hiển thị sai.

### Cài đặt người dùng
Chỉnh sửa `assets/data/local.json`:
- `notifications`: Bật/tắt thông báo đẩy
- `lang`: Ngôn ngữ (hiện tại "vi" cho tiếng Việt)
- `mode`: Giao diện ("light" hoặc "dark")
- Khi app chạy lần đầu nếu `id` rỗng hoặc là placeholder `{id}`, app sẽ sinh UUID (dùng `crypto.randomUUID`/`getRandomValues`, fallback ngẫu nhiên) và lưu vào localStorage + Firebase `local.json`.
- App ghi nhận thông tin thiết bị (expo-device) và lưu dưới `devices/<id>.json` trên Firebase khi có cấu hình.

## Các thư viện phụ thuộc

### Framework cốt lõi
- React Native 0.81.5 với React 19.1.0
- Expo SDK ~54.0.25
- Expo Router ~6.0.15 (routing dựa trên file với native tabs)

### Tính năng thiết bị
- `expo-sensors`: Accelerometer để phát hiện rung động
- `expo-location`: Theo dõi GPS để xác minh thực địa
- `expo-notifications`: Hệ thống thông báo đẩy
- `expo-haptics`: Phản hồi xúc giác
- `expo-device`, `expo-cellular`: Trạng thái thiết bị và mạng

### Các thành phần UI
- `react-native-webview`: Để nhúng bản đồ
- `react-native-safe-area-context`: Xử lý vùng an toàn
- `@react-navigation/*`: Cơ sở hạ tầng điều hướng

## Ghi chú

- **Ngôn ngữ**: Tất cả chuỗi UI bằng tiếng Việt
- **Nền tảng mục tiêu**: iOS và Android (có thể xuất web nhưng thông báo bị hạn chế)
- **Quyền yêu cầu**: Vị trí (foreground), thông báo
- **Mạng**: Ứng dụng kiểm tra kết nối Wi-Fi/cellular trước các thao tác quan trọng
- **Testing**: Chưa cấu hình framework test; nên thêm Jest + Testing Library cho phát triển tương lai
