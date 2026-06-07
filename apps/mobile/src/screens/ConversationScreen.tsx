import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";
import { Colors } from "../theme/colors";
import { fetchMessages, fetchPublicKey } from "../api/chat";
import { getOrCreateKeypair, encryptMessage, decryptMessage } from "../utils/crypto";
import { useChatSocket } from "../hooks/useChatSocket";
import type { ChatMessage } from "@blobe/shared-types";

interface DecryptedMessage extends ChatMessage {
    text: string;
    isMine: boolean;
    readByOther: boolean;
}

interface Props {
    navigation: any;
    route: { params: { conversationId: string; recipientId: string } };
}

export default function ConversationScreen({ navigation, route }: Props) {
    const { conversationId, recipientId } = route.params;

    const [messages, setMessages] = useState<DecryptedMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [typingUserId, setTypingUserId] = useState<string | null>(null);
    const [myUserId, setMyUserId] = useState<string | null>(null);

    const myPrivateKeyRef = useRef<string | null>(null);
    const myPublicKeyRef = useRef<string | null>(null);
    const recipientPublicKeyRef = useRef<string | null>(null);
    const publicKeyMapRef = useRef<Record<string, string>>({});
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const flatListRef = useRef<FlatList>(null);

    // Decode userId from stored JWT
    useEffect(() => {
        AsyncStorage.getItem("internal_jwt").then((token) => {
            if (!token) return;
            try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                setMyUserId(payload.id);
            } catch {}
        });
    }, []);

    const decrypt = useCallback(
        async (msg: ChatMessage): Promise<DecryptedMessage> => {
            const isMine = msg.senderId === myUserId;
            let text = "[encrypted]";
            try {
                const senderPk =
                    publicKeyMapRef.current[msg.senderId] ??
                    (isMine ? myPublicKeyRef.current! : recipientPublicKeyRef.current!);
                if (senderPk && myPrivateKeyRef.current) {
                    text = await decryptMessage(
                        msg.encryptedContent,
                        msg.iv,
                        senderPk,
                        myPrivateKeyRef.current,
                    );
                }
            } catch {}
            return { ...msg, text, isMine, readByOther: false };
        },
        [myUserId],
    );

    // Load keys + initial messages
    useEffect(() => {
        if (!myUserId) return;
        (async () => {
            try {
                const [keypair, recipPk] = await Promise.all([
                    getOrCreateKeypair(),
                    fetchPublicKey(recipientId).catch(() => ""),
                ]);
                myPrivateKeyRef.current = keypair.privateKey;
                myPublicKeyRef.current = keypair.publicKey;
                recipientPublicKeyRef.current = recipPk;
                publicKeyMapRef.current[myUserId] = keypair.publicKey;
                if (recipPk) publicKeyMapRef.current[recipientId] = recipPk;

                const { messages: raw } = await fetchMessages(conversationId);
                const decrypted = await Promise.all(raw.map(decrypt));
                // API returns newest first; reverse to show oldest first in inverted list
                setMessages(decrypted);
            } catch (err) {
                console.error("[ConversationScreen] init error:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [myUserId, conversationId, recipientId, decrypt]);

    const handleMessageNew = useCallback(
        async (msg: ChatMessage) => {
            const decrypted = await decrypt(msg);
            setMessages((prev) => [decrypted, ...prev]);
        },
        [decrypt],
    );

    const handleTypingStart = useCallback(
        (data: { userId: string }) => {
            if (data.userId !== myUserId) setTypingUserId(data.userId);
        },
        [myUserId],
    );

    const handleTypingStop = useCallback(
        (data: { userId: string }) => {
            if (data.userId !== myUserId) setTypingUserId(null);
        },
        [myUserId],
    );

    const handleMessageRead = useCallback(
        (data: { userId: string; messageId: string }) => {
            if (data.userId === myUserId) return;
            setMessages((prev) =>
                prev.map((m) => (m.isMine ? { ...m, readByOther: true } : m)),
            );
        },
        [myUserId],
    );

    const handlePresenceUpdate = useCallback(
        (_data: { userId: string; online: boolean }) => {},
        [],
    );

    const { sendMessage, emitTypingStart, emitTypingStop, emitRead } = useChatSocket({
        conversationId,
        onMessageNew: handleMessageNew,
        onTypingStart: handleTypingStart,
        onTypingStop: handleTypingStop,
        onMessageRead: handleMessageRead,
        onPresenceUpdate: handlePresenceUpdate,
    });

    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || sending) return;
        if (!recipientPublicKeyRef.current || !myPrivateKeyRef.current) return;

        setSending(true);
        setInputText("");
        if (isTypingRef.current) {
            isTypingRef.current = false;
            emitTypingStop(conversationId);
        }

        try {
            const { encryptedContent, iv } = await encryptMessage(
                text,
                recipientPublicKeyRef.current,
                myPrivateKeyRef.current,
            );
            await sendMessage({ conversationId, encryptedContent, iv });
        } catch (err) {
            console.error("[ConversationScreen] send error:", err);
            setInputText(text);
        } finally {
            setSending(false);
        }
    }, [inputText, sending, conversationId, sendMessage, emitTypingStop]);

    const handleChangeText = useCallback(
        (text: string) => {
            setInputText(text);
            if (text.length > 0 && !isTypingRef.current) {
                isTypingRef.current = true;
                emitTypingStart(conversationId);
            }
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => {
                if (isTypingRef.current) {
                    isTypingRef.current = false;
                    emitTypingStop(conversationId);
                }
            }, 1500);
        },
        [conversationId, emitTypingStart, emitTypingStop],
    );

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: any) => {
            for (const item of viewableItems) {
                const msg: DecryptedMessage = item.item;
                if (!msg.isMine) {
                    emitRead(conversationId, msg.id);
                }
            }
        },
        [conversationId, emitRead],
    );

    const renderMessage = ({ item }: { item: DecryptedMessage }) => (
        <View style={[styles.bubble, item.isMine ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.bubbleText, item.isMine && styles.myBubbleText]}>
                {item.text}
            </Text>
            {item.isMine && (
                <Icon
                    name={item.readByOther ? "checkmark-done" : "checkmark"}
                    size={12}
                    color={item.readByOther ? Colors.accent : Colors.secondary}
                    style={styles.tick}
                />
            )}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="chevron-back" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {recipientId}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    inverted
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
                    ListHeaderComponent={
                        typingUserId ? (
                            <View style={styles.typingBubble}>
                                <Text style={styles.typingText}>typing…</Text>
                            </View>
                        ) : null
                    }
                />
            )}

            {/* Input bar */}
            <View style={styles.inputBar}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={handleChangeText}
                    placeholder="Message"
                    placeholderTextColor={Colors.textSecondary}
                    multiline
                    maxLength={2000}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || sending}
                >
                    <Icon name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 55,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    backBtn: { marginRight: 8 },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: "600",
        color: Colors.textPrimary,
    },
    loader: { flex: 1, justifyContent: "center" },
    messageList: { paddingHorizontal: 16, paddingVertical: 12 },
    bubble: {
        maxWidth: "75%",
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginVertical: 4,
    },
    myBubble: {
        alignSelf: "flex-end",
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        alignSelf: "flex-start",
        backgroundColor: Colors.backgroundSoft,
        borderBottomLeftRadius: 4,
    },
    bubbleText: { fontSize: 15, color: Colors.textPrimary },
    myBubbleText: { color: "#fff" },
    tick: { alignSelf: "flex-end", marginTop: 4 },
    typingBubble: {
        alignSelf: "flex-start",
        backgroundColor: Colors.backgroundSoft,
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 8,
    },
    typingText: { color: Colors.textSecondary, fontSize: 14 },
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderTopColor: Colors.border,
        backgroundColor: Colors.background,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        backgroundColor: Colors.backgroundSoft,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.textPrimary,
        marginRight: 10,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    sendBtnDisabled: { backgroundColor: Colors.secondary },
});
