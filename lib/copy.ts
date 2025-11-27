export type RiskBandKey = "stable" | "caution" | "elevated" | "high" | "danger";

type Lang = "vi" | "en";

export type Copy = {
  common: {
    back: string;
    riskBands: Record<RiskBandKey, string>;
    connectivity: {
      needTitle: string;
      needBody: string;
      offline: string;
      online: string;
      checking: string;
    };
    proximityTitle: string;
    proximityBody: (distance: string, threshold: number) => string;
    locationPermissionTitle: string;
    locationPermissionBody: string;
    pushTitle: string;
    pushBody: (probability: number, site: string, distance: string) => string;
    pushErrors: {
      deviceRequired: string;
      permissionMissing: string;
      projectIdMissing: string;
      tokenFailed: (error: unknown) => string;
    };
    lastNotificationFallback: string;
    stationNameFallback: string;
    stationIdFallback: string;
    coordinatesFallback: string;
    calculating: string;
    noticeTitle: string;
  };
  home: {
    heroTitle: string;
    updatedAt: (time: string) => string;
    quickSummaryTitle: string;
    fieldCheckTitle: string;
    shortForecastTitle: string;
    sensorsTitle: string;
    guidanceTitle: string;
    quickStats: {
      distance: string;
      sensorConfidence: string;
      connectivity: string;
      dominant: string;
      siteId: string;
      coords: string;
      lastNotification: string;
    };
    ground: {
      statusReady: string;
      statusRecording: string;
      trustLabel: string;
      trustNone: string;
      trustWorking: string;
      pointsLabel: string;
      pointsNone: string;
      pointsWorking: string;
      pointsCount: (count: number) => string;
      connectionLabel: string;
      buttonStart: string;
      buttonStop: string;
    };
    forecastAhead: (hours: number) => string;
    metrics: {
      soilMoisture: string;
      slopeAngle: string;
      rainfall24h: string;
      groundVibration: string;
    };
    mitigation: {
      extreme: string[];
      high: string[];
      medium: string[];
      low: string[];
    };
  };
  settings: {
    title: string;
    subtitle: string;
    notificationsTitle: string;
    notificationsHint: string;
    riskAlertsTitle: string;
    riskAlertsHint: string;
    appearanceTitle: string;
    appearanceHint: string;
    languageTitle: string;
    languageHint: string;
    deviceInfoTitle: string;
    deviceInfoHint: string;
    deviceIdLabel: string;
    resetLabel: string;
    resetAlertTitle: string;
    resetAlertBody: string;
    modeLight: string;
    modeDark: string;
    languages: { code: Lang; label: string }[];
  };
  map: {
    loading: string;
    progress: (percent: number) => string;
    loaded: string;
    ready: string;
    errorTitle: string;
    errorMessage: string;
    httpError: (status: number, url: string) => string;
  };
};

const COPY: Record<Lang, Copy> = {
  vi: {
    common: {
      back: "Quay lại",
      riskBands: {
        stable: "Ổn định",
        caution: "Cảnh giác",
        elevated: "Tăng cao",
        high: "Cao",
        danger: "Nguy hiểm",
      },
      connectivity: {
        needTitle: "Cần kết nối",
        needBody: "Bật Wi-Fi hoặc dữ liệu di động để tiếp tục kiểm tra.",
        offline: "Không có Wi-Fi/4G",
        online: "Đã bật Wi-Fi/4G",
        checking: "Đang kiểm tra kết nối...",
      },
      proximityTitle: "Cảnh báo khoảng cách",
      proximityBody: (distance, threshold) =>
        `Thiết bị đang cách trạm ${distance} (<= ${threshold}m).`,
      locationPermissionTitle: "Thiếu quyền vị trí",
      locationPermissionBody: "Cấp quyền vị trí để ghi vết tại hiện trường.",
      pushTitle: "Cảnh báo sạt lở cao",
      pushBody: (probability, site, distance) =>
        `Nguy cơ ${probability}% tại ${site}. Khoảng cách: ${distance}.`,
      pushErrors: {
        deviceRequired: "Cần thiết bị thật để nhận thông báo đẩy.",
        permissionMissing: "Chưa được cấp quyền nhận thông báo.",
        projectIdMissing: "Thiếu projectId để lấy push token.",
        tokenFailed: (error: unknown) => `Không thể lấy push token: ${error}`,
      },
      lastNotificationFallback: "Chưa nhận thông báo",
      stationNameFallback: "Trạm giám sát",
      stationIdFallback: "Không có mã trạm",
      coordinatesFallback: "Chưa có tọa độ",
      calculating: "Đang tính toán",
      noticeTitle: "Thông báo",
    },
    home: {
      heroTitle: "Nguy cơ sạt lở",
      updatedAt: (time) => `Cập nhật ${time}`,
      quickSummaryTitle: "Tóm tắt nhanh",
      fieldCheckTitle: "Kiểm tra tại hiện trường",
      shortForecastTitle: "Dự báo ngắn hạn",
      sensorsTitle: "Cảm biến tại chỗ",
      guidanceTitle: "Hướng dẫn hành động",
      quickStats: {
        distance: "Khoảng cách tới trạm",
        sensorConfidence: "Độ tin cậy cảm biến",
        connectivity: "Kết nối",
        dominant: "Yếu tố chi phối",
        siteId: "Mã trạm",
        coords: "Tọa độ trạm",
        lastNotification: "Thông báo gần nhất",
      },
      ground: {
        statusReady: "Sẵn sàng kiểm tra tại hiện trường",
        statusRecording: "Đang ghi rung & GPS (5 phút)...",
        trustLabel: "Độ tin cậy trạm",
        trustNone: "Chưa có dữ liệu",
        trustWorking: "Đang tính...",
        pointsLabel: "Vị trí ghi",
        pointsNone: "Chưa ghi GPS",
        pointsWorking: "Đang ghi GPS...",
        pointsCount: (count: number) => `${count} điểm GPS`,
        connectionLabel: "Kết nối",
        buttonStart: "Bắt đầu kiểm tra 5 phút",
        buttonStop: "Dừng & lưu kiểm tra",
      },
      forecastAhead: (hours) => `+${hours} giờ`,
      metrics: {
        soilMoisture: "Độ ẩm đất",
        slopeAngle: "Độ dốc",
        rainfall24h: "Lượng mưa 24h",
        groundVibration: "Rung nền",
      },
      mitigation: {
        extreme: [
          "Sơ tán ngay các hộ dân trong vùng đỏ.",
          "Chặn đường qua sườn dốc, ưu tiên lực lượng ứng cứu.",
          "Bay flycam hoặc kiểm tra trực tiếp mỗi 15 phút.",
        ],
        high: [
          "Gửi cảnh báo tự động mỗi giờ.",
          "Mở rãnh thoát nước, dọn sạch vật cản.",
          "Giữ liên lạc với đội phản ứng nhanh tại điểm tập kết.",
        ],
        medium: [
          "Tuần tra tìm vết nứt mới trên sườn dốc.",
          "So sánh số liệu mưa với trạm địa phương.",
          "Kiểm tra thiết bị đo mưa trước nửa đêm.",
        ],
        low: [
          "Giám sát định kỳ mỗi 6 giờ.",
          "Thông tin trạng thái an toàn cho cộng đồng.",
          "Đồng bộ thiết bị sau mỗi đợt mưa nhỏ.",
        ],
      },
    },
    settings: {
      title: "Cài đặt",
      subtitle: "Điều chỉnh thông báo, giao diện và ngôn ngữ cho bảng điều khiển sạt lở.",
      notificationsTitle: "Thông báo",
      notificationsHint: "Nhận cảnh báo khi đến gần trạm hoặc rủi ro cao.",
      riskAlertsTitle: "Cảnh báo nguy cơ",
      riskAlertsHint: "Bật rung, thông báo đẩy và banner cảnh báo.",
      appearanceTitle: "Giao diện",
      appearanceHint: "Chọn tông màu phù hợp khi xem ngoài hiện trường.",
      languageTitle: "Ngôn ngữ",
      languageHint: "Thay đổi ngôn ngữ hiển thị của ứng dụng.",
      deviceInfoTitle: "Thông tin thiết bị",
      deviceInfoHint: "Dùng để đối chiếu khi gửi báo cáo.",
      deviceIdLabel: "Mã thiết bị",
      resetLabel: "Khôi phục mặc định",
      resetAlertTitle: "Đã đặt lại",
      resetAlertBody: "Khôi phục cài đặt theo cấu hình mặc định.",
      modeLight: "Sáng",
      modeDark: "Tối",
      languages: [
        { code: "vi", label: "Tiếng Việt" },
        { code: "en", label: "English" },
      ],
    },
    map: {
      loading: "Đang tải bản đồ...",
      progress: (percent) => `Đang tải ${percent}%`,
      loaded: "Bản đồ đã tải xong",
      ready: "Bản đồ sẵn sàng",
      errorTitle: "Lỗi tải bản đồ",
      errorMessage: "Không thể tải bản đồ",
      httpError: (status, url) => `Máy chủ trả về lỗi ${status} khi truy cập ${url}`,
    },
  },
  en: {
    common: {
      back: "Back",
      riskBands: {
        stable: "Stable",
        caution: "Watch",
        elevated: "Elevated",
        high: "High",
        danger: "Critical",
      },
      connectivity: {
        needTitle: "Connection needed",
        needBody: "Turn on Wi‑Fi or cellular data to continue.",
        offline: "No Wi‑Fi/cellular",
        online: "Wi‑Fi/cellular on",
        checking: "Checking network...",
      },
      proximityTitle: "Distance alert",
      proximityBody: (distance, threshold) =>
        `Device is ${distance} from the station (<= ${threshold}m).`,
      locationPermissionTitle: "Location permission missing",
      locationPermissionBody: "Allow location to record the on-site track.",
      pushTitle: "High landslide risk",
      pushBody: (probability, site, distance) =>
        `Risk ${probability}% at ${site}. Distance: ${distance}.`,
      pushErrors: {
        deviceRequired: "A real device is required to receive push notifications.",
        permissionMissing: "Notification permission not granted.",
        projectIdMissing: "Missing projectId to fetch push token.",
        tokenFailed: (error: unknown) => `Unable to fetch push token: ${error}`,
      },
      lastNotificationFallback: "No notifications yet",
      stationNameFallback: "Monitoring site",
      stationIdFallback: "No station ID",
      coordinatesFallback: "No coordinates",
      calculating: "Calculating",
      noticeTitle: "Notice",
    },
    home: {
      heroTitle: "Landslide risk",
      updatedAt: (time) => `Updated ${time}`,
      quickSummaryTitle: "Quick summary",
      fieldCheckTitle: "On-site check",
      shortForecastTitle: "Short-term forecast",
      sensorsTitle: "On-site sensors",
      guidanceTitle: "Action guidance",
      quickStats: {
        distance: "Distance to station",
        sensorConfidence: "Sensor confidence",
        connectivity: "Connectivity",
        dominant: "Dominant factor",
        siteId: "Station ID",
        coords: "Station coordinates",
        lastNotification: "Last notification",
      },
      ground: {
        statusReady: "Ready for field check",
        statusRecording: "Recording vibration & GPS (5 mins)...",
        trustLabel: "Station confidence",
        trustNone: "No data yet",
        trustWorking: "Calculating...",
        pointsLabel: "Logged points",
        pointsNone: "No GPS logged",
        pointsWorking: "Logging GPS...",
        pointsCount: (count: number) => `${count} GPS points`,
        connectionLabel: "Connectivity",
        buttonStart: "Start 5-min check",
        buttonStop: "Stop & save check",
      },
      forecastAhead: (hours) => `+${hours}h`,
      metrics: {
        soilMoisture: "Soil moisture",
        slopeAngle: "Slope angle",
        rainfall24h: "Rainfall 24h",
        groundVibration: "Ground vibration",
      },
      mitigation: {
        extreme: [
          "Evacuate households in the red zone immediately.",
          "Block access across the slope; prioritize rescue teams.",
          "Fly drone or inspect every 15 minutes.",
        ],
        high: [
          "Send automatic alerts every hour.",
          "Open drainage and clear obstructions.",
          "Stay in touch with rapid response team at the rally point.",
        ],
        medium: [
          "Patrol for new cracks on the slope.",
          "Compare rain totals with local stations.",
          "Check the rain gauge before midnight.",
        ],
        low: [
          "Monitor every 6 hours.",
          "Share safety status with the community.",
          "Sync devices after each light rain.",
        ],
      },
    },
    settings: {
      title: "Settings",
      subtitle: "Adjust alerts, appearance, and language for the landslide dashboard.",
      notificationsTitle: "Notifications",
      notificationsHint: "Get alerts when near the station or risk is high.",
      riskAlertsTitle: "Risk alerts",
      riskAlertsHint: "Enable vibration, push notifications, and warning banners.",
      appearanceTitle: "Appearance",
      appearanceHint: "Pick a tone that works outdoors.",
      languageTitle: "Language",
      languageHint: "Change the app display language.",
      deviceInfoTitle: "Device info",
      deviceInfoHint: "Used for reference when sending reports.",
      deviceIdLabel: "Device ID",
      resetLabel: "Reset to default",
      resetAlertTitle: "Reset",
      resetAlertBody: "Restored settings to defaults.",
      modeLight: "Light",
      modeDark: "Dark",
      languages: [
        { code: "vi", label: "Tiếng Việt" },
        { code: "en", label: "English" },
      ],
    },
    map: {
      loading: "Loading map...",
      progress: (percent) => `Loading ${percent}%`,
      loaded: "Map loaded",
      ready: "Map ready",
      errorTitle: "Map load error",
      errorMessage: "Unable to load the map",
      httpError: (status, url) => `Server returned ${status} for ${url}`,
    },
  },
};

export const getCopy = (lang: string): Copy => COPY[(lang as Lang) ?? "vi"] ?? COPY.vi;
