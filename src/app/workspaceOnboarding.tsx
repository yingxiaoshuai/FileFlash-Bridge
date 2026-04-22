import React from 'react';
import {
  Insets,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {theme} from './theme';
import {ActionButton, GlyphIconButton, PanelSurface} from './ui';

export type WorkspaceTourAnchorRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type WorkspaceTourStep<AnchorId extends string = string> = {
  body: string;
  fallbackTarget?: AnchorId;
  id: string;
  target: AnchorId;
  title: string;
};

type GuidedTourTargetProps = {
  active?: boolean;
  captureRef?: (node: React.ElementRef<typeof View> | null) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function GuidedTourTarget({
  active,
  captureRef,
  children,
  style,
  testID,
}: GuidedTourTargetProps) {
  return (
    <View
      collapsable={false}
      ref={captureRef}
      style={[style, active ? styles.targetActive : null]}
      testID={testID}>
      {children}
    </View>
  );
}

type WorkspaceOnboardingOverlayProps = {
  activeRect?: WorkspaceTourAnchorRect;
  insets: Insets;
  onClose: () => void;
  onComplete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  showPrevious: boolean;
  step: WorkspaceTourStep;
  stepIndex: number;
  totalSteps: number;
};

export function WorkspaceOnboardingOverlay({
  activeRect,
  insets,
  onClose,
  onComplete,
  onNext,
  onPrevious,
  onSkip,
  showPrevious,
  step,
  stepIndex,
  totalSteps,
}: WorkspaceOnboardingOverlayProps) {
  const isLastStep = stepIndex === totalSteps - 1;
  const topInset = insets.top ?? 0;
  const rightInset = insets.right ?? 0;
  const bottomInset = insets.bottom ?? 0;
  const leftInset = insets.left ?? 0;

  return (
    <View style={styles.overlayRoot} testID="workspace-onboarding-overlay">
      <View style={styles.backdrop} />
      {activeRect ? (
        <View
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              height: activeRect.height + 16,
              left: Math.max(12, activeRect.x - 8),
              top: Math.max(topInset + 8, activeRect.y - 8),
              width: activeRect.width + 16,
            },
          ]}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.sheetWrap,
          {
            paddingBottom: Math.max(bottomInset, 12),
            paddingLeft: Math.max(leftInset, 12),
            paddingRight: Math.max(rightInset, 12),
            paddingTop: Math.max(topInset, 12),
          },
        ]}>
        <PanelSurface style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>
                {stepIndex + 1} / {totalSteps}
              </Text>
            </View>
            <GlyphIconButton
              accessibilityLabel="关闭引导"
              glyph="×"
              onPress={onClose}
              testID="workspace-onboarding-close"
            />
          </View>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
          <View style={styles.footer}>
            <View style={styles.secondaryActions}>
              <ActionButton
                compact
                label="跳过"
                onPress={onSkip}
                testID="workspace-onboarding-skip"
              />
              {showPrevious ? (
                <ActionButton
                  compact
                  label="上一步"
                  onPress={onPrevious}
                  testID="workspace-onboarding-previous"
                />
              ) : null}
            </View>
            <ActionButton
              compact
              label={isLastStep ? '完成' : '下一步'}
              onPress={isLastStep ? onComplete : onNext}
              testID={
                isLastStep
                  ? 'workspace-onboarding-complete'
                  : 'workspace-onboarding-next'
              }
              tone="primary"
            />
          </View>
        </PanelSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  backdrop: {
    backgroundColor: 'rgba(7, 15, 30, 0.56)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  focusRing: {
    borderColor: theme.colors.primary,
    borderRadius: 28,
    borderWidth: 2,
    position: 'absolute',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 420,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: '100%',
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressPill: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressPillText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: theme.colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetActive: {
    borderColor: theme.colors.primary,
    borderRadius: 28,
    borderWidth: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
});
