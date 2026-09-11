import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../../components/PrimaryButton';
import type { ChatMessage } from '../../domain/types';
import { formatRelative } from '../../domain/time';
import { moderateText } from '../../domain/moderation/textModeration';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fontSizes, radii, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

/** Cadence de relecture : le serveur ne peut pas nous prévenir. */
const POLL_MS = 4000;

/**
 * Conversation privée avec un voisin (§4.6).
 *
 * Le filtre de texte s'applique ici comme sur le fil : un message privé n'est
 * pas un espace sans règles, et le serveur refuse de toute façon ce que
 * l'écran laisserait passer.
 */
export function ChatScreen({ route }: Props) {
  const { neighborId, neighborName } = route.params;
  const { s, language, rtl } = useI18n();
  const { repository } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMessages(await repository.loadMessages(neighborId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [repository, neighborId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const verdict = moderateText(text);
  const envoyable = text.trim().length > 0 && verdict.clean && !sending;

  const envoyer = async () => {
    if (!envoyable) return;
    setSending(true);
    try {
      const envoyé = await repository.sendMessage(neighborId, text.trim());
      setMessages((current) => [...current, envoyé]);
      setText('');
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.thread}>
        {messages.length === 0 ? (
          <Text style={[styles.empty, rtl.text]}>{s.community.chatEmpty}</Text>
        ) : null}

        {messages.map((message) => (
          <View
            key={message.id}
            style={[styles.bubble, message.fromMe ? styles.mine : styles.theirs]}
          >
            <Text style={message.fromMe ? styles.mineText : styles.theirsText}>{message.text}</Text>
            <Text style={message.fromMe ? styles.mineMeta : styles.theirsMeta}>
              {formatRelative(message.createdAt, language)}
            </Text>
          </View>
        ))}
      </ScrollView>

      {failed ? <Text style={[styles.failed, rtl.text]}>{s.community.failed}</Text> : null}
      {!verdict.clean ? (
        <Text style={[styles.failed, rtl.text]}>{s.compose.moderationWarning}</Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={[styles.input, rtl.text]}
          placeholder={s.community.chatPlaceholder}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          accessibilityLabel={s.community.chatPlaceholder}
        />
        <PrimaryButton label={s.community.send} disabled={!envoyable} onPress={envoyer} />
      </View>
      <Text style={[styles.who, rtl.text]}>{neighborName}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  thread: { padding: spacing.lg, gap: spacing.sm },
  empty: { fontSize: fontSizes.small, color: colors.muted, textAlign: 'center' },
  bubble: { maxWidth: '85%', borderRadius: radii.md, padding: spacing.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mineText: { color: colors.paper, fontSize: fontSizes.small, lineHeight: 19 },
  theirsText: { color: colors.ink, fontSize: fontSizes.small, lineHeight: 19 },
  mineMeta: { marginTop: 4, color: colors.paper, opacity: 0.8, fontSize: fontSizes.caption },
  theirsMeta: { marginTop: 4, color: colors.muted, fontSize: fontSizes.caption },
  failed: {
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.small,
    color: colors.alert,
  },
  composer: { padding: spacing.lg, gap: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    minHeight: 48,
    maxHeight: 120,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  who: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    fontSize: fontSizes.caption,
    color: colors.muted,
  },
});
