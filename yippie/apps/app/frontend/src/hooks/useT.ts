import { useAuth } from '../auth/useAuth'
import { translations, type Lang, type TKey } from '../i18n/translations'

function resolveLang(uiLanguage: unknown): Lang {
  return ((uiLanguage as Lang) ?? 'en') in translations
    ? (uiLanguage as Lang)
    : 'en'
}

export function useLang(): Lang {
  const { user } = useAuth()
  return resolveLang(user?.ui_language)
}

export function useT() {
  const { user } = useAuth()
  const lang = resolveLang(user?.ui_language)
  const dict = translations[lang]
  return (key: TKey): string => dict[key] ?? translations.en[key] ?? key
}
