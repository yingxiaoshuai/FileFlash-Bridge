import React from 'react';
import {PaperProvider} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppShell} from './src/app/AppShell';
import {paperTheme} from './src/app/paperTheme';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AppShell />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
