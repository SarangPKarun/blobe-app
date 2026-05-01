import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyA9hLMB1zN2yBPR-hddOKDFknns2N6u3gk",
    authDomain: "blobe-app.firebaseapp.com",
    projectId: "blobe-app",
    storageBucket: "blobe-app.firebasestorage.app",
    messagingSenderId: "63690453911",
    appId: "1:63690453911:web:2993e5cf11fff58a394ad2",
    measurementId: "G-55XXDT6VN9"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);