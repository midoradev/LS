import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Keyboard } from 'react-native';
import * as Location from 'expo-location';

export type ProvinceRecord = {
  name: string;
  code: number;
  division_type: string;
  codename: string;
};

export type ActiveSite = {
  code: number;
  name: string;
  divisionType: string;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

type LocationStatus = 'idle' | 'locating' | 'denied' | 'error' | 'ready';

type MonitoringContextValue = {
  provinces: ProvinceRecord[];
  activeSite: ActiveSite | null;
  locationQuery: string;
  setLocationQuery: (value: string) => void;
  activeCoords: Coordinates | null;
  isFetchingProvinces: boolean;
  provinceError: string | null;
  locationStatus: LocationStatus;
  isResolvingSelection: boolean;
  locationSuggestions: ProvinceRecord[];
  handleSelectSite: (province: ProvinceRecord) => Promise<void>;
  coordinateLabel: string;
  monitoringLabel: string;
  divisionLabel: string;
  currentLocationLabel: string | null;
};

const MonitoringContext = createContext<MonitoringContextValue | undefined>(undefined);

const PROVINCES_ENDPOINT = 'https://provinces.open-api.vn/api/?depth=1';

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const toTitleCase = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Province';

const toActiveSite = (province: ProvinceRecord): ActiveSite => ({
  code: province.code,
  name: province.name,
  divisionType: province.division_type,
});

type ProviderProps = {
  children: ReactNode;
};

export function MonitoringProvider({ children }: ProviderProps) {
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [activeSite, setActiveSite] = useState<ActiveSite | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [activeCoords, setActiveCoords] = useState<Coordinates | null>(null);
  const [isFetchingProvinces, setIsFetchingProvinces] = useState(false);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [isResolvingSelection, setIsResolvingSelection] = useState(false);
  const [hasAttemptedAutoLocate, setHasAttemptedAutoLocate] = useState(false);
  const [currentLocationLabel, setCurrentLocationLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProvinces = async () => {
      setIsFetchingProvinces(true);
      setProvinceError(null);
      try {
        const response = await fetch(PROVINCES_ENDPOINT);
        if (!response.ok) throw new Error('Failed to load provinces');
        const payload: ProvinceRecord[] = await response.json();
        if (!cancelled) setProvinces(payload);
      } catch {
        if (!cancelled) setProvinceError('Cannot reach provinces API right now.');
      } finally {
        if (!cancelled) setIsFetchingProvinces(false);
      }
    };

    loadProvinces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSite || !provinces.length) return;
    const fallback = toActiveSite(provinces[0]);
    setActiveSite(fallback);
    setLocationQuery(fallback.name);
  }, [provinces, activeSite]);

  useEffect(() => {
    if (!provinces.length || hasAttemptedAutoLocate) return;
    let cancelled = false;
    const resolveDeviceLocation = async () => {
      setHasAttemptedAutoLocate(true);
      try {
        setLocationStatus('locating');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationStatus('denied');
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const coords: Coordinates = {
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        };
        setActiveCoords(coords);
        const reverse = await Location.reverseGeocodeAsync({
          latitude: coords.lat,
          longitude: coords.lng,
        });
        if (cancelled) return;
        const label =
          reverse[0]?.region ??
          reverse[0]?.city ??
          reverse[0]?.subregion ??
          reverse[0]?.district ??
          reverse[0]?.name ??
          null;
        if (label) {
          setCurrentLocationLabel(label);
          const match =
            provinces.find((province) => {
              const normalizedProvince = normalizeName(province.name);
              const normalizedLabel = normalizeName(label);
              return (
                normalizedProvince.includes(normalizedLabel) ||
                normalizedLabel.includes(normalizedProvince)
              );
            }) ?? null;
          if (match) {
            const swiftSite = toActiveSite(match);
            setActiveSite(swiftSite);
            setLocationQuery(swiftSite.name);
          }
        }
        setLocationStatus('ready');
      } catch {
        if (!cancelled) setLocationStatus('error');
      }
    };

    resolveDeviceLocation();
    return () => {
      cancelled = true;
    };
  }, [provinces, hasAttemptedAutoLocate]);

  const locationSuggestions = useMemo(() => {
    if (!provinces.length) return [];
    const trimmed = locationQuery.trim();
    const normalizedQuery = trimmed ? normalizeName(trimmed) : '';
    const list = normalizedQuery
      ? provinces.filter((province) => normalizeName(province.name).includes(normalizedQuery))
      : provinces;
    return list.slice(0, 6);
  }, [locationQuery, provinces]);

  const handleSelectSite = useCallback(
    async (province: ProvinceRecord) => {
      const selected = toActiveSite(province);
      setActiveSite(selected);
      setLocationQuery(province.name);
      setCurrentLocationLabel(province.name);
      Keyboard.dismiss();
      setIsResolvingSelection(true);
      try {
        const results = await Location.geocodeAsync(`${province.name}, Vietnam`);
        if (results.length) {
          setActiveCoords({
            lat: results[0].latitude,
            lng: results[0].longitude,
          });
        }
      } catch {
        // silent fail for geocode
      } finally {
        setIsResolvingSelection(false);
      }
    },
    [],
  );

  const coordinateLabel = activeCoords
    ? `${activeCoords.lat.toFixed(2)}N, ${activeCoords.lng.toFixed(2)}E`
    : locationStatus === 'locating'
      ? 'Detecting your device location...'
      : locationStatus === 'denied'
        ? 'Location access denied. Select a province manually.'
        : locationStatus === 'error'
          ? 'Unable to resolve your position.'
          : 'Pick a province to focus monitoring.';

  const divisionLabel = toTitleCase(activeSite?.divisionType);
  const monitoringLabel = activeSite?.name ?? (provinceError ? 'Unavailable' : 'Select a province');

  const value = useMemo(
    () => ({
      provinces,
      activeSite,
      locationQuery,
      setLocationQuery,
      activeCoords,
      isFetchingProvinces,
      provinceError,
      locationStatus,
      isResolvingSelection,
      locationSuggestions,
      handleSelectSite,
      coordinateLabel,
      monitoringLabel,
      divisionLabel,
      currentLocationLabel,
    }),
    [
      provinces,
      activeSite,
      locationQuery,
      activeCoords,
      isFetchingProvinces,
      provinceError,
      locationStatus,
      isResolvingSelection,
      locationSuggestions,
      handleSelectSite,
      coordinateLabel,
      monitoringLabel,
      divisionLabel,
      currentLocationLabel,
    ],
  );

  return <MonitoringContext.Provider value={value}>{children}</MonitoringContext.Provider>;
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within MonitoringProvider');
  }
  return context;
}
