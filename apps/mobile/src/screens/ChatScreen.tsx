import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { Colors } from "../theme/colors";
import { listConversations } from "../api/chat";
import type { Conversation } from "@blobe/shared-types";

export default function ChatScreen({ navigation }: { navigation: any }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await listConversations();
            setConversations(data);
        } catch (err) {
            console.error("[ChatScreen] failed to load conversations:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleNewChat = () => {
        Alert.prompt(
            "New Chat",
            "Enter the user ID to start a conversation:",
            async (recipientId) => {
                if (!recipientId?.trim()) return;
                try {
                    const { getOrCreateConversation } = await import("../api/chat");
                    const conv = await getOrCreateConversation(recipientId.trim());
                    navigation.navigate("Conversation", {
                        conversationId: conv.id,
                        recipientId: recipientId.trim(),
                    });
                } catch {
                    Alert.alert("Error", "Could not start conversation.");
                }
            },
        );
    };

    const renderItem = ({ item }: { item: Conversation }) => {
        const otherParticipant = item.participants.find((p) => p.userId !== item.id);
        const recipientId = otherParticipant?.userId ?? "";
        const hasUnread = (item.unreadCount ?? 0) > 0;

        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() =>
                    navigation.navigate("Conversation", {
                        conversationId: item.id,
                        recipientId,
                    })
                }
            >
                <View style={styles.avatar}>
                    <Icon name="person-circle-outline" size={42} color={Colors.secondary} />
                </View>

                <View style={styles.chatContent}>
                    <Text style={styles.name} numberOfLines={1}>
                        {recipientId || "Chat"}
                    </Text>
                    <Text style={styles.message} numberOfLines={1}>
                        {item.lastMessage ? "New message" : "No messages yet"}
                    </Text>
                </View>

                <View style={styles.rightSide}>
                    <Text style={styles.time}>
                        {new Date(item.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </Text>
                    {hasUnread && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Chats</Text>
                <TouchableOpacity onPress={handleNewChat}>
                    <Icon name="create-outline" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No conversations yet. Tap + to start one.</Text>
                    }
                />
            )}
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
    loader: {
        marginTop: 40,
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
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.backgroundSoft,
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
    empty: {
        textAlign: "center",
        marginTop: 60,
        color: Colors.textSecondary,
        fontSize: 15,
    },
});
