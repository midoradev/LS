import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSettings } from "../providers/settings-context";
import { getCopy } from "../lib/copy";
import { getTheme, type Theme } from "../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const copy = useMemo(() => getCopy(settings.lang), [settings.lang]);
  const theme = useMemo(() => getTheme(), []);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const langOptions = copy.settings.languages;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={18} color={theme.icon} />
            <Text style={styles.backText}>{copy.common.back}</Text>
          </Pressable>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{copy.settings.title}</Text>
          <Text style={styles.subtitle}>{copy.settings.subtitle}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>{copy.settings.notificationsTitle}</Text>
            <Text style={styles.sectionHint}>{copy.settings.notificationsHint}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{copy.settings.riskAlertsTitle}</Text>
              <Text style={styles.rowHint}>{copy.settings.riskAlertsHint}</Text>
            </View>
            <Switch
              value={settings.notifications}
              trackColor={{ false: theme.track, true: theme.accent }}
              onValueChange={(value) => updateSettings({ notifications: value })}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>{copy.settings.languageTitle}</Text>
            <Text style={styles.sectionHint}>{copy.settings.languageHint}</Text>
          </View>
          <View style={styles.chipRow}>
            {langOptions.map((lang) => {
              const active = settings.lang === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => updateSettings({ lang: lang.code })}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>{copy.settings.deviceInfoTitle}</Text>
            <Text style={styles.sectionHint}>{copy.settings.deviceInfoHint}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{copy.settings.deviceIdLabel}</Text>
            <Text style={styles.infoValue}>{settings.id ?? copy.common.stationIdFallback}</Text>
          </View>
          <Text style={styles.sectionHint}>
            {copy.settings.subtitle}
          </Text>
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
    container: {
      padding: 20,
      gap: 16,
      backgroundColor: theme.background,
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    backButtonPressed: {
      opacity: 0.6,
    },
    backText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },
    header: {
      gap: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.subtext,
    },
    section: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
      backgroundColor: theme.card,
    },
    sectionTop: {
      gap: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    sectionHint: {
      fontSize: 13,
      color: theme.subtext,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    rowText: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    rowHint: {
      fontSize: 13,
      color: theme.subtext,
    },
    chipRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.softCard,
    },
    chipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "600",
    },
    chipTextActive: {
      color: "#ffffff",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    infoLabel: {
      fontSize: 14,
      color: theme.subtext,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
  });
