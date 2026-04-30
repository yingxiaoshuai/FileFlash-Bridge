import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');
const staticServerPackagePath = path.join(
  repoRoot,
  'packages',
  'fileflash-static-server',
);
const harmonyTcpRuntimePath = path.join(
  repoRoot,
  'src',
  'modules',
  'service',
  'reactNativeTcpHttpRuntime.ts',
);

const knownSupportMatrix = {
  '@fileflash/react-native-static-server': {
    evidence: 'Local package only contains android/ and ios/ native sources.',
    recommendation:
      'Keep this module for iOS/Android, and use the Harmony TCP runtime path instead of porting it directly.',
    status: 'conditional',
  },
  '@react-native-clipboard/clipboard': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/clipboard@1.13.2-0.0.9.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
  '@react-native-community/netinfo': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/netinfo@11.1.0-0.0.8.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
  '@react-native-documents/picker': {
    evidence:
      'Verified Harmony package exists: @react-native-ohos/react-native-document-picker@9.2.2.',
    recommendation:
      'Use the Harmony document picker package when creating the Harmony branch/target.',
    status: 'supported',
  },
  '@react-native-oh-tpl/clipboard': {
    evidence:
      'Harmony template clipboard package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/netinfo': {
    evidence:
      'Harmony template netinfo package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/react-native-fs': {
    evidence:
      'Harmony template react-native-fs package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/react-native-safe-area-context': {
    evidence:
      'Harmony template safe-area-context package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/react-native-share': {
    evidence:
      'Harmony template react-native-share package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/react-native-svg': {
    evidence:
      'Harmony template react-native-svg package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-oh-tpl/react-native-tcp-socket': {
    evidence:
      'Harmony template react-native-tcp-socket package is installed in the current workspace.',
    recommendation:
      'Keep this package wired into the Harmony host project and Metro alias path.',
    status: 'supported',
  },
  '@react-native-ohos/react-native-document-picker': {
    evidence:
      'Harmony document picker package is installed in the current workspace.',
    recommendation:
      'Keep this package autolinked and route Harmony document picking through the compatibility wrapper.',
    status: 'supported',
  },
  '@react-native-oh/react-native-harmony': {
    evidence: 'Latest verified package version: 0.82.23.',
    recommendation:
      'Align the app to the React Native version supported by RNOH before creating a Harmony target.',
    status: 'supported',
  },
  pako: {
    evidence: 'Pure JavaScript dependency.',
    recommendation: 'No Harmony-specific action is expected.',
    status: 'js',
  },
  react: {
    evidence:
      'JavaScript runtime dependency handled by the React Native layer.',
    recommendation: 'Keep aligned with the chosen React Native / RNOH stack.',
    status: 'js',
  },
  'react-native': {
    evidence:
      'React Native compatibility is tied to the verified RNOH package line 0.82.23.',
    recommendation:
      'Use react-native@0.82.1 with @react-native-oh/react-native-harmony@0.82.23, or wait for a newer official RNOH release.',
    status: 'blocked',
  },
  'react-native-fs': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/react-native-fs@2.20.0-0.1.14.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
  'react-native-paper': {
    evidence: 'Mostly JavaScript UI layer on top of React Native primitives.',
    recommendation:
      'Validate gesture, ripple, and theme behavior on Harmony after the base port is running.',
    status: 'js',
  },
  'react-native-qrcode-svg': {
    evidence:
      'JavaScript package that depends on react-native-svg being available on the target platform.',
    recommendation:
      'Treat as supported only after react-native-svg is wired up on Harmony.',
    status: 'conditional',
  },
  'react-native-safe-area-context': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/react-native-safe-area-context@4.7.4-0.2.1.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
  'react-native-share': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/react-native-share@10.2.1-0.0.6.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
  'react-native-tcp-socket': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/react-native-tcp-socket@6.2.0-0.0.3.',
    recommendation:
      'Use this package as the base for the Harmony JS HTTP runtime.',
    status: 'supported',
  },
  'react-native-svg': {
    evidence:
      'Verified Harmony template package exists: @react-native-oh-tpl/react-native-svg@15.0.1-8.',
    recommendation:
      'Swap to the Harmony template package when creating the Harmony branch/target.',
    status: 'supported',
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeVersion(value) {
  return String(value ?? '').replace(/^[~^]/, '');
}

function parseMajorMinor(version) {
  const [major, minor] = normalizeVersion(version).split('.');
  return {
    major: Number(major) || 0,
    minor: Number(minor) || 0,
  };
}

function compareMajorMinor(leftVersion, rightVersion) {
  const left = parseMajorMinor(leftVersion);
  const right = parseMajorMinor(rightVersion);

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  return left.minor - right.minor;
}

function detectStaticServerStatus() {
  const hasAndroid = fs.existsSync(
    path.join(staticServerPackagePath, 'android'),
  );
  const hasIos = fs.existsSync(path.join(staticServerPackagePath, 'ios'));
  const hasHarmony =
    fs.existsSync(path.join(staticServerPackagePath, 'harmony')) ||
    fs.existsSync(path.join(staticServerPackagePath, 'ohos'));
  const hasHarmonyTcpRuntime = fs.existsSync(harmonyTcpRuntimePath);

  if (hasAndroid && hasIos && !hasHarmony) {
    return {
      evidence:
        hasHarmonyTcpRuntime
          ? 'packages/fileflash-static-server still only contains android/ and ios/ implementations, but the repo now includes a Harmony JS TCP runtime fallback.'
          : 'packages/fileflash-static-server contains android/ and ios/ implementations, but no harmony/ or ohos/ implementation.',
      recommendation:
        hasHarmonyTcpRuntime
          ? 'Keep this module for iOS/Android and wire Harmony builds to the TCP runtime path.'
          : 'Port this custom native module before attempting to start the local transfer service on Harmony.',
      status: hasHarmonyTcpRuntime ? 'conditional' : 'blocked',
    };
  }

  return knownSupportMatrix['@fileflash/react-native-static-server'];
}

function evaluateDependency(name, version) {
  if (name === '@fileflash/react-native-static-server') {
    return {
      name,
      version,
      ...detectStaticServerStatus(),
    };
  }

  if (name === 'react-native') {
    const rnStatus = knownSupportMatrix[name];
    const supportedRnLine = '0.82.23';
    const mismatch = compareMajorMinor(version, supportedRnLine) > 0;

    return {
      name,
      version,
      evidence: mismatch
        ? `${rnStatus.evidence} Current dependency is newer than the verified Harmony line.`
        : rnStatus.evidence,
      recommendation: rnStatus.recommendation,
      status: mismatch ? 'blocked' : 'supported',
    };
  }

  const entry = knownSupportMatrix[name];
  if (!entry) {
    return {
      name,
      version,
      evidence: 'No Harmony assessment entry exists for this dependency yet.',
      recommendation:
        'Manually verify whether this package is pure JS, already supported, or needs a Harmony port.',
      status: 'unknown',
    };
  }

  return {
    name,
    version,
    ...entry,
  };
}

function evaluateInboundSharingBridge() {
  const iosBridgePath = path.join(
    repoRoot,
    'ios',
    'FileFlashBridge',
    'FPInboundSharing.m',
  );
  const androidBridgePath = path.join(
    repoRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'com.fileflashbridge',
    'FPInboundSharingModule.kt',
  );
  const harmonyBridgePaths = [
    path.join(repoRoot, 'harmony', 'FPInboundSharing'),
    path.join(
      repoRoot,
      'harmony',
      'entry',
      'src',
      'main',
      'ets',
      'fpinboundsharing',
      'ShareInbox.ets',
    ),
    path.join(
      repoRoot,
      'harmony',
      'entry',
      'src',
      'main',
      'ets',
      'entryability',
      'EntryAbility.ets',
    ),
  ];

  const hasIosBridge = fs.existsSync(iosBridgePath);
  const hasAndroidBridge = fs.existsSync(androidBridgePath);
  const hasHarmonyBridge = harmonyBridgePaths.some(candidatePath =>
    fs.existsSync(candidatePath),
  );

  if (hasIosBridge && hasAndroidBridge && !hasHarmonyBridge) {
    return {
      evidence:
        'The app-owned FPInboundSharing bridge exists for iOS and Android, but no Harmony implementation was found.',
      name: 'FPInboundSharing',
      recommendation:
        'Port this bridge if you want Harmony to receive files/text from the OS share sheet.',
      status: 'blocked',
      version: 'app-native',
    };
  }

  return {
    evidence:
      'No missing app-owned inbound sharing bridge was detected for Harmony in the current workspace.',
    name: 'FPInboundSharing',
    recommendation:
      'Keep the inbound sharing bridge aligned across all native targets.',
    status: 'supported',
    version: 'app-native',
  };
}

function sortBySeverity(results) {
  const priority = {
    blocked: 0,
    unknown: 1,
    conditional: 2,
    supported: 3,
    js: 4,
  };

  return [...results].sort((left, right) => {
    const leftPriority = priority[left.status] ?? 99;
    const rightPriority = priority[right.status] ?? 99;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });
}

function printTextReport(results) {
  const counts = results.reduce(
    (summary, item) => {
      summary[item.status] = (summary[item.status] ?? 0) + 1;
      return summary;
    },
    { blocked: 0, conditional: 0, js: 0, supported: 0, unknown: 0 },
  );

  console.log('HarmonyOS Doctor');
  console.log('');
  console.log(
    `Project React Native: ${
      findResult(results, 'react-native')?.version ?? 'unknown'
    }`,
  );
  console.log('Verified RNOH line: 0.82.23');
  console.log('');
  console.log(
    `Summary: blocked=${counts.blocked}, unknown=${counts.unknown}, conditional=${counts.conditional}, supported=${counts.supported}, js=${counts.js}`,
  );
  console.log('');

  for (const item of results) {
    console.log(`[${item.status}] ${item.name}@${item.version}`);
    console.log(`  Evidence: ${item.evidence}`);
    console.log(`  Next: ${item.recommendation}`);
  }

  console.log('');
  console.log('Recommended path:');
  console.log(
    '1. Create a Harmony-specific branch aligned to the verified RNOH React Native line.',
  );
  console.log(
    '2. Replace supported third-party packages with their Harmony template variants.',
  );
  console.log(
    '3. Prefer the TCP socket Harmony runtime path, and only keep custom native server modules for iOS/Android.',
  );
  console.log(
    '4. Verify app-owned native bridges such as the inbound share receiver before generating the Harmony target.',
  );
}

function findResult(results, name) {
  return results.find(item => item.name === name);
}

function main() {
  const wantsJson = process.argv.includes('--json');
  const packageJson = readJson(packageJsonPath);
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
  };

  const evaluated = sortBySeverity(
    [
      ...Object.entries(dependencies).map(([name, version]) =>
        evaluateDependency(name, normalizeVersion(version)),
      ),
      evaluateInboundSharingBridge(),
    ],
  );

  const hasBlockingItems = evaluated.some(item => item.status === 'blocked');
  const hasUnknownItems = evaluated.some(item => item.status === 'unknown');

  if (wantsJson) {
    console.log(
      JSON.stringify(
        {
          dependencies: evaluated,
          hasBlockingItems,
          hasUnknownItems,
          verifiedRnohVersion: '0.82.23',
        },
        null,
        2,
      ),
    );
  } else {
    printTextReport(evaluated);
  }

  if (hasBlockingItems) {
    process.exitCode = 2;
    return;
  }

  if (hasUnknownItems) {
    process.exitCode = 1;
  }
}

main();
