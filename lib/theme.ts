export type Theme = {
  background: string;
  card: string;
  softCard: string;
  border: string;
  text: string;
  subtext: string;
  icon: string;
  accent: string;
  danger: string;
  track: string;
  statusBar: "light" | "dark";
};

const lightTheme: Theme = {
  background: "#ffffff",
  card: "#ffffff",
  softCard: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  subtext: "#475569",
  icon: "#0f172a",
  accent: "#15803d",
  danger: "#dc2626",
  track: "#f1f5f9",
  statusBar: "dark",
};

const darkTheme: Theme = {
  background: "#0b1220",
  card: "#0f172a",
  softCard: "#111827",
  border: "#1f2937",
  text: "#e2e8f0",
  subtext: "#cbd5e1",
  icon: "#e2e8f0",
  accent: "#22c55e",
  danger: "#ef4444",
  track: "#1f2937",
  statusBar: "light",
};

export const getTheme = (mode: "light" | "dark") =>
  mode === "dark" ? darkTheme : lightTheme;
