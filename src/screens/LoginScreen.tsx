import React, { useState } from "react";
import {
    View,
    TextInput,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { Colors } from "../theme/colors";

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(""); // ✅ NEW STATE
    const [loading, setLoading] = useState(false);

    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    // 🔥 Friendly Firebase errors
    const getFriendlyError = (msg: string) => {
        if (msg.includes("user-not-found"))
            return "No account found with this email";
        if (msg.includes("wrong-password"))
            return "Incorrect password";
        if (msg.includes("invalid-email"))
            return "Invalid email format";
        return "Login failed. Try again.";
    };

    const showMessage = (setFn: any, message: string) => {
        setFn(message);

        setTimeout(() => {
            setFn("");
        }, 4000); // ⏱️ 5 seconds
    };


    const handleLogin = async () => {
        setError("");
        setEmailError(false);
        setPasswordError(false);

        if (!email || !password) {
            showMessage(setError, "Please fill all fields");
            setEmailError(!email);
            setPasswordError(!password);
            return;
        }

        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
        } catch (e: any) {
            showMessage(setError, getFriendlyError(e.message));
        } finally {
            setLoading(false);
        }
    };


    return (
        <View style={styles.container}>

            <Text style={styles.title}>Welcome Back 🌍</Text>
            <Text style={styles.subtitle}>Login to continue</Text>

            {/* ✅ CUSTOM ALERT BOX */}
            {error ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {/* EMAIL */}
            <TextInput
                placeholder="Email"
                placeholderTextColor={Colors.textSecondary}
                style={[
                    styles.input,
                    emailError && styles.inputError
                ]}
                onChangeText={setEmail}
            />

            {/* PASSWORD + 👁️ TOGGLE */}
            <View style={{ position: "relative" }}>
                <TextInput
                    placeholder="Password"
                    placeholderTextColor={Colors.textSecondary}
                    secureTextEntry={!showPassword}
                    style={[
                        styles.input,
                        passwordError && styles.inputError
                    ]}
                    onChangeText={setPassword}
                />

                <TouchableOpacity
                    style={styles.eye}
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Text style={{ color: Colors.textSecondary }}>
                        {showPassword ? "🙈" : "👁️"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* BUTTON */}
            <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Login</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={styles.link}>
                    Don't have an account?{" "}
                    <Text style={styles.linkBold}>Register</Text>
                </Text>
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
});