import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';

import { ToastProvider } from './src/components/Toast';
import { LocalRepository } from './src/data/localRepository';
import type { Language } from './src/domain/types';
import { I18nProvider, useI18n } from './src/i18n/I18nProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingFlow } from './src/screens/onboarding/OnboardingFlow';
import { AppProvider, useApp } from './src/state/AppProvider';
import { colors } from './src/theme/theme';

/** Langue de départ : celle du téléphone si c'est l'arabe, sinon le français. */
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'ar' ? 'ar' : 'fr';
}

/**
 * Aiguillage : tant que l'inscription n'est pas terminée, l'application n'est
 * que l'onboarding — le fil du quartier n'est pas accessible avant d'avoir
 * accepté les règles (§3).
 */
function Root() {
  const { ready, session, register } = useApp();
  const { setLanguage } = useI18n();

  // Une session déjà enregistrée impose sa langue au redémarrage.
  useEffect(() => {
    if (session) setLanguage(session.language);
  }, [session, setLanguage]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!session) {
    return <OnboardingFlow onDone={register} />;
  }

  return <RootNavigator />;
}

export default function App() {
  const repository = useMemo(() => new LocalRepository(), []);

  return (
    <SafeAreaProvider>
      <I18nProvider initialLanguage={deviceLanguage()}>
        <AppProvider repository={repository}>
          <ToastProvider>
            <StatusBar style="dark" />
            <Root />
          </ToastProvider>
        </AppProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
