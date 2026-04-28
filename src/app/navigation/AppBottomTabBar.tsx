import React from 'react';
import { View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { styles } from '../appShellStyles';
import { theme } from '../theme';
import { HomeTabIcon, SettingsTabIcon } from '../icons/AppIcons';
import { createAppTranslator } from '../../modules/localization/i18n';
import type { AppTabId } from '../workspaceTypes';

type TranslateApp = ReturnType<typeof createAppTranslator>;

type AppBottomTabBarProps = {
  activeTab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  t: TranslateApp;
};

export function AppBottomTabBar({
  activeTab,
  onTabChange,
  t,
}: AppBottomTabBarProps) {
  return (
    <View
      style={[
        styles.segmentedTabBar,
        {
          paddingBottom: 4,
        },
      ]}
      testID="bottom-tab-bar"
    >
      <SegmentedButtons<AppTabId>
        buttons={[
          {
            accessibilityLabel: t('tabs.home'),
            checkedColor: theme.colors.primaryStrong,
            icon: ({ color, size }) => (
              <HomeTabIcon color={color} size={size * 0.95} />
            ),
            label: t('tabs.home'),
            labelStyle: styles.segmentedTabLabel,
            showSelectedCheck: false,
            style: styles.segmentedTabButton,
            testID: 'tab-home',
            uncheckedColor: theme.colors.inkSoft,
            value: 'home',
          },
          {
            accessibilityLabel: t('tabs.settings'),
            checkedColor: theme.colors.primaryStrong,
            icon: ({ color, size }) => (
              <SettingsTabIcon color={color} size={size * 0.95} />
            ),
            label: t('tabs.settings'),
            labelStyle: styles.segmentedTabLabel,
            showSelectedCheck: false,
            style: styles.segmentedTabButton,
            testID: 'tab-settings',
            uncheckedColor: theme.colors.inkSoft,
            value: 'settings',
          },
        ]}
        density="small"
        onValueChange={value => {
          onTabChange(value);
        }}
        style={styles.segmentedTabs}
        theme={{
          colors: {
            onSecondaryContainer: theme.colors.primaryStrong,
            onSurface: theme.colors.inkSoft,
            outline: 'transparent',
            secondaryContainer: theme.colors.primarySoft,
          },
        }}
        value={activeTab}
      />
    </View>
  );
}
