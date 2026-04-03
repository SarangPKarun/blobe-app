import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';

type Props = {
    onPress: () => void;
};

const LocationButton: React.FC<Props> = ({ onPress }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.button} onPress={onPress}>
                <Text style={styles.text}>📍</Text>
            </TouchableOpacity>
        </View>
    );
};

export default LocationButton;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
    },
    button: {
        width: 55,
        height: 55,
        borderRadius: 30,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',

        // Shadow (Android + iOS)
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    text: {
        fontSize: 24,
    },
});