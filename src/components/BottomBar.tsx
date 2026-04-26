import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function BottomBar({ activeTab, setActiveTab }: any) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setActiveTab("discover")}
                >
                    <Icon
                        name="compass"
                        size={24}
                        color={activeTab === "discover" ? "#000" : "#8e8e93"}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setActiveTab("globe")}
                >
                    <Icon
                        name="home"
                        size={24}
                        color={activeTab === "globe" ? "#09ff98ff" : "#8e8e93"}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setActiveTab("profile")}
                >
                    <Icon
                        name="person"
                        size={24}
                        color={activeTab === "profile" ? "#000" : "#8e8e93"}
                    />
                </TouchableOpacity>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        bottom: 18,
        left: 18,
        right: 18,
        alignItems: "center",
    },

    container: {
        width: "100%",
        height: 62,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.50)",
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center"
    },

    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
    },
});