import { useCallback } from 'react';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';
import { useApp } from '../store/AppContext';

type Locale = 'en' | 'ar';

const translations: Record<Locale, typeof en> = { en, ar };

export function useI18n() {
  const { state } = useApp();
  const locale = state.locale as Locale;

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const keys = path.split('.');
      let value: any = translations[locale];

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return fallback ?? path;
        }
      }

      return typeof value === 'string' ? value : (fallback ?? path);
    },
    [locale]
  );

  return { t, locale };
}
