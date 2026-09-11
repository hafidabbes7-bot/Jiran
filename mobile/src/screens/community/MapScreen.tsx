import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import { distanceMeters } from '../../domain/location';
import { formatDistance } from '../../domain/time';
import type { Place, PlaceKind } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

const KINDS: { kind: PlaceKind; emoji: string }[] = [
  { kind: 'pharmacie', emoji: '💊' },
  { kind: 'ecole', emoji: '🏫' },
  { kind: 'mosquee', emoji: '🕌' },
  { kind: 'bus', emoji: '🚌' },
  { kind: 'sante', emoji: '🏥' },
  { kind: 'autre', emoji: '📌' },
];

const emojiOf = (kind: PlaceKind) => KINDS.find((item) => item.kind === kind)?.emoji ?? '📌';

/**
 * Points utiles du quartier (§4.12) : pharmacie de garde, école, mosquée,
 * arrêt de bus, avec la distance depuis l'endroit où l'on est.
 *
 * Pas de carte dessinée : elle imposerait une clé d'API et une dépendance
 * native, pour moins de service qu'une liste triée par distance. Toucher un
 * point ouvre l'itinéraire dans l'application de cartes du téléphone, qui fait
 * ce travail bien mieux.
 */
export function MapScreen() {
  const { s, rtl, language } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadPlaces(), [repository]);
  const { data: places, failed, busy, run } = useRemote<Place[]>(load, []);

  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceKind>('pharmacie');

  const localiser = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) return null;

    const reading = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const point = { latitude: reading.coords.latitude, longitude: reading.coords.longitude };
    setPosition(point);
    return point;
  };

  const triés = useMemo(() => {
    if (!position) return places;
    return [...places].sort(
      (a, b) => distanceMeters(position, a) - distanceMeters(position, b)
    );
  }, [places, position]);

  const ouvrirItinéraire = (place: Place) => {
    const coords = `${place.latitude},${place.longitude}`;
    const url = Platform.select({
      ios: `maps://?daddr=${coords}`,
      android: `geo:${coords}?q=${coords}(${encodeURIComponent(place.name)})`,
      default: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${coords.replace(',', '/')}`,
    });
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.mapIntro}</Text>

      <PrimaryButton label={s.community.mapLocate} tone="ghost" onPress={localiser} />

      {places.length === 0 ? <Empty>{s.community.mapEmpty}</Empty> : null}

      {triés.map((place) => (
        <Pressable
          key={place.id}
          accessibilityRole="button"
          onPress={() => ouvrirItinéraire(place)}
        >
          <Card style={styles.spaced}>
            <Text style={[styles.title, rtl.text]}>
              {emojiOf(place.kind)} {place.name}
            </Text>
            <Text style={[styles.meta, rtl.text]}>
              {s.community.placeKinds[place.kind]}
              {position ? ` · ${formatDistance(distanceMeters(position, place), language)}` : ''}
            </Text>
            <Text style={[styles.link, rtl.text]}>{s.community.mapOpen}</Text>
          </Card>
        </Pressable>
      ))}

      <SectionTitle>{s.community.mapAdd}</SectionTitle>
      <View style={[styles.pillRow, rtl.row]}>
        {KINDS.map((option) => (
          <Pressable
            key={option.kind}
            accessibilityRole="button"
            onPress={() => setKind(option.kind)}
            style={[styles.pill, option.kind === kind && styles.pillActive]}
          >
            <Text style={[styles.pillText, option.kind === kind && styles.pillTextActive]}>
              {option.emoji} {s.community.placeKinds[option.kind]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={s.community.placeName}
        placeholder={s.community.placeNamePlaceholder}
        value={name}
        onChangeText={setName}
      />
      <Text style={[styles.meta, rtl.text]}>{s.community.mapAddHint}</Text>
      <PrimaryButton
        label={s.community.add}
        loading={busy}
        style={styles.spaced}
        onPress={() => {
          if (name.trim().length < 2) return;
          run(async () => {
            const point = position ?? (await localiser());
            if (!point) return;
            await repository.addPlace({ name: name.trim(), kind, ...point });
            setName('');
          });
        }}
      />
    </CommunityScreen>
  );
}
