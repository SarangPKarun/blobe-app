import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function BottomBar({ activeTab, setActiveTab }: any) {
    return (
        <View style={styles.container}>

            <TouchableOpacity onPress={() => setActiveTab("home")}>
                <Icon name="home" size={24} color={activeTab === "home" ? "#007bff" : "#999"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActiveTab("globe")}>
                <Icon name="compass" size={24} color={activeTab === "globe" ? "#007bff" : "#999"} />
            </TouchableOpacity>

            {/* 🔥 CENTER BUTTON */}
            <TouchableOpacity
                style={styles.centerButton}
                onPress={() => setActiveTab("create")}
            >
                <Icon name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActiveTab("notifications")}>
                <Icon name="notifications" size={24} color={activeTab === "notifications" ? "#007bff" : "#999"} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActiveTab("profile")}>
                <Icon name="person" size={24} color={activeTab === "profile" ? "#007bff" : "#999"} />
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        width: "100%",
        height: 70,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        backgroundColor: "#fff",
        borderTopWidth: 0.5,
        borderColor: "#ccc",
    },
    centerButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#007bff",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 30,
    },
});