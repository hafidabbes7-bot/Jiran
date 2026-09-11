import React, { useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Conversation, Neighbor } from '../../domain/types';
import { formatRelative } from '../../domain/time';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import type { RootStackParamList } from '../../navigation/types';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;

/**
 * Liste des conversations privées (§4.6). Les commentaires du fil restent
 * publics ; ici, deux voisins négocient une annonce ou un covoiturage sans
 * que le quartier entier suive l'échange.
 */
export function MessagesScreen({ navigation }: Props) {
  const { s, format, language, rtl } = useI18n();
  const { repository } = useApp();

  // La liste des voisins est relue ici, et non prise dans l'état de
  // l'application : un voisin inscrit depuis l'ouverture doit pouvoir être
  // contacté sans avoir à relancer l'application.
  const load = useCallback(
    async () => ({
      conversations: await repository.loadConversations(),
      neighbors: await repository.loadNeighbors(),
    }),
    [repository]
  );
  const { data, failed } = useRemote<{ conversations: Conversation[]; neighbors: Neighbor[] }>(
    load,
    { conversations: [], neighbors: [] }
  );

  const conversations = data.conversations;
  const déjàOuverts = new Set(conversations.map((item) => item.neighborId));
  const autres: Neighbor[] = data.neighbors.filter((neighbor) => !déjàOuverts.has(neighbor.id));

  return (
    <CommunityScreen failed={failed}>
      {conversations.length === 0 ? <Empty>{s.community.messagesEmpty}</Empty> : null}

      {conversations.map((conversation) => (
        <Pressable
          key={conversation.neighborId}
          accessibilityRole="button"
          accessibilityLabel={format(s.community.openChat, { name: conversation.neighborName })}
          onPress={() =>
            navigation.navigate('Chat', {
              neighborId: conversation.neighborId,
              neighborName: conversation.neighborName,
            })
          }
        >
          <Card>
            <Text style={[styles.title, rtl.text]}>
              {conversation.neighborName}
              {conversation.unread > 0
                ? ` · ${format(s.community.unread, { count: conversation.unread })}`
                : ''}
            </Text>
            <Text style={[styles.meta, rtl.text]} numberOfLines={1}>
              {conversation.lastMessage}
            </Text>
            <Text style={[styles.meta, rtl.text]}>
              {formatRelative(conversation.lastAt, language)}
            </Text>
          </Card>
        </Pressable>
      ))}

      <SectionTitle>{s.community.messagesStart}</SectionTitle>
      {autres.length === 0 ? <Empty>{s.community.noNeighborYet}</Empty> : null}
      {autres.map((neighbor) => (
        <Pressable
          key={neighbor.id}
          accessibilityRole="button"
          accessibilityLabel={format(s.community.openChat, { name: neighbor.name })}
          onPress={() =>
            navigation.navigate('Chat', { neighborId: neighbor.id, neighborName: neighbor.name })
          }
        >
          <Card>
            <Text style={[styles.title, rtl.text]}>{neighbor.name}</Text>
            {neighbor.building ? (
              <Text style={[styles.meta, rtl.text]}>{neighbor.building}</Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </CommunityScreen>
  );
}
