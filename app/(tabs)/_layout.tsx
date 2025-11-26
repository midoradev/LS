import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Trang chủ</Label>
        <Icon sf="house.fill" drawable="custom_android_home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="screen">
        <Label>Bản đồ</Label>
        <Icon sf="map.fill" drawable="custom_android_map" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
