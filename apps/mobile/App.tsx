import * as Sentry from '@sentry/react-native';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobeProvider } from './src/context/GlobeContext';
import PersistentGlobeWebView from './src/components/PersistentGlobeWebView';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  environment: process.env.APP_ENV ?? 'production',
  tracesSampleRate: 0.2,
  // Automatically captures JS crashes, unhandled promise rejections, and native crashes.
  enableNativeCrashHandling: true,
});

function App() {
  return (
    <SafeAreaProvider>
      <GlobeProvider>
        <View style={styles.root}>
          <PersistentGlobeWebView />
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </View>
      </GlobeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  root: { flex: 1 },
});
