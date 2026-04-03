import { StyleSheet, View } from 'react-native';
import LocationButton from '../components/LocationButton';
import { handleLocationPress } from '../utils/locationHandler';
import GlobeScreen, { GlobeScreenHandle } from './GlobeScreen';
import { useRef } from 'react';

import { signOut } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { TouchableOpacity, Text, Alert } from "react-native";


export default function HomeScreen() {
    const globeRef = useRef<GlobeScreenHandle>(null);

    const onLocationPress = () => {
        handleLocationPress((lat, lng) => {
            globeRef.current?.sendLocation(lat, lng);
        });
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // No navigation needed — AppNavigator auto redirects
        } catch (error: any) {
            Alert.alert("Logout Error", error.message);
        }
    };

    return (


        <View style={styles.container}>

            {/* Globe Screen */}
            <GlobeScreen ref={globeRef} />

            {/* Floating Button */}
            <LocationButton onPress={onLocationPress} />

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    logoutButton: {
        position: "absolute",
        top: 50,
        right: 20,
        backgroundColor: "#ff4d4d",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        zIndex: 10,
    },
    logoutText: {
        color: "white",
        fontWeight: "bold",
    }
});