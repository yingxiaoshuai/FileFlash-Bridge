import React from 'react';
import {Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import App from '../App';
import {useAppModel} from '../src/app/useAppModel';
import {
  DEFAULT_SERVICE_CONFIG,
  ProjectRecord,
  SharedFileRecord,
} from '../src/modules/service/models';

jest.mock('../src/app/useAppModel', () => ({
  useAppModel: jest.fn(),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
    SafeAreaView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => <View style={style}>{children}</View>,
    useSafeAreaInsets: () => ({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    }),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Pressable, Text, View} = require('react-native');

  const Menu = Object.assign(
    ({
      anchor,
      children,
      visible,
      testID,
    }: {
      anchor: React.ReactNode;
      children: React.ReactNode;
      visible: boolean;
      testID?: string;
    }) => (
      <View testID={testID}>
        {anchor}
        {visible ? children : null}
      </View>
    ),
    {
      Item: ({
        onPress,
        testID,
        title,
        titleStyle,
      }: {
        onPress: () => void;
        testID?: string;
        title: string;
        titleStyle?: unknown;
      }) => (
        <Pressable onPress={onPress} testID={testID}>
          <Text style={titleStyle}>{title}</Text>
        </Pressable>
      ),
    },
  );

  const BottomNavigation = {
    Bar: ({
      navigationState,
      onTabPress,
      renderIcon,
      renderLabel,
      testID,
    }: {
      navigationState: {
        index: number;
        routes: Array<{
          key: string;
          testID?: string;
          title: string;
        }>;
      };
      onTabPress: (props: {
        defaultPrevented: boolean;
        preventDefault: () => void;
        route: {
          key: string;
          testID?: string;
          title: string;
        };
      }) => void;
      renderIcon?: (props: {
        color: string;
        focused: boolean;
        route: {
          key: string;
          testID?: string;
          title: string;
        };
      }) => React.ReactNode;
      renderLabel?: (props: {
        color: string;
        focused: boolean;
        route: {
          key: string;
          testID?: string;
          title: string;
        };
      }) => React.ReactNode;
      testID?: string;
    }) => (
      <View testID={testID}>
        {navigationState.routes.map((route, index) => {
          const focused = navigationState.index === index;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                onTabPress({
                  defaultPrevented: false,
                  preventDefault: jest.fn(),
                  route,
                });
              }}
              testID={route.testID}>
              {renderIcon?.({
                color: focused ? 'active' : 'inactive',
                focused,
                route,
              })}
              {renderLabel?.({
                color: focused ? 'active' : 'inactive',
                focused,
                route,
              }) ?? <Text>{route.title}</Text>}
            </Pressable>
          );
        })}
      </View>
    ),
  };

  const SegmentedButtons = ({
    buttons,
    onValueChange,
    testID,
    value,
  }: {
    buttons: Array<{
      label?: string;
      testID?: string;
      value: string;
    }>;
    onValueChange: (value: string) => void;
    testID?: string;
    value: string;
  }) => (
    <View testID={testID}>
      {buttons.map(button => (
        <Pressable
          key={button.value}
          onPress={() => {
            onValueChange(button.value);
          }}
          testID={button.testID}>
          <Text>{button.label}</Text>
          <Text>{button.value === value ? 'selected' : 'idle'}</Text>
        </Pressable>
      ))}
    </View>
  );

  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{children}</Text>
      </Pressable>
    ),
    BottomNavigation,
    IconButton: ({
      onPress,
      testID,
    }: {
      onPress: () => void;
      testID?: string;
    }) => <Pressable onPress={onPress} testID={testID} />,
    MD3LightTheme: {
      colors: {},
    },
    Menu,
    PaperProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
    SegmentedButtons,
    Surface: ({children, style, testID}: {children: React.ReactNode; style?: unknown; testID?: string}) => (
      <View style={style} testID={testID}>
        {children}
      </View>
    ),
    Drawer: {
      Item: ({
        label,
        onPress,
        style,
        testID,
      }: {
        label: string;
        onPress: () => void;
        style?: unknown;
        testID?: string;
      }) => (
        <Pressable onPress={onPress} style={style} testID={testID}>
          <Text>{label}</Text>
        </Pressable>
      ),
      Section: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
    },
  };
});

