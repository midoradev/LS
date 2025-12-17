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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, type Href } from "expo-router";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { useSettings } from "../../providers/settings-context";
import { getCopy, type RiskBandKey } from "../../lib/copy";
import { getTheme, type Theme } from "../../lib/theme";
import {
  getCachedPushToken,
  getNotificationsClient,
  presentLocalNotificationAsync,
  registerForPushNotificationsAsync,
} from "../../lib/notifications";
import type * as NotificationsType from "expo-notifications";
import { fetchFirebaseJson } from "../../lib/firebase";
import globalSiteData from "../../assets/data/global.json";

type SensorSnapshot = {
  soilMoisture: number;
  slopeAngle: number;
  rainfall24h: number;
  groundVibration: number;
};

type GlobalPayload = {
  ten?: string;
  id?: string;
  dia_diem?: string;
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

const SERIOUSNESS_COLORS: Record<RiskBandKey, string> = {
  stable: "#15803d",
  caution: "#2563eb",
  elevated: "#b45309",
  high: "#f97316",
  danger: "#dc2626",
};

const METRIC_BASE: Record<
  keyof SensorSnapshot,
  { min: number; max: number; color: string; format: (value: number) => string }
> = {
  soilMoisture: {
    min: 30,
    max: 95,
    color: "#15803d",
    format: (value) => `${value.toFixed(1)}%`,
  },
  slopeAngle: {
    min: 10,
    max: 55,
    color: "#2563eb",
    format: (value) => `${value.toFixed(1)}°`,
  },
  rainfall24h: {
    min: 20,
    max: 200,
    color: "#0f766e",
    format: (value) => `${value.toFixed(0)} mm`,
  },
  groundVibration: {
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
type RainEndpoint = {
  label: string;
  url: string;
  extractor: (payload: unknown) => number | null;
};

const Notifications = getNotificationsClient();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const riskFromRange = (value: number, startRisk: number, danger: number) =>
  clamp((value - startRisk) / (danger - startRisk), 0, 1);

const hasUsableLocalStorage = () =>
  typeof localStorage !== "undefined" && typeof localStorage.getItem === "function";

const describeBand = (score: number): RiskBandKey => {
  if (score >= 0.8) return "danger";
  if (score >= 0.65) return "high";
  if (score >= 0.45) return "elevated";
  if (score >= 0.28) return "caution";
  return "stable";
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
    const Cellular = await import("expo-cellular");
    const generation = await Cellular.getCellularGenerationAsync();
    hasCellular = generation !== null;
  } catch (error) {
    console.warn("Bỏ qua kiểm tra kết nối di động (thiếu hoặc không hỗ trợ expo-cellular):", error);
  }

  const hasWifiOrAny = isBrowserOnline();
  return hasCellular || hasWifiOrAny;
};

const globalSite = globalSiteData as GlobalPayload;

type OpenWeatherExtra = {
  openWeatherApiKey?: string;
};

const getEnvValue = (key: string) => {
  const env =
    (typeof globalThis !== "undefined" &&
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env) ||
    undefined;
  return env?.[key];
};

const getOpenWeatherApiKey = () => {
  const extraKey = (Constants?.expoConfig?.extra as OpenWeatherExtra | undefined)?.openWeatherApiKey;
  return getEnvValue("EXPO_PUBLIC_OPENWEATHER_API_KEY") || extraKey || null;
};

const getStationCoordinates = (data?: GlobalPayload) => {
  const lat = data?.toa_do?.x;
  const lon = data?.toa_do?.y;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
};

const extractRainfallFromForecast3h = (payload: unknown) => {
  const data = payload as { list?: { rain?: { ["3h"]?: number } }[] };
  if (!Array.isArray(data?.list)) return null;
  return data.list
    .slice(0, 8) // 8 x 3h = 24h
    .reduce(
      (total: number, entry: { rain?: { ["3h"]?: number } }) => total + (entry?.rain?.["3h"] ?? 0),
      0
    );
};

const extractRainfallFromCurrent = (payload: unknown) => {
  const data = payload as { rain?: { ["1h"]?: number; ["3h"]?: number } };
  if (typeof data?.rain?.["1h"] === "number") return data.rain["1h"];
  if (typeof data?.rain?.["3h"] === "number") return data.rain["3h"];
  return 0; // không mưa nhưng request thành công
};

const logOpenWeatherPayload = (label: string, payload: unknown) => {
  try {
    const data = payload as {
      rain?: Record<string, number>;
      list?: { dt_txt?: string; dt?: number; rain?: { ["3h"]?: number } }[];
    };

    let summary: unknown = data?.rain ?? null;
    if (Array.isArray(data?.list)) {
      summary = data.list
        .slice(0, 8)
        .map((item) => ({
          t: item?.dt_txt ?? item?.dt ?? "n/a",
          r3h: item?.rain?.["3h"] ?? 0,
        }));
    }

    const snippet = JSON.stringify({ rain: summary }).slice(0, 1000);
    console.log(`[OpenWeather][${label}] rain-only: ${snippet}`);
  } catch (error) {
    console.log(`[OpenWeather][${label}] payload (không thể stringify rain):`, payload, error);
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

export default function IndexScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const copy = useMemo(() => getCopy(settings.lang), [settings.lang]);
  const theme = useMemo(() => getTheme(settings.mode), [settings.mode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const locale = settings.lang === "en" ? "en-US" : "vi-VN";
  const goToSettings = useCallback(() => {
    router.push("/settings" as Href);
  }, [router]);
  const proximityNotified = useRef(false);
  const pushSentRef = useRef(false);
  const groundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [globalData, setGlobalData] = useState<GlobalPayload>(globalSite);
  const [sensorSnapshot, setSensorSnapshot] = useState<SensorSnapshot>(() =>
    createSnapshotFromData(globalSite)
  );
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const rainfallFetchedRef = useRef(false);
  const geocodeFetchedRef = useRef(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(() => getCachedPushToken());
  const notificationListener = useRef<NotificationsType.EventSubscription | null>(null);
  const responseListener = useRef<NotificationsType.EventSubscription | null>(null);
  const [lastNotification, setLastNotification] = useState<NotificationsType.Notification | null>(
    null
  );
  const notificationsEnabled = settings.notifications;
  const [connectivityOk, setConnectivityOk] = useState<boolean | null>(null);
  const [groundRunning, setGroundRunning] = useState(false);
  const [groundSamples, setGroundSamples] = useState<
    { ax: number; ay: number; az: number }[]
  >([]);
  const [groundPoints, setGroundPoints] = useState<{ lat: number; lon: number }[]>([]);
  const [groundTrust, setGroundTrust] = useState<number | null>(null);
  const [groundStatus, setGroundStatus] = useState(copy.home.ground.statusReady);
  const lastNotificationLabel = useMemo(() => {
    if (!lastNotification) return copy.common.lastNotificationFallback;
    const title = lastNotification.request.content.title || copy.common.lastNotificationFallback;
    const timestamp =
    typeof lastNotification.date === "number"
        ? new Date(lastNotification.date).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
    return timestamp ? `${title} (${timestamp})` : title;
  }, [copy.common.lastNotificationFallback, lastNotification, locale]);

  const metricConfig = useMemo(
    () => ({
      soilMoisture: { ...METRIC_BASE.soilMoisture, label: copy.home.metrics.soilMoisture },
      slopeAngle: { ...METRIC_BASE.slopeAngle, label: copy.home.metrics.slopeAngle },
      rainfall24h: { ...METRIC_BASE.rainfall24h, label: copy.home.metrics.rainfall24h },
      groundVibration: { ...METRIC_BASE.groundVibration, label: copy.home.metrics.groundVibration },
    }),
    [copy]
  );

  useEffect(() => {
    setGroundStatus(
      groundRunning ? copy.home.ground.statusRecording : copy.home.ground.statusReady
    );
  }, [copy, groundRunning]);

  useEffect(() => {
    setSensorSnapshot((prev) => {
      const base = createSnapshotFromData(globalData);
      return { ...base, rainfall24h: prev.rainfall24h ?? base.rainfall24h };
    });
  }, [globalData]);

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
      (Object.keys(metricConfig) as (keyof SensorSnapshot)[]).map((key) => {
        const meta = metricConfig[key];
        return {
          key,
          label: meta.label,
          value: meta.format(sensorSnapshot[key]),
          level: riskLevels[key],
          color: meta.color,
        };
      }),
    [metricConfig, riskLevels, sensorSnapshot]
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
      return copy.home.mitigation.extreme;
    }
    if (probability >= 0.55) {
      return copy.home.mitigation.high;
    }
    if (probability >= 0.35) {
      return copy.home.mitigation.medium;
    }
    return copy.home.mitigation.low;
  }, [copy, probability]);

  const distanceMeters = clamp(asNumber(globalData?.khoang_cach, 0), 0, Number.MAX_SAFE_INTEGER);
  const distanceLabel = formatDistance(distanceMeters);
  const siteName = globalData?.ten || copy.common.stationNameFallback;
  const siteId = globalData?.id || copy.common.stationIdFallback;
  const updatedAtLabel = lastUpdated.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const coordinateLabel =
    typeof globalData?.toa_do?.x === "number" && typeof globalData?.toa_do?.y === "number"
      ? `${globalData.toa_do.x.toFixed(2)}N, ${globalData.toa_do.y.toFixed(2)}E`
      : copy.common.coordinatesFallback;

  const ensureConnectivity = useCallback(async () => {
    const hasNet = await checkNetworkConnectivity();
    setConnectivityOk(hasNet);
    if (!hasNet) {
      Alert.alert(copy.common.connectivity.needTitle, copy.common.connectivity.needBody);
    }
    return hasNet;
  }, [copy]);

  useEffect(() => {
    ensureConnectivity();
  }, [ensureConnectivity]);

  useEffect(() => {
    const hasCoords = !!getStationCoordinates(globalData);
    if (hasCoords || geocodeFetchedRef.current) return;
    const apiKey = getOpenWeatherApiKey();
    const query = globalData?.dia_diem || globalData?.ten;
    if (!apiKey || !query) return;

    const controller = new AbortController();
    geocodeFetchedRef.current = true;

    const geocode = async () => {
      try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          query
        )}&limit=1&appid=${apiKey}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Geocode HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { lat?: number; lon?: number }[];
        const first = payload?.[0];
        if (typeof first?.lat === "number" && typeof first?.lon === "number") {
          setGlobalData((prev) => ({
            ...prev,
            toa_do: { x: first.lat, y: first.lon },
          }));
        } else {
          console.log("Geocode không trả tọa độ; giữ nguyên dữ liệu cũ.");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        geocodeFetchedRef.current = false; // cho phép thử lại nếu cần
        console.warn("Không thể geocode từ OpenWeather:", error);
      }
    };

    geocode();
    return () => controller.abort();
  }, [globalData]);

  useEffect(() => {
    const controller = new AbortController();
    const loadGlobal = async () => {
      const remote = await fetchFirebaseJson<GlobalPayload>("global", controller.signal);
      if (remote && !controller.signal.aborted) {
        setGlobalData(remote);
      }
    };
    loadGlobal();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const apiKey = getOpenWeatherApiKey();
    const coords = getStationCoordinates(globalData);

    if (!apiKey) {
      console.log("Thiếu OpenWeather API key (EXPO_PUBLIC_OPENWEATHER_API_KEY hoặc extra.openWeatherApiKey).");
      return;
    }
    if (!coords) {
      console.warn("Không có tọa độ trạm để gọi OpenWeather; giữ nguyên lượng mưa tĩnh.");
      return;
    }
    if (rainfallFetchedRef.current) return;
    rainfallFetchedRef.current = true;

    const controller = new AbortController();
    const endpoints: RainEndpoint[] = [
      {
        label: "Forecast 3h (2.5)",
        url: `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&units=metric&lang=vi&appid=${apiKey}`,
        extractor: extractRainfallFromForecast3h,
      },
      {
        label: "Current weather (2.5)",
        url: `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&lang=vi&appid=${apiKey}`,
        extractor: extractRainfallFromCurrent,
      },
    ];

    const fetchRainfallFromEndpoint = async (endpoint: RainEndpoint) => {
      try {
        const response = await fetch(endpoint.url, { signal: controller.signal });
        if (!response.ok) {
          let reason = "";
          try {
            reason = await response.text();
          } catch {
            // ignore
          }
          const trimmedReason = reason ? `: ${reason.slice(0, 140)}` : "";
          throw new Error(`${endpoint.label} HTTP ${response.status}${trimmedReason}`);
        }
        const payload = await response.json();
        logOpenWeatherPayload(endpoint.label, payload);
        const rainfallMm = endpoint.extractor(payload);
        if (typeof rainfallMm === "number") return rainfallMm;
        console.log(`${endpoint.label} không có dữ liệu mưa, thử endpoint khác.`);
        return null;
      } catch (error) {
        if (controller.signal.aborted) return undefined;
        console.warn(`Không lấy được lượng mưa từ OpenWeather (${endpoint.label}):`, error);
        return null;
      }
    };

    const loadRainfall = async () => {
      for (const endpoint of endpoints) {
        const rainfallMm = await fetchRainfallFromEndpoint(endpoint);
        if (typeof rainfallMm === "number") {
          setSensorSnapshot((prev) => ({ ...prev, rainfall24h: rainfallMm }));
          setLastUpdated(new Date());
          if (rainfallMm === 0) {
            console.log(`${endpoint.label} trả về không mưa (0mm); dùng giá trị này.`);
          }
          return;
        }
        if (rainfallMm === undefined) return; // aborted
      }

      console.log("OpenWeather không trả về lượng mưa; giữ nguyên giá trị cục bộ.");
    };

    loadRainfall();

    return () => controller.abort();
  }, [globalData]);

  const connectivityLabel = useMemo(() => {
    if (connectivityOk === false) return copy.common.connectivity.offline;
    if (connectivityOk) return copy.common.connectivity.online;
    return copy.common.connectivity.checking;
  }, [connectivityOk, copy]);

  useEffect(() => {
    if (distanceMeters <= PROXIMITY_THRESHOLD_METERS && !proximityNotified.current) {
      proximityNotified.current = true;
      Alert.alert(
        copy.common.proximityTitle,
        copy.common.proximityBody(distanceLabel, PROXIMITY_THRESHOLD_METERS)
      );
    }
    if (distanceMeters > PROXIMITY_THRESHOLD_METERS + 20) {
      proximityNotified.current = false;
    }
  }, [copy, distanceLabel, distanceMeters]);

  useEffect(() => {
    if (!notificationsEnabled) {
      console.log("Thông báo tắt trong local.json; bỏ qua đăng ký push.");
      return;
    }

    if (!Notifications) {
      console.log("Notifications không khả dụng (SSR/static); bỏ qua đăng ký push.");
      return;
    }

    const usableLocalStorage = hasUsableLocalStorage();
    if (Platform.OS === "web" && !usableLocalStorage) {
      console.log("Bỏ qua đăng ký push trên web/static (không có localStorage khả dụng).");
      return;
    }

    registerForPushNotificationsAsync(copy.common.noticeTitle, copy.common.pushErrors).then(
      (token) => {
        if (token) setExpoPushToken(token);
      }
    );

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setLastNotification(notification);
      }
    );
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Phản hồi thông báo:", response.actionIdentifier);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [copy.common.noticeTitle, copy.common.pushErrors, notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled) return;

    const isClose = distanceMeters <= PROXIMITY_THRESHOLD_METERS;
    const isHighRisk = probability >= PUSH_RISK_THRESHOLD;
    const readyForPush = isClose && isHighRisk && !pushSentRef.current;

    if (readyForPush) {
      pushSentRef.current = true;
      void ensureConnectivity();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

      const title = copy.common.pushTitle;
      const body = copy.common.pushBody(probabilityPercent, siteName, distanceLabel);
      if (expoPushToken) {
        sendPushNotification(expoPushToken, title, body);
      } else {
        presentLocalNotificationAsync(title, body);
      }
    }
    if ((!isClose || probability < PUSH_RISK_THRESHOLD - 0.1) && pushSentRef.current) {
      pushSentRef.current = false;
    }
  }, [
    copy.common,
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
      setGroundStatus(copy.home.ground.statusReady);
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
        Alert.alert(copy.common.locationPermissionTitle, copy.common.locationPermissionBody);
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

      setGroundStatus(copy.home.ground.statusRecording);
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
      setGroundStatus(copy.home.ground.statusReady);
    };
  }, [copy, ensureConnectivity, groundRunning]);

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
      { label: copy.home.quickStats.distance, value: distanceLabel },
      { label: copy.home.quickStats.sensorConfidence, value: `${sensorConfidence}%` },
      { label: copy.home.quickStats.connectivity, value: connectivityLabel },
      { label: copy.home.quickStats.dominant, value: dominantFactor?.label ?? copy.common.calculating },
      { label: copy.home.quickStats.siteId, value: siteId },
      { label: copy.home.quickStats.coords, value: coordinateLabel },
      { label: copy.home.quickStats.lastNotification, value: lastNotificationLabel },
    ],
    [
      connectivityLabel,
      coordinateLabel,
      distanceLabel,
      dominantFactor,
      lastNotificationLabel,
      copy,
      sensorConfidence,
      siteId,
    ]
  );

  const groundTrustLabel = useMemo(() => {
    if (groundTrust !== null) return `${groundTrust}%`;
    if (groundRunning) return copy.home.ground.trustWorking;
    return copy.home.ground.trustNone;
  }, [copy, groundRunning, groundTrust]);

  const groundPointsLabel = useMemo(() => {
    if (groundPoints.length > 0) return copy.home.ground.pointsCount(groundPoints.length);
    if (groundRunning) return copy.home.ground.pointsWorking;
    return copy.home.ground.pointsNone;
  }, [copy, groundPoints.length, groundRunning]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.container} style={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroLabel}>{copy.home.heroTitle}</Text>
              <Text style={styles.heroLocation}>{siteName}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={goToSettings}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
            >
              <Ionicons name="settings-outline" size={18} color={theme.icon} />
            </Pressable>
          </View>
          <View style={[styles.heroRow, styles.heroRowWide]}>
            <Text style={[styles.heroValue, { color: severityColor }]}>{probabilityPercent}%</Text>
            <View style={styles.heroMeta}>
              <Text style={styles.heroBand}>{copy.common.riskBands[band]}</Text>
              <Text style={styles.heroTime}>{copy.home.updatedAt(updatedAtLabel)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.home.quickSummaryTitle}</Text>
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
          <Text style={styles.sectionTitle}>{copy.home.fieldCheckTitle}</Text>
          <Text style={styles.sectionHint}>{groundStatus}</Text>
          <View style={styles.quickRow}>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>{copy.home.ground.trustLabel}</Text>
              <Text style={styles.quickValue}>{groundTrustLabel}</Text>
            </View>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>{copy.home.ground.pointsLabel}</Text>
              <Text style={styles.quickValue}>{groundPointsLabel}</Text>
            </View>
            <View style={styles.groundCard}>
              <Text style={styles.quickLabel}>{copy.home.ground.connectionLabel}</Text>
              <Text style={styles.quickValue}>{connectivityLabel}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleToggleGroundCheck}
            style={[styles.groundButton, groundRunning && styles.groundButtonStop]}
          >
            {groundRunning && <ActivityIndicator color="#ffffff" />}
            <Text style={styles.groundButtonText}>
              {groundRunning ? copy.home.ground.buttonStop : copy.home.ground.buttonStart}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.home.shortForecastTitle}</Text>
          <View style={styles.forecastRow}>
            {forecasts.map((forecast) => (
              <View key={forecast.hours} style={styles.forecastCard}>
                <Text style={styles.forecastTitle}>{copy.home.forecastAhead(forecast.hours)}</Text>
                <Text style={[styles.forecastValue, { color: SERIOUSNESS_COLORS[forecast.band] }]}>
                  {`${Math.round(forecast.projected * 100)}%`}
                </Text>
                <Text style={styles.forecastLabel}>{copy.common.riskBands[forecast.band]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.home.sensorsTitle}</Text>
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
          <Text style={styles.sectionTitle}>{copy.home.guidanceTitle}</Text>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scroll: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      padding: 20,
      gap: 16,
      backgroundColor: theme.background,
    },
    hero: {
      borderRadius: 18,
      padding: 18,
      gap: 8,
      alignItems: "stretch",
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroLabel: {
      color: theme.subtext,
      fontSize: 14,
    },
    heroLocation: {
      color: theme.text,
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
    heroRowWide: {
      alignSelf: "stretch",
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
      color: theme.text,
    },
    heroTime: {
      color: theme.subtext,
      fontSize: 13,
    },
    settingsButton: {
      padding: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.softCard,
    },
    settingsButtonPressed: {
      opacity: 0.8,
    },
    section: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
      backgroundColor: theme.card,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    sectionHint: {
      fontSize: 13,
      color: theme.subtext,
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
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    groundCard: {
      flex: 1,
      minWidth: "45%",
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.softCard,
    },
    groundButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.accent,
    },
    groundButtonStop: {
      backgroundColor: theme.danger,
    },
    groundButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
    quickLabel: {
      fontSize: 13,
      color: theme.subtext,
    },
    quickValue: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
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
      color: theme.subtext,
    },
    forecastValue: {
      fontSize: 22,
      fontWeight: "800",
    },
    forecastLabel: {
      fontSize: 13,
      color: theme.text,
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
      color: theme.text,
    },
    factorValue: {
      fontSize: 14,
      color: theme.subtext,
    },
    factorBar: {
      height: 8,
      backgroundColor: theme.track,
      borderRadius: 999,
    },
    factorLevel: {
      height: 8,
      borderRadius: 999,
    },
    step: {
      fontSize: 14,
      color: theme.text,
      marginTop: 4,
    },
  });
