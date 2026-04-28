import React from 'react';
import {Text, View} from 'react-native';
import {SegmentedButtons} from 'react-native-paper';

import {styles} from '../appShellStyles';
import {createAppTranslator} from '../../modules/localization/i18n';
import type {AppTabId} from '../workspaceTypes';

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
  const renderGlyphIcon = React.useCallback(
    (glyph: string) =>
      ({color, size}: {color: string; size: number}) => (
        <Text
          style={[
            styles.segmentedTabGlyph,
            {
              color,
              fontSize: size * 0.95,
            },
          ]}>
          {glyph}
        </Text>
      ),
    [],
  );

  return (
    <View
      style={[
        styles.segmentedTabBar,
        {
          paddingBottom: 8,
        },
      ]}
      testID="bottom-tab-bar">
      <SegmentedButtons<AppTabId>
        buttons={[
          {
            accessibilityLabel: t('tabs.home'),
            icon: renderGlyphIcon('⌂'),
            label: t('tabs.home'),
            showSelectedCheck: false,
            testID: 'tab-home',
            value: 'home',
          },
          {
            accessibilityLabel: t('tabs.settings'),
            icon: renderGlyphIcon('⚙'),
            label: t('tabs.settings'),
            showSelectedCheck: false,
            testID: 'tab-settings',
            value: 'settings',
          },
        ]}
        density="small"
        onValueChange={value => {
          onTabChange(value);
        }}
        style={styles.segmentedTabs}
        value={activeTab}
      />
    </View>
  );
}
