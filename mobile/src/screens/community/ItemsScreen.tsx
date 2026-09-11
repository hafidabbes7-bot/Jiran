import React, { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { Item } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

/** Dans combien de jours un objet emprunté doit être rendu, par défaut. */
const PRET_JOURS = 7;

/**
 * Bibliothèque d'objets prêtés entre voisins (§4.10) : perceuse, escabeau,
 * tente. Le statut et la date de retour vivent sur le serveur — c'est ce qui
 * évite que deux voisins croient avoir le même objet.
 */
export function ItemsScreen() {
  const { s, format, rtl } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadItems(), [repository]);
  const { data: items, failed, busy, run } = useRemote<Item[]>(load, []);
  const [name, setName] = useState('');

  const retour = () => {
    const date = new Date();
    date.setDate(date.getDate() + PRET_JOURS);
    return date.toISOString().slice(0, 10);
  };

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.itemsIntro}</Text>

      {items.length === 0 ? <Empty>{s.community.itemsEmpty}</Empty> : null}

      {items.map((item) => (
        <Card key={item.id}>
          <Text style={[styles.title, rtl.text]}>{item.name}</Text>
          <Text style={[styles.meta, rtl.text]}>
            {item.ownerIsMe
              ? s.community.itemMine
              : format(s.community.itemOwner, { name: item.ownerName })}
            {' · '}
            {item.status === 'disponible'
              ? s.community.itemAvailable
              : format(s.community.itemBorrowed, {
                  name: item.borrowedByMe ? s.community.you : (item.borrowerName ?? ''),
                  date: item.dueDate ?? '—',
                })}
          </Text>

          {item.status === 'disponible' && !item.ownerIsMe ? (
            <PrimaryButton
              label={s.community.borrow}
              tone="ghost"
              loading={busy}
              onPress={() => run(() => repository.borrowItem(item.id, retour()))}
              style={styles.spaced}
            />
          ) : null}

          {item.status === 'emprunte' && (item.ownerIsMe || item.borrowedByMe) ? (
            <PrimaryButton
              label={s.community.giveBack}
              tone="ghost"
              loading={busy}
              onPress={() => run(() => repository.returnItem(item.id))}
              style={styles.spaced}
            />
          ) : null}
        </Card>
      ))}

      <SectionTitle>{s.community.itemsAdd}</SectionTitle>
      <Field
        label={s.community.itemName}
        placeholder={s.community.itemNamePlaceholder}
        value={name}
        onChangeText={setName}
      />
      <PrimaryButton
        label={s.community.add}
        loading={busy}
        onPress={() => {
          if (name.trim().length < 2) return;
          run(async () => {
            await repository.addItem(name.trim());
            setName('');
          });
        }}
      />
    </CommunityScreen>
  );
}
