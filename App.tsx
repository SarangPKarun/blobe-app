import { StatusBar, StyleSheet, View } from 'react-native';
import LocationButton from './src/components/LocationButton';
import { handleLocationPress } from './src/utils/locationHandler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GlobeScreen, { GlobeScreenHandle } from './src/screens/GlobeScreen';
import { useRef } from 'react';

function App() {
  const globeRef = useRef<GlobeScreenHandle>(null);

  const onLocationPress = () => {
    handleLocationPress((lat, lng) => {
      globeRef.current?.sendLocation(lat, lng);
    });
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>

        {/* Globe Screen */}
        <GlobeScreen ref={globeRef} />

        {/* Floating Location Button */}
        <LocationButton onPress={onLocationPress} />

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
