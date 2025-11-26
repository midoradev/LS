import { Stack } from "expo-router";
import { SettingsProvider } from "../providers/settings-context";

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack>
    </SettingsProvider>
  );
}
