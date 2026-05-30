import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobeProvider } from './src/context/GlobeContext';
import PersistentGlobeWebView from './src/components/PersistentGlobeWebView';

export default function App() {
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

const styles = StyleSheet.create({
  root: { flex: 1 },
});
