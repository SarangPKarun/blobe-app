import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";

import BottomBar from "../components/BottomBar";
import NotificationScreen from "./NotificationScreen";
import GlobeScreen, { GlobeScreenHandle } from './GlobeScreen';
import DiscoverScreen from "./DiscoverScreen";

import ProfileScreen from "./ProfileScreen";
import CreatePostScreen from "./CreatePostScreen";

import LocationButton from '../components/LocationButton';
import { handleLocationPress } from '../utils/locationHandler';
import SearchBar from "../components/SearchBar";
import { useRef } from 'react';



export default function HomeScreen() {
    const globeRef = useRef<GlobeScreenHandle>(null);

    const [activeTab, setActiveTab] = useState("globe");
    const [search, setSearch] = useState('');

    const renderContent = () => {
        switch (activeTab) {
            case "discover":
                return <DiscoverScreen />;

            case "globe":
                return <GlobeScreen ref={globeRef} />;

            case "create":
                return <CreatePostScreen />;

            case "notifications":
                return <NotificationScreen />;

            case "profile":
                return <ProfileScreen />;
        }
    };

    const onLocationPress = () => {
        handleLocationPress((lat, lng) => {
            globeRef.current?.sendLocation(lat, lng);
        });
    };


    return (
        <View style={styles.container}>
            {renderContent()}

            {/* Floating Button */}
            {activeTab === "globe" && (
                <LocationButton onPress={onLocationPress} />
            )}

            {activeTab === "globe" && (
                <SearchBar
                    value={search}
                    onChangeText={setSearch}
                    onPressSearch={() => console.log(search)}
                />
            )}

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