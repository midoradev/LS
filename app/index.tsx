import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Cellular from "expo-cellular";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";

type SensorSnapshot = {
  soilMoisture: number;
  slopeAngle: number;
  rainfall24h: number;
  groundVibration: number;
};

type RiskBand = "Ổn định" | "Cảnh giác" | "Tăng cao" | "Cao" | "Nguy hiểm";

type GlobalPayload = {
  ten?: string;
  id?: string;
  toa_do?: {
    x?: number;
    y?: number;
  };
  do_am_dat?: number;
  do_doc?: number;
  do_rung_dat?: number;
  mua_24h?: number;
  khoang_cach?: number;
};

type LocalConfig = {
  id?: string;
  lang?: string;
  mode?: "light" | "dark";
  notifications?: boolean;
};

const SERIOUSNESS_COLORS: Record<RiskBand, string> = {
  "Ổn định": "#15803d",
  "Cảnh giác": "#2563eb",
  "Tăng cao": "#b45309",
  Cao: "#f97316",
  "Nguy hiểm": "#dc2626",
};

const BAND_LABELS: Record<RiskBand, string> = {
  "Ổn định": "Ổn định",
  "Cảnh giác": "Cảnh giác",
  "Tăng cao": "Tăng cao",
  Cao: "Cao",
  "Nguy hiểm": "Nguy hiểm",
};

const METRIC_CONFIG: Record<
  keyof SensorSnapshot,
  { label: string; min: number; max: number; color: string; format: (value: number) => string }
> = {
  soilMoisture: {
    label: "Độ ẩm đất",
    min: 30,
    max: 95,
    color: "#15803d",
    format: (value) => `${value.toFixed(1)}%`,
  },
  slopeAngle: {
    label: "Độ dốc",
    min: 10,
    max: 55,
    color: "#2563eb",
    format: (value) => `${value.toFixed(1)}°`,
  },
  rainfall24h: {
    label: "Lượng mưa 24h",
    min: 20,
    max: 200,
    color: "#0f766e",
    format: (value) => `${value.toFixed(0)} mm`,
  },
  groundVibration: {
    label: "Rung nền",
    min: 0.05,
    max: 1.4,
    color: "#b45309",
    format: (value) => `${value.toFixed(2)} cm/s²`,
  },
};

const WEIGHTS: Record<keyof SensorSnapshot, number> = {
  soilMoisture: 0.32,
  slopeAngle: 0.31,
  rainfall24h: 0.22,
  groundVibration: 0.15,
};

const PROXIMITY_THRESHOLD_METERS = 100;
const FORECAST_HOURS = [1, 3, 6];
const PUSH_RISK_THRESHOLD = 0.7;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const riskFromRange = (value: number, startRisk: number, danger: number) =>
  clamp((value - startRisk) / (danger - startRisk), 0, 1);

const hasUsableLocalStorage = () =>
  typeof localStorage !== "undefined" && typeof localStorage.getItem === "function";

const describeBand = (score: number): RiskBand => {
  if (score >= 0.8) return "Nguy hiểm";
  if (score >= 0.65) return "Cao";
  if (score >= 0.45) return "Tăng cao";
  if (score >= 0.28) return "Cảnh giác";
  return "Ổn định";
};

const asNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && !Number.isNaN(value) ? value : fallback;

const createSnapshotFromData = (data: GlobalPayload): SensorSnapshot => ({
  soilMoisture: asNumber(data?.do_am_dat, 0),
  slopeAngle: asNumber(data?.do_doc, 0),
  rainfall24h: asNumber(data?.mua_24h, 0),
  groundVibration: asNumber(data?.do_rung_dat, 0),
});

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

const isBrowserOnline = () =>
  typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
    ? navigator.onLine
    : true;

const checkNetworkConnectivity = async () => {
  let hasCellular = false;
  try {
    const generation = await Cellular.getCellularGenerationAsync();
    hasCellular = generation !== null;
  } catch (error) {
    console.warn("Không kiểm tra được kết nối di động:", error);
  }

  const hasWifiOrAny = isBrowserOnline();
  return hasCellular || hasWifiOrAny;
};

const globalSite = require("../assets/data/global.json") as GlobalPayload;
const localConfig = require("../assets/data/local.json") as LocalConfig;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const handleRegistrationError = (message: string) => {
  Alert.alert("Thông báo", message);
  console.error(message);
};

const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (!Device.isDevice) {
    handleRegistrationError("Cần thiết bị thật để nhận thông báo đẩy.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    handleRegistrationError("Chưa được cấp quyền nhận thông báo.");
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    handleRegistrationError("Thiếu projectId để lấy push token.");
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    handleRegistrationError(`Không thể lấy push token: ${error}`);
    return null;
  }
};

const sendPushNotification = async (expoPushToken: string, title: string, body: string) => {
  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data: { type: "landslide_alert" },
  };

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.warn("Gửi thông báo thất bại:", error);
  }
};

const sendLocalNotification = async (title: string, body: string) => {
  if (Platform.OS === "web") {
    console.log("Bỏ qua thông báo cục bộ trên web/static.");
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("Không thể hiển thị thông báo cục bộ:", error);
  }
};

export default function IndexScreen() {
  const proximityNotified = useRef(false);
  const pushSentRef = useRef(false);
  const groundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensorSnapshot = useMemo(() => createSnapshotFromData(globalSite), []);
  const lastUpdated = useMemo(() => new Date(), []);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const notificationsEnabled = localConfig?.notifications !== false;
  const [connectivityOk, setConnectivityOk] = useState<boolean | null>(null);
  const [groundRunning, setGroundRunning] = useState(false);
  const [groundSamples, setGroundSamples] = useState<
    { ax: number; ay: number; az: number }[]
  >([]);
  const [groundPoints, setGroundPoints] = useState<{ lat: number; lon: number }[]>([]);
  const [groundTrust, setGroundTrust] = useState<number | null>(null);
  const [groundStatus, setGroundStatus] = useState("Sẵn sàng kiểm tra tại hiện trường");
  const lastNotificationLabel = useMemo(() => {
    if (!lastNotification) return "Chưa nhận thông báo";
    const title = lastNotification.request.content.title || "Thông báo mới";
    const timestamp =
      typeof lastNotification.date === "number"
        ? new Date(lastNotification.date).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
    return timestamp ? `${title} (${timestamp})` : title;
  }, [lastNotification]);

  const riskLevels = useMemo(() => {
    const doAm = sensorSnapshot.soilMoisture;
    const mua = sensorSnapshot.rainfall24h;
    const doc = sensorSnapshot.slopeAngle;
    const rung = sensorSnapshot.groundVibration;

    return {
      soilMoisture: riskFromRange(doAm, 60, 100), // nguy hiểm khi đất gần bão hòa
      rainfall24h: riskFromRange(mua, 80, 200), // cảnh báo từ 100-200mm/24h
      slopeAngle: riskFromRange(doc, 25, 45), // >30-45 độ rất dốc
      groundVibration: riskFromRange(rung, 4, 6.5), // rung chấn 4.5-5.0 Richter trở lên đáng kể
    };
  }, [sensorSnapshot]);

  const weightedScore = useMemo(
    () =>
      (Object.entries(WEIGHTS) as [keyof SensorSnapshot, number][]).reduce(
        (total, [key, weight]) => total + riskLevels[key] * weight,
        0
      ),
    [riskLevels]
  );

  const probability = useMemo(() => clamp(0.18 + weightedScore * 0.92, 0, 1), [weightedScore]);
  const probabilityPercent = Math.round(probability * 100);
  const band = describeBand(probability);
  const severityColor = SERIOUSNESS_COLORS[band];
  const sensorConfidence = Math.round(
    clamp(
      60 +
        15 * (1 - riskLevels.groundVibration) +
        10 * (1 - riskLevels.rainfall24h * 0.6) +
        15 * (1 - riskLevels.soilMoisture * 0.4),
      40,
      100
    )
  );

  const forecasts = useMemo(() => {
    return FORECAST_HOURS.map((hours) => {
      const rainfallPressure = riskLevels.rainfall24h * 0.18;
      const slopePressure = riskLevels.slopeAngle * 0.12;
      const saturationPush = riskLevels.soilMoisture * 0.1;
      const projected = clamp(
        probability + (hours / 6) * (rainfallPressure + slopePressure + saturationPush),
        0,
        1
      );
      return {
        hours,
        projected,
        band: describeBand(projected),
      };
    });
  }, [probability, riskLevels]);

  const factors = useMemo(
    () =>
      (Object.keys(METRIC_CONFIG) as (keyof SensorSnapshot)[]).map((key) => {
        const meta = METRIC_CONFIG[key];
        return {
          key,
          label: meta.label,
          value: meta.format(sensorSnapshot[key]),
          level: riskLevels[key],
          color: meta.color,
        };
      }),
    [riskLevels, sensorSnapshot]
  );

  const dominantFactor = useMemo(() => {
    return factors.reduce<null | (typeof factors)[number]>((top, current) => {
      if (!top) return current;
      const topScore = riskLevels[top.key] * WEIGHTS[top.key];
      const currentScore = riskLevels[current.key] * WEIGHTS[current.key];
      return currentScore > topScore ? current : top;
    }, null);
  }, [factors, riskLevels]);

  const mitigationSteps = useMemo(() => {
    if (probability >= 0.75) {
      return [
        "Sơ tán ngay các hộ dân trong vùng đỏ.",
        "Chặn đường qua sườn dốc, ưu tiên lực lượng ứng cứu.",
        "Bay flycam hoặc kiểm tra trực tiếp mỗi 15 phút.",
      ];
    }
    if (probability >= 0.55) {
      return [
        "Gửi cảnh báo tự động mỗi giờ.",
        "Mở rãnh thoát nước, dọn sạch vật cản.",
        "Giữ liên lạc với đội phản ứng nhanh tại điểm tập kết.",
      ];
    }
    if (probability >= 0.35) {
      return [
        "Tuần tra tìm vết nứt mới trên sườn dốc.",
        "So sánh số liệu mưa với trạm địa phương.",
        "Kiểm tra thiết bị đo mưa trước nửa đêm.",
      ];
    }
    return [
      "Giám sát định kỳ mỗi 6 giờ.",
      "Thông tin trạng thái an toàn cho cộng đồng.",
      "Đồng bộ thiết bị sau mỗi đợt mưa nhỏ.",
    ];
  }, [probability]);

  const distanceMeters = clamp(asNumber(globalSite?.khoang_cach, 0), 0, Number.MAX_SAFE_INTEGER);
  const distanceLabel = formatDistance(distanceMeters);
  const siteName = globalSite?.ten || "Trạm giám sát";
  const siteId = globalSite?.id || "Không có mã trạm";
  const updatedAtLabel = lastUpdated.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const coordinateLabel =
    typeof globalSite?.toa_do?.x === "number" && typeof globalSite?.toa_do?.y === "number"
      ? `${globalSite.toa_do.x.toFixed(2)}N, ${globalSite.toa_do.y.toFixed(2)}E`
      : "Chưa có tọa độ";

  const ensureConnectivity = useCallback(async () => {
    const hasNet = await checkNetworkConnectivity();
    setConnectivityOk(hasNet);
    if (!hasNet) {
      Alert.alert("Cần kết nối", "Bật Wi-Fi hoặc dữ liệu di động để tiếp tục kiểm tra.");
    }
    return hasNet;
  }, []);

  useEffect(() => {
    ensureConnectivity();
  }, [ensureConnectivity]);

  const connectivityLabel = useMemo(() => {
    if (connectivityOk === false) return "Không có Wi-Fi/4G";
    if (connectivityOk) return "Đã bật Wi-Fi/4G";
    return "Đang kiểm tra kết nối...";
  }, [connectivityOk]);

  useEffect(() => {
    if (distanceMeters <= PROXIMITY_THRESHOLD_METERS && !proximityNotified.current) {
      proximityNotified.current = true;
      Alert.alert(
        "Cảnh báo khoảng cách",
        `Thiết bị đang cách trạm ${distanceLabel} (<= ${PROXIMITY_THRESHOLD_METERS}m).`
      );
    }
    if (distanceMeters > PROXIMITY_THRESHOLD_METERS + 20) {
      proximityNotified.current = false;
    }
  }, [distanceLabel, distanceMeters]);

  useEffect(() => {
    if (!notificationsEnabled) {
      console.log("Thông báo tắt trong local.json; bỏ qua đăng ký push.");
      return;
    }

    const usableLocalStorage = hasUsableLocalStorage();
    if (Platform.OS === "web" && !usableLocalStorage) {
      console.log("Bỏ qua đăng ký push trên web/static (không có localStorage khả dụng).");
      return;
    }

    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Phản hồi thông báo:", response.actionIdentifier);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled) return;

    const isClose = distanceMeters <= PROXIMITY_THRESHOLD_METERS;
    const isHighRisk = probability >= PUSH_RISK_THRESHOLD;
    const readyForPush = isClose && isHighRisk && !pushSentRef.current;

    if (readyForPush) {
      pushSentRef.current = true;
      void ensureConnectivity();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

      const title = "Cảnh báo sạt lở cao";
      const body = `Nguy cơ ${probabilityPercent}% tại ${siteName}. Khoảng cách: ${distanceLabel}.`;
      if (expoPushToken) {
        sendPushNotification(expoPushToken, title, body);
      } else {
        sendLocalNotification(title, body);
      }
    }
    if ((!isClose || probability < PUSH_RISK_THRESHOLD - 0.1) && pushSentRef.current) {
      pushSentRef.current = false;
    }
  }, [
    distanceLabel,
    distanceMeters,
    ensureConnectivity,
    expoPushToken,
    notificationsEnabled,
    probability,
    probabilityPercent,
    siteName,
  ]);

  const groundTrustScore = useMemo(() => {
    if (!groundSamples.length) return null;
    const avgMagnitude =
      groundSamples.reduce(
        (sum, sample) => sum + Math.abs(sample.ax) + Math.abs(sample.ay) + Math.abs(sample.az),
        0
      ) / groundSamples.length;
    return Math.round(clamp(100 - avgMagnitude * 40, 0, 100));
  }, [groundSamples]);

  useEffect(() => {
    setGroundTrust(groundTrustScore);
  }, [groundTrustScore]);

  useEffect(() => {
    if (!groundRunning) {
      if (groundTimerRef.current) {
        clearTimeout(groundTimerRef.current);
        groundTimerRef.current = null;
      }
      setGroundStatus("Sẵn sàng kiểm tra tại hiện trường");
      return;
    }

    let accelSub: { remove: () => void } | null = null;
    let locSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    const recordAccelerometer = ({ x, y, z }: { x: number; y: number; z: number }) => {
      if (cancelled) return;
      setGroundSamples((prev) => [...prev.slice(-300), { ax: x, ay: y, az: z }]);
    };

    const recordLocation = (loc: Location.LocationObject) => {
      if (cancelled) return;
      setGroundPoints((prev) => [
        ...prev,
        { lat: loc.coords.latitude, lon: loc.coords.longitude },
      ]);
    };

    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") return true;
        Alert.alert("Thiếu quyền vị trí", "Cấp quyền vị trí để ghi vết tại hiện trường.");
        return false;
      } catch (error) {
        console.warn("Không lấy được quyền vị trí:", error);
        return false;
      }
    };

    const startRecording = async () => {
      const hasNet = await ensureConnectivity();
      if (!hasNet || cancelled) {
        setGroundRunning(false);
        return;
      }

      const hasPermission = await requestLocationPermission();
      if (!hasPermission || cancelled) {
        setGroundRunning(false);
        return;
      }

      setGroundStatus("Đang ghi rung & GPS (5 phút)...");
      groundTimerRef.current = setTimeout(() => setGroundRunning(false), 5 * 60 * 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        accelSub = Accelerometer.addListener(recordAccelerometer);
        Accelerometer.setUpdateInterval(100);
      } catch (error) {
        console.warn("Không thể ghi cảm biến:", error);
      }

      try {
        locSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
          recordLocation
        );
      } catch (error) {
        console.warn("Không thể theo dõi vị trí:", error);
      }
    };

    startRecording();

    return () => {
      cancelled = true;
      accelSub?.remove();
      locSub?.remove();
      if (groundTimerRef.current) {
        clearTimeout(groundTimerRef.current);
        groundTimerRef.current = null;
      }
      setGroundStatus("Sẵn sàng kiểm tra tại hiện trường");
    };
  }, [ensureConnectivity, groundRunning]);

  const handleToggleGroundCheck = useCallback(async () => {
    if (groundRunning) {
      setGroundRunning(false);
      Haptics.selectionAsync().catch(() => {});
      return;
    }

    const ok = await ensureConnectivity();
    if (!ok) return;

    setGroundSamples([]);
    setGroundPoints([]);
    setGroundTrust(null);
    setGroundRunning(true);
  }, [ensureConnectivity, groundRunning]);

  const quickStats = useMemo(
    () => [
      { label: "Khoảng cách tới trạm", value: distanceLabel },
      { label: "Độ tin cậy cảm biến", value: `${sensorConfidence}%` },
      { label: "Kết nối", value: connectivityLabel },
      { label: "Yếu tố chi phối", value: dominantFactor?.label ?? "Đang tính toán" },
      { label: "Mã trạm", value: siteId },
      { label: "Tọa độ trạm", value: coordinateLabel },
      { label: "Thông báo gần nhất", value: lastNotificationLabel },
    ],
    [
      connectivityLabel,
      coordinateLabel,
      distanceLabel,
      dominantFactor,
      lastNotificationLabel,
      sensorConfidence,
      siteId,
    ]
  );

  const groundTrustLabel = useMemo(() => {
    if (groundTrust !== null) return `${groundTrust}%`;
    if (groundRunning) return "Đang tính...";
    return "Chưa có dữ liệu";
  }, [groundRunning, groundTrust]);

  const groundPointsLabel = useMemo(() => {
    if (groundPoints.length > 0) return `${groundPoints.length} điểm GPS`;
    if (groundRunning) return "Đang ghi GPS...";
    return "Chưa ghi GPS";
  }, [groundPoints.length, groundRunning]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} style={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Nguy cơ sạt lở</Text>
          <Text style={styles.heroLocation}>{siteName}</Text>
          <View style={styles.heroRow}>
            <Text style={[styles.heroValue, { color: severityColor }]}>{probabilityPercent}%</Text>
            <View style={styles.heroMeta}>
              <Text style={styles.heroBand}>{BAND_LABELS[band]}</Text>
              <Text style={styles.heroTime}>{`Cập nhật ${updatedAtLabel}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tóm tắt nhanh</Text>
          <View style={styles.quickRow}>
            {quickStats.map((item) => (
              <View key={item.label} style={styles.quickCard}>
                <Text style={styles.quickLabel}>{item.label}</Text>
                <Text style={styles.quickValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kiểm tra tại hiện trường</Text>
          <Text style={styles.sectionHint}>{groundStatus}</Text>
          <View style={styles.quickRow}>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>Độ tin cậy trạm</Text>
              <Text style={styles.quickValue}>{groundTrustLabel}</Text>
            </View>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>Vị trí ghi</Text>
              <Text style={styles.quickValue}>{groundPointsLabel}</Text>
            </View>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>Kết nối</Text>
              <Text style={styles.quickValue}>{connectivityLabel}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleToggleGroundCheck}
            style={[styles.groundButton, groundRunning && styles.groundButtonStop]}
          >
            {groundRunning && <ActivityIndicator color="#ffffff" />}
            <Text style={styles.groundButtonText}>
              {groundRunning ? "Dừng & lưu kiểm tra" : "Bắt đầu kiểm tra 5 phút"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dự báo ngắn hạn</Text>
          <View style={styles.forecastRow}>
            {forecasts.map((forecast) => (
              <View key={forecast.hours} style={styles.forecastCard}>
                <Text style={styles.forecastTitle}>{`+${forecast.hours} giờ`}</Text>
                <Text style={[styles.forecastValue, { color: SERIOUSNESS_COLORS[forecast.band] }]}>
                  {`${Math.round(forecast.projected * 100)}%`}
                </Text>
                <Text style={styles.forecastLabel}>{BAND_LABELS[forecast.band]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cảm biến tại chỗ</Text>
          {factors.map((factor) => (
            <View key={factor.key} style={styles.factorRow}>
              <View style={styles.factorMeta}>
                <Text style={styles.factorTitle}>{factor.label}</Text>
                <Text style={styles.factorValue}>{factor.value}</Text>
              </View>
              <View style={styles.factorBar}>
                <View
                  style={[
                    styles.factorLevel,
                    { backgroundColor: factor.color, width: `${factor.level * 100}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hướng dẫn hành động</Text>
          {mitigationSteps.map((step, index) => (
            <Text key={step} style={styles.step}>
              {`${index + 1}. ${step}`}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroLabel: {
    color: "#334155",
    fontSize: 14,
  },
  heroLocation: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 46,
    fontWeight: "800",
    textAlign: "center",
  },
  heroMeta: {
    alignItems: "flex-start",
    gap: 2,
  },
  heroBand: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  heroTime: {
    color: "#475569",
    fontSize: 13,
  },
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionHint: {
    fontSize: 13,
    color: "#475569",
    marginTop: -4,
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  quickCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "transparent",
  },
  groundCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  groundButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#15803d",
  },
  groundButtonStop: {
    backgroundColor: "#dc2626",
  },
  groundButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  quickLabel: {
    fontSize: 13,
    color: "#475569",
  },
  quickValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  forecastRow: {
    flexDirection: "row",
    gap: 12,
  },
  forecastCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    gap: 4,
  },
  forecastTitle: {
    fontSize: 13,
    color: "#475569",
  },
  forecastValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  forecastLabel: {
    fontSize: 13,
    color: "#0f172a",
  },
  factorRow: {
    gap: 6,
  },
  factorMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  factorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  factorValue: {
    fontSize: 14,
    color: "#475569",
  },
  factorBar: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  factorLevel: {
    height: 8,
    borderRadius: 999,
  },
  step: {
    fontSize: 14,
    color: "#0f172a",
    marginTop: 4,
  },
});
