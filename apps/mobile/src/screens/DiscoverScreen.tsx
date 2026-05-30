import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { Colors } from '../theme/colors';
import SearchBar from '../components/SearchBar';
import { useGlobe } from '../context/GlobeContext';
import { searchWeights, suggest, trending } from '../api/search';

type TabId = 'globe' | 'discover' | 'create' | 'notifications' | 'profile';

interface Props {
    setActiveTab?: (tab: TabId) => void;
}

const DEBOUNCE_MS = 300;

export default function DiscoverScreen({ setActiveTab }: Props) {
    const { sendSearchWeights, region } = useGlobe();

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [trendingTerms, setTrendingTerms] = useState<string[]>([]);
    const [searching, setSearching] = useState(false);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch trending on mount.
    useEffect(() => {
        trending()
            .then(setTrendingTerms)
            .catch(() => {});
    }, []);

    // Debounced typeahead.
    const onChangeText = useCallback((text: string) => {
        setQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (text.length < 2) {
            setSuggestions([]);
            return;
        }
        debounceTimer.current = setTimeout(() => {
            suggest(text)
                .then(setSuggestions)
                .catch(() => setSuggestions([]));
        }, DEBOUNCE_MS);
    }, []);

    const runSearch = useCallback(async (q: string) => {
        if (!q.trim() || !region) return;
        setSearching(true);
        setSuggestions([]);
        try {
            const weights = await searchWeights(q, region);
            sendSearchWeights(weights);
        } catch {
            // non-fatal
        } finally {
            setSearching(false);
        }
    }, [region, sendSearchWeights]);

    const onPressSearch = useCallback(() => runSearch(query), [query, runSearch]);

    const onPressSuggestion = useCallback((term: string) => {
        setQuery(term);
        runSearch(term);
    }, [runSearch]);

    return (
        <View style={styles.container}>
            {/* Floating create-post FAB */}
            <TouchableOpacity
                style={styles.createPostButton}
                onPress={() => setActiveTab?.('create')}
            >
                <Icon name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <SearchBar
                value={query}
                onChangeText={onChangeText}
                onPressSearch={onPressSearch}
            />

            {/* Typeahead suggestions */}
            {suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                    {suggestions.map((s) => (
                        <TouchableOpacity
                            key={s}
                            style={styles.suggestionRow}
                            onPress={() => onPressSuggestion(s)}
                        >
                            <Icon name="search-outline" size={14} color={Colors.textSecondary} style={styles.suggestionIcon} />
                            <Text style={styles.suggestionText}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Trending chips — shown when search box is empty */}
            {query.length === 0 && trendingTerms.length > 0 && (
                <View style={styles.trendingSection}>
                    <Text style={styles.trendingLabel}>Trending</Text>
                    <View style={styles.chipsRow}>
                        {trendingTerms.map((term) => (
                            <TouchableOpacity
                                key={term}
                                style={styles.chip}
                                onPress={() => onPressSuggestion(term)}
                            >
                                <Text style={styles.chipText}>{term}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Searching indicator */}
            {searching && (
                <Text style={styles.statusText}>Searching…</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundSoft,
        paddingTop: 110, // leave room for SearchBar at top:50
    },

    createPostButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: Colors.primary,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },

    suggestionsBox: {
        marginHorizontal: 18,
        backgroundColor: Colors.background,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
    },

    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },

    suggestionIcon: {
        marginRight: 10,
    },

    suggestionText: {
        fontSize: 15,
        color: Colors.textPrimary,
    },

    trendingSection: {
        marginTop: 24,
        paddingHorizontal: 18,
    },

    trendingLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
    },

    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    chip: {
        backgroundColor: Colors.background,
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },

    chipText: {
        fontSize: 14,
        color: Colors.textPrimary,
    },

    statusText: {
        marginTop: 16,
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: 14,
    },
});
