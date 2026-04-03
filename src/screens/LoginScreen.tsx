import React, { useState } from "react";
import { View, TextInput, Button, Text, TouchableOpacity } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { Alert } from 'react-native';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    return (
        <View style={{ padding: 20 }}>
            <TextInput placeholder="Email" onChangeText={setEmail} />
            <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} />

            <Button title="Login" onPress={handleLogin} />

            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text>Don't have an account? Register</Text>
            </TouchableOpacity>
        </View>
    );
}