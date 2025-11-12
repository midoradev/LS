import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type LinkItem = {
  key: string;
  label: string;
  description?: string;
};

const quickLinks: LinkItem[] = [
  { key: 'about', label: 'About app', description: 'Version, build, acknowledgements' },
  { key: 'privacy', label: 'Privacy policy' },
  { key: 'terms', label: 'Terms and conditions' },
  { key: 'cookies', label: 'Cookies policy' },
  { key: 'contact', label: 'Contact support', description: 'landsafe@gmail.com' },
];

const languageOptions = ['English', 'Tiếng Việt'];
const unitOptions = ['Metric', 'Imperial'];

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions[0]);
  const [selectedUnit, setSelectedUnit] = useState(unitOptions[0]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Control alerts, preferences, and policies.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowSubtitle}>Push alerts for critical slope activity</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#cbd5f5', true: '#0ea5e9' }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Dark mode</Text>
            <Text style={styles.rowSubtitle}>Dim UI for night patrols</Text>
          </View>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            trackColor={{ false: '#cbd5f5', true: '#0ea5e9' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Languages</Text>
        <View style={styles.chipRow}>
          {languageOptions.map((option) => {
            const active = selectedLanguage === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSelectedLanguage(option)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Units</Text>
        <View style={styles.chipRow}>
          {unitOptions.map((option) => {
            const active = selectedUnit === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSelectedUnit(option)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          Metric uses millimeters and centimeters per second squared. Imperial uses inches and ft/s^2.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>More</Text>
        {quickLinks.map((item, index) => (
          <View key={item.key}>
            <Pressable style={styles.linkRow} onPress={() => {}}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.label}</Text>
                {item.description ? <Text style={styles.rowSubtitle}>{item.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            {index < quickLinks.length - 1 ? <View style={styles.linkDivider} /> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  chipText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  helperText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  linkDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});
