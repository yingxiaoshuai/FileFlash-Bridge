import React from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {Menu} from 'react-native-paper';

import {styles} from '../appShellStyles';
import {ActionButton, PanelSurface} from '../ui';
import {
  APP_LOCALE_OPTIONS,
  createAppTranslator,
} from '../../modules/localization/i18n';
import type {AppLocale} from '../../modules/localization/i18n';

type TranslateApp = ReturnType<typeof createAppTranslator>;

type SettingsScreenProps = {
  currentLocaleLabel: string;
  isBusy: boolean;
  isLocaleMenuVisible: boolean;
  isQuickLocaleMenuVisible: boolean;
  locale: AppLocale;
  onDismissLocaleMenu: () => void;
  onDismissQuickLocaleMenu: () => void;
  onOpenLocaleMenu: () => void;
  onOpenQuickLocaleMenu: () => void;
  onSelectLocale: (locale: AppLocale) => void;
  pagePadding: number;
  tabBarPadding: number;
  t: TranslateApp;
};

export function SettingsScreen({
  currentLocaleLabel,
  isBusy,
  isLocaleMenuVisible,
  isQuickLocaleMenuVisible,
  locale,
  onDismissLocaleMenu,
  onDismissQuickLocaleMenu,
  onOpenLocaleMenu,
  onOpenQuickLocaleMenu,
  onSelectLocale,
  pagePadding,
  tabBarPadding,
  t,
}: SettingsScreenProps) {
  return (
    <View style={styles.screenSection}>
      <View
        style={[
          styles.screenHeaderShell,
          styles.settingsHeaderShell,
          {
            paddingHorizontal: pagePadding,
          },
        ]}>
        <View style={styles.settingsTopBar}>
          <Menu
            anchor={
              <View style={styles.localeMenuAnchor}>
                <QuickSelectButton
                  accessibilityLabel={t('settings.language.openMenu')}
                  disabled={isBusy}
                  label={`${currentLocaleLabel} ▾`}
                  onPress={onOpenQuickLocaleMenu}
                  testID="settings-locale-menu-open"
                />
              </View>
            }
            anchorPosition="bottom"
            onDismiss={onDismissQuickLocaleMenu}
            statusBarHeight={0}
            testID="settings-locale-menu"
            visible={isQuickLocaleMenuVisible}>
            {APP_LOCALE_OPTIONS.map(option => (
              <Menu.Item
                key={`settings-${option.value}`}
                onPress={() => {
                  onSelectLocale(option.value);
                }}
                testID={`settings-locale-menu-item-${option.value}`}
                title={t(option.labelKey)}
                titleStyle={
                  option.value === locale
                    ? styles.localeMenuItemActiveLabel
                    : undefined
                }
              />
            ))}
          </Menu>
        </View>
      </View>

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.page,
          styles.settingsPage,
          {
            paddingHorizontal: pagePadding,
            paddingTop: 8,
            paddingBottom: tabBarPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <PanelSurface style={styles.settingsCard}>
          <Text style={styles.settingsSectionLabel}>{t('settings.preferences')}</Text>
          <Menu
            anchor={
              <Pressable
                onPress={onOpenLocaleMenu}
                style={styles.settingsRow}
                testID="settings-language-item">
                <View style={styles.settingsRowLead}>
                  <View style={styles.settingsIconWrap}>
                    <Text style={styles.settingsIcon}>文A</Text>
                  </View>
                  <View style={styles.settingsRowText}>
                    <Text style={styles.settingsRowTitle}>
                      {t('settings.language.title')}
                    </Text>
                    <Text style={styles.settingsRowDescription}>
                      {t('settings.language.description')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.settingsRowValue}>{currentLocaleLabel}</Text>
              </Pressable>
            }
            anchorPosition="bottom"
            onDismiss={onDismissLocaleMenu}
            statusBarHeight={0}
            testID="settings-language-menu"
            visible={isLocaleMenuVisible}>
            {APP_LOCALE_OPTIONS.map(option => (
              <Menu.Item
                key={`settings-item-${option.value}`}
                onPress={() => {
                  onSelectLocale(option.value);
                }}
                testID={`settings-language-menu-item-${option.value}`}
                title={t(option.labelKey)}
                titleStyle={
                  option.value === locale
                    ? styles.localeMenuItemActiveLabel
                    : undefined
                }
              />
            ))}
          </Menu>
        </PanelSurface>
      </ScrollView>
    </View>
  );
}

type QuickSelectButtonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID: string;
};

function QuickSelectButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  testID,
}: QuickSelectButtonProps) {
  return (
    <ActionButton
      accessibilityLabel={accessibilityLabel}
      compact
      disabled={disabled}
      label={label}
      onPress={onPress}
      testID={testID}
      tone="secondary"
    />
  );
}
