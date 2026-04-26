import React from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

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
                <Icon
                    name="search"
                    size={20}
                    color="#8e8e93"
                    style={styles.leftIcon}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Search..."
                    placeholderTextColor="#8e8e93"
                    value={value}
                    onChangeText={onChangeText}
                />

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onPressSearch}
                >
                    <Icon
                        name="arrow-forward-circle"
                        size={24}
                        color="#000"
                    />
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
        left: 18,
        right: 18,
    },

    searchBox: {
        height: 48,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,

        // Same glass style as bottom bar
        backgroundColor: 'rgba(255,255,255,0.50)',
    },

    leftIcon: {
        marginRight: 10,
    },

    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },

    iconButton: {
        marginLeft: 10,
    },
});