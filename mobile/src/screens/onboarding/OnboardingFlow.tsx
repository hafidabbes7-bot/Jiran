import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '../../components/Field';
import { NeighborhoodPicker } from '../../components/NeighborhoodPicker';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { AuthService, Channel, VerifiedSession } from '../../data/authService';
import { NEIGHBORHOODS, findNeighborhood } from '../../data/neighborhoods';
import { checkPosition, findCoverage } from '../../domain/location';
import { isValidAlgerianMobile } from '../../domain/phone';
import { formatDistance } from '../../domain/time';
import type { Language, Neighborhood, Session } from '../../domain/types';
import { useI18n, useLocalizedName } from '../../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../../theme/theme';
import { usePhoneVerification, type VerificationError } from './usePhoneVerification';
import { useRulesCountdown } from './useRulesCountdown';

type Step = 1 | 2 | 3 | 4 | 5;

/** Longueur du code envoyé par SMS — doit correspondre à `OTP_LENGTH` côté serveur. */
const CODE_LENGTH = 6;

/** Pastille du canal, réservée aux boutons de choix — pas aux phrases. */
const CHANNEL_EMOJI: Record<Channel, string> = {
  sms: '💬',
  whatsapp: '🟢',
  whatsapp_link: '🟢',
};

type PositionStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'verified' }
  | { kind: 'too-far'; distance: number; suggestion?: Neighborhood }
  /** Aucun quartier connu ne couvre la position : la liste est encore partielle. */
  | { kind: 'uncovered'; distance: number; nearest?: Neighborhood }
  /** Le voisin a choisi d'entrer sans vérification, son quartier n'étant pas couvert. */
  | { kind: 'accepted' }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * Parcours d'inscription en 5 étapes (§4.1). La dernière — les règles du
 * quartier — est obligatoire et son bouton reste verrouillé quelques secondes,
 * pour garantir une vraie lecture avant l'entrée dans l'application (§3).
 *
 * L'étape « compte » se déroule en deux volets : le numéro, puis le code reçu
 * par SMS. On reste à 5 étapes affichées — la vérification fait partie de la
 * création du compte, elle n'en est pas une de plus.
 */
export function OnboardingFlow({
  auth,
  onDone,
}: {
  auth: AuthService;
  onDone: (session: Session) => Promise<void>;
}) {
  const { s, format, language, setLanguage, rtl } = useI18n();
  const localizedName = useLocalizedName();

  const [step, setStep] = useState<Step>(1);
  const [accountPane, setAccountPane] = useState<'phone' | 'code' | 'link'>('phone');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [availableChannels, setAvailableChannels] = useState<Channel[]>(['sms']);
  const [verified, setVerified] = useState<VerifiedSession | null>(null);
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string }>({});
  // Rien n'est choisi d'avance : un quartier pré-sélectionné serait accepté
  // par distraction, et ce choix décide de qui sont « tes voisins ».
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [building, setBuilding] = useState('');
  const [position, setPosition] = useState<PositionStatus>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);

  const neighborhood = useMemo(() => findNeighborhood(neighborhoodId), [neighborhoodId]);

  const selectNeighborhood = useCallback((id: string) => {
    setNeighborhoodId(id);
    setPosition({ kind: 'idle' });
  }, []);

  const chooseLanguage = (next: Language) => {
    setLanguage(next);
    setStep(2);
  };

  const verification = usePhoneVerification(auth);

  // Les canaux proposés dépendent de ce qui est réellement branché côté
  // serveur : inutile d'offrir WhatsApp si aucun compte Meta n'est configuré.
  useEffect(() => {
    let cancelled = false;
    auth.listChannels().then((channels) => {
      if (cancelled || channels.length === 0) return;
      setAvailableChannels(channels);
      setChannel((current) => (channels.includes(current) ? current : channels[0]!));
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const channelName = (value: Channel) => {
    if (value === 'whatsapp') return s.onboarding.channelWhatsapp;
    if (value === 'whatsapp_link') return s.onboarding.channelWhatsappLink;
    return s.onboarding.channelSms;
  };

  /** Message d'erreur de la vérification, dans la langue courante. */
  const verificationMessage = (failure: VerificationError): string => {
    switch (failure.key) {
      case 'invalid_phone':
        return s.onboarding.phoneError;
      case 'sms_failed':
        return s.onboarding.sendFailed;
      case 'channel_unavailable':
        return s.onboarding.channelUnavailable;
      case 'network':
        return s.onboarding.networkError;
      case 'rate_limited':
        return format(s.onboarding.rateLimited, {
          seconds: failure.retryAfterSeconds ?? 60,
        });
      case 'invalid_code':
        return failure.attemptsLeft === 1
          ? s.onboarding.codeInvalidOne
          : format(s.onboarding.codeInvalidMany, { count: failure.attemptsLeft ?? 0 });
      case 'expired':
        return s.onboarding.codeExpired;
      case 'consumed':
        return s.onboarding.codeConsumed;
      case 'too_many_attempts':
        return s.onboarding.codeTooManyAttempts;
      case 'not_found':
        return s.onboarding.codeExpired;
      case 'link_expired':
        return s.onboarding.linkExpired;
    }
  };

  /** Code renvoyé par un serveur en mode développement, s'il y en a un. */
  const devCode =
    verification.status.kind === 'awaiting-code' || verification.status.kind === 'verifying'
      ? verification.status.challenge.devCode
      : undefined;

  const submitAccount = async () => {
    const nextErrors: typeof errors = {};
    if (!firstName.trim()) nextErrors.firstName = s.onboarding.firstNameError;
    if (!isValidAlgerianMobile(phone)) nextErrors.phone = s.onboarding.phoneError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const challenge = await verification.requestCode(phone, channel);
    if (!challenge) return;

    if (challenge.mode === 'link') {
      setAccountPane('link');
      openWhatsApp(challenge.link);
      return;
    }

    // En développement, le serveur renvoie le code : on le pré-remplit pour
    // ne pas avoir à le recopier depuis la console.
    setCode(challenge.devCode ?? '');
    setAccountPane('code');
  };

  const [linkOpenFailed, setLinkOpenFailed] = useState(false);

  const openWhatsApp = async (link: string) => {
    setLinkOpenFailed(false);
    try {
      await Linking.openURL(link);
    } catch {
      // WhatsApp absent : l'écran propose alors d'envoyer le message à la main.
      setLinkOpenFailed(true);
    }
  };

  const onVerified = useCallback((session: VerifiedSession) => {
    setVerified(session);
    setStep(3);
  }, []);

  // Le serveur ne peut pas nous prévenir : on redemande régulièrement tant que
  // le message du voisin n'est pas arrivé.
  const { waitForLink } = verification;
  useEffect(() => {
    if (accountPane !== 'link' || verification.status.kind !== 'awaiting-link') return;

    const interval = setInterval(() => {
      waitForLink(onVerified);
    }, 2500);
    return () => clearInterval(interval);
  }, [accountPane, verification.status.kind, waitForLink, onVerified]);

  const submitCode = async () => {
    const session = await verification.verifyCode(code);
    if (session) onVerified(session);
  };

  /** Renvoi d'un code, sans repasser par la saisie du numéro. */
  const requestNewCode = async () => {
    const challenge = await verification.requestCode(phone, channel);
    if (challenge && challenge.mode === 'code') setCode(challenge.devCode ?? '');
  };

  const editPhone = () => {
    verification.reset();
    setCode('');
    setLinkOpenFailed(false);
    setAccountPane('phone');
  };

  /**
   * Vérification par géolocalisation plutôt que par courrier postal (§2) : on
   * compare la position réelle au quartier déclaré.
   */
  const confirmPosition = useCallback(async () => {
    if (!neighborhood) return;
    setPosition({ kind: 'checking' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPosition({ kind: 'denied' });
        return;
      }

      const reading = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = checkPosition(reading.coords, neighborhood, NEIGHBORHOODS);
      if (result.verified) {
        setPosition({ kind: 'verified' });
        return;
      }

      // Hors du quartier déclaré : soit le voisin s'est trompé de ligne et un
      // autre quartier le couvre, soit sa commune n'est pas encore dans la
      // liste — deux situations très différentes à l'écran.
      const coverage = findCoverage(reading.coords, NEIGHBORHOODS);
      setPosition(
        coverage.neighborhood
          ? {
              kind: 'too-far',
              distance: result.distanceMeters,
              suggestion: coverage.neighborhood,
            }
          : {
              kind: 'uncovered',
              distance: coverage.distanceMeters,
              nearest: coverage.nearest,
            }
      );
    } catch {
      setPosition({ kind: 'unavailable' });
    }
  }, [neighborhood]);

  /**
   * Chemin le plus court : on part de la position et on en déduit le quartier,
   * au lieu de demander au voisin de le trouver dans une liste de 97 lignes.
   */
  const detectNeighborhood = useCallback(async () => {
    setPosition({ kind: 'checking' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPosition({ kind: 'denied' });
        return;
      }

      const reading = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coverage = findCoverage(reading.coords, NEIGHBORHOODS);
      if (!coverage.neighborhood) {
        setPosition({ kind: 'uncovered', distance: coverage.distanceMeters, nearest: coverage.nearest });
        return;
      }

      setNeighborhoodId(coverage.neighborhood.id);
      setPosition({ kind: 'verified' });
    } catch {
      setPosition({ kind: 'unavailable' });
    }
  }, []);

  const rules = useRulesCountdown(step === 5);

  const finish = async () => {
    if (!verified) return;
    setSubmitting(true);
    try {
      await onDone({
        firstName: firstName.trim(),
        // Le numéro retenu est celui que le serveur a vérifié, pas celui saisi.
        phone: verified.phone,
        phoneVerifiedAt: new Date().toISOString(),
        token: verified.token,
        neighborhoodId,
        building: building.trim() || undefined,
        language,
        locationVerified: position.kind === 'verified',
        rulesAcceptedAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.dots, rtl.row]}>
          {[1, 2, 3, 4, 5].map((index) => (
            <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <View style={styles.center}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>🏘️</Text>
              </View>
              <Text style={styles.brand}>Jiran</Text>
              <Text style={styles.tagline}>{s.onboarding.tagline}</Text>
              <View style={styles.langButtons}>
                <PrimaryButton
                  label={`🇩🇿 ${s.onboarding.langFr}`}
                  tone="ghost"
                  onPress={() => chooseLanguage('fr')}
                />
                <PrimaryButton
                  label={`🇩🇿 ${s.onboarding.langAr}`}
                  tone="ghost"
                  onPress={() => chooseLanguage('ar')}
                />
              </View>
            </View>
          ) : null}

          {step === 2 && accountPane === 'phone' ? (
            <View>
              <Text style={styles.stepEmoji}>👤</Text>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.accountTitle}</Text>
              <Text style={[styles.sub, rtl.text]}>{s.onboarding.accountSubtitle}</Text>

              <Field
                label={s.onboarding.firstNameLabel}
                placeholder={s.onboarding.firstNamePlaceholder}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                error={errors.firstName}
              />
              <Field
                label={s.onboarding.phoneLabel}
                placeholder={s.onboarding.phonePlaceholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                error={errors.phone}
                hint={s.onboarding.phoneHint}
              />

              {availableChannels.length > 1 ? (
                <View style={styles.channelBlock}>
                  <Text style={[styles.label, rtl.text]}>{s.onboarding.channelLabel}</Text>
                  <View style={[styles.channelRow, rtl.row]}>
                    {availableChannels.map((option) => {
                      const active = option === channel;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          onPress={() => setChannel(option)}
                          style={[styles.channelButton, active && styles.channelButtonActive]}
                        >
                          <Text
                            style={[styles.channelText, active && styles.channelTextActive]}
                          >
                            {CHANNEL_EMOJI[option]} {channelName(option)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {channel === 'whatsapp_link' ? (
                    <Text style={[styles.channelHint, rtl.text]}>
                      {s.onboarding.channelFreeHint}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <PrimaryButton
                label={s.onboarding.createAccount}
                loading={verification.status.kind === 'sending'}
                onPress={submitAccount}
              />

              {verification.error ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {verificationMessage(verification.error)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 2 && accountPane === 'link' ? (
            <View>
              <Text style={styles.stepEmoji}>🟢</Text>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.linkTitle}</Text>
              <Text style={[styles.sub, rtl.text]}>{s.onboarding.linkSubtitle}</Text>

              <PrimaryButton
                label={s.onboarding.linkOpen}
                onPress={() => {
                  if (verification.status.kind === 'awaiting-link') {
                    openWhatsApp(verification.status.challenge.link);
                  }
                }}
              />

              <Text style={[styles.linkWaiting, rtl.text]}>{s.onboarding.linkWaiting}</Text>

              {linkOpenFailed ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {s.onboarding.linkOpenFailed}
                </Text>
              ) : null}

              {verification.error ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {verificationMessage(verification.error)}
                </Text>
              ) : null}

              <Pressable accessibilityRole="button" onPress={editPhone}>
                <Text style={[styles.linkButton, rtl.text]}>{s.onboarding.changeNumber}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 2 && accountPane === 'code' ? (
            <View>
              <Text style={styles.stepEmoji}>💬</Text>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.codeTitle}</Text>
              <Text style={[styles.sub, rtl.text]}>
                {format(s.onboarding.codeSubtitle, {
                  length: CODE_LENGTH,
                  phone,
                  channel: channelName(channel),
                })}
              </Text>

              <Field
                label={format(s.onboarding.codeLabel, { channel: channelName(channel) })}
                placeholder={s.onboarding.codePlaceholder}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                autoFocus
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                style={styles.codeInput}
              />

              {verification.error ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {verificationMessage(verification.error)}
                </Text>
              ) : null}

              {devCode ? (
                <Text style={[styles.devNotice, rtl.text]}>
                  {format(s.onboarding.devCodeNotice, { code: devCode })}
                </Text>
              ) : null}

              <PrimaryButton
                label={s.onboarding.verify}
                disabled={code.length < CODE_LENGTH}
                loading={verification.status.kind === 'verifying'}
                onPress={submitCode}
                style={styles.spaced}
              />

              <PrimaryButton
                label={
                  verification.secondsBeforeResend > 0
                    ? format(s.onboarding.resendIn, { seconds: verification.secondsBeforeResend })
                    : s.onboarding.resend
                }
                tone="ghost"
                disabled={verification.secondsBeforeResend > 0}
                onPress={() => requestNewCode()}
                style={styles.spaced}
              />

              <Pressable accessibilityRole="button" onPress={editPhone}>
                <Text style={[styles.linkButton, rtl.text]}>{s.onboarding.changeNumber}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 3 ? (
            <View>
              <Text style={styles.stepEmoji}>📍</Text>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.locationTitle}</Text>
              <Text style={[styles.sub, rtl.text]}>{s.onboarding.locationSubtitle}</Text>

              <PrimaryButton
                label={
                  position.kind === 'checking'
                    ? s.onboarding.positionChecking
                    : s.onboarding.detectNeighborhood
                }
                loading={position.kind === 'checking'}
                onPress={detectNeighborhood}
              />

              <View style={styles.spaced}>
                <NeighborhoodPicker
                  value={neighborhoodId}
                  onChange={(id) => {
                    setNeighborhoodId(id);
                    setPosition({ kind: 'idle' });
                  }}
                />
              </View>

              <Field
                label={s.onboarding.buildingLabel}
                placeholder={s.onboarding.buildingPlaceholder}
                value={building}
                onChangeText={setBuilding}
              />

              <PrimaryButton
                label={
                  position.kind === 'checking'
                    ? s.onboarding.positionChecking
                    : s.onboarding.confirmPosition
                }
                tone="ghost"
                loading={position.kind === 'checking'}
                disabled={!neighborhood}
                onPress={confirmPosition}
                style={styles.spaced}
              />

              {position.kind === 'verified' ? (
                <Text style={[styles.positionOk, rtl.text]}>
                  {format(s.onboarding.positionOk, {
                    neighborhood: neighborhood ? localizedName(neighborhood) : '',
                  })}
                </Text>
              ) : null}

              {position.kind === 'too-far' ? (
                <View>
                  <Text style={[styles.positionError, rtl.text]}>
                    {format(s.onboarding.positionTooFar, {
                      distance: formatDistance(position.distance, language),
                      neighborhood: neighborhood ? localizedName(neighborhood) : '',
                    })}
                  </Text>
                  {position.suggestion ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setNeighborhoodId(position.suggestion!.id);
                        setPosition({ kind: 'idle' });
                      }}
                    >
                      <Text style={[styles.positionSuggestion, rtl.text]}>
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
                  <Text style={[styles.positionError, rtl.text]}>
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
                <Text style={[styles.positionError, rtl.text]}>
                  {s.onboarding.unverifiedNotice}
                </Text>
              ) : null}

              {position.kind === 'denied' ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {s.onboarding.positionDenied}
                </Text>
              ) : null}

              {position.kind === 'unavailable' ? (
                <Text style={[styles.positionError, rtl.text]}>
                  {s.onboarding.positionUnavailable}
                </Text>
              ) : null}

              <PrimaryButton
                label={s.onboarding.continue}
                disabled={position.kind !== 'verified' && position.kind !== 'accepted'}
                onPress={() => setStep(4)}
                style={styles.spaced}
              />
              {position.kind !== 'verified' && position.kind !== 'accepted' ? (
                <Text style={[styles.hint, rtl.text]}>{s.onboarding.mustVerify}</Text>
              ) : null}
            </View>
          ) : null}

          {step === 4 ? (
            <View>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.introTitle}</Text>
              {[
                { emoji: '🏘️', title: s.onboarding.intro1Title, text: s.onboarding.intro1Text },
                { emoji: '🚨', title: s.onboarding.intro2Title, text: s.onboarding.intro2Text },
                { emoji: '🤝', title: s.onboarding.intro3Title, text: s.onboarding.intro3Text },
              ].map((feature) => (
                <View key={feature.title} style={[styles.feature, rtl.row]}>
                  <Text style={styles.featureEmoji}>{feature.emoji}</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.featureTitle, rtl.text]}>{feature.title}</Text>
                    <Text style={[styles.featureText, rtl.text]}>{feature.text}</Text>
                  </View>
                </View>
              ))}
              <PrimaryButton
                label={s.onboarding.discover}
                onPress={() => setStep(5)}
                style={styles.spaced}
              />
            </View>
          ) : null}

          {step === 5 ? (
            <View>
              <Text style={styles.stepEmoji}>📜</Text>
              <Text style={[styles.heading, rtl.text]}>{s.onboarding.rulesTitle}</Text>
              <Text style={[styles.sub, rtl.text]}>{s.onboarding.rulesSubtitle}</Text>

              {[
                { emoji: '🤝', text: s.onboarding.rule1 },
                { emoji: '✅', text: s.onboarding.rule2 },
                { emoji: '🚫', text: s.onboarding.rule3 },
                { emoji: '⚠️', text: s.onboarding.rule4 },
              ].map((rule) => (
                <View key={rule.text} style={[styles.rule, rtl.row]}>
                  <Text style={styles.ruleEmoji}>{rule.emoji}</Text>
                  <Text style={[styles.ruleText, rtl.text]}>{rule.text}</Text>
                </View>
              ))}

              <PrimaryButton
                label={
                  rules.unlocked
                    ? s.onboarding.agree
                    : format(s.onboarding.agreeCountdown, { seconds: rules.remaining })
                }
                disabled={!rules.unlocked}
                loading={submitting}
                onPress={finish}
                style={styles.spaced}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  dots: {
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.brand, width: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  logo: {
    width: 76,
    height: 76,
    borderRadius: radii.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 36 },
  brand: { fontSize: fontSizes.display, fontWeight: '700', color: colors.ink },
  tagline: {
    fontSize: fontSizes.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  langButtons: { alignSelf: 'stretch', gap: spacing.md },
  stepEmoji: { fontSize: 34, marginBottom: spacing.sm, textAlign: 'center' },
  heading: { fontSize: fontSizes.heading, fontWeight: '700', color: colors.ink },
  sub: { fontSize: fontSizes.small, color: colors.muted, marginBottom: spacing.lg, marginTop: 4 },
  label: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  neighborhoodList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  neighborhoodRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  neighborhoodRowActive: { backgroundColor: colors.sand },
  neighborhoodName: { fontSize: fontSizes.body, color: colors.ink, fontWeight: '600' },
  neighborhoodWilaya: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  spaced: { marginTop: spacing.md },
  listHint: {
    marginBottom: spacing.md,
    fontSize: fontSizes.small,
    color: colors.muted,
  },
  channelBlock: { marginBottom: spacing.md },
  channelRow: { gap: spacing.sm },
  channelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  channelButtonActive: { borderColor: colors.brand, backgroundColor: colors.sand },
  channelText: { fontSize: fontSizes.body, fontWeight: '600', color: colors.muted },
  channelHint: {
    marginTop: spacing.sm,
    fontSize: fontSizes.small,
    color: colors.muted,
    lineHeight: 18,
  },
  linkWaiting: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.muted,
    fontSize: fontSizes.small,
  },
  channelTextActive: { color: colors.brand },
  codeInput: {
    fontSize: fontSizes.heading,
    letterSpacing: 6,
    textAlign: 'center',
  },
  devNotice: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: fontSizes.small,
  },
  linkButton: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.brand,
    fontWeight: '700',
    fontSize: fontSizes.small,
  },
  positionOk: { marginTop: spacing.sm, color: colors.aid, fontSize: fontSizes.small },
  positionError: { marginTop: spacing.sm, color: colors.alert, fontSize: fontSizes.small },
  positionSuggestion: {
    marginTop: spacing.xs,
    color: colors.brand,
    fontSize: fontSizes.small,
    fontWeight: '600',
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: fontSizes.small,
    color: colors.muted,
    textAlign: 'center',
  },
  feature: {
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  featureEmoji: { fontSize: 22 },
  featureTitle: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  featureText: { fontSize: fontSizes.small, color: colors.muted, marginTop: 2 },
  rule: {
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ruleEmoji: { fontSize: fontSizes.title },
  ruleText: { flex: 1, fontSize: fontSizes.small, lineHeight: 19, color: colors.ink },
});
