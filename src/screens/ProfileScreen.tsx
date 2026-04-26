import React, { useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from "react-native";

import { signOut } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { useNavigation } from "@react-navigation/native";


import { Colors } from "../theme/colors";
import Icon from "react-native-vector-icons/Ionicons";


export default function ProfileScreen() {
    const navigation: any = useNavigation();


    const handleLogout = async () => {
        try {
            await signOut(auth);
            // No navigation needed — AppNavigator auto redirects
        } catch (error: any) {
            Alert.alert("Logout Error", error.message);
        }
    };

    const handleFollowProfile = async () => {
        Alert.alert("Followed");
    };

    return (
        <View style={styles.container}>
            <View style={styles.profileInfo}>
                <Image source={{ uri: "https://via.placeholder.com/120" }} style={styles.profilePic} />
            </View>

            <View style={styles.profileDetails}>
                <Text style={styles.title}>Nila K S</Text>
                <Text style={styles.subtitle}>@nilaks</Text>
                <Text style={styles.subtitle}>Intermediate CMA | Best companion</Text>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statsBox}>
                    <Text style={styles.subtitle}>1.2K</Text>
                    <Text style={styles.subtitle}>Followers</Text>
                </View>

                <View style={styles.statsBox}>
                    <Text style={styles.subtitle}>450</Text>
                    <Text style={styles.subtitle}>Following</Text>
                </View>

                <View style={styles.statsBox}>
                    <Text style={styles.subtitle}>98</Text>
                    <Text style={styles.subtitle}>Posts</Text>
                </View>


                <TouchableOpacity style={styles.followButton} onPress={handleFollowProfile}>
                    <Text style={styles.followText}>Follow</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.aboutSection}>
                <Text style={styles.title}>About</Text>
                <Text style={styles.subtitle}>Passionate about being happy. CMA</Text>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate("Notification")}>
                <Icon name="notifications" size={28} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate("Chat")} >
                <Icon name="chatbubble-ellipses" size={28} color={Colors.primary} />
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundSoft,
        justifyContent: "center",
        padding: 24,
    },

    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: Colors.primary,
        marginBottom: 8,
    },

    profileInfo: {

    },

    profilePic: {

    },

    profileDetails: {

    },

    statsRow: {

    },

    statsBox: {

    },

    followButton: {

    },

    followText: {

    },

    aboutSection: {

    },

    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: 20,
    },

    /* ✅ ERROR BOX STYLE */
    errorBox: {
        backgroundColor: "#ff4d4d20",
        borderColor: "#ff4d4d",
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
    },

    errorText: {
        color: "#ff4d4d",
        fontSize: 14,
    },

    input: {
        backgroundColor: Colors.background,
        padding: 14,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.textPrimary,
    },

    inputError: {
        borderColor: "#ff4d4d",
    },

    button: {
        backgroundColor: Colors.primary,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10,
    },

    buttonText: {
        color: Colors.textOnDark,
        fontWeight: "bold",
        fontSize: 16,
    },

    eye: {
        position: "absolute",
        right: 15,
        top: 15,
    },

    link: {
        textAlign: "center",
        marginTop: 20,
        color: Colors.textSecondary,
    },

    linkBold: {
        color: Colors.accent,
        fontWeight: "bold",
    },

    logoutButton: {
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
    notificationButton: {
        position: "absolute",
        top: 50,
        left: 20,
        padding: 5,
        zIndex: 10,
    },
    chatButton: {
        position: "absolute",
        top: 50,
        right: 20,
        padding: 5,
        zIndex: 10,
    },
});