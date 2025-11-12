import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { MonitoringProvider } from "@/lib/monitoring-context";

export default function TabLayout() {
  return (
    <MonitoringProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon sf="house.fill" drawable="custom_android_home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="search" role="search">
          <Label>Search</Label>
          <Icon sf="magnifyingglass" drawable="custom_android_search" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf="gearshape.fill" drawable="custom_android_settings" />
          <Label>Settings</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </MonitoringProvider>
  );
}
