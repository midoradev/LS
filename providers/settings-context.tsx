import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  useRef,
} from "react";
import * as Device from "expo-device";
import type { AsyncStorageStatic } from "@react-native-async-storage/async-storage";
import { fetchFirebaseJson, patchFirebaseJson } from "../lib/firebase";

type LocalConfig = {
  id?: string;
  lang?: string;
  notifications?: boolean;
  device?: DeviceSnapshot;
};

export type Settings = {
  id?: string;
  lang: string;
  notifications: boolean;
};

type DeviceSnapshot = {
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  modelId: string | null;
  osName: string | null;
  osVersion: string | null;
  osBuildId: string | null;
  osInternalBuildId: string | null;
  deviceName: string | null;
  deviceType: number | null;
  designName: string | null;
  productName: string | null;
  platformApiLevel: number | null;
  supportedCpuArchitectures: string[] | null;
  totalMemory: number | null;
};

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetDefaults: () => void;
};

const localConfig = require("../assets/data/local.json") as LocalConfig;

const defaultSettings: Settings = {
  id: localConfig?.id,
  lang: localConfig?.lang ?? "vi",
  notifications: localConfig?.notifications !== false,
};

const storageKey = "ls2_settings";

const SettingsContext = createContext<SettingsContextValue | null>(null);

const sanitizeSettingsPatch = (value: unknown): Partial<Settings> => {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const patch: Partial<Settings> = {};
  if (typeof record.id === "string") patch.id = record.id;
  if (typeof record.lang === "string") patch.lang = record.lang;
  if (typeof record.notifications === "boolean") patch.notifications = record.notifications;
  return patch;
};

let asyncStoragePromise: Promise<AsyncStorageStatic | null> | null = null;
const resolveAsyncStorage = () => {
  asyncStoragePromise ??= import("@react-native-async-storage/async-storage")
    .then((mod) => {
      const storage = mod?.default;
      if (
        storage &&
        typeof storage.getItem === "function" &&
        typeof storage.setItem === "function"
      ) {
        return storage;
      }
      return null;
    })
    .catch((error) => {
      console.warn(
        "AsyncStorage native module unavailable; skipping native persistence.",
        error
      );
      return null;
    });
  return asyncStoragePromise;
};

const getLocalStorage = () => {
  const ls = (
    globalThis as { localStorage?: { getItem?: unknown; setItem?: unknown } }
  ).localStorage;
  if (
    ls &&
    typeof ls.getItem === "function" &&
    typeof ls.setItem === "function"
  ) {
    return ls as {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
    };
  }
  return null;
};

const createDeviceSnapshot = (): DeviceSnapshot => ({
  brand: Device.brand ?? null,
  manufacturer: Device.manufacturer ?? null,
  modelName: Device.modelName ?? null,
  modelId: Device.modelId ?? null,
  osName: Device.osName ?? null,
  osVersion: Device.osVersion ?? null,
  osBuildId: Device.osBuildId ?? null,
  osInternalBuildId: Device.osInternalBuildId ?? null,
  deviceName: Device.deviceName ?? null,
  deviceType: Device.deviceType ?? null,
  designName: Device.designName ?? null,
  productName: Device.productName ?? null,
  platformApiLevel: Device.platformApiLevel ?? null,
  supportedCpuArchitectures: Device.supportedCpuArchitectures ?? null,
  totalMemory: Device.totalMemory ?? null,
});

const generateLocalId = () => {
  const cryptoObj = (globalThis as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => void };
  }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // RFC4122 v4 variant
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const segments = [
      Array.from(bytes.slice(0, 4)).map(toHex).join(""),
      Array.from(bytes.slice(4, 6)).map(toHex).join(""),
      Array.from(bytes.slice(6, 8)).map(toHex).join(""),
      Array.from(bytes.slice(8, 10)).map(toHex).join(""),
      Array.from(bytes.slice(10, 16)).map(toHex).join(""),
    ];
    return segments.join("-");
  }
  return `local_${Math.random().toString(36).slice(2, 10)}`;
};

export function SettingsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const idEnsured = useRef(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const deviceSnapshot = useMemo(() => createDeviceSnapshot(), []);
  const asyncStorageRef = useRef<AsyncStorageStatic | null>(null);

  useEffect(() => {
    const load = async () => {
      const storage = getLocalStorage();
      const localStored = (() => {
        if (!storage) return null;
        try {
          const raw = storage.getItem(storageKey);
          return raw ? sanitizeSettingsPatch(JSON.parse(raw)) : null;
        } catch (error) {
          console.warn("Không thể đọc cài đặt đã lưu (localStorage):", error);
          return null;
        }
      })();

      let asyncStored: Partial<Settings> | null = null;
      asyncStorageRef.current = await resolveAsyncStorage();
      if (asyncStorageRef.current) {
        try {
          const raw = await asyncStorageRef.current.getItem(storageKey);
          asyncStored = raw ? sanitizeSettingsPatch(JSON.parse(raw)) : null;
        } catch (error) {
          console.warn("Không thể đọc cài đặt đã lưu (AsyncStorage):", error);
        }
      }

      const merged = { ...localStored, ...asyncStored };
      if (Object.keys(merged).length) {
        setSettings((prev) => ({ ...prev, ...merged }));
      }
      setStorageHydrated(true);
    };
    load();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCloudSettings = async () => {
      if (!settings.id || settings.id.includes("{id}")) return;
      const remote = await fetchFirebaseJson<{ settings?: unknown }>(
        `devices/${settings.id}`,
        controller.signal
      );
      const remoteSettings = sanitizeSettingsPatch(remote?.settings);
      if (Object.keys(remoteSettings).length && !controller.signal.aborted) {
        setSettings((prev) => ({ ...prev, ...remoteSettings }));
      }
    };
    loadCloudSettings();
    return () => controller.abort();
  }, [settings.id]);

  useEffect(() => {
    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.setItem(storageKey, JSON.stringify(settings));
      } catch (error) {
        console.warn("Không thể lưu cài đặt (localStorage):", error);
      }
    }

    asyncStorageRef.current
      ?.setItem(storageKey, JSON.stringify(settings))
      .catch((error) => {
        console.warn("Không thể lưu cài đặt (AsyncStorage):", error);
      });
  }, [settings]);

  useEffect(() => {
    if (!settings.id || settings.id.includes("{id}")) return;
    const payload = {
      settings,
      device: deviceSnapshot,
      recordedAt: new Date().toISOString(),
    };
    patchFirebaseJson(`devices/${settings.id}`, payload);
  }, [settings, deviceSnapshot]);

  useEffect(() => {
    if (idEnsured.current) return;
    if (!storageHydrated) return;
    if (settings.id && !settings.id.includes("{id}")) {
      idEnsured.current = true;
      return;
    }
    const newId = generateLocalId();
    setSettings((prev) => ({ ...prev, id: newId }));
    idEnsured.current = true;
  }, [storageHydrated, settings.id]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings((prev) => ({ ...defaultSettings, id: prev.id ?? defaultSettings.id }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetDefaults,
    }),
    [settings, updateSettings, resetDefaults]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings phải được sử dụng bên trong SettingsProvider");
  }
  return value;
};

export const getDefaultSettings = () => defaultSettings;