const mockUseAppModel = useAppModel as jest.MockedFunction<typeof useAppModel>;

function createProject(
  id: string,
  title: string,
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    createdAt: '2026-04-15T09:00:00.000Z',
    fileIds: [],
    id,
    messages: [],
    title,
    updatedAt: '2026-04-15T09:00:00.000Z',
    ...overrides,
  };
}

function createSharedFile(
  id: string,
  projectId: string,
  displayName: string,
): SharedFileRecord {
  return {
    compression: 'none',
    createdAt: '2026-04-15T09:00:00.000Z',
    displayName,
    id,
    isLargeFile: false,
    mimeType: 'text/plain',
    originalSize: 12,
    projectId,
    relativePath: displayName,
    size: 12,
    storagePath: `D:/tmp/${displayName}`,
    storedSize: 12,
  };
}

function createModel(overrides: Record<string, unknown> = {}) {
  const projectA = createProject('project-a', '项目 A', {
    messages: [
      {
        content: '文本 A',
        createdAt: '2026-04-15T09:00:00.000Z',
        id: 'msg-a',
        projectId: 'project-a',
        source: 'browser',
      },
    ],
  });
  const projectB = createProject('project-b', '项目 B', {
    fileIds: ['file-b'],
  });
  const sharedFile = createSharedFile('file-b', 'project-b', 'shared.txt');

  return {
    activeProject: projectA,
    activeProjectFiles: [],
    busyAction: undefined,
    clearNotice: jest.fn(),
    copyMessage: jest.fn(),
    createProject: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    deleteProject: jest.fn().mockResolvedValue(true),
    deletionWarning: '删除将清除该会话的数据及关联文件。',
    exportFile: jest.fn().mockResolvedValue(undefined),
    importFilesForShare: jest.fn().mockResolvedValue(undefined),
    importMediaForShare: jest.fn().mockResolvedValue(undefined),
    isFileShared: jest.fn().mockReturnValue(false),
    isReady: true,
    locale: 'zh-CN',
    notice: undefined,
    onboarding: {
      canReopen: true,
      isVisible: false,
      shouldAutoOpen: false,
      status: 'completed',
      version: 'workspace-tour-v1',
    },
    openWorkspaceOnboarding: jest.fn().mockResolvedValue(undefined),
    projects: [projectA, projectB],
    refreshAddress: jest.fn().mockResolvedValue(undefined),
    renameProject: jest.fn().mockResolvedValue(true),
    securityCopy: '',
    selectProject: jest.fn().mockResolvedValue(true),
    setLocale: jest.fn().mockResolvedValue(undefined),
    serviceState: {
      activeConnections: [],
      config: {
        ...DEFAULT_SERVICE_CONFIG,
        securityMode: 'secure',
      },
      network: {
        label: 'Wi-Fi',
        mode: 'wifi',
        reachable: true,
      },
      phase: 'running',
      qrValue: 'http://192.168.0.2:8668',
      sharedFileCount: 1,
      accessUrl: 'http://192.168.0.2:8668',
    },
    setSecurityMode: jest.fn().mockResolvedValue(undefined),
    sharedFiles: [sharedFile],
    completeWorkspaceOnboarding: jest.fn().mockResolvedValue(undefined),
    skipWorkspaceOnboarding: jest.fn().mockResolvedValue(undefined),
    toggleService: jest.fn().mockResolvedValue(undefined),
    toggleSharedFile: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('App sidebar history', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        fontScale: 1,
        height: 900,
        scale: 2,
        width: 1100,
      });
  });

  test('renders project history with drawer items and switches projects from the sidebar', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(() => tree!.root.findByProps({testID: 'sidebar-panel'})).toThrow();

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-open'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'sidebar-panel'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'project-drawer-item-project-b'}).props
        .onPress();
    });

    expect(model.selectProject).toHaveBeenCalledWith('project-b');
  });

  test('creates a project from the sidebar and deletes through a row menu', () => {
    const model = createModel();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-open'}).props.onPress();
    });

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-create-project'}).props.onPress();
    });

    act(() => {
      tree!.root
        .findByProps({testID: 'project-row-menu-open-project-b'})
        .props.onPress();
    });

    expect(model.createProject).toHaveBeenCalled();

    expect(() => tree!.root.findByProps({testID: 'sidebar-delete-project'})).toThrow();

    act(() => {
      tree!.root
        .findByProps({testID: 'project-row-menu-delete-project-b'})
        .props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '删除项目',
      model.deletionWarning,
      expect.any(Array),
    );
  });

  test('renames a project from the sidebar menu', async () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-open'}).props.onPress();
    });

    act(() => {
      tree!.root
        .findByProps({testID: 'project-row-menu-open-project-b'})
        .props.onPress();
    });

    act(() => {
      tree!.root
        .findByProps({testID: 'project-row-menu-rename-project-b'})
        .props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'project-rename-dialog'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'project-rename-input'}).props.onChangeText(
        '新的项目名',
      );
    });

    await act(async () => {
      tree!.root.findByProps({testID: 'project-rename-submit'}).props.onPress();
    });

    expect(model.renameProject).toHaveBeenCalledWith('project-b', '新的项目名');
  });

  test('keeps service and file import actions on the home workspace instead of inside the sidebar', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'home-toggle-service'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'home-import-files'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'home-import-media'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'sidebar-toggle-service'})).toThrow();
    expect(() => tree!.root.findByProps({testID: 'sidebar-import-files'})).toThrow();
  });

  test('renders compact workspace summary and contextual address actions when service is reachable', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'workspace-summary-connections'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-summary-shared'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-summary-mode'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'service-address-row'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'service-copy-link'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'service-refresh-address'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'service-mode-panel'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'service-address-collapsed'})).toThrow();
  });

  test('collapses the address area and hides duplicate offline diagnostics when no reachable address is available', () => {
    const model = createModel({
      serviceState: {
        ...createModel().serviceState,
        accessUrl: undefined,
        error: {
          code: 'NETWORK_UNAVAILABLE',
          message: '没有可用局域网地址',
          recoverable: true,
          suggestedAction: '检查 Wi-Fi 或热点连接',
        },
        network: {
          label: '无可用局域网',
          mode: 'offline',
          reachable: false,
        },
        phase: 'idle',
        qrValue: undefined,
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'service-address-collapsed'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'service-copy-link'})).toThrow();
    expect(() => tree!.root.findByProps({testID: 'service-refresh-address'})).toThrow();
    expect(() => tree!.root.findByProps({testID: 'service-address-row'})).toThrow();
    expect(() => tree!.root.findByProps({testID: 'service-network-warning'})).toThrow();
  });

  test('shows received file timestamps and removes the shared file project shortcut', () => {
    const receivedFile = createSharedFile('file-a', 'project-a', 'received.txt');
    const noticeMessage = '服务状态已更新，当前会话内容可继续管理。';
    const model = createModel({
      activeProjectFiles: [receivedFile],
      notice: {
        message: noticeMessage,
        tone: 'info',
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'file-received-at-file-a'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'shared-file-project-file-b'})).toThrow();
    expect(
      tree!.root.findAll(node => {
        const {children} = node.props ?? {};
        return (
          children === noticeMessage ||
          (Array.isArray(children) && children.includes(noticeMessage))
        );
      }),
    ).toHaveLength(0);
  });

  test('opens the project history drawer from the toolbar on narrow screens', () => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        fontScale: 1,
        height: 844,
        scale: 3,
        width: 390,
      });

    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(() => tree!.root.findByProps({testID: 'sidebar-panel'})).toThrow();

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-open'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'sidebar-panel'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'sidebar-backdrop'}).props.onPress();
    });

    expect(() => tree!.root.findByProps({testID: 'sidebar-panel'})).toThrow();
  });

  test('shows the onboarding overlay for first-run users and lets them reopen it later', () => {
    const model = createModel({
      onboarding: {
        canReopen: true,
        isVisible: true,
        shouldAutoOpen: true,
        status: 'unseen',
        version: 'workspace-tour-v1',
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'workspace-onboarding-overlay'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-onboarding-sheet-docked'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-onboarding-image-service'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-next'}).props.onPress();
    });

    expect(
      tree!.root.findByProps({testID: 'workspace-onboarding-previous'}),
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({testID: 'workspace-onboarding-image-shared-files'}),
    ).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-skip'}).props.onPress();
    });

    expect(model.skipWorkspaceOnboarding).toHaveBeenCalled();

    act(() => {
      tree!.root.findByProps({testID: 'workspace-open-onboarding'}).props.onPress();
    });

    expect(model.openWorkspaceOnboarding).toHaveBeenCalled();
  });

  test('opens a locale menu in the header and forwards language changes', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'locale-menu-open'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'locale-menu-item-zh-CN'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'locale-menu-item-en-US'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'locale-menu-item-en-US'}).props.onPress();
    });

    expect(model.setLocale).toHaveBeenCalledWith('en-US');
  });

  test('switches between home and settings tabs while keeping transfer actions on home', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'tab-home'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'tab-settings'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'home-toggle-service'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'tab-settings'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'settings-language-item'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'home-toggle-service'})).toThrow();

    act(() => {
      tree!.root.findByProps({testID: 'tab-home'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'home-toggle-service'})).toBeTruthy();
  });

  test('opens the settings language menu and forwards language changes', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'tab-settings'}).props.onPress();
    });

    act(() => {
      tree!.root.findByProps({testID: 'settings-language-item'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'settings-language-menu-item-zh-CN'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'settings-language-menu-item-en-US'})).toBeTruthy();

    act(() => {
      tree!.root
        .findByProps({testID: 'settings-language-menu-item-en-US'})
        .props.onPress();
    });

    expect(model.setLocale).toHaveBeenCalledWith('en-US');
  });

  test('uses a floating onboarding card on phone layouts', () => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        fontScale: 1,
        height: 844,
        scale: 3,
        width: 390,
      });

    const model = createModel({
      onboarding: {
        canReopen: true,
        isVisible: true,
        shouldAutoOpen: true,
        status: 'unseen',
        version: 'workspace-tour-v1',
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'workspace-onboarding-sheet-phone'})).toBeTruthy();
  });

  test('keeps the onboarding overlay available when the address target is missing and completes on the last step', () => {
    const model = createModel({
      onboarding: {
        canReopen: true,
        isVisible: true,
        shouldAutoOpen: true,
        status: 'unseen',
        version: 'workspace-tour-v1',
      },
      serviceState: {
        ...createModel().serviceState,
        accessUrl: undefined,
        error: {
          code: 'NETWORK_UNAVAILABLE',
          message: '没有可用局域网地址',
          recoverable: true,
          suggestedAction: '检查 Wi-Fi 或热点连接',
        },
        network: {
          label: '无可用局域网',
          mode: 'offline',
          reachable: false,
        },
        phase: 'idle',
        qrValue: undefined,
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'service-address-collapsed'})).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-next'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'workspace-onboarding-overlay'})).toBeTruthy();
    expect(
      tree!.root.findByProps({testID: 'workspace-onboarding-image-shared-files'}),
    ).toBeTruthy();

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-next'}).props.onPress();
    });

    expect(
      tree!.root.findByProps({testID: 'workspace-onboarding-complete'}),
    ).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-onboarding-image-project'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'workspace-onboarding-body'}).props.children).toContain(
      'App Store',
    );
    expect(tree!.root.findByProps({testID: 'workspace-onboarding-body'}).props.children).toContain(
      'GitHub',
    );

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-complete'}).props.onPress();
    });

    expect(model.completeWorkspaceOnboarding).toHaveBeenCalled();
  });

  test('explains that files can be sent into the app through the system share flow', () => {
    const model = createModel({
      onboarding: {
        canReopen: true,
        isVisible: true,
        shouldAutoOpen: true,
        status: 'unseen',
        version: 'workspace-tour-v1',
      },
    });
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'workspace-onboarding-next'}).props.onPress();
    });

    expect(tree!.root.findByProps({testID: 'workspace-onboarding-body'}).props.children).toContain(
      '系统分享',
    );
  });
});
