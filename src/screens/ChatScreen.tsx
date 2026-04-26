import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { Colors } from "../theme/colors";

const chats = [
    {
        id: "1",
        name: "Ava",
        message: "Hey, how are you?",
        time: "2m",
        unread: 2,
        image: "https://i.pravatar.cc/150?img=1",
    },
    {
        id: "2",
        name: "Noah",
        message: "Let's meet tomorrow.",
        time: "10m",
        unread: 0,
        image: "https://i.pravatar.cc/150?img=2",
    },
    {
        id: "3",
        name: "Emma",
        message: "Sent a photo",
        time: "1h",
        unread: 1,
        image: "https://i.pravatar.cc/150?img=3",
    },
    {
        id: "4",
        name: "Liam",
        message: "Typing...",
        time: "3h",
        unread: 0,
        image: "https://i.pravatar.cc/150?img=4",
    },
];

export default function ChatScreen() {
    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.chatItem}>
            <Image source={{ uri: item.image }} style={styles.avatar} />

            <View style={styles.chatContent}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.message}>{item.message}</Text>
            </View>

            <View style={styles.rightSide}>
                <Text style={styles.time}>{item.time}</Text>

                {item.unread > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {item.unread}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Chats</Text>

                <TouchableOpacity>
                    <Icon
                        name="create-outline"
                        size={24}
                        color={Colors.primary}
                    />
                </TouchableOpacity>
            </View>

            <FlatList
                data={chats}
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
        paddingTop: 55,
        paddingHorizontal: 16,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },

    title: {
        fontSize: 30,
        fontWeight: "700",
        color: Colors.primary,
    },

    chatItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: "#ddd",
    },

    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        marginRight: 14,
    },

    chatContent: {
        flex: 1,
    },

    name: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.textPrimary,
        marginBottom: 4,
    },

    message: {
        fontSize: 14,
        color: Colors.textSecondary,
    },

    rightSide: {
        alignItems: "flex-end",
    },

    time: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 6,
    },

    badge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 6,
    },

    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
});