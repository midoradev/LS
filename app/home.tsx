import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMonitoring } from '@/lib/monitoring-context';

type SensorSnapshot = {
  soilMoisture: number;
  slopeAngle: number;
  rainfall24h: number;
  groundVibration: number;
};

type RiskBand = 'Stable' | 'Guarded' | 'Elevated' | 'High' | 'Severe';

const SERIOUSNESS_COLORS: Record<RiskBand, string> = {
  Stable: '#15803d',
  Guarded: '#2563eb',
  Elevated: '#b45309',
  High: '#f97316',
  Severe: '#dc2626',
};

const normalize = (value: number, min: number, max: number) =>
  Math.min(1, Math.max(0, (value - min) / (max - min)));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const createInitialSnapshot = (): SensorSnapshot => ({
  soilMoisture: randomBetween(58, 78),
  slopeAngle: randomBetween(31, 42),
  rainfall24h: randomBetween(90, 150),
  groundVibration: randomBetween(0.2, 0.85),
});

const jitter = (value: number, min: number, max: number, delta: number) =>
  clamp(value + (Math.random() - 0.5) * delta, min, max);

const evolveSnapshot = (snapshot: SensorSnapshot): SensorSnapshot => ({
  soilMoisture: jitter(snapshot.soilMoisture, 45, 90, 2.5),
  slopeAngle: jitter(snapshot.slopeAngle, 26, 48, 1),
  rainfall24h: jitter(snapshot.rainfall24h, 60, 180, 6),
  groundVibration: jitter(snapshot.groundVibration, 0.1, 1.2, 0.12),
});

const describeBand = (score: number): RiskBand => {
  if (score >= 0.8) return 'Severe';
  if (score >= 0.65) return 'High';
  if (score >= 0.45) return 'Elevated';
  if (score >= 0.28) return 'Guarded';
  return 'Stable';
};

export default function HomeScreen() {
  const [sensorSnapshot, setSensorSnapshot] = useState<SensorSnapshot>(() => createInitialSnapshot());
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const {
    activeSite,
    coordinateLabel,
    monitoringLabel,
    divisionLabel,
    currentLocationLabel,
    locationStatus,
  } = useMonitoring();
  const locationHeadline =
    currentLocationLabel ??
    (locationStatus === 'locating' ? 'Detecting your position...' : monitoringLabel);
  const locationSubhead = activeSite ? `${activeSite.name} - ${divisionLabel}` : monitoringLabel;
  const handleOpenSearch = () => router.push('/search');

  useEffect(() => {
    const id = setInterval(() => {
      setSensorSnapshot((current) => evolveSnapshot(current));
      setLastUpdated(new Date());
    }, 4500);

    return () => clearInterval(id);
  }, []);

  const normalized = useMemo(
    () => ({
      soilMoisture: normalize(sensorSnapshot.soilMoisture, 30, 95),
      slopeAngle: normalize(sensorSnapshot.slopeAngle, 10, 55),
      rainfall24h: normalize(sensorSnapshot.rainfall24h, 20, 200),
      groundVibration: normalize(sensorSnapshot.groundVibration, 0.05, 1.4),
    }),
    [sensorSnapshot],
  );

  const weights = {
    soilMoisture: 0.32,
    slopeAngle: 0.31,
    rainfall24h: 0.22,
    groundVibration: 0.15,
  };

  const weightedScore =
    normalized.soilMoisture * weights.soilMoisture +
    normalized.slopeAngle * weights.slopeAngle +
    normalized.rainfall24h * weights.rainfall24h +
    normalized.groundVibration * weights.groundVibration;

  const probability = clamp(0.18 + weightedScore * 0.92, 0, 1);
  const probabilityPercent = Math.round(probability * 100);
  const band = describeBand(probability);
  const severityColor = SERIOUSNESS_COLORS[band];
  const sensorConfidence = Math.round(68 + normalized.groundVibration * 20 + normalized.soilMoisture * 12);

  const forecasts = useMemo(() => {
    const horizons = [1, 3, 6];
    return horizons.map((hours) => {
      const rainfallPressure = (normalized.rainfall24h - 0.5) * 0.2;
      const slopePressure = (normalized.slopeAngle - 0.5) * 0.15;
      const projected = clamp(probability + (hours / 6) * (rainfallPressure + slopePressure), 0, 1);
      return {
        hours,
        projected,
        band: describeBand(projected),
      };
    });
  }, [normalized.rainfall24h, normalized.slopeAngle, probability]);

  const factors = (Object.keys(weights) as (keyof typeof weights)[]).map((key) => ({
    key,
    label:
      key === 'soilMoisture'
        ? 'Soil moisture'
        : key === 'slopeAngle'
          ? 'Slope angle'
          : key === 'rainfall24h'
            ? '24h rainfall'
            : 'Ground vibration',
    value:
      key === 'soilMoisture'
        ? `${sensorSnapshot.soilMoisture.toFixed(1)}%`
        : key === 'slopeAngle'
          ? `${sensorSnapshot.slopeAngle.toFixed(1)} deg`
          : key === 'rainfall24h'
            ? `${sensorSnapshot.rainfall24h.toFixed(0)} mm`
            : `${sensorSnapshot.groundVibration.toFixed(2)} cm/s^2`,
    level: normalized[key as keyof SensorSnapshot],
    color:
      key === 'soilMoisture'
        ? '#0ea5e9'
        : key === 'slopeAngle'
          ? '#a855f7'
          : key === 'rainfall24h'
            ? '#22c55e'
            : '#fb923c',
  }));

  const dominantFactor = factors.reduce((top, current) => {
    if (!top) return current;
    const topScore = top.level * weights[top.key as keyof typeof weights];
    const currentScore = current.level * weights[current.key as keyof typeof weights];
    return currentScore > topScore ? current : top;
  }, factors[0]);

  const mitigationSteps = useMemo(() => {
    if (probability >= 0.75) {
      return [
        'Relocate exposed households immediately.',
        'Limit road access to responders only.',
        'Launch drone scans every 15 minutes.',
      ];
    }
    if (probability >= 0.55) {
      return [
        'Send hourly advisories via SMS.',
        'Inspect drainage paths for obstructions.',
        'Stage response gear near the access trail.',
      ];
    }
    if (probability >= 0.35) {
      return [
        'Patrol the slope for fresh cracks.',
        'Coordinate rainfall readings with LGU.',
        'Verify rain gauges before midnight.',
      ];
    }
    return [
      'Monitor every six hours.',
      'Share calm status with the community.',
      'Sync sensors after each drizzle event.',
    ];
  }, [probability]);

  const updatedAtLabel = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>Current focus</Text>
          <Text style={styles.headerTitle}>{locationHeadline}</Text>
          <Text style={styles.headerSubtitle}>{locationSubhead}</Text>
          <Text style={styles.headerMeta}>{coordinateLabel}</Text>
        </View>
        <Pressable style={styles.searchButton} onPress={handleOpenSearch}>
          <Ionicons name="search-outline" size={18} color="#0f172a" />
          <Text style={styles.searchButtonText}>Search site</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Risk probability</Text>
        <View style={styles.riskRow}>
          <Text style={[styles.riskValue, { color: severityColor }]}>{probabilityPercent}%</Text>
          <View>
            <Text style={styles.bandTitle}>{band} risk</Text>
            <Text style={styles.muted}>{`Updated ${updatedAtLabel}`}</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Sensor confidence</Text>
          <Text style={styles.statValue}>{sensorConfidence}%</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Primary driver</Text>
          <Text style={styles.statValue}>{dominantFactor?.label ?? 'Unknown'}</Text>
        </View>
        <View style={styles.forecastRow}>
          {forecasts.map((forecast) => (
            <View key={forecast.hours} style={styles.forecastCard}>
              <Text style={styles.forecastTitle}>{`+${forecast.hours}h`}</Text>
              <Text style={[styles.forecastValue, { color: SERIOUSNESS_COLORS[forecast.band] }]}>
                {`${Math.round(forecast.projected * 100)}%`}
              </Text>
              <Text style={styles.forecastLabel}>{forecast.band}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Risk drivers</Text>
        {factors.map((factor) => (
          <View key={factor.key} style={styles.factorRow}>
            <View style={[styles.factorLevel, { backgroundColor: factor.color, width: `${factor.level * 100}%` }]} />
            <View style={styles.factorMeta}>
              <Text style={styles.factorTitle}>{factor.label}</Text>
              <Text style={styles.factorValue}>{factor.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Suggested actions</Text>
        {mitigationSteps.map((step, index) => (
          <Text key={step} style={styles.step}>
            {`${index + 1}. ${step}`}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    backgroundColor: '#fff',
    gap: 16,
  },
  header: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  headerMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  muted: {
    fontSize: 13,
    color: '#6b7280',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riskValue: {
    fontSize: 38,
    fontWeight: '700',
  },
  bandTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
    color: '#475569',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastCard: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  forecastTitle: {
    fontSize: 13,
    color: '#64748b',
  },
  forecastValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  forecastLabel: {
    fontSize: 13,
    color: '#475569',
  },
  factorRow: {
    marginTop: 8,
  },
  factorLevel: {
    height: 8,
    borderRadius: 999,
  },
  factorMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  factorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  factorValue: {
    fontSize: 14,
    color: '#475569',
  },
  step: {
    fontSize: 14,
    color: '#0f172a',
  },
});
