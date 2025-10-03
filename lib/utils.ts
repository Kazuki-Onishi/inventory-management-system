
import { Item } from './types';

export const classNames = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const getItemDisplayName = (item: Item | undefined, language: 'en' | 'ja'): string => {
  if (!item) return '';
  if (language === 'en' && item.nameEn) {
    return item.nameEn;
  }
  return item.name;
};
