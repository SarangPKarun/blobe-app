import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import NotificationScreen from "../screens/NotificationScreen";
import ChatScreen from "../screens/ChatScreen";
import ConversationScreen from "../screens/ConversationScreen";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { setupBackgroundHandler } from "../utils/messaging";
import { getOrCreateKeypair } from "../utils/crypto";
import { registerPublicKey } from "../api/chat";

// Must be called at module level — RN Firebase requirement
setupBackgroundHandler();

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u) {
                // Bootstrap E2E keypair and register public key with chat-service
                getOrCreateKeypair()
                    .then(({ publicKey }) => registerPublicKey(publicKey))
                    .catch((err) => console.warn("[crypto] keypair bootstrap failed:", err));
            }
        });

        return unsubscribe;
    }, []);

    if (loading) return null;

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
            }}
        >
            {user ? (
                <>
                    <Stack.Screen
                        name="Globe"
                        component={HomeScreen}
                    />

                    <Stack.Screen
                        name="Notification"
                        component={NotificationScreen}
                        options={{ animation: "slide_from_left" }}
                    />
                    <Stack.Screen
                        name="Chat"
                        component={ChatScreen}
                        options={{ animation: "slide_from_right" }}
                    />
                    <Stack.Screen
                        name="Conversation"
                        component={ConversationScreen}
                        options={{ animation: "slide_from_right" }}
                    />
                </>
            ) : (
                <>
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                    />

                    <Stack.Screen
                        name="Register"
                        component={RegisterScreen}
                    />
                </>
            )}
        </Stack.Navigator>
    );
}