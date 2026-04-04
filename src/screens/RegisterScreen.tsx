import React, { useState } from "react";
import {
    View,
    TextInput,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { Colors } from "../theme/colors";

export default function RegisterScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");     // ✅ error state
    const [success, setSuccess] = useState(""); // ✅ success state
    const [loading, setLoading] = useState(false);

    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    // 🔥 Password strength
    const getPasswordStrength = () => {
        if (password.length < 6) return "Weak";
        if (password.length < 10) return "Medium";
        return "Strong";
    };

    // 🔥 Firebase error cleaner
    const getFriendlyError = (msg: string) => {
        if (msg.includes("email-already-in-use"))
            return "Email already registered";
        if (msg.includes("invalid-email"))
            return "Invalid email format";
        return "Something went wrong. Try again.";
    };

    const showMessage = (setFn: any, message: string) => {
        setFn(message);

        setTimeout(() => {
            setFn("");
        }, 4000); // ⏱️ 5 seconds
    };

    const handleRegister = async () => {
        setError("");
        setSuccess("");
        setEmailError(false);
        setPasswordError(false);

        if (!email || !password) {
            showMessage(setError, "Please fill all fields");
            setEmailError(!email);
            setPasswordError(!password);
            return;
        }

        if (password.length < 6) {
            showMessage(setError, "Password must be at least 6 characters");
            setPasswordError(true);
            return;
        }

        try {
            setLoading(true);
            await createUserWithEmailAndPassword(auth, email, password);

            setSuccess("Account created 🎉");

            setTimeout(() => {
                navigation.navigate("Login");
            }, 1500);

        } catch (e: any) {
            showMessage(setError, getFriendlyError(e.message));
        } finally {
            setLoading(false);
        }
    };


    return (
        <View style={styles.container}>

            <Text style={styles.title}>Create Account 🌱</Text>
            <Text style={styles.subtitle}>Register to get started</Text>

            {/* 🔴 ERROR ALERT */}
            {error ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {/* 🟢 SUCCESS ALERT */}
            {success ? (
                <View style={styles.successBox}>
                    <Text style={styles.successText}>{success}</Text>
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

            {/* PASSWORD */}
            <TextInput
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                style={[
                    styles.input,
                    passwordError && styles.inputError
                ]}
                onChangeText={setPassword}
            />

            {/* 🔥 Password Strength */}
            {password ? (
                <Text style={styles.strength}>
                    Strength: {getPasswordStrength()}
                </Text>
            ) : null}

            {/* BUTTON */}
            <TouchableOpacity
                style={styles.button}
                onPress={handleRegister}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Register</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.link}>
                    Already have an account?{" "}
                    <Text style={styles.linkBold}>Login</Text>
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

    /* 🔴 ERROR BOX */
    errorBox: {
        backgroundColor: "#ff4d4d20",
        borderColor: "#ff4d4d",
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },

    errorText: {
        color: "#ff4d4d",
        fontSize: 14,
    },

    /* 🟢 SUCCESS BOX */
    successBox: {
        backgroundColor: "#4CAF5020",
        borderColor: "#4CAF50",
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },

    successText: {
        color: "#4CAF50",
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

    strength: {
        marginBottom: 10,
        color: Colors.textSecondary,
        fontSize: 12,
    },

    button: {
        backgroundColor: Colors.accent,
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

    link: {
        textAlign: "center",
        marginTop: 20,
        color: Colors.textSecondary,
    },

    linkBold: {
        color: Colors.primary,
        fontWeight: "bold",
    },
});