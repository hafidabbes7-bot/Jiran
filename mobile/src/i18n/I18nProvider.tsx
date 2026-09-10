import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';

import type { Language } from '../domain/types';
import { fr, type Strings } from './fr';
import { ar } from './ar';

const DICTIONARIES: Record<Language, Strings> = { fr, ar };

/** Remplace les `{clé}` d'un texte par les valeurs fournies. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Dictionnaire de la langue courante. */
  s: Strings;
  format: typeof format;
  isRTL: boolean;
  /** Styles à appliquer pour respecter le sens de lecture. */
  rtl: {
    row: ViewStyle;
    text: TextStyle;
    align: ViewStyle;
  };
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Bascule française / arabe avec sens de lecture.
 *
 * On n'utilise volontairement pas `I18nManager.forceRTL`, qui impose un
 * redémarrage complet de l'application à chaque changement de langue. La
 * direction est portée par les styles exposés ici, ce qui rend la bascule
 * immédiate — comportement déjà validé sur le prototype.
 */
export function I18nProvider({
  initialLanguage = 'fr',
  children,
}: {
  initialLanguage?: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const value = useMemo<I18nValue>(() => {
    const isRTL = language === 'ar';
    return {
      language,
      setLanguage,
      s: DICTIONARIES[language],
      format,
      isRTL,
      rtl: {
        row: { flexDirection: isRTL ? 'row-reverse' : 'row' },
        text: { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        align: { alignItems: isRTL ? 'flex-end' : 'flex-start' },
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n doit être utilisé dans un I18nProvider');
  return value;
}

/** Nom du quartier dans la langue courante. */
export function useLocalizedName(): (item: { name: string; nameAr: string }) => string {
  const { language } = useI18n();
  return useCallback((item) => (language === 'ar' ? item.nameAr : item.name), [language]);
}
