import messaging from '@react-native-firebase/messaging';
import { registerDeviceToken } from '../api/notifications';

export async function requestPushPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function registerFCMToken(overrideJwt?: string): Promise<void> {
  try {
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    if (token) {
      await registerDeviceToken(token, overrideJwt);
    }
  } catch (err) {
    console.error('[FCM] Token registration failed:', err);
  }
}

export function setupForegroundListener(
  onNotification: (notification: { title?: string; body?: string; data?: Record<string, string> }) => void
): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    onNotification({
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as Record<string, string>,
    });
  });
}

// Must be called at module level outside any component tree
export function setupBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM Background]', remoteMessage.notification?.title);
  });
}
