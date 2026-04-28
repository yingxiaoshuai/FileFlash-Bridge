import React from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {theme} from './theme';
import {ActionButton, GlyphIconButton} from './ui';

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

export type WorkspaceOnboardingLabels = {
  close: string;
  complete: string;
  next: string;
  previous: string;
  skip: string;
};

type GuidedTourTargetProps = {
  active?: boolean;
  captureRef?: (node: React.ElementRef<typeof View> | null) => void;
  children: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function GuidedTourTarget({
  active,
  captureRef,
  children,
  onLayout,
  style,
  testID,
}: GuidedTourTargetProps) {
  return (
    <View
      collapsable={false}
      onLayout={onLayout}
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
  labels: WorkspaceOnboardingLabels;
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

const ONBOARDING_IMAGE_ASPECT_RATIO = 364 / 735;

const ONBOARDING_IMAGES: Record<string, ImageSourcePropType> = {
  project: require('../assets/tutorial/project.png'),
  service: require('../assets/tutorial/service.png'),
  'shared-files': require('../assets/tutorial/sharedFiles.png'),
};

function getOnboardingImage(stepId: string) {
  return ONBOARDING_IMAGES[stepId] ?? ONBOARDING_IMAGES.service;
}

export function WorkspaceOnboardingOverlay({
  activeRect: _activeRect,
  hostFrame,
  labels,
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
  const isPhoneLayout = hostFrame.width < 560;
  const showPromptAtTop = stepIndex > 0;
  const chromePadding = isPhoneLayout ? 0 : 24;
  const stageWidth = Math.max(hostFrame.width - chromePadding * 2, 320);
  const stageHeight = Math.max(hostFrame.height - chromePadding * 2, 560);
  const sheetWrapperTestID = isPhoneLayout
    ? 'workspace-onboarding-sheet-phone'
    : 'workspace-onboarding-sheet-docked';

  const imageHeightByWidth = stageWidth / ONBOARDING_IMAGE_ASPECT_RATIO;
  const imageWidthByHeight = stageHeight * ONBOARDING_IMAGE_ASPECT_RATIO;
  const imageHeight =
    imageHeightByWidth <= stageHeight ? imageHeightByWidth : stageHeight;
  const imageWidth =
    imageHeightByWidth <= stageHeight ? stageWidth : imageWidthByHeight;

  return (
    <View style={styles.overlayRoot} testID="workspace-onboarding-overlay">
      <View style={styles.backdrop} />
      <View style={styles.stageWrap}>
        <View
          style={[
            styles.stage,
            isPhoneLayout ? styles.stagePhone : styles.stageDocked,
            {
              height: stageHeight,
              width: stageWidth,
            },
          ]}
          testID={sheetWrapperTestID}>
          <View style={styles.visualViewport}>
            <Image
              resizeMode="contain"
              source={getOnboardingImage(step.id)}
              style={[
                styles.image,
                {
                  height: imageHeight,
                  width: imageWidth,
                },
              ]}
              testID={`workspace-onboarding-image-${step.id}`}
            />
          </View>

          <View style={styles.topChrome}>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>
                {stepIndex + 1} / {totalSteps}
              </Text>
            </View>
            <GlyphIconButton
              accessibilityLabel={labels.close}
              glyph="X"
              onPress={onClose}
              testID="workspace-onboarding-close"
            />
          </View>

          <View
            style={[
              styles.detailsChrome,
              showPromptAtTop ? styles.detailsChromeTop : styles.detailsChromeBottom,
            ]}>
            <View style={styles.copyBlock}>
              <View style={styles.paginationRow}>
                {Array.from({length: totalSteps}).map((_, index) => (
                  <View
                    key={`workspace-onboarding-dot-${index}`}
                    style={[
                      styles.paginationDot,
                      index === stepIndex ? styles.paginationDotActive : null,
                    ]}
                  />
                ))}
              </View>
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
                    fullWidth={isPhoneLayout}
                    label={labels.previous}
                    onPress={onPrevious}
                    testID="workspace-onboarding-previous"
                  />
                ) : null}
                <ActionButton
                  compact
                  fullWidth={isPhoneLayout}
                  label={labels.skip}
                  onPress={onSkip}
                  testID="workspace-onboarding-skip"
                />
              </View>

              <ActionButton
                compact
                fullWidth={isPhoneLayout}
                label={isLastStep ? labels.complete : labels.next}
                onPress={isLastStep ? onComplete : onNext}
                testID={
                  isLastStep
                    ? 'workspace-onboarding-complete'
                    : 'workspace-onboarding-next'
                }
                tone="primary"
              />
            </View>
          </View>
        </View>
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
    backgroundColor: '#02060d',
    bottom: 0,
    left: 0,
    opacity: 0.98,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  stageWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  stage: {
    alignSelf: 'center',
    backgroundColor: '#08121e',
    overflow: 'hidden',
    position: 'relative',
  },
  stagePhone: {
    borderRadius: 0,
  },
  stageDocked: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      height: 16,
      width: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 28,
  },
  visualViewport: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    maxHeight: '100%',
    maxWidth: '100%',
  },
  topChrome: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  detailsChrome: {
    backgroundColor: 'rgba(4, 10, 18, 0.82)',
    gap: 14,
    left: 0,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    position: 'absolute',
    right: 0,
  },
  detailsChromeBottom: {
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    bottom: 0,
  },
  detailsChromeTop: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    top: 68,
  },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressPillText: {
    color: '#f5f7fb',
    fontSize: 12,
    fontWeight: '800',
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paginationDot: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: theme.radius.pill,
    height: 8,
    width: 8,
  },
  paginationDotActive: {
    backgroundColor: theme.colors.primary,
    width: 24,
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    color: '#f5f7fb',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: 'rgba(245,247,251,0.88)',
    fontSize: 14,
    lineHeight: 21,
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
    opacity: 1,
  },
});
