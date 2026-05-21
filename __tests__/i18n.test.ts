import { resolveAppLocaleFromLanguageTag } from '../src/modules/localization/i18n';

describe('app locale resolution', () => {
  test('maps Chinese device language tags to Chinese and every other language to English', () => {
    expect(resolveAppLocaleFromLanguageTag('zh-CN')).toBe('zh-CN');
    expect(resolveAppLocaleFromLanguageTag('zh_Hans_CN')).toBe('zh-CN');
    expect(resolveAppLocaleFromLanguageTag('zh-TW')).toBe('zh-CN');
    expect(resolveAppLocaleFromLanguageTag('en-US')).toBe('en-US');
    expect(resolveAppLocaleFromLanguageTag('ja-JP')).toBe('en-US');
    expect(resolveAppLocaleFromLanguageTag(undefined)).toBe('en-US');
  });
});
