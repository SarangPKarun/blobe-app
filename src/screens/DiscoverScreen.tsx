import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Colors } from "../theme/colors";
import Icon from "react-native-vector-icons/Ionicons";

export default function DiscoverScreen({ setActiveTab }: { setActiveTab: (tab: string) => void }) {

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.createPostButton} onPress={() => setActiveTab("create")}>
                <Icon name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.title}>Discover Screen</Text>
            <Text style={styles.subtitle}>You can discover new posts here</Text>


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

    createPostButton: {
        position: "absolute",
        top: 50,
        right: 20,
        backgroundColor: Colors.primary,
        width: 50,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 25,
        zIndex: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
});