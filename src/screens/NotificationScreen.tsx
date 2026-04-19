import React, { useState } from "react";
import { View, Image, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";

import { Colors } from "../theme/colors";

type NotificationItem = {
    id: string;
    name: string;
    action: string;
    time: string;
    image: string;
    followBack?: boolean;
};

const notifications: NotificationItem[] = [
    {
        id: "1",
        name: "john_doe",
        action: "started following you.",
        time: "2m",
        image: "https://i.pravatar.cc/150?img=1",
        followBack: true,
    },
    {
        id: "2",
        name: "emma_watson",
        action: "liked your photo.",
        time: "10m",
        image: "https://i.pravatar.cc/150?img=5",
    },
    {
        id: "3",
        name: "alex_07",
        action: "commented: Nice shot 🔥",
        time: "25m",
        image: "https://i.pravatar.cc/150?img=8",
    },
    {
        id: "4",
        name: "michael",
        action: "mentioned you in a story.",
        time: "1h",
        image: "https://i.pravatar.cc/150?img=12",
    },
    {
        id: "5",
        name: "sophia",
        action: "started following you.",
        time: "3h",
        image: "https://i.pravatar.cc/150?img=15",
        followBack: true,
    },
];


export default function NotificationScreen() {

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <TouchableOpacity style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.avatar} />

            <View style={styles.textArea}>
                <Text style={styles.text}>
                    <Text style={styles.name}>{item.name} </Text>
                    {item.action}
                    <Text style={styles.time}> {item.time}</Text>
                </Text>
            </View>

            {item.followBack && (
                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>Follow</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );


    return (
        <View style={styles.container}>

            <Text style={styles.header}>Notifications</Text>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
            />

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

    header: {
        fontSize: 26,
        fontWeight: "bold",
        marginBottom: 20,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: "#eee",
    },

    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },

    textArea: {
        flex: 1,
        marginLeft: 12,
        paddingRight: 10,
    },

    text: {
        fontSize: 14,
        color: "#222",
        lineHeight: 20,
    },

    name: {
        fontWeight: "bold",
    },

    time: {
        color: "gray",
        fontSize: 13,
    },
});