import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { Group, GroupPost } from '../../domain/types';
import { formatRelative } from '../../domain/time';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

/** Émojis proposés à la création — un groupe se reconnaît d'abord à son icône. */
const EMOJIS = ['👥', '🎒', '🌱', '⚽', '📖', '🛠️', '🍲'];

/**
 * Groupes d'intérêt (§4.11) : parents d'élèves, jardinage, foot du quartier,
 * cercle d'étude. Le fil d'un groupe n'est lisible que par ses membres — c'est
 * le serveur qui le garantit, pas l'affichage.
 */
export function GroupsScreen() {
  const { s, format, language, rtl } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadGroups(), [repository]);
  const { data: groups, failed, busy, run } = useRemote<Group[]>(load, []);

  const [openId, setOpenId] = useState<string | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]!);

  const ouvrir = async (group: Group) => {
    if (openId === group.id) {
      setOpenId(null);
      return;
    }

    setOpenId(group.id);
    setPosts([]);
    if (group.joined) setPosts(await repository.loadGroupPosts(group.id));
  };

  const publier = async (groupId: string) => {
    if (text.trim().length < 2) return;
    const post = await repository.addGroupPost(groupId, text.trim());
    setPosts((current) => [post, ...current]);
    setText('');
  };

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.groupsIntro}</Text>

      {groups.length === 0 ? <Empty>{s.community.groupsEmpty}</Empty> : null}

      {groups.map((group) => (
        <Card key={group.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={format(s.community.openGroup, { name: group.name })}
            onPress={() => ouvrir(group)}
          >
            <Text style={[styles.title, rtl.text]}>
              {group.emoji} {group.name}
            </Text>
            <Text style={[styles.meta, rtl.text]}>
              {format(s.community.groupMembers, { count: group.members })}
            </Text>
          </Pressable>

          <PrimaryButton
            label={group.joined ? s.community.leave : s.community.join}
            tone="ghost"
            loading={busy}
            onPress={() =>
              run(async () => {
                await repository.setGroupMembership(group.id, !group.joined);
                if (openId === group.id) setPosts([]);
              })
            }
            style={styles.spaced}
          />

          {openId === group.id && group.joined ? (
            <View style={styles.spaced}>
              <Field
                label={s.community.groupWrite}
                placeholder={s.community.groupWritePlaceholder}
                value={text}
                onChangeText={setText}
                multiline
              />
              <PrimaryButton label={s.community.send} onPress={() => publier(group.id)} />

              {posts.length === 0 ? (
                <Text style={[styles.meta, styles.spaced, rtl.text]}>
                  {s.community.groupNoPost}
                </Text>
              ) : null}
              {posts.map((post) => (
                <View key={post.id} style={styles.spaced}>
                  <Text style={[styles.title, rtl.text]}>{post.authorName}</Text>
                  <Text style={[styles.meta, rtl.text]}>{post.text}</Text>
                  <Text style={[styles.meta, rtl.text]}>
                    {formatRelative(post.createdAt, language)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {openId === group.id && !group.joined ? (
            <Text style={[styles.meta, styles.spaced, rtl.text]}>{s.community.groupLocked}</Text>
          ) : null}
        </Card>
      ))}

      <SectionTitle>{s.community.groupsAdd}</SectionTitle>
      <View style={[styles.pillRow, rtl.row]}>
        {EMOJIS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={option}
            onPress={() => setEmoji(option)}
            style={[styles.pill, option === emoji && styles.pillActive]}
          >
            <Text style={styles.pillText}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={s.community.groupName}
        placeholder={s.community.groupNamePlaceholder}
        value={name}
        onChangeText={setName}
      />
      <PrimaryButton
        label={s.community.add}
        loading={busy}
        onPress={() => {
          if (name.trim().length < 2) return;
          run(async () => {
            await repository.createGroup(name.trim(), emoji);
            setName('');
          });
        }}
      />
    </CommunityScreen>
  );
}
