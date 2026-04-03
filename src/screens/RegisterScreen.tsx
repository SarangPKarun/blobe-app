import React, { useState } from "react";
import { View, TextInput, Button, Text, TouchableOpacity } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { Alert } from 'react-native';

export default function RegisterScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    return (
        <View style={{ padding: 20 }}>
            <TextInput placeholder="Email" onChangeText={setEmail} />
            <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} />

            <Button title="Register" onPress={handleRegister} />

            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
}