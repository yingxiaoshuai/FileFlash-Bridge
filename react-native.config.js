const harmonyOnlyDependencies = [
  '@react-native-oh-tpl/clipboard',
  '@react-native-oh-tpl/netinfo',
  '@react-native-oh-tpl/react-native-fs',
  '@react-native-oh-tpl/react-native-safe-area-context',
  '@react-native-oh-tpl/react-native-share',
  '@react-native-oh-tpl/react-native-svg',
  '@react-native-oh-tpl/react-native-tcp-socket',
  '@react-native-ohos/react-native-document-picker',
];

module.exports = {
  dependencies: Object.fromEntries(
    harmonyOnlyDependencies.map(dependencyName => [
      dependencyName,
      {
        platforms: {
          android: null,
          ios: null,
        },
      },
    ]),
  ),
};
