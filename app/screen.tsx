import { useCallback, useState } from "react";
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
  WebViewNavigation,
  WebViewProgressEvent,
} from "react-native-webview/lib/WebViewTypes";
import { StatusBar } from "expo-status-bar";

export default function MapScreen() {
  const [statusMessage, setStatusMessage] = useState("Đang tải bản đồ...");
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const handleLoadStart = useCallback(() => {
    setLastErrorMessage(null);
    setStatusMessage("Đang tải bản đồ...");
  }, []);

  const handleLoadProgress = useCallback((event: WebViewProgressEvent) => {
    const progress = Math.round((event.nativeEvent.progress ?? 0) * 100);
    if (progress > 0 && progress < 100) {
      setStatusMessage(`Đang tải ${progress}%`);
    }
  }, []);

  const handleLoad = useCallback(() => {
    setStatusMessage("Bản đồ đã tải xong");
  }, []);

  const handleLoadEnd = useCallback(() => {
    setStatusMessage("Bản đồ sẵn sàng");
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const urlLabel = (() => {
        try {
          const { hostname } = new URL(navState.url);
          return hostname || navState.url;
        } catch {
          return navState.url;
        }
      })();

      setStatusMessage(`Đang xem ${urlLabel}`);
    },
    []
  );

  const handleError = useCallback((event: WebViewErrorEvent) => {
    const { description, url } = event.nativeEvent;
    const message = description || "Không thể tải bản đồ";

    console.error(`[WebView] Failed loading ${url}: ${message}`);
    setLastErrorMessage(message);
    setStatusMessage("Không thể tải bản đồ");
    Alert.alert("Lỗi tải bản đồ", message);
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { statusCode, url } = event.nativeEvent;
    const httpMessage = `Máy chủ trả về lỗi ${statusCode} khi truy cập ${url}`;

    console.warn(`[WebView] HTTP error: ${httpMessage}`);
    setLastErrorMessage(httpMessage);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    console.log("[WebView] Message from content:", event.nativeEvent.data);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      setStatusMessage(`Đang mở ${request.url}`);
      return true;
    },
    []
  );

  const loaderMessage = lastErrorMessage ?? statusMessage;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="auto" />
      <View style={styles.mapShell}>
        <View style={styles.mapFrame}>
          <WebView
            originWhitelist={["*"]}
            source={{ uri: "https://luquetsatlo.nchmf.gov.vn/" }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#ffffffff" />
                <Text style={styles.loaderText}>{loaderMessage}</Text>
              </View>
            )}
            onLoadStart={handleLoadStart}
            onLoadProgress={handleLoadProgress}
            onLoad={handleLoad}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onHttpError={handleHttpError}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            style={styles.webview}
          />
        </View>
        <Text
          style={[
            styles.statusText,
            lastErrorMessage && styles.statusTextError,
          ]}
          numberOfLines={2}
        >
          {loaderMessage}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  mapShell: {
    flex: 1,
    width: "100%",
    maxWidth: 960,
    gap: 12,
    alignSelf: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  mapFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
  },
  loader: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  loaderText: {
    fontSize: 14,
  },
  statusText: {
    textAlign: "center",
    fontSize: 13,
    color: "#4f4f4f",
  },
  statusTextError: {
    color: "#c93a3a",
    fontWeight: "600",
  },
});
