module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'android/**/build/**',
    'harmony/**/build/**',
    'harmony/entry/src/main/ets/codegen/generated/**',
    'harmony/entry/src/main/resources/rawfile/bundle.harmony.js',
    'harmony/oh_modules/**',
    'ios/Pods/**',
  ],
};
