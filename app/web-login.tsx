import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { requestAndGetPushToken, triggerTestNotification } from "../lib/notifications";

export default function WebLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [pushInfo, setPushInfo] = useState("Đang kiểm tra quyền thông báo...");
  const [token, setToken] = useState<string | null>(null);

  const isAuthed = useMemo(() => loginMessage === "ok", [loginMessage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await requestAndGetPushToken();
      if (cancelled) return;
      if (!res.ok) {
        setPushInfo(`Thông báo: ${res.error}`);
        return;
      }
      setToken(res.expoPushToken);
      setPushInfo(res.note ?? "Đã sẵn sàng để test thông báo.");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = () => {
    if (username === "admin" && password === "admin") {
      setLoginMessage("ok");
    } else {
      setLoginMessage("Sai tài khoản hoặc mật khẩu.");
    }
  };

  const handleTestNotification = async () => {
    const res = await triggerTestNotification();
    if (!res.ok) {
      setPushInfo(`Test thất bại: ${res.error}`);
      return;
    }
    setPushInfo("Đã gửi thông báo test. Nếu không thấy, hãy kiểm tra quyền thông báo.");
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Đăng nhập</Text>

        <Text style={styles.label}>Tài khoản</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder="Nhập tài khoản"
          placeholderTextColor="#777"
          style={styles.input}
        />

        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Nhập mật khẩu"
          placeholderTextColor="#777"
          style={styles.input}
        />

        <Pressable onPress={handleLogin} style={styles.button}>
          <Text style={styles.buttonText}>Đăng nhập</Text>
        </Pressable>

        {loginMessage && (
          <Text style={[styles.message, loginMessage === "ok" ? styles.ok : styles.err]}>
            {loginMessage === "ok" ? "Đăng nhập thành công" : loginMessage}
          </Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.titleSmall}>Test thông báo</Text>
        <Text style={styles.help}>
          Nền tảng: {Platform.OS}. Ưu tiên test thông báo cục bộ trên giả lập. Push token có thể không có trên giả lập.
        </Text>

        <Pressable onPress={handleTestNotification} style={styles.buttonSecondary}>
          <Text style={styles.buttonTextSecondary}>Gửi thông báo test</Text>
        </Pressable>

        <Text style={styles.help}>{pushInfo}</Text>

        {token ? (
          <Text style={styles.token}>Expo Push Token: {token}</Text>
        ) : (
          <Text style={styles.help}>Expo Push Token: (không có)</Text>
        )}

        {isAuthed && (
          <Text style={styles.help}>Trang web này chỉ dành cho developer. Vui lòng không chia sẻ thông tin đăng nhập.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 12 },
  titleSmall: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 8 },
  label: { fontSize: 12, color: "#111", marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  message: { marginTop: 10, fontSize: 12 },
  ok: { color: "#111" },
  err: { color: "#b00020" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 16 },
  buttonSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#fff",
    marginBottom: 10,
    marginTop: 10,
  },
  buttonTextSecondary: { color: "#111", fontWeight: "700" },
  help: { fontSize: 12, color: "#444", marginTop: 6 },
  token: { fontSize: 12, color: "#111", marginTop: 6 },
});
