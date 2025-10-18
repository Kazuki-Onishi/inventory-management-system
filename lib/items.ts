import { Item } from '../types';

const HUMAN_ID_PREFIX = 'ITM-';
const HUMAN_ID_PAD_LENGTH = 4;
const HUMAN_ID_SEQUENCE_REGEX = /(\d+)$/;

export const deriveHumanIdFromId = (id: string): string => {
  const alphanumeric = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = alphanumeric.slice(-HUMAN_ID_PAD_LENGTH);
  const padded = suffix.padStart(HUMAN_ID_PAD_LENGTH, '0');
  return `${HUMAN_ID_PREFIX}${padded}`;
};

export const ensureItemHumanId = <T extends { id: string; humanId?: string | null }>(item: T): T & { humanId: string } => {
  if (item.humanId && item.humanId.trim().length > 0) {
    return item as T & { humanId: string };
  }
  const humanId = deriveHumanIdFromId(item.id);
  return { ...item, humanId };
};

const extractHumanIdSequence = (humanId?: string | null): number | null => {
  if (!humanId) return null;
  const match = humanId.match(HUMAN_ID_SEQUENCE_REGEX);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
};

export const generateNextItemHumanId = (items: Array<{ id: string; humanId?: string | null }>): string => {
  const maxSequence = items.reduce((max, item) => {
    const sequence = extractHumanIdSequence(item.humanId);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);
  const next = maxSequence + 1;
  return `${HUMAN_ID_PREFIX}${String(next).padStart(HUMAN_ID_PAD_LENGTH, '0')}`;
};

export const withEnsuredHumanIds = (items: Item[]): Item[] => {
  return items.map((item) => ensureItemHumanId(item));
};
