import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import { NEIGHBORHOODS, findNeighborhood } from '../../data/neighborhoods';
import { checkPosition, findCoverage } from '../../domain/location';
import { formatDistance } from '../../domain/time';
import type { Neighborhood } from '../../domain/types';
import { useI18n, useLocalizedName } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import type { RootStackParamList } from '../../navigation/types';
import { Card, CommunityScreen, styles } from './shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Move'>;

/** Lignes affichées d'un coup — au-delà, la recherche prend le relais. */
const VISIBLE = 12;

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

type Position =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'verified' }
  | { kind: 'too-far'; distance: number; suggestion?: Neighborhood }
  | { kind: 'uncovered'; distance: number; nearest?: Neighborhood }
  | { kind: 'accepted' }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * Changement de quartier après un déménagement.
 *
 * Le compte ne change pas — le serveur reconnaît le voisin à son numéro, déjà
 * vérifié : ni SMS ni réinscription. Seule la position est reconfirmée, comme
 * à l'inscription, sinon n'importe qui pourrait s'installer dans un quartier
 * où il n'habite pas.
 *
 * Ce qui a été écrit reste où ça a été écrit : les publications appartiennent
 * au fil de l'ancien quartier. Les conversations privées déjà entamées, elles,
 * restent ouvertes des deux côtés.
 */
