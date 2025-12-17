import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { getCopy } from "../lib/copy";
import { patchFirebaseJson } from "../lib/firebase";
import {
  configureForegroundNotifications,
  registerForPushNotificationsAsync,
} from "../lib/notifications";
import { SettingsProvider, useSettings } from "../providers/settings-context";
import WebLoginScreen from "./web-login";

function NotificationBootstrap() {
  const { settings } = useSettings();
  const copy = useMemo(() => getCopy(settings.lang), [settings.lang]);
  const sentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureForegroundNotifications();
  }, []);

  useEffect(() => {
    if (!settings.notifications) return;
    let cancelled = false;

    registerForPushNotificationsAsync(copy.common.noticeTitle, copy.common.pushErrors).then(
      (token) => {
        if (cancelled || !token || !settings.id || settings.id.includes("{id}")) return;
        if (sentTokenRef.current === token) return;

        console.log("Expo push token:", token);
        sentTokenRef.current = token;
        patchFirebaseJson(`devices/${settings.id}`, { pushToken: token }).catch((error) => {
          console.warn("Không thể cập nhật pushToken lên backend:", error);
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [copy.common.noticeTitle, copy.common.pushErrors, settings.id, settings.notifications]);

  return null;
}

export default function RootLayout() {
  if (Platform.OS === "web") {
    return <WebLoginScreen />;
  }

  return (
    <SettingsProvider>
      <NotificationBootstrap />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack>
    </SettingsProvider>
  );
}
