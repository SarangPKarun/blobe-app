import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

async function requestLocationPermission() {
    if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
}

export const handleLocationPress = async (
    sendToGlobe: (lat: number, lng: number) => void
) => {
    console.log("Location button pressed");

    const hasPermission = await requestLocationPermission();

    if (!hasPermission) {
        Alert.alert("Permission denied", "Location permission is required");
        return;
    }

    Geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            console.log("Latitude:", latitude);
            console.log("Longitude:", longitude);

            // Send to globe WebView
            sendToGlobe(latitude, longitude);
        },
        (error) => {
            console.error("Location error:", error);
            Alert.alert("Error", error.message || "Failed to get location");
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
        }
    );
};