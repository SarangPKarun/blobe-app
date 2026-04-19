import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";

import BottomBar from "../components/BottomBar";
import NotificationScreen from "./NotificationScreen";
import GlobeScreen, { GlobeScreenHandle } from './GlobeScreen';

import ProfileScreen from "./ProfileScreen";
import CreatePostScreen from "./CreatePostScreen";

import LocationButton from '../components/LocationButton';
import { handleLocationPress } from '../utils/locationHandler';
import { useRef } from 'react';

import { signOut } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";


export default function HomeScreen() {
    const globeRef = useRef<GlobeScreenHandle>(null);

    const [activeTab, setActiveTab] = useState("home");

    const renderContent = () => {
        switch (activeTab) {
            case "home":
                return (
                    <View style={styles.content}>
                        <Text>Home Feed</Text>
                    </View>
                );

            case "globe":
                return <GlobeScreen ref={globeRef} />;

            case "create":
                return <CreatePostScreen />;

            case "notifications":
                return <NotificationScreen />;

            case "profile":
                return <ProfileScreen />;

            default:
                return (
                    <View style={styles.content}>
                        <Text>Home</Text>
                    </View>
                );
        }
    };

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
            {renderContent()}

            {/* Floating Button */}
            {activeTab === "globe" && (
                <LocationButton onPress={onLocationPress} />
            )}

            {/* <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity> */}
            <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} />
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
    },
    content: {
        flex: 1,
        paddingBottom: 80,
        justifyContent: "center",
        alignItems: "center",
    },
});