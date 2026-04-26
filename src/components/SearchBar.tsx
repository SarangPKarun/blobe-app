import React from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Text,
} from 'react-native';

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    onPressSearch?: () => void;
};

const SearchBar: React.FC<Props> = ({
    value,
    onChangeText,
    onPressSearch,
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.searchBox}>
                <TextInput
                    style={styles.input}
                    placeholder="Search..."
                    placeholderTextColor="#777"
                    value={value}
                    onChangeText={onChangeText}
                />

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onPressSearch}
                >
                    <Text style={styles.icon}>🔍</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default SearchBar;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
    },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 55,

        // Shadow
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },

    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },

    iconButton: {
        marginLeft: 10,
    },

    icon: {
        fontSize: 22,
    },
});