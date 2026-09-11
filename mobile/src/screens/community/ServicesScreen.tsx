import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { Service } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useApp } from '../../state/AppProvider';
import { Card, CommunityScreen, Empty, SectionTitle, styles, useRemote } from './shared';

/**
 * Annuaire des artisans recommandés par de vrais voisins (§4.9).
 *
 * La note n'a de valeur que parce qu'elle vient de voisins vérifiés du même
 * quartier : le serveur n'en compte qu'une par personne, et inscrire un
 * artisan vaut recommandation.
 */
export function ServicesScreen() {
  const { s, format, rtl } = useI18n();
  const { repository } = useApp();

  const load = useCallback(() => repository.loadServices(), [repository]);
  const { data: services, failed, busy, run } = useRemote<Service[]>(load, []);

  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [phone, setPhone] = useState('');

  const ajouter = () => {
    if (name.trim().length < 2 || trade.trim().length < 2) return;
    run(async () => {
      await repository.addService({
        name: name.trim(),
        trade: trade.trim(),
        phone: phone.trim() || undefined,
      });
      setName('');
      setTrade('');
      setPhone('');
    });
  };

  return (
    <CommunityScreen failed={failed}>
      <Text style={[styles.intro, rtl.text]}>{s.community.servicesIntro}</Text>

      {services.length === 0 ? <Empty>{s.community.servicesEmpty}</Empty> : null}

      {services.map((service) => (
        <Card key={service.id}>
          <Text style={[styles.title, rtl.text]}>
            {service.name} · {service.trade}
          </Text>
          <Text style={[styles.meta, rtl.text]}>
            {'★'.repeat(Math.round(service.rating))}
            {service.rating > 0 ? ` ${service.rating}/5 · ` : ''}
            {format(s.community.recommendations, { count: service.recommendations })}
            {service.phone ? ` · ${service.phone}` : ''}
          </Text>

          <View style={[styles.pillRow, styles.spaced, rtl.row]}>
            {[1, 2, 3, 4, 5].map((note) => (
              <Pressable
                key={note}
                accessibilityRole="button"
                accessibilityLabel={format(s.community.rate, { count: note })}
                disabled={busy}
                onPress={() => run(() => repository.recommendService(service.id, note))}
                style={styles.pill}
              >
                <Text style={styles.pillText}>{note}★</Text>
              </Pressable>
            ))}
          </View>
          {service.recommendedByMe ? (
            <Text style={[styles.meta, rtl.text]}>{s.community.alreadyRecommended}</Text>
          ) : null}
        </Card>
      ))}

      <SectionTitle>{s.community.servicesAdd}</SectionTitle>
      <Field
        label={s.community.serviceName}
        placeholder={s.community.serviceNamePlaceholder}
        value={name}
        onChangeText={setName}
      />
      <Field
        label={s.community.serviceTrade}
        placeholder={s.community.serviceTradePlaceholder}
        value={trade}
        onChangeText={setTrade}
      />
      <Field
        label={s.community.servicePhone}
        placeholder="05 xx xx xx xx"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <PrimaryButton label={s.community.add} loading={busy} onPress={ajouter} />
    </CommunityScreen>
  );
}
