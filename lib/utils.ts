
import { Item } from '../types';

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

const kanaOffset = 0x60;

export const normalizeSearchText = (value: string): string => {
  if (!value) return '';
  const normalized = value.normalize('NFKC').toLowerCase();
  let result = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCharCode(code - kanaOffset); // カタカナ → ひらがな
    } else {
      result += normalized[i];
    }
  }
  return result;
};

export const createSearchTerms = (query: string): string[] =>
  normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

export const matchesSearch = (values: Array<string | null | undefined>, terms: string[]): boolean => {
  if (terms.length === 0) return true;
  const combined = values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => normalizeSearchText(value))
    .join(' ');
  if (!combined) return false;
  return terms.every((term) => combined.includes(term));
};
