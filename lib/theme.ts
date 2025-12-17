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

export const getTheme = () => lightTheme;
