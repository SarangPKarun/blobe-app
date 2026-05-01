import React, { useState, useEffect } from "react";
import {
    View,
    TextInput,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { createUserWithEmailAndPassword, updatePassword, signInWithPhoneNumber, ApplicationVerifier } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../utils/firebaseConfig";
import { Colors } from "../theme/colors";

export default function RegisterScreen({ navigation }: any) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Step 1 State
    const [contactInfo, setContactInfo] = useState("");
    const [inputType, setInputType] = useState<"email" | "phone" | null>(null);

    // Step 2 State
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(30);
    const [confirmationResult, setConfirmationResult] = useState<any>(null);

    // Step 3 State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [dobDay, setDobDay] = useState("1");
    const [dobMonth, setDobMonth] = useState("1");
    const [dobYear, setDobYear] = useState("2000");
    const [password, setPassword] = useState("");

    // Errors
    const [fieldErrors, setFieldErrors] = useState<any>({});

    useEffect(() => {
        let interval: any;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const showMessage = (setFn: any, message: string) => {
        setFn(message);
        setTimeout(() => setFn(""), 4000);
    };

    const getPasswordStrength = () => {
        if (password.length < 6) return "Weak";
        if (password.length < 10) return "Medium";
        return "Strong";
    };


    const validateContact = (input: string) => {
        const trimmed = input.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;

        if (emailRegex.test(trimmed)) {
            return { type: "email", value: trimmed };
        }

        if (phoneRegex.test(trimmed)) {
            // normalize phone to +91 format
            let phone = trimmed.replace(/^(\+91|91)/, "");
            return { type: "phone", value: `+91${phone}` };
        }

        return { type: "invalid", value: "" };
    };

    const handleNextStep1 = async () => {
        setError("");

        const result = validateContact(contactInfo);

        if (result.type === "invalid") {
            showMessage(setError, "Enter a valid email or phone number");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;

        if (emailRegex.test(contactInfo)) {
            setInputType("email");
            // Simulate sending OTP for email
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                setStep(2);
                setTimer(30);
            }, 1000);
        }
        else if (phoneRegex.test(contactInfo)) {
            setInputType("phone");
            setLoading(true);
            try {
                const formattedPhone = contactInfo.startsWith("+91")
                    ? contactInfo
                    : `+91${contactInfo}`;

                const confirmationResult = await auth().signInWithPhoneNumber(formattedPhone);

                setConfirmationResult(confirmationResult);

                setTimeout(() => {
                    setLoading(false);
                    setStep(2);
                    setTimer(30);
                }, 1000);
            } catch (e: any) {
                setLoading(false);
                showMessage(setError, e.message);
            }
        } else {
            showMessage(setError, "Please enter a valid email or phone number (e.g., +1234567890)");
        }
    };

    const handleNextStep2 = async () => {
        setError("");
        if (otp.length !== 6) {
            showMessage(setError, "Please enter a 6-digit OTP");
            return;
        }

        setLoading(true);
        try {
            if (inputType === "phone" && confirmationResult) {
                await confirmationResult.confirm(otp);

                const user = auth().currentUser;

                console.log("UID:", user?.uid);

                setStep(3);
            }
            // else {
            //     // Simulated OTP verification
            //     if (otp !== "123456") {
            //         throw new Error("Invalid OTP. Try 123456");
            //     }
            // }
        } catch (e: any) {
            showMessage(setError, e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        setError("");
        let errors: any = {};
        if (!firstName) errors.firstName = true;
        if (!lastName) errors.lastName = true;
        if (!username) errors.username = true;
        if (password.length < 8) errors.password = true;

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            showMessage(setError, "Please fill all fields correctly. Password min 8 chars.");
            return;
        }

        setLoading(true);
        try {
            // Check username uniqueness
            const usernameRef = doc(db, "usernames", username.toLowerCase());
            const usernameSnap = await getDoc(usernameRef);

            if (usernameSnap.exists()) {
                throw new Error("Username is already taken");
            }

            let uid = "";
            let userEmail = inputType === "email" ? contactInfo : "";
            let userPhone = inputType === "phone" ? contactInfo : "";

            if (inputType === "email") {
                const userCredential = await createUserWithEmailAndPassword(auth, contactInfo, password);
                uid = userCredential.user.uid;
            } else {
                // For phone auth, user is already authenticated if confirm() succeeded
                // Since we are mocking phone OTP, we will create a mock account here
                // just so it works without the native setup.
                const mockEmail = `phone_${contactInfo.replace("+", "")}@mock.com`;
                const userCredential = await createUserWithEmailAndPassword(auth, mockEmail, password);
                uid = userCredential.user.uid;
            }

            // Save to Firestore
            const dob = { day: parseInt(dobDay), month: parseInt(dobMonth), year: parseInt(dobYear) };

            await setDoc(doc(db, "users", uid), {
                firstName,
                lastName,
                username: username.toLowerCase(),
                dob,
                email: userEmail,
                phone: userPhone,
                createdAt: new Date().toISOString()
            });

            await setDoc(usernameRef, { uid });

            setSuccess("Account created successfully! 🎉");
            setTimeout(() => {
                navigation.goBack();
            }, 1500);

        } catch (e: any) {
            showMessage(setError, e.message);
        } finally {
            setLoading(false);
        }
    };

    const generateArray = (start: number, end: number) => {
        return Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Create Account 🌱</Text>
                <Text style={styles.subtitle}>Step {step} of 3</Text>

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

                {step === 1 && (
                    <>
                        <TextInput
                            placeholder="Email or Phone Number"
                            placeholderTextColor={Colors.textSecondary}
                            style={styles.input}
                            value={contactInfo}
                            onChangeText={setContactInfo}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TouchableOpacity style={styles.button} onPress={handleNextStep1} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
                        </TouchableOpacity>
                    </>
                )}

                {step === 2 && (
                    <>
                        <Text style={styles.infoText}>
                            Enter the 6-digit OTP sent to {contactInfo}
                        </Text>
                        <TextInput
                            placeholder="123456"
                            placeholderTextColor={Colors.textSecondary}
                            style={styles.input}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="numeric"
                            maxLength={6}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.button} onPress={handleNextStep2} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.resendButton}
                            disabled={timer > 0}
                            onPress={() => { setTimer(30); setOtp(""); }}
                        >
                            <Text style={[styles.link, timer > 0 && styles.disabledText]}>
                                {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                {step === 3 && (
                    <>
                        <View style={styles.row}>
                            <TextInput
                                placeholder="First Name"
                                placeholderTextColor={Colors.textSecondary}
                                style={[styles.input, styles.halfInput, fieldErrors.firstName && styles.inputError]}
                                value={firstName}
                                onChangeText={setFirstName}
                            />
                            <TextInput
                                placeholder="Last Name"
                                placeholderTextColor={Colors.textSecondary}
                                style={[styles.input, styles.halfInput, fieldErrors.lastName && styles.inputError]}
                                value={lastName}
                                onChangeText={setLastName}
                            />
                        </View>

                        <TextInput
                            placeholder="Username"
                            placeholderTextColor={Colors.textSecondary}
                            style={[styles.input, fieldErrors.username && styles.inputError]}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>Date of Birth</Text>
                        <View style={styles.pickerRow}>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={dobDay} onValueChange={setDobDay} style={styles.picker} dropdownIconColor={Colors.textSecondary}>
                                    {generateArray(1, 31).map(day => <Picker.Item key={day} label={day} value={day} />)}
                                </Picker>
                            </View>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={dobMonth} onValueChange={setDobMonth} style={styles.picker} dropdownIconColor={Colors.textSecondary}>
                                    {generateArray(1, 12).map(month => <Picker.Item key={month} label={month} value={month} />)}
                                </Picker>
                            </View>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={dobYear} onValueChange={setDobYear} style={styles.picker} dropdownIconColor={Colors.textSecondary}>
                                    {generateArray(1900, new Date().getFullYear()).reverse().map(year => <Picker.Item key={year} label={year} value={year} />)}
                                </Picker>
                            </View>
                        </View>

                        <TextInput
                            placeholder="Password (min 8 chars)"
                            placeholderTextColor={Colors.textSecondary}
                            secureTextEntry
                            style={[styles.input, fieldErrors.password && styles.inputError]}
                            value={password}
                            onChangeText={setPassword}
                        />
                        {password ? <Text style={styles.strength}>Strength: {getPasswordStrength()}</Text> : null}

                        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Registration</Text>}
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.link}>
                        Already have an account? <Text style={styles.linkBold}>Login</Text>
                    </Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
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
    infoText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 15,
        textAlign: "center"
    },
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
    row: {
        flexDirection: "row",
        justifyContent: "space-between"
    },
    halfInput: {
        width: "48%"
    },
    label: {
        color: Colors.textSecondary,
        marginBottom: 5,
        fontSize: 14,
        fontWeight: "bold"
    },
    pickerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    pickerContainer: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        marginHorizontal: 2,
        height: 50,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    picker: {
        color: Colors.textPrimary,
        height: 50,
        width: '100%',
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
    resendButton: {
        marginTop: 15,
        alignItems: "center"
    },
    link: {
        textAlign: "center",
        marginTop: 20,
        color: Colors.textSecondary,
    },
    disabledText: {
        opacity: 0.5
    },
    linkBold: {
        color: Colors.primary,
        fontWeight: "bold",
    },
});