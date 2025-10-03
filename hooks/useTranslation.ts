import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { en, ja, TranslationKey } from '../locales/index';

const translations: Record<'en' | 'ja', typeof en> = { en, ja };

export const useTranslation = () => {
  const { language } = useContext(AppContext);

  const t = (key: TranslationKey, replacements?: { [key: string]: string }): string => {
    let translation = translations[language][key] || key;

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
      });
    }

    return translation;
  };

  return { t, language, setLanguage: useContext(AppContext).setLanguage };
};
