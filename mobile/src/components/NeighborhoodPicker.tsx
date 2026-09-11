import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field } from './Field';
import { NEIGHBORHOODS, findNeighborhood } from '../data/neighborhoods';
import type { Country, Neighborhood } from '../domain/types';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/** Lignes affichées d'un coup — au-delà, la recherche prend le relais. */
const VISIBLE = 40;

const COUNTRIES: { code: Country; flag: string }[] = [
  { code: 'DZ', flag: '🇩🇿' },
  { code: 'CA', flag: '🇨🇦' },
];

/** Compare sans se soucier des accents ni de la casse : « bejaia » trouve Béjaïa. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Choix du lieu, par paliers.
 *
 * 1554 entrées ne se parcourent pas : on descend wilaya → daïra → commune en
 * Algérie, et on s'arrête à la province au Canada, où le découpage n'a pas
 * d'équivalent utile de la commune. Une recherche libre court-circuite les
 * paliers quand on sait déjà ce qu'on cherche.
 *
 * Écrit une fois ici : l'inscription et le déménagement posent exactement la
 * même question, et deux copies auraient divergé.
 */
export function NeighborhoodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { s, format, language, rtl } = useI18n();
  const localizedName = useLocalizedName();

  const courant = findNeighborhood(value);
  const [country, setCountry] = useState<Country>(courant?.country ?? 'DZ');
  const [query, setQuery] = useState('');
  // On ouvre toujours sur la liste des wilayas (ou des provinces), même quand
  // un lieu est déjà choisi : entrer directement dans une daïra donne
  // l'impression que le reste du pays n'existe pas. Le choix courant reste
  // rappelé sous la liste.
  const [region, setRegion] = useState<string | undefined>();
  const [subRegion, setSubRegion] = useState<string | undefined>();

  const duPays = useMemo(
    () => NEIGHBORHOODS.filter((item) => item.country === country),
    [country]
  );

  /** Régions du pays, dans l'ordre du nom affiché. */
  const regions = useMemo(() => {
    const vues = new Map<string, Neighborhood>();
    for (const item of duPays) if (!vues.has(item.regionCode)) vues.set(item.regionCode, item);
    return [...vues.values()].sort((a, b) =>
      (language === 'ar' ? a.regionAr : a.region).localeCompare(
        language === 'ar' ? b.regionAr : b.region,
        'fr'
      )
    );
  }, [duPays, language]);

  const subRegions = useMemo(() => {
    if (!region) return [];
    const vues = new Set<string>();
    for (const item of duPays) {
      if (item.regionCode === region && item.subRegion) vues.add(item.subRegion);
    }
    return [...vues].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [duPays, region]);

  const résultats = useMemo(() => {
    const needle = query.trim();
    if (needle) {
      const folded = fold(needle);
      return duPays.filter((item) =>
        [item.name, item.nameAr, item.subRegion ?? '', item.region, item.regionAr].some((champ) =>
          fold(champ).includes(folded)
        )
      );
    }

    if (!region) return [];
    if (country === 'CA') return duPays.filter((item) => item.regionCode === region);
    if (!subRegion) return [];
    return duPays.filter((item) => item.regionCode === region && item.subRegion === subRegion);
  }, [duPays, query, region, subRegion, country]);

  const changerPays = (code: Country) => {
    setCountry(code);
    setQuery('');
    setRegion(undefined);
    setSubRegion(undefined);
  };

  const choisirRegion = (item: Neighborhood) => {
    setRegion(item.regionCode);
    setSubRegion(undefined);
    // Au Canada, la province est le lieu : il n'y a pas de palier en dessous.
    if (item.country === 'CA') onChange(item.id);
  };

  const étiquette = (item: Neighborhood) =>
    item.subRegion
      ? `${item.subRegion} · ${language === 'ar' ? item.regionAr : item.region}`
      : language === 'ar'
        ? item.regionAr
        : item.region;

  const Ligne = ({
    titre,
    sous,
    actif,
    onPress,
  }: {
    titre: string;
    sous?: string;
    actif?: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(actif) }}
      accessibilityLabel={titre}
      onPress={onPress}
      style={[styles.row, actif && styles.rowActive]}
    >
      <Text style={[styles.rowName, rtl.text]}>{titre}</Text>
      {sous ? <Text style={[styles.rowMeta, rtl.text]}>{sous}</Text> : null}
    </Pressable>
  );

  return (
    <View>
      <View style={[styles.countries, rtl.row]}>
        {COUNTRIES.map((option) => (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: option.code === country }}
            onPress={() => changerPays(option.code)}
            style={[styles.country, option.code === country && styles.countryActive]}
          >
            <Text
              style={[styles.countryText, option.code === country && styles.countryTextActive]}
            >
              {option.flag} {s.places.countries[option.code]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        label={s.places.label[country]}
        placeholder={s.places.search[country]}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Fil d'Ariane : sans lui, on ne sait plus à quel palier on est. */}
      {!query && region ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (subRegion ? setSubRegion(undefined) : setRegion(undefined))}
        >
          <Text style={[styles.back, rtl.text]}>
            ← {subRegion ?? regions.find((item) => item.regionCode === region)?.region ?? ''}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {!query && !region
          ? regions.map((item) => (
              <Ligne
                key={item.regionCode}
                titre={language === 'ar' ? item.regionAr : item.region}
                sous={
                  country === 'CA'
                    ? s.places.provinceHint
                    : format(s.places.communes, {
                        count: duPays.filter((c) => c.regionCode === item.regionCode).length,
                      })
                }
                actif={item.country === 'CA' && item.id === value}
                onPress={() => choisirRegion(item)}
              />
            ))
          : null}

        {!query && region && country === 'DZ' && !subRegion
          ? subRegions.map((daira) => (
              <Ligne key={daira} titre={daira} onPress={() => setSubRegion(daira)} />
            ))
          : null}

        {résultats.slice(0, VISIBLE).map((item) => (
          <Ligne
            key={item.id}
            titre={localizedName(item)}
            sous={étiquette(item)}
            actif={item.id === value}
            onPress={() => onChange(item.id)}
          />
        ))}
      </View>

      {résultats.length > VISIBLE ? (
        <Text style={[styles.hint, rtl.text]}>
          {format(s.places.more, { count: résultats.length - VISIBLE })}
        </Text>
      ) : null}

      {query && résultats.length === 0 ? (
        <Text style={[styles.hint, rtl.text]}>
          {format(s.places.noMatch, { query: query.trim() })}
        </Text>
      ) : null}

      {country === 'CA' ? (
        <Text style={[styles.hint, rtl.text]}>{s.places.provinceScale}</Text>
      ) : null}

      {courant ? (
        <Text style={[styles.chosen, rtl.text]}>
          {format(s.places.chosen, {
            place: `${localizedName(courant)} · ${étiquette(courant)}`,
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  countries: { gap: spacing.sm, marginBottom: spacing.md },
  country: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  countryActive: { borderColor: colors.brand, backgroundColor: colors.sand },
  countryText: { fontSize: fontSizes.body, fontWeight: '600', color: colors.muted },
  countryTextActive: { color: colors.brand },
  back: { color: colors.brand, fontWeight: '700', fontSize: fontSizes.small, marginBottom: spacing.sm },
  list: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowActive: { backgroundColor: colors.sand },
  rowName: { fontSize: fontSizes.body, color: colors.ink, fontWeight: '600' },
  rowMeta: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  hint: { marginTop: spacing.sm, fontSize: fontSizes.small, color: colors.muted },
  chosen: {
    marginTop: spacing.sm,
    fontSize: fontSizes.small,
    color: colors.brand,
    fontWeight: '600',
  },
});
