import { useAuth } from '../auth/useAuth'
import { translations, type Lang, type TKey } from '../i18n/translations'

export function useT() {
  const { user } = useAuth()
  const lang = ((user?.ui_language as Lang) ?? 'en') in translations
    ? (user?.ui_language as Lang)
    : 'en'
  const dict = translations[lang]
  return (key: TKey): string => dict[key] ?? translations.en[key] ?? key
}
