import React from 'react';
import {
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
  hostFrame: {
    height: number;
    width: number;
  };
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
  hostFrame,
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
  const [sheetHeight, setSheetHeight] = React.useState(0);
  const isLastStep = stepIndex === totalSteps - 1;
  const isPhoneLayout = hostFrame.width < 560;
  const overlayWidth = Math.max(0, hostFrame.width);
  const overlayHeight = Math.max(0, hostFrame.height);
  const anchorRect = activeRect;
  const ringPadding = isPhoneLayout ? 6 : 8;
  const focusRingRect = anchorRect
    ? (() => {
        const ringWidth = Math.min(
          overlayWidth - 24,
          anchorRect.width + ringPadding * 2,
        );
        const ringHeight = Math.min(
          overlayHeight - 24,
          anchorRect.height + ringPadding * 2,
        );

        return {
          height: ringHeight,
          left: clamp(anchorRect.x - ringPadding, 12, overlayWidth - ringWidth - 12),
          top: clamp(anchorRect.y - ringPadding, 12, overlayHeight - ringHeight - 12),
          width: ringWidth,
        };
      })()
    : undefined;
  const estimatedSheetHeight = sheetHeight || (isPhoneLayout ? 280 : 244);
  const phoneSheetFrame =
    isPhoneLayout && anchorRect
      ? (() => {
          const sheetWidth = Math.min(overlayWidth - 24, 380);
          const spaceBelow =
            overlayHeight - (anchorRect.y + anchorRect.height) - 16;
          const spaceAbove = anchorRect.y - 16;
          const preferBelow =
            spaceBelow >= estimatedSheetHeight || spaceBelow >= spaceAbove;

          return {
            left: clamp(anchorRect.x, 12, overlayWidth - sheetWidth - 12),
            top: preferBelow
              ? clamp(
                  anchorRect.y + anchorRect.height + 12,
                  12,
                  overlayHeight - estimatedSheetHeight - 12,
                )
              : clamp(
                  anchorRect.y - estimatedSheetHeight - 12,
                  12,
                  overlayHeight - estimatedSheetHeight - 12,
                ),
            width: sheetWidth,
          };
        })()
      : undefined;
  const sheetWrapperTestID = isPhoneLayout
    ? 'workspace-onboarding-sheet-phone'
    : 'workspace-onboarding-sheet-docked';

  return (
    <View style={styles.overlayRoot} testID="workspace-onboarding-overlay">
      <View style={styles.backdrop} />
      {focusRingRect ? (
        <View
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              height: focusRingRect.height,
              left: focusRingRect.left,
              top: focusRingRect.top,
              width: focusRingRect.width,
            },
          ]}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.sheetWrap,
          styles.sheetWrapPadded,
        ]}>
        <View
          onLayout={event => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== sheetHeight) {
              setSheetHeight(nextHeight);
            }
          }}
          style={[
            styles.sheetContainer,
            phoneSheetFrame
              ? [
                  styles.sheetContainerFloating,
                  {
                    left: phoneSheetFrame.left,
                    top: phoneSheetFrame.top,
                    width: phoneSheetFrame.width,
                  },
                ]
              : styles.sheetContainerDocked,
          ]}
          testID={sheetWrapperTestID}>
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
              <Text style={styles.title} testID="workspace-onboarding-title">
                {step.title}
              </Text>
              <Text style={styles.body} testID="workspace-onboarding-body">
                {step.body}
              </Text>
            </View>
            <View
              style={[
                styles.footer,
                isPhoneLayout ? styles.footerCompact : null,
              ]}>
              <View
                style={[
                  styles.secondaryActions,
                  isPhoneLayout ? styles.secondaryActionsCompact : null,
                ]}>
                {showPrevious ? (
                  <ActionButton
                    compact
                    label="上一步"
                    onPress={onPrevious}
                    fullWidth={isPhoneLayout}
                    testID="workspace-onboarding-previous"
                  />
                ) : null}
                <ActionButton
                  compact
                  label="跳过"
                  onPress={onSkip}
                  fullWidth={isPhoneLayout}
                  testID="workspace-onboarding-skip"
                />
              </View>
              <ActionButton
                compact
                fullWidth={isPhoneLayout}
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
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
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
    position: 'relative',
  },
  sheetWrapPadded: {
    padding: 12,
  },
  sheetContainer: {
    width: '100%',
  },
  sheetContainerDocked: {
    alignSelf: 'center',
    maxWidth: 420,
  },
  sheetContainerFloating: {
    position: 'absolute',
  },
  sheet: {
    alignSelf: 'center',
    gap: 16,
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
  footerCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryActionsCompact: {
    flexDirection: 'column',
    width: '100%',
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
