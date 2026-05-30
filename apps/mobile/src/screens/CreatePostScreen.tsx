import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGlobe } from '../context/GlobeContext';
import { createPost } from '../api/posts';
import type { GlobeBanner } from '@blobe/shared-types';
import { Colors } from '../theme/colors';

type TabId = 'globe' | 'discover' | 'create' | 'notifications' | 'profile';

interface Props {
  setActiveTab?: (tab: TabId) => void;
}

export default function CreatePostScreen({ setActiveTab }: Props) {
  const globe = useGlobe();
  const camera = globe.getCameraState();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latitude = camera?.latitude ?? 0;
  const longitude = camera?.longitude ?? 0;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const { post } = await createPost({
        latitude,
        longitude,
        title: title.trim(),
        content: content.trim() || undefined,
        frontText: frontText.trim() || undefined,
        backText: backText.trim() || undefined,
      });

      const banner: GlobeBanner = {
        id: post.id,
        latitude: post.latitude,
        longitude: post.longitude,
        title: post.title,
      };
      globe.sendBanners([banner]);
      setActiveTab?.('globe');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Post</Text>

        <Text style={styles.subtitle}>
          Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Title *"
          placeholderTextColor={Colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Content (optional)"
          placeholderTextColor={Colors.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
        />

        <TextInput
          style={styles.input}
          placeholder="Front text (optional)"
          placeholderTextColor={Colors.textSecondary}
          value={frontText}
          onChangeText={setFrontText}
          maxLength={200}
        />

        <TextInput
          style={styles.input}
          placeholder="Back text (optional)"
          placeholderTextColor={Colors.textSecondary}
          value={backText}
          onChangeText={setBackText}
          maxLength={200}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textOnDark} />
          ) : (
            <Text style={styles.buttonText}>Post to Globe</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab?.('globe')}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSoft,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#ff4d4d20',
    borderColor: '#ff4d4d',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#ff4d4d',
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
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.textOnDark,
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    textAlign: 'center',
    marginTop: 20,
    color: Colors.textSecondary,
  },
  inputError: {
    borderColor: '#ff4d4d',
  },
  linkBold: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
});
