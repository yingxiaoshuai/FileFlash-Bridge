/**
 * @format
 */

/* global global, require */

const runtimeGlobal = global;

// RN 0.82 new-architecture startup can call PerformanceLogger before
// InitializeCore installs global.performance. This fallback must run before any
// react-native import, because static imports execute before module body code.
if (!runtimeGlobal.performance) {
  runtimeGlobal.performance = {
    mark: () => {},
    measure: () => {},
    now: () => {
      const nativePerformanceNow = runtimeGlobal.nativePerformanceNow;
      return typeof nativePerformanceNow === 'function'
        ? nativePerformanceNow()
        : Date.now();
    },
  };
}

require('react-native/Libraries/Core/InitializeCore');

const { AppRegistry } = require('react-native');
const App = require('./App').default;
const { name: appName } = require('./app.json');

AppRegistry.registerComponent(appName, () => App);
