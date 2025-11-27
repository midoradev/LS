import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SettingsMode = "light" | "dark";

type LocalConfig = {
  id?: string;
  lang?: string;
  mode?: SettingsMode;
  notifications?: boolean;
};

export type Settings = {
  id?: string;
  lang: string;
  mode: SettingsMode;
  notifications: boolean;
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
  mode: localConfig?.mode ?? "light",
  notifications: localConfig?.notifications !== false,
};

const storageKey = "ls2_settings";

const SettingsContext = createContext<SettingsContextValue | null>(null);

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

export function SettingsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage) return;

    try {
      const stored = storage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn("Không thể đọc cài đặt đã lưu:", error);
    }
  }, []);

  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage) return;

    try {
      storage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      console.warn("Không thể lưu cài đặt:", error);
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(defaultSettings);
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
