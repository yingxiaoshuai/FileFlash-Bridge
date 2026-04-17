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
    isFileShared: jest.fn().mockReturnValue(false),
    isReady: true,
    notice: undefined,
    projects: [projectA, projectB],
    refreshAddress: jest.fn().mockResolvedValue(undefined),
    securityCopy: '',
    selectProject: jest.fn().mockResolvedValue(true),
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

  test('keeps service and file import actions on the home workspace instead of inside the sidebar', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    expect(tree!.root.findByProps({testID: 'home-toggle-service'})).toBeTruthy();
    expect(tree!.root.findByProps({testID: 'home-import-files'})).toBeTruthy();
    expect(() => tree!.root.findByProps({testID: 'sidebar-toggle-service'})).toThrow();
    expect(() => tree!.root.findByProps({testID: 'sidebar-import-files'})).toThrow();
  });

  test('jumps to the related project from a shared file card', () => {
    const model = createModel();
    mockUseAppModel.mockReturnValue(model as ReturnType<typeof useAppModel>);

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<App />);
    });

    act(() => {
      tree!.root.findByProps({testID: 'shared-file-project-file-b'}).props.onPress();
    });

    expect(model.selectProject).toHaveBeenCalledWith('project-b');
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
});
