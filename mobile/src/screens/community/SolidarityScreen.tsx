import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { SolidarityAction, SolidarityKind } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

const KINDS: { kind: SolidarityKind; emoji: string }[] = [
  { kind: 'sang', emoji: '🩸' },
  { kind: 'vetements', emoji: '🧥' },
  { kind: 'ramadan', emoji: '🌙' },
  { kind: 'autre', emoji: '🤝' },
];

/**
 * Actions solidaires du quartier (§4.15) : don du sang, collecte de vêtements,
 * panier de Ramadan. Le bouton « Je participe » compte de vraies personnes —
 * une par voisin, côté serveur.
 */
export function SolidarityScreen() {
  const { s, format, rtl } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadSolidarityActions(), [repository]);
  const { data: actions, failed, busy, run } = useRemote<SolidarityAction[]>(load, []);

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [happensOn, setHappensOn] = useState('');
  const [kind, setKind] = useState<SolidarityKind>('sang');

  const emojiOf = (value: SolidarityKind) =>
    KINDS.find((item) => item.kind === value)?.emoji ?? '🤝';

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.solidarityIntro}</Text>

      {actions.length === 0 ? <Empty>{s.community.solidarityEmpty}</Empty> : null}

      {actions.map((action) => (
        <Card key={action.id}>
          <Text style={[styles.title, rtl.text]}>
            {emojiOf(action.kind)} {action.title}
          </Text>
          <Text style={[styles.meta, rtl.text]}>
            {format(s.community.participants, { count: action.participants })}
            {action.happensOn ? ` · ${action.happensOn}` : ''}
          </Text>
          {action.details ? <Text style={[styles.meta, rtl.text]}>{action.details}</Text> : null}

          <PrimaryButton
            label={action.joined ? s.community.leaveAction : s.community.participate}
            tone="ghost"
            loading={busy}
            onPress={() => run(() => repository.setParticipation(action.id, !action.joined))}
            style={styles.spaced}
          />
        </Card>
      ))}

      <SectionTitle>{s.community.solidarityAdd}</SectionTitle>
      <View style={[styles.pillRow, rtl.row]}>
        {KINDS.map((option) => (
          <Pressable
            key={option.kind}
            accessibilityRole="button"
            onPress={() => setKind(option.kind)}
            style={[styles.pill, option.kind === kind && styles.pillActive]}
          >
            <Text style={[styles.pillText, option.kind === kind && styles.pillTextActive]}>
              {option.emoji} {s.community.solidarityKinds[option.kind]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={s.community.solidarityTitleLabel}
        placeholder={s.community.solidarityTitlePlaceholder}
        value={title}
        onChangeText={setTitle}
      />
      <Field
        label={s.community.solidarityDetails}
        placeholder={s.community.solidarityDetailsPlaceholder}
        value={details}
        onChangeText={setDetails}
        multiline
      />
      <Field
        label={s.community.solidarityDate}
        placeholder="2026-03-01"
        value={happensOn}
        onChangeText={setHappensOn}
      />
      <PrimaryButton
        label={s.community.add}
        loading={busy}
        onPress={() => {
          if (title.trim().length < 3) return;
          run(async () => {
            await repository.createSolidarityAction({
              title: title.trim(),
              kind,
              details: details.trim() || undefined,
              happensOn: /^\d{4}-\d{2}-\d{2}$/.test(happensOn) ? happensOn : undefined,
            });
            setTitle('');
            setDetails('');
            setHappensOn('');
          });
        }}
      />
    </CommunityScreen>
  );
}
