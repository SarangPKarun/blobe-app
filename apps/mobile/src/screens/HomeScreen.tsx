import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
} from 'react-native';

import BottomBar from '../components/BottomBar';
import LocationButton from '../components/LocationButton';
import SearchBar from '../components/SearchBar';
import { useGlobe } from '../context/GlobeContext';
import { handleLocationPress } from '../utils/locationHandler';

import DiscoverScreen from './DiscoverScreen';
import NotificationScreen from './NotificationScreen';
import ProfileScreen from './ProfileScreen';
import CreatePostScreen from './CreatePostScreen';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.85;

type TabId = 'globe' | 'discover' | 'create' | 'notifications' | 'profile';

export default function HomeScreen() {
  const globe = useGlobe();
  const [activeTab, setActiveTab] = useState<TabId>('globe');
  const [search, setSearch] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const overlayOpen = activeTab !== 'globe';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: overlayOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [overlayOpen, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [OVERLAY_HEIGHT, 0],
  });

  const onLocationPress = useCallback(() => {
    handleLocationPress((lat, lng) => globe.sendLocation(lat, lng));
  }, [globe]);

  const renderOverlayContent = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverScreen setActiveTab={setActiveTab} />;
      case 'create':
        return <CreatePostScreen setActiveTab={setActiveTab} />;
      case 'notifications':
        return <NotificationScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Globe controls — sit above the persistent globe, below the overlay */}
      {!overlayOpen && (
        <LocationButton onPress={onLocationPress} />
      )}
      {!overlayOpen && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onPressSearch={() => console.log(search)}
        />
      )}

      {/* Sliding overlay — translates in from the bottom */}
      <Animated.View
        style={[styles.overlay, { transform: [{ translateY }] }]}
        pointerEvents={overlayOpen ? 'auto' : 'none'}
      >
        {renderOverlayContent()}
      </Animated.View>

      <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: OVERLAY_HEIGHT,
    zIndex: 5,
  },
});
