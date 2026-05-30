import { Platform } from 'react-native';

const LOCAL_HOST = Platform.OS === 'ios' ? 'localhost' : '10.0.2.2';

export const GLOBE_SERVICE_URL = __DEV__
  ? `http://${LOCAL_HOST}:3004`
  : 'https://globe.blobe.app';

export const POST_SERVICE_URL = __DEV__
  ? `http://${LOCAL_HOST}:3002`
  : 'https://posts.blobe.app';

export const GLOBE_WS_URL = __DEV__
  ? `ws://${LOCAL_HOST}:3004/ws`
  : 'wss://globe.blobe.app/ws';
