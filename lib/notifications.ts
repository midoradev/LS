import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import type * as NotificationsType from "expo-notifications";
import type { Copy } from "./copy";

const fallbackAlertTitle = "Thông báo";
const fallbackPushCopy: Copy["common"]["pushErrors"] = {
  deviceRequired: "Cần thiết bị thật để nhận thông báo đẩy.",
  permissionMissing: "Chưa được cấp quyền nhận thông báo.",
  projectIdMissing: "Thiếu projectId để lấy push token.",
  tokenFailed: (error: unknown) => `Không thể lấy push token: ${error}`,
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type WebNotificationCtor = {
  permission: "default" | "denied" | "granted";
  requestPermission: () => Promise<"default" | "denied" | "granted">;
} & (new (title: string, options?: { body?: string }) => unknown);

const getWebNotification = (): WebNotificationCtor | null => {
  const api = (globalThis as { Notification?: WebNotificationCtor }).Notification;
  return api ?? null;
};

let cachedNotifications: typeof NotificationsType | null = null;
export const getNotificationsClient = (): typeof NotificationsType | null => {
  if (cachedNotifications) return cachedNotifications;
  if (Platform.OS === "web") return null;
  try {
    // require at runtime to avoid loading on web/SSR
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as typeof NotificationsType;
    cachedNotifications = mod;
    return mod;
  } catch (error) {
    console.warn("Không thể tải expo-notifications:", error);
    return null;
  }
};

let handlerConfigured = false;
let registrationPromise: Promise<string | null> | null = null;
let cachedToken: string | null = null;

const handleRegistrationError = (title: string, message: string) => {
  Alert.alert(title, message);
  console.warn(message);
};

const configureAndroidChannelAsync = async () => {
  const Notifications = getNotificationsClient();
  if (!Notifications) return;
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
};

export const configureForegroundNotifications = () => {
  const Notifications = getNotificationsClient();
  if (!Notifications || handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
};

export const registerForPushNotificationsAsync = (
  alertTitle: string,
  pushCopy: Copy["common"]["pushErrors"]
): Promise<string | null> => {
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    const Notifications = getNotificationsClient();
    if (!Notifications) {
      console.warn("Bỏ qua đăng ký thông báo (Notifications không khả dụng trong môi trường hiện tại).");
      return null;
    }

    if (Platform.OS === "web") {
      console.log("Bỏ qua đăng ký push trên web.");
      return null;
    }

    await configureAndroidChannelAsync();

    const Device = await import("expo-device");
    if (!Device.isDevice) {
      handleRegistrationError(alertTitle, pushCopy.deviceRequired);
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      handleRegistrationError(alertTitle, pushCopy.permissionMissing);
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError(alertTitle, pushCopy.projectIdMissing);
      return null;
    }

    try {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      cachedToken = data;
      return data;
    } catch (error) {
      handleRegistrationError(alertTitle, pushCopy.tokenFailed(error));
      return null;
    }
  })();

  return registrationPromise;
};

export const getCachedPushToken = () => cachedToken;

export const presentLocalNotificationAsync = async (title: string, body: string) => {
  const Notifications = getNotificationsClient();
  if (!Notifications) {
    console.log("Bỏ qua thông báo cục bộ vì Notifications không khả dụng.");
    return;
  }
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

export type PushSetupResult =
  | { ok: true; expoPushToken: string | null; note?: string }
  | { ok: false; error: string };

export const requestAndGetPushToken = async (): Promise<PushSetupResult> => {
  if (Platform.OS === "web") {
    const notificationApi = getWebNotification();
    if (!notificationApi) {
      return {
        ok: true,
        expoPushToken: null,
        note: "Trình duyệt không hỗ trợ Notification API. Dùng thông báo cục bộ để test.",
      };
    }
    const perm =
      notificationApi.permission === "granted"
        ? "granted"
        : await notificationApi.requestPermission();
    if (perm !== "granted") {
      return { ok: false, error: "Bạn chưa cho phép thông báo trên trình duyệt." };
    }
    return {
      ok: true,
      expoPushToken: null,
      note: "Web không dùng Expo push token. Bạn vẫn test được thông báo cục bộ.",
    };
  }

  const token = await registerForPushNotificationsAsync(fallbackAlertTitle, fallbackPushCopy);
  if (!token) {
    return {
      ok: true,
      expoPushToken: null,
      note: "Không có push token (thường do giả lập). Vẫn test được thông báo cục bộ.",
    };
  }
  return { ok: true, expoPushToken: token };
};

export const triggerTestNotification = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (Platform.OS === "web") {
    const notificationApi = getWebNotification();
    if (!notificationApi) {
      return { ok: false, error: "Trình duyệt không hỗ trợ Notification API." };
    }
    const perm =
      notificationApi.permission === "granted"
        ? "granted"
        : await notificationApi.requestPermission();
    if (perm !== "granted") {
      return { ok: false, error: "Bạn chưa cho phép thông báo trên trình duyệt." };
    }
    await wait(1000);
    new notificationApi("Thông báo test", { body: "Nếu bạn thấy cái này là ok." }); // NOSONAR: side-effect shows notification
    return { ok: true };
  }

  const Notifications = getNotificationsClient();
  if (!Notifications) {
    return { ok: false, error: "Notifications không khả dụng trên nền tảng hiện tại." };
  }

  configureForegroundNotifications();
  await configureAndroidChannelAsync();

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: "Thông báo test", body: "Nếu bạn thấy cái này là ok.", sound: "default" },
      trigger: null,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message ?? "Không gửi được thông báo test." };
  }
};
