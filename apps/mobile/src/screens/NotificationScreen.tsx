import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { Colors } from "../theme/colors";
import { fetchNotifications, markNotificationRead, markAllRead } from "../api/notifications";
import { setupForegroundListener } from "../utils/messaging";

type NotificationItem = {
    id: string;
    type: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    actorId?: string;
    sourceId?: string;
};

export default function NotificationScreen() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadNotifications = useCallback(async (cursor?: string) => {
        try {
            const data = await fetchNotifications({ limit: 20, cursor });
            if (cursor) {
                setNotifications((prev) => [...prev, ...data.notifications]);
            } else {
                setNotifications(data.notifications);
            }
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);
        } catch (err) {
            console.error('[NotificationScreen] fetch failed:', err);
        }
    }, []);

    useEffect(() => {
        loadNotifications().finally(() => setLoading(false));

        const unsubscribe = setupForegroundListener(({ title, body, data }) => {
            const newNotif: NotificationItem = {
                id: data?.notificationId ?? String(Date.now()),
                type: data?.type ?? 'general',
                content: body ?? title ?? '',
                isRead: false,
                createdAt: new Date().toISOString(),
                sourceId: data?.postId ?? data?.paymentId,
                actorId: data?.actorId,
            };
            setNotifications((prev) => [newNotif, ...prev]);
        });

        return unsubscribe;
    }, [loadNotifications]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const onEndReached = async () => {
        if (!hasMore || loadingMore || !nextCursor) return;
        setLoadingMore(true);
        await loadNotifications(nextCursor);
        setLoadingMore(false);
    };

    const handleRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        try {
            await markNotificationRead(id);
        } catch {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
            );
        }
    };

    const handleMarkAll = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        try {
            await markAllRead();
        } catch (err) {
            console.error('[NotificationScreen] markAllRead failed:', err);
        }
    };

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <TouchableOpacity
            style={[styles.card, item.isRead && styles.cardRead]}
            onPress={() => handleRead(item.id)}
        >
            <View style={styles.dot}>
                {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.textArea}>
                <Text style={styles.text}>{item.content}</Text>
                <Text style={styles.time}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Notifications</Text>
                <TouchableOpacity onPress={handleMarkAll}>
                    <Text style={styles.markAll}>Mark all read</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.3}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>No notifications yet</Text>
                }
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator style={styles.footer} color={Colors.primary} />
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundSoft,
        paddingTop: 24,
        paddingHorizontal: 16,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.backgroundSoft,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    header: {
        fontSize: 26,
        fontWeight: "bold",
        color: "#111",
    },
    markAll: {
        fontSize: 13,
        color: Colors.accent,
        fontWeight: "600",
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: "#eee",
    },
    cardRead: {
        opacity: 0.6,
    },
    dot: {
        width: 12,
        alignItems: "center",
        marginRight: 10,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
    },
    textArea: {
        flex: 1,
    },
    text: {
        fontSize: 14,
        color: "#222",
        lineHeight: 20,
    },
    time: {
        marginTop: 2,
        fontSize: 12,
        color: "gray",
    },
    empty: {
        textAlign: "center",
        marginTop: 60,
        color: Colors.textSecondary,
        fontSize: 15,
    },
    footer: {
        marginVertical: 16,
    },
});
