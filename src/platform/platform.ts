import { Platform } from 'react-native';

export function isHarmonyPlatform(os = Platform.OS) {
  const platformOs = os as string;
  return platformOs === 'harmony' || platformOs === 'ohos';
}

export function createUnsupportedHarmonyFeatureError(feature: string) {
  return new Error(
    `HarmonyOS support for ${feature} has not been implemented yet.`,
  );
}
