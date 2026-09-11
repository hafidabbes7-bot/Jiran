import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PostCard } from '../components/PostCard';
import { ReportSheet } from '../components/ReportSheet';
import { useToast } from '../components/Toast';
import { moderateText } from '../domain/moderation/textModeration';
import { formatRelative } from '../domain/time';
import type { Comment, ReportReason } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

export function PostDetailScreen({ route }: Props) {
  const { postId } = route.params;
  const { s, language, rtl } = useI18n();
  const { posts, toggleLike, loadComments, addComment, report } = useApp();
  const toast = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);

  const post = posts.find((item) => item.id === postId);

  const refresh = useCallback(async () => {
    setComments(await loadComments(postId));
  }, [loadComments, postId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = async () => {
    const check = moderateText(draft);
    if (!check.clean) {
      toast(s.compose.moderationWarning);
      return;
    }
    if (draft.trim().length < 2) return;

    try {
      await addComment(postId, draft);
      setDraft('');
      await refresh();
    } catch {
      // Refus du serveur (modération, contenu bloqué, coupure) : on le dit
      // plutôt que de laisser croire que la réponse est partie.
      toast(s.compose.publishFailed);
    }
  };

  const submitReport = async (reason: ReportReason) => {
    setReporting(false);
    const accepted = await report(postId, reason);
    toast(accepted ? s.report.sent : s.report.alreadyReported);
  };

  if (!post) return null;

  const blocked = post.moderation.hidden;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <PostCard
          post={post}
          showComments={false}
          onLike={() => toggleLike(post.id)}
          onReport={() => setReporting(true)}
        />

        {blocked ? null : (
          <>
            <Text style={[styles.sectionTitle, rtl.text]}>{s.detail.repliesTitle}</Text>

            {comments.length === 0 ? (
              <Text style={[styles.empty, rtl.text]}>{s.detail.noComments}</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={[styles.comment, rtl.row]}>
                  <View style={styles.avatar}>
                    <Text>👤</Text>
                  </View>
                  <View style={styles.commentBody}>
                    <Text style={[styles.commentName, rtl.text]}>{comment.authorName}</Text>
                    <Text style={[styles.commentText, rtl.text]}>{comment.text}</Text>
                    <Text style={[styles.commentTime, rtl.text]}>
                      {formatRelative(comment.createdAt, language)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {blocked ? null : (
        <View style={[styles.inputRow, rtl.row]}>
          <TextInput
            placeholder={s.detail.commentPlaceholder}
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            style={[styles.input, rtl.text]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.detail.send}
            onPress={send}
            style={styles.send}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      )}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        onSelect={submitReport}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  empty: { color: colors.muted, fontSize: fontSizes.small },
  comment: { gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentBody: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  commentName: { fontSize: fontSizes.small, fontWeight: '700', color: colors.ink },
  commentText: { fontSize: fontSizes.body, color: colors.ink, marginTop: 2, lineHeight: 19 },
  commentTime: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 4 },
  inputRow: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.paper, fontSize: fontSizes.title },
});
