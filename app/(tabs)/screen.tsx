import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewProgressEvent,
} from "react-native-webview/lib/WebViewTypes";
import { StatusBar } from "expo-status-bar";
import { useSettings } from "../../providers/settings-context";
import { getCopy } from "../../lib/copy";
import { getTheme, type Theme } from "../../lib/theme";

type MapStatus =
  | { key: "loading" }
  | { key: "progress"; progress: number }
  | { key: "loaded" }
  | { key: "ready" }
  | { key: "error"; message?: string };

export default function MapScreen() {
  const { settings } = useSettings();
  const copy = useMemo(() => getCopy(settings.lang), [settings.lang]);
  const theme = useMemo(() => getTheme(), []);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [status, setStatus] = useState<MapStatus>({ key: "loading" });
  const isReady = status.key === "ready";

  const handleLoadStart = useCallback(() => {
    setStatus({ key: "loading" });
  }, []);

  const handleLoadProgress = useCallback((event: WebViewProgressEvent) => {
    const progress = Math.round((event.nativeEvent.progress ?? 0) * 100);
    if (progress > 0 && progress < 100) {
      setStatus({ key: "progress", progress });
    }
  }, []);

  const handleLoad = useCallback(() => {
    setStatus({ key: "loaded" });
  }, []);

  const handleLoadEnd = useCallback(() => {
    setStatus({ key: "ready" });
  }, []);

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      const { description, url } = event.nativeEvent;
      const message = description || copy.map.errorMessage;

      console.error(`[WebView] Failed loading ${url}: ${message}`);
      setStatus({ key: "error", message });
      Alert.alert(copy.map.errorTitle, message);
    },
    [copy]
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      const { statusCode, url } = event.nativeEvent;
      const httpMessage = copy.map.httpError(statusCode, url);

      console.warn(`[WebView] HTTP error: ${httpMessage}`);
      setStatus({ key: "error", message: httpMessage });
    },
    [copy]
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    console.log("[WebView] Message from content:", event.nativeEvent.data);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (_request: ShouldStartLoadRequest) => {
      setStatus({ key: "loading" });
      return true;
    },
    []
  );

  const loaderMessage = useMemo(() => {
    switch (status.key) {
      case "progress":
        return copy.map.progress(Math.round(status.progress ?? 0));
      case "loaded":
        return copy.map.loaded;
      case "ready":
        return copy.map.ready;
      case "error":
        return status.message ?? copy.map.errorMessage;
      default:
        return copy.map.loading;
    }
  }, [copy, status]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.mapShell}>
        <View style={styles.mapFrame}>
          <WebView
            originWhitelist={["*"]}
            source={{ uri: "https://luquetsatlo.nchmf.gov.vn/" }}
            onLoadStart={handleLoadStart}
            onLoadProgress={handleLoadProgress}
            onLoad={handleLoad}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onHttpError={handleHttpError}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            style={[styles.webview, !isReady && styles.webviewHidden]}
          />
          {status.key !== "ready" && (
            <View style={styles.loaderOverlay}>
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={theme.icon} />
                <Text style={styles.loaderText}>{loaderMessage}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 80,
      backgroundColor: theme.background,
    },
    mapShell: {
      flex: 1,
      width: "100%",
      maxWidth: 960,
      gap: 12,
      alignSelf: "center",
    },
    mapFrame: {
      flex: 1,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: theme.card,
    },
    webview: {
      flex: 1,
    },
    webviewHidden: {
      opacity: 0,
    },
    loaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.card,
    },
    loader: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    loaderText: {
      fontSize: 14,
      color: theme.text,
    },
  });
