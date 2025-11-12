import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMonitoring } from '@/lib/monitoring-context';

export default function SearchScreen() {
  const {
    locationQuery,
    setLocationQuery,
    coordinateLabel,
    activeSite,
    divisionLabel,
    provinceError,
    isFetchingProvinces,
    locationSuggestions,
    handleSelectSite,
    isResolvingSelection,
  } = useMonitoring();

  const currentFocus = activeSite ? `${activeSite.name} - ${divisionLabel}` : 'No province selected yet.';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Search site</Text>
      <Text style={styles.subtitle}>Choose a Vietnamese province or city to monitor.</Text>
      <View style={styles.card}>
        <TextInput
          placeholder="Type a province"
          placeholderTextColor="#94a3b8"
          value={locationQuery}
          onChangeText={setLocationQuery}
          style={styles.input}
        />
        <Text style={styles.muted}>{coordinateLabel}</Text>
        <Text style={styles.helper}>{currentFocus}</Text>
        {provinceError ? <Text style={styles.error}>{provinceError}</Text> : null}
        {isFetchingProvinces && !locationSuggestions.length ? (
          <View style={styles.inline}>
            <ActivityIndicator size="small" />
            <Text style={styles.muted}>Loading provinces...</Text>
          </View>
        ) : null}
        <View style={styles.suggestionList}>
          {locationSuggestions.map((site) => (
            <Pressable key={site.code} style={styles.suggestion} onPress={() => handleSelectSite(site)}>
              <Text style={styles.suggestionName}>{site.name}</Text>
            </Pressable>
          ))}
        </View>
        {isResolvingSelection ? (
          <View style={styles.inline}>
            <ActivityIndicator size="small" />
            <Text style={styles.muted}>Resolving coordinates...</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    gap: 16,
    backgroundColor: '#ffffff',
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  muted: {
    fontSize: 13,
    color: '#6b7280',
  },
  helper: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionList: {
    gap: 8,
  },
  suggestion: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionName: {
    fontSize: 15,
    color: '#0f172a',
  },
});
