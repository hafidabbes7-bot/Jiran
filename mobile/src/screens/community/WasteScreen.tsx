import React, { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PrimaryButton } from '../../components/PrimaryButton';
import type { WasteKind, WasteSlot } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

const KINDS: WasteKind[] = ['ordures', 'recyclable', 'encombrants'];
const HOURS = ['06:00', '08:00', '17:00', '19:00', '21:00'];

/** Le rappel est un choix propre à l'appareil : il ne concerne pas le quartier. */
const REMINDER_KEY = 'jiran/waste-reminder';

/**
 * Calendrier de collecte des déchets (§4.14).
 *
 * Renseigné par les voisins eux-mêmes : aucune commune algérienne ne publie
 * ces horaires sous une forme exploitable, et ce sont les habitants qui les
 * connaissent. Le rappel de la veille reste sur le téléphone.
 */
export function WasteScreen() {
  const { s, rtl } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadWasteSlots(), [repository]);
  const { data: slots, failed, busy, run } = useRemote<WasteSlot[]>(load, []);

  const [kind, setKind] = useState<WasteKind>('ordures');
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(HOURS[3]!);
  const [reminder, setReminder] = useState(false);

  // Le réglage est relu à l'ouverture ; un stockage illisible ne doit pas
  // empêcher de consulter le calendrier.
  React.useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY)
      .then((value) => setReminder(value === 'true'))
      .catch(() => undefined);
  }, []);

  const changerRappel = (value: boolean) => {
    setReminder(value);
    AsyncStorage.setItem(REMINDER_KEY, String(value)).catch(() => undefined);
  };

  const jours = s.community.weekdays;

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.wasteIntro}</Text>

      {slots.length === 0 ? <Empty>{s.community.wasteEmpty}</Empty> : null}

      {slots.map((slot) => (
        <Card key={slot.id}>
          <Text style={[styles.title, rtl.text]}>
            {s.community.wasteKinds[slot.kind]} · {jours[slot.weekday] ?? ''} {slot.hour}
          </Text>
          <PrimaryButton
            label={s.community.remove}
            tone="ghost"
            loading={busy}
            onPress={() => run(() => repository.removeWasteSlot(slot.id))}
            style={styles.spaced}
          />
        </Card>
      ))}

      <Card style={styles.spaced}>
        <View style={[styles.row, rtl.row]}>
          <Text style={[styles.title, rtl.text]}>{s.community.wasteReminder}</Text>
          <Switch value={reminder} onValueChange={changerRappel} />
        </View>
        <Text style={[styles.meta, rtl.text]}>{s.community.wasteReminderHint}</Text>
      </Card>

      <SectionTitle>{s.community.wasteAdd}</SectionTitle>
      <View style={[styles.pillRow, rtl.row]}>
        {KINDS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => setKind(option)}
            style={[styles.pill, option === kind && styles.pillActive]}
          >
            <Text style={[styles.pillText, option === kind && styles.pillTextActive]}>
              {s.community.wasteKinds[option]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.pillRow, rtl.row]}>
        {jours.map((jour, index) => (
          <Pressable
            key={jour}
            accessibilityRole="button"
            onPress={() => setWeekday(index)}
            style={[styles.pill, index === weekday && styles.pillActive]}
          >
            <Text style={[styles.pillText, index === weekday && styles.pillTextActive]}>
              {jour}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.pillRow, rtl.row]}>
        {HOURS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => setHour(option)}
            style={[styles.pill, option === hour && styles.pillActive]}
          >
            <Text style={[styles.pillText, option === hour && styles.pillTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
      <PrimaryButton
        label={s.community.add}
        loading={busy}
        onPress={() => run(() => repository.addWasteSlot({ kind, weekday, hour }))}
      />
    </CommunityScreen>
  );
}
