
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

const JAPANESE_NUMERAL_MAP: Record<string, string> = {
  '〇': '0',
  '零': '0',
  '一': '1',
  '壱': '1',
  '弌': '1',
  '二': '2',
  '弐': '2',
  '貳': '2',
  '三': '3',
  '参': '3',
  '參': '3',
  '四': '4',
  '肆': '4',
  '五': '5',
  '伍': '5',
  '六': '6',
  '陸': '6',
  '七': '7',
  '柒': '7',
  '八': '8',
  '捌': '8',
  '九': '9',
  '玖': '9',
};

export const normalizeSearchText = (value: string): string => {
  if (!value) return '';
  const normalized = value.normalize('NFKC').toLowerCase();
  let result = '';
  for (let i = 0; i < normalized.length; i += 1) {
    let char = normalized[i];
    const code = normalized.charCodeAt(i);
    if (code >= 0x30a1 && code <= 0x30f6) {
      char = String.fromCharCode(code - kanaOffset); // Katakana -> Hiragana
    }
    result += JAPANESE_NUMERAL_MAP[char] ?? char;
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
