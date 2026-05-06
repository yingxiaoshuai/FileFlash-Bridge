import React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { styles } from './appShellStyles';
import { AppBottomTabBar } from './navigation/AppBottomTabBar';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { theme } from './theme';
import { useAppModel } from './useAppModel';
import { WorkspaceOnboardingOverlay } from './workspaceOnboarding';
import {
  APP_LOCALE_OPTIONS,
  createAppTranslator,
} from '../modules/localization/i18n';
import type {
  WorkspaceTourAnchorRect,
  WorkspaceTourStep,
} from './workspaceOnboarding';
import type { AppTabId, WorkspaceTourTargetId } from './workspaceTypes';

type TourTargetNode = React.ElementRef<typeof View>;

export function AppShell(): React.JSX.Element {
  const model = useAppModel();
  const t = createAppTranslator(model.locale);
  const skipWorkspaceOnboarding = model.skipWorkspaceOnboarding;
  const [activeTab, setActiveTab] = React.useState<AppTabId>('home');
  const [isLocaleMenuVisible, setLocaleMenuVisible] = React.useState(false);
  const [isSettingsQuickLocaleMenuVisible, setSettingsQuickLocaleMenuVisible] =
    React.useState(false);
  const [isSettingsLocaleMenuVisible, setSettingsLocaleMenuVisible] =
    React.useState(false);
  const [isProjectHistoryOpen, setProjectHistoryOpen] = React.useState(false);
  const [projectActionMenuId, setProjectActionMenuId] = React.useState<
    string | undefined
  >();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tourStepIndex, setTourStepIndex] = React.useState(0);
  const [tourTargetRects, setTourTargetRects] = React.useState<
    Partial<Record<WorkspaceTourTargetId, WorkspaceTourAnchorRect>>
  >({});
  const [tourHostFrame, setTourHostFrame] = React.useState({
    height,
    width,
  });
  const tourTargetRefs = React.useRef<
    Partial<Record<WorkspaceTourTargetId, TourTargetNode | null>>
  >({});
  const tourHostRef = React.useRef<TourTargetNode | null>(null);
  const pagePadding = width < 480 ? 12 : 16;
  const stackOverviewCards = width < 1180;
  const stackProjectPanels = width < 1020;
  const qrSize = width < 480 ? 118 : 156;
  const serviceCardContentMax = stackOverviewCards
    ? width - pagePadding * 2 - 36
    : Math.max(160, Math.floor((width - pagePadding * 2 - 14) / 2) - 36);
  const serviceQrSize = Math.min(qrSize, Math.max(112, serviceCardContentMax));
  const tabBarPadding = 12;
  const historyDrawerWidth =
    width < 560
      ? Math.min(Math.max(280, Math.floor(width * 0.82)), 340)
      : Math.min(Math.max(304, Math.floor(width * 0.32)), 380);
  const currentLocaleLabel = t(
    APP_LOCALE_OPTIONS.find(option => option.value === model.locale)
      ?.labelKey ?? 'settings.language.option.zh',
  );
  const previousActiveProjectIdRef = React.useRef<string | undefined>(
    model.activeProject?.id,
  );

  const setTourTargetRef = React.useCallback(
    (targetId: WorkspaceTourTargetId, node: TourTargetNode | null) => {
      tourTargetRefs.current[targetId] = node;
    },
    [],
  );

  const measureTourTarget = React.useCallback(
    (targetId: WorkspaceTourTargetId) => {
      const node = tourTargetRefs.current[targetId];
      const tourHostNode = tourHostRef.current;
      if (!node) {
        setTourTargetRects(currentRects => {
          if (!currentRects[targetId]) {
            return currentRects;
          }

          const nextRects = { ...currentRects };
          delete nextRects[targetId];
          return nextRects;
        });
        return;
      }

      const updateRect = (
        x: number,
        y: number,
        measuredWidth: number,
        measuredHeight: number,
      ) => {
        if (!measuredWidth || !measuredHeight) {
          setTourTargetRects(currentRects => {
            if (!currentRects[targetId]) {
              return currentRects;
            }

            const nextRects = { ...currentRects };
            delete nextRects[targetId];
            return nextRects;
          });
          return;
        }

        setTourTargetRects(currentRects => {
          const previousRect = currentRects[targetId];
          if (
            previousRect &&
            previousRect.x === x &&
            previousRect.y === y &&
            previousRect.width === measuredWidth &&
            previousRect.height === measuredHeight
          ) {
            return currentRects;
          }

          return {
            ...currentRects,
            [targetId]: {
              height: measuredHeight,
              width: measuredWidth,
              x,
              y,
            },
          };
        });
      };

      if (tourHostNode && typeof node.measureLayout === 'function') {
        node.measureLayout(
          tourHostNode,
          (x, y, measuredWidth, measuredHeight) => {
            updateRect(x, y, measuredWidth, measuredHeight);
          },
          () => {
            if (typeof node.measureInWindow === 'function') {
              node.measureInWindow((x, y, measuredWidth, measuredHeight) => {
                updateRect(x, y, measuredWidth, measuredHeight);
              });
            }
          },
        );
        return;
      }

      if (typeof node.measureInWindow === 'function') {
        node.measureInWindow((x, y, measuredWidth, measuredHeight) => {
          updateRect(x, y, measuredWidth, measuredHeight);
        });
        return;
      }

      setTourTargetRects(currentRects => {
        if (!currentRects[targetId]) {
          return currentRects;
        }

        const nextRects = { ...currentRects };
        delete nextRects[targetId];
        return nextRects;
      });
    },
    [],
  );

  const tourTargetCallbacks = React.useMemo(
    () => ({
      'help-button': (node: TourTargetNode | null) => {
        setTourTargetRef('help-button', node);
      },
      'project-panel': (node: TourTargetNode | null) => {
        setTourTargetRef('project-panel', node);
      },
      'service-address': (node: TourTargetNode | null) => {
        setTourTargetRef('service-address', node);
      },
      'service-panel': (node: TourTargetNode | null) => {
        setTourTargetRef('service-panel', node);
      },
      'shared-files-panel': (node: TourTargetNode | null) => {
        setTourTargetRef('shared-files-panel', node);
      },
    }),
    [setTourTargetRef],
  );

  React.useEffect(() => {
    if (
      projectActionMenuId &&
      !model.projects.some(project => project.id === projectActionMenuId)
    ) {
      setProjectActionMenuId(undefined);
    }
  }, [model.projects, projectActionMenuId]);

  React.useEffect(() => {
    const previousActiveProjectId = previousActiveProjectIdRef.current;
    if (
      isProjectHistoryOpen &&
      previousActiveProjectId &&
      previousActiveProjectId !== model.activeProject?.id
    ) {
      setProjectHistoryOpen(false);
    }

    previousActiveProjectIdRef.current = model.activeProject?.id;
  }, [isProjectHistoryOpen, model.activeProject?.id]);

  React.useEffect(() => {
    if (!model.onboarding.isVisible) {
      return;
    }

    setActiveTab('home');
    setTourStepIndex(0);
  }, [model.onboarding.isVisible]);

  React.useEffect(() => {
    if (activeTab === 'home') {
      return;
    }

    setProjectActionMenuId(undefined);
    setProjectHistoryOpen(false);
  }, [activeTab]);

  React.useEffect(() => {
    setLocaleMenuVisible(false);
    setSettingsQuickLocaleMenuVisible(false);
    setSettingsLocaleMenuVisible(false);
  }, [activeTab]);

  React.useEffect(() => {
    if (!model.onboarding.isVisible) {
      return;
    }

    measureTourTarget('help-button');
    measureTourTarget('service-panel');
    measureTourTarget('service-address');
    measureTourTarget('shared-files-panel');
    measureTourTarget('project-panel');
  }, [
    measureTourTarget,
    model.activeProject?.id,
    model.activeProject?.messages.length,
    model.activeProjectFiles.length,
    model.onboarding.isVisible,
    model.serviceState.accessUrl,
    model.serviceState.network.reachable,
    model.sharedFiles.length,
    tourStepIndex,
    width,
  ]);

  React.useEffect(() => {
    setTourHostFrame({
      height,
      width,
    });
  }, [height, width]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !model.onboarding.isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (tourStepIndex > 0) {
          setTourStepIndex(currentIndex => Math.max(0, currentIndex - 1));
        } else {
          void skipWorkspaceOnboarding();
        }

        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    model.onboarding.isVisible,
    skipWorkspaceOnboarding,
    tourStepIndex,
  ]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || model.onboarding.isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isProjectHistoryOpen) {
          setProjectActionMenuId(undefined);
          setProjectHistoryOpen(false);
          return true;
        }

        if (activeTab !== 'home') {
          setActiveTab('home');
          return true;
        }

        return false;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [activeTab, isProjectHistoryOpen, model.onboarding.isVisible]);

  const tourSteps: WorkspaceTourStep<WorkspaceTourTargetId>[] = [
    {
      body:
        model.serviceState.phase === 'running'
          ? t('onboarding.service.body.running')
          : t('onboarding.service.body.stopped'),
      id: 'service',
      target: 'service-panel',
      title:
        model.serviceState.phase === 'running'
          ? t('onboarding.service.title.running')
          : t('onboarding.service.title.stopped'),
    },
    {
      body: t('onboarding.shared.body'),
      id: 'shared-files',
      target: 'shared-files-panel',
      title: t('onboarding.shared.title'),
    },
    {
      body: t('onboarding.project.body'),
      id: 'project',
      target: 'project-panel',
      title: t('onboarding.project.title'),
    },
  ];
  const onboardingLabels = {
    close: t('onboarding.close'),
    complete: t('onboarding.complete'),
    next: t('onboarding.next'),
    previous: t('onboarding.previous'),
    skip: t('onboarding.skip'),
  };
  const currentTourStep = model.onboarding.isVisible
    ? tourSteps[Math.min(tourStepIndex, tourSteps.length - 1)]
    : undefined;
  const activeTourTargetId = currentTourStep
    ? currentTourStep.target === 'service-address' &&
      !(model.serviceState.accessUrl && model.serviceState.network.reachable)
      ? currentTourStep.fallbackTarget ?? currentTourStep.target
      : currentTourStep.target
    : undefined;
  const activeTourTargetRect = activeTourTargetId
    ? tourTargetRects[activeTourTargetId]
    : undefined;

  const handleSelectLocale = (
    locale: (typeof APP_LOCALE_OPTIONS)[number]['value'],
  ) => {
    setLocaleMenuVisible(false);
    setSettingsQuickLocaleMenuVisible(false);
    setSettingsLocaleMenuVisible(false);
    void model.setLocale(locale);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        onLayout={event => {
          const nextFrame = event.nativeEvent.layout;
          if (
            nextFrame.width > 0 &&
            nextFrame.height > 0 &&
            (nextFrame.width !== tourHostFrame.width ||
              nextFrame.height !== tourHostFrame.height)
          ) {
            setTourHostFrame({
              height: nextFrame.height,
              width: nextFrame.width,
            });
          }
        }}
        ref={tourHostRef}
        style={styles.screenRoot}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.background}
        />
        {!model.isReady ? (
          <View style={styles.loadingShell}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text style={styles.loadingTitle}>{t('app.loading')}</Text>
          </View>
        ) : (
          <View style={styles.readyShell}>
            {activeTab === 'home' ? (
              <HomeScreen
                activeTourTargetId={activeTourTargetId}
                currentLocaleLabel={currentLocaleLabel}
                historyDrawerWidth={historyDrawerWidth}
                insets={insets}
                isLocaleMenuVisible={isLocaleMenuVisible}
                isProjectHistoryOpen={isProjectHistoryOpen}
                model={model}
                pagePadding={pagePadding}
                projectActionMenuId={projectActionMenuId}
                serviceQrSize={serviceQrSize}
                stackOverviewCards={stackOverviewCards}
                stackProjectPanels={stackProjectPanels}
                tabBarPadding={tabBarPadding}
                t={t}
                tourTargetCallbacks={tourTargetCallbacks}
                width={width}
                onOpenTour={() => {
                  void model.openWorkspaceOnboarding();
                }}
                onSelectLocale={handleSelectLocale}
                setLocaleMenuVisible={setLocaleMenuVisible}
                setProjectActionMenuId={setProjectActionMenuId}
                setProjectHistoryOpen={setProjectHistoryOpen}
              />
            ) : (
              <SettingsScreen
                currentLocaleLabel={currentLocaleLabel}
                isBusy={Boolean(model.busyAction)}
                isLocaleMenuVisible={isSettingsLocaleMenuVisible}
                isQuickLocaleMenuVisible={isSettingsQuickLocaleMenuVisible}
                locale={model.locale}
                onDismissLocaleMenu={() => {
                  setSettingsLocaleMenuVisible(false);
                }}
                onDismissQuickLocaleMenu={() => {
                  setSettingsQuickLocaleMenuVisible(false);
                }}
                onOpenLocaleMenu={() => {
                  setSettingsLocaleMenuVisible(true);
                }}
                onOpenQuickLocaleMenu={() => {
                  setSettingsQuickLocaleMenuVisible(true);
                }}
                onSelectLocale={handleSelectLocale}
                pagePadding={pagePadding}
                tabBarPadding={tabBarPadding}
                t={t}
              />
            )}

            <AppBottomTabBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              t={t}
            />
          </View>
        )}

        {model.onboarding.isVisible && currentTourStep ? (
          <WorkspaceOnboardingOverlay
            activeRect={activeTourTargetRect}
            hostFrame={tourHostFrame}
            labels={onboardingLabels}
            onClose={() => {
              void model.skipWorkspaceOnboarding();
            }}
            onComplete={() => {
              void model.completeWorkspaceOnboarding();
            }}
            onNext={() => {
              setTourStepIndex(currentIndex =>
                Math.min(tourSteps.length - 1, currentIndex + 1),
              );
            }}
            onPrevious={() => {
              setTourStepIndex(currentIndex => Math.max(0, currentIndex - 1));
            }}
            onSkip={() => {
              void model.skipWorkspaceOnboarding();
            }}
            showPrevious={tourStepIndex > 0}
            step={currentTourStep}
            stepIndex={tourStepIndex}
            totalSteps={tourSteps.length}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
