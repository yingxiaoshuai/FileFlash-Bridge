import { NativeModules, Platform } from 'react-native';

import {
  AppLocale,
  resolveAppLocaleFromLanguageTag,
} from '../modules/localization/i18n';

type NativeSettingsManager = {
  settings?: {
    AppleLanguages?: string[];
    AppleLocale?: string;
  };
};

type NativeLocaleModule = {
  getConstants?: () => {
    localeIdentifier?: string;
  };
  localeIdentifier?: string;
};

function readNativeModule<T>(name: string): T | undefined {
  try {
    return (NativeModules as Record<string, T | undefined>)[name];
  } catch {
    return undefined;
  }
}

function readLocaleConstants(module?: NativeLocaleModule) {
  try {
    return module?.getConstants?.();
  } catch {
    return undefined;
  }
}

function readIntlLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

function collectDeviceLanguageTags() {
  const candidates: unknown[] = [];

  if (Platform.OS === 'ios') {
    const settingsManager =
      readNativeModule<NativeSettingsManager>('SettingsManager');
    const appleLanguages = settingsManager?.settings?.AppleLanguages;
    candidates.push(
      Array.isArray(appleLanguages) ? appleLanguages[0] : undefined,
      settingsManager?.settings?.AppleLocale,
    );
  }

  const i18nManager = readNativeModule<NativeLocaleModule>('I18nManager');
  const i18nConstants = readLocaleConstants(i18nManager);
  candidates.push(i18nConstants?.localeIdentifier, i18nManager?.localeIdentifier);

  const platformConstants =
    readNativeModule<NativeLocaleModule>('PlatformConstants');
  const platformLocaleConstants = readLocaleConstants(platformConstants);
  candidates.push(
    platformLocaleConstants?.localeIdentifier,
    platformConstants?.localeIdentifier,
  );

  candidates.push(readIntlLocale());

  return candidates.filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
}

export function getDeviceDefaultAppLocale(): AppLocale {
  return resolveAppLocaleFromLanguageTag(collectDeviceLanguageTags()[0]);
}
