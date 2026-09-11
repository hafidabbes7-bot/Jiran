import React, { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { Neighbor, Vacation, WatchedVacation } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mode vacances (§4.13) : déclarer une absence et désigner nommément les
 * voisins qui veillent.
 *
 * Une absence n'est jamais publiée au quartier — seuls les voisins choisis la
 * voient. Annoncer à tout le monde qu'un logement est vide reviendrait à
 * donner l'adresse aux cambrioleurs.
 */
export function VacationScreen() {
  const { s, format, rtl } = useI18n();
  const { repository } = useApp();

  // Les voisins sont relus avec l'absence : on ne peut pas désigner comme
  // veilleur quelqu'un qui s'est inscrit depuis l'ouverture de l'application.
  const load = useCallback(
    async () => ({
      ...(await repository.loadVacation()),
      neighbors: await repository.loadNeighbors(),
    }),
    [repository]
  );
  const { data, failed, busy, run } = useRemote<{
    vacation: Vacation | null;
    watched: WatchedVacation[];
    neighbors: Neighbor[];
  }>(load, { vacation: null, watched: [], neighbors: [] });

  const neighbors = data.neighbors;

  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [note, setNote] = useState('');
  const [watchers, setWatchers] = useState<string[]>([]);

  const valide =
    JOUR.test(startsOn) && JOUR.test(endsOn) && endsOn >= startsOn && watchers.length > 0;

  const basculer = (id: string) =>
    setWatchers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.vacationIntro}</Text>

      {data.vacation ? (
        <Card>
          <Text style={[styles.title, rtl.text]}>
            {format(s.community.vacationActive, {
              from: data.vacation.startsOn,
              to: data.vacation.endsOn,
            })}
          </Text>
          <Text style={[styles.meta, rtl.text]}>
            {format(s.community.vacationWatchers, {
              names: data.vacation.watchers.map((watcher) => watcher.name).join(', '),
            })}
          </Text>
          {data.vacation.note ? (
            <Text style={[styles.meta, rtl.text]}>{data.vacation.note}</Text>
          ) : null}
          <PrimaryButton
            label={s.community.vacationCancel}
            tone="ghost"
            loading={busy}
            onPress={() => run(() => repository.cancelVacation())}
            style={styles.spaced}
          />
        </Card>
      ) : (
        <View>
          <Field
            label={s.community.vacationFrom}
            placeholder="2026-07-01"
            value={startsOn}
            onChangeText={setStartsOn}
          />
          <Field
            label={s.community.vacationTo}
            placeholder="2026-07-15"
            value={endsOn}
            onChangeText={setEndsOn}
          />
          <Field
            label={s.community.vacationNote}
            placeholder={s.community.vacationNotePlaceholder}
            value={note}
            onChangeText={setNote}
          />

          <SectionTitle>{s.community.vacationChoose}</SectionTitle>
          {neighbors.length === 0 ? <Empty>{s.community.noNeighborYet}</Empty> : null}
          {neighbors.map((neighbor) => (
            <Card key={neighbor.id}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: watchers.includes(neighbor.id) }}
                onPress={() => basculer(neighbor.id)}
                style={[styles.row, rtl.row]}
              >
                <Text style={[styles.title, rtl.text]}>{neighbor.name}</Text>
                <Switch
                  value={watchers.includes(neighbor.id)}
                  onValueChange={() => basculer(neighbor.id)}
                />
              </Pressable>
            </Card>
          ))}

          <PrimaryButton
            label={s.community.vacationDeclare}
            disabled={!valide}
            loading={busy}
            style={styles.spaced}
            onPress={() =>
              run(async () => {
                await repository.declareVacation({
                  startsOn,
                  endsOn,
                  note: note.trim() || undefined,
                  watcherIds: watchers,
                });
                setStartsOn('');
                setEndsOn('');
                setNote('');
                setWatchers([]);
              })
            }
          />
        </View>
      )}

      <SectionTitle>{s.community.vacationWatching}</SectionTitle>
      {data.watched.length === 0 ? <Empty>{s.community.vacationNoneWatched}</Empty> : null}
      {data.watched.map((watched) => (
        <Card key={watched.id}>
          <Text style={[styles.title, rtl.text]}>
            {format(s.community.vacationWatchedTitle, { name: watched.neighborName })}
          </Text>
          <Text style={[styles.meta, rtl.text]}>
            {format(s.community.vacationActive, { from: watched.startsOn, to: watched.endsOn })}
          </Text>
          {watched.note ? <Text style={[styles.meta, rtl.text]}>{watched.note}</Text> : null}
        </Card>
      ))}
    </CommunityScreen>
  );
}