export function MoveScreen({ navigation }: Props) {
  const { s, format, language, rtl } = useI18n();
  const localizedName = useLocalizedName();
  const { session, move } = useApp();

  const [query, setQuery] = useState('');
  const [choix, setChoix] = useState(session?.neighborhoodId ?? NEIGHBORHOODS[0]!.id);
  const [building, setBuilding] = useState(session?.building ?? '');
  const [position, setPosition] = useState<Position>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const quartier = useMemo(() => findNeighborhood(choix) ?? NEIGHBORHOODS[0]!, [choix]);

  const matching = useMemo(() => {
    const needle = query.trim();
    if (!needle) return NEIGHBORHOODS;
    const folded = fold(needle);
    return NEIGHBORHOODS.filter((item) =>
      [item.name, item.nameAr, item.wilaya, item.wilayaAr].some((field) =>
        fold(field).includes(folded)
      )
    );
  }, [query]);

  const visible = useMemo(() => {
    const head = matching.slice(0, VISIBLE);
    return head.some((item) => item.id === choix) ? head : [quartier, ...head];
  }, [matching, quartier, choix]);

  const lirePosition = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setPosition({ kind: 'denied' });
      return null;
    }

    const reading = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return reading.coords;
  }, []);

  const détecter = async () => {
    setPosition({ kind: 'checking' });
    try {
      const coords = await lirePosition();
      if (!coords) return;

      const coverage = findCoverage(coords, NEIGHBORHOODS);
      if (!coverage.neighborhood) {
        setPosition({ kind: 'uncovered', distance: coverage.distanceMeters, nearest: coverage.nearest });
        return;
      }

      setChoix(coverage.neighborhood.id);
      setQuery('');
      setPosition({ kind: 'verified' });
    } catch {
      setPosition({ kind: 'unavailable' });
    }
  };

  const confirmer = async () => {
    setPosition({ kind: 'checking' });
    try {
      const coords = await lirePosition();
      if (!coords) return;

      const result = checkPosition(coords, quartier, NEIGHBORHOODS);
      if (result.verified) {
        setPosition({ kind: 'verified' });
        return;
      }

      const coverage = findCoverage(coords, NEIGHBORHOODS);
      setPosition(
        coverage.neighborhood
          ? { kind: 'too-far', distance: result.distanceMeters, suggestion: coverage.neighborhood }
          : { kind: 'uncovered', distance: coverage.distanceMeters, nearest: coverage.nearest }
      );
    } catch {
      setPosition({ kind: 'unavailable' });
    }
  };

  const prêt = position.kind === 'verified' || position.kind === 'accepted';
  const déjàLà = session?.neighborhoodId === choix && (session?.building ?? '') === building.trim();

  const déménager = async () => {
    if (!prêt) return;
    setBusy(true);
    try {
      await move(choix, building.trim() || undefined, position.kind === 'verified');
      setFailed(false);
      navigation.goBack();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.moveIntro}</Text>

      <PrimaryButton
        label={
          position.kind === 'checking'
            ? s.onboarding.positionChecking
            : s.onboarding.detectNeighborhood
        }
        loading={position.kind === 'checking'}
        onPress={détecter}
      />

      <View style={styles.spaced}>
        <Field
          label={s.onboarding.neighborhoodLabel}
          placeholder={s.onboarding.neighborhoodSearchPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {visible.map((item) => {
        const active = item.id === choix;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={localizedName(item)}
            onPress={() => {
              setChoix(item.id);
              setPosition({ kind: 'idle' });
            }}
          >
            <Card style={active ? styles.pillActive : undefined}>
              <Text style={[styles.title, rtl.text]}>{localizedName(item)}</Text>
              <Text style={[styles.meta, rtl.text]}>
                {language === 'ar' ? item.wilayaAr : item.wilaya}
              </Text>
            </Card>
          </Pressable>
        );
      })}

      {matching.length > VISIBLE ? (
        <Text style={[styles.meta, rtl.text]}>
          {format(s.onboarding.neighborhoodMore, { count: matching.length - VISIBLE })}
        </Text>
      ) : null}

      <View style={styles.spaced}>
        <Field
          label={s.onboarding.buildingLabel}
          placeholder={s.onboarding.buildingPlaceholder}
          value={building}
          onChangeText={setBuilding}
        />
      </View>

      <PrimaryButton
        label={s.onboarding.confirmPosition}
        tone="ghost"
        loading={position.kind === 'checking'}
        onPress={confirmer}
      />

      {position.kind === 'verified' ? (
        <Text style={[styles.meta, rtl.text]}>
          {format(s.onboarding.positionOk, { neighborhood: localizedName(quartier) })}
        </Text>
      ) : null}

      {position.kind === 'too-far' ? (
        <View>
          <Text style={[styles.moveError, rtl.text]}>
            {format(s.onboarding.positionTooFar, {
              distance: formatDistance(position.distance, language),
              neighborhood: localizedName(quartier),
            })}
          </Text>
          {position.suggestion ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setChoix(position.suggestion!.id);
                setPosition({ kind: 'idle' });
              }}
            >
              <Text style={[styles.link, rtl.text]}>
                {format(s.onboarding.positionSuggestion, {
                  neighborhood: localizedName(position.suggestion),
                })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {position.kind === 'uncovered' ? (
        <View>
          <Text style={[styles.moveError, rtl.text]}>
            {format(s.onboarding.positionUncovered, {
              neighborhood: position.nearest ? localizedName(position.nearest) : '—',
              distance: formatDistance(position.distance, language),
            })}
          </Text>
          <PrimaryButton
            label={s.onboarding.continueUnverified}
            tone="ghost"
            onPress={() => setPosition({ kind: 'accepted' })}
            style={styles.spaced}
          />
        </View>
      ) : null}

      {position.kind === 'accepted' ? (
        <Text style={[styles.moveError, rtl.text]}>{s.onboarding.unverifiedNotice}</Text>
      ) : null}

      {position.kind === 'denied' ? (
        <Text style={[styles.moveError, rtl.text]}>{s.onboarding.positionDenied}</Text>
      ) : null}

      {position.kind === 'unavailable' ? (
        <Text style={[styles.moveError, rtl.text]}>{s.onboarding.positionUnavailable}</Text>
      ) : null}

      <PrimaryButton
        label={s.community.moveConfirm}
        disabled={!prêt || déjàLà}
        loading={busy}
        onPress={déménager}
        style={styles.spaced}
      />
      {déjàLà ? <Text style={[styles.meta, rtl.text]}>{s.community.moveSame}</Text> : null}

      <Text style={[styles.meta, styles.spaced, rtl.text]}>{s.community.moveKeeps}</Text>
    </CommunityScreen>
  );
}
