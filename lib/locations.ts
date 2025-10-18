import { Location, SubLocation } from '../types';

const LOCATION_SEQUENCE_REGEX = /^[A-Z]+$/;
const SUBLOCATION_SEQUENCE_REGEX = /^\d+$/;
const LETTERS_COUNT = 26;
const SUBLOCATION_PAD_LENGTH = 2;

const toLetterSequenceNumber = (value: string): number | null => {
  const sequence = value.trim().toUpperCase();
  if (!LOCATION_SEQUENCE_REGEX.test(sequence)) {
    return null;
  }
  let result = 0;
  for (let i = 0; i < sequence.length; i += 1) {
    result = result * LETTERS_COUNT + (sequence.charCodeAt(i) - 64);
  }
  return result;
};

const fromLetterSequenceNumber = (value: number): string => {
  if (value <= 0) {
    return 'A';
  }
  let number = value;
  let result = '';
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + (number % LETTERS_COUNT)) + result;
    number = Math.floor(number / LETTERS_COUNT);
  }
  return result;
};

const fallbackLocationHumanId = (id: string): string => {
  const alphanumeric = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = alphanumeric.slice(-4) || '0001';
  return `LOC-${suffix.padStart(4, '0')}`;
};

export const ensureLocationHumanId = <T extends { id: string; humanId?: string | null }>(location: T): T & { humanId: string } => {
  const trimmed = location.humanId?.trim().toUpperCase();
  const humanId = trimmed && trimmed.length > 0 ? trimmed : fallbackLocationHumanId(location.id);
  return { ...(location as unknown as T & { humanId: string }), humanId };
};

export const generateNextLocationHumanId = (locations: Array<{ humanId?: string | null }>): string => {
  const maxSequence = locations.reduce((max, location) => {
    const sequenceNumber = location.humanId ? toLetterSequenceNumber(location.humanId) : null;
    if (sequenceNumber !== null && sequenceNumber > max) {
      return sequenceNumber;
    }
    return max;
  }, 0);
  return fromLetterSequenceNumber(maxSequence + 1);
};

const extractSubLocationSequence = (subLocation?: SubLocation): number | null => {
  if (!subLocation?.humanId) return null;
  const value = subLocation.humanId.trim();
  if (!SUBLOCATION_SEQUENCE_REGEX.test(value)) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const generateNextSubLocationHumanId = (location: Location): string => {
  const sublocations = location.sublocations || [];
  const maxSequence = sublocations.reduce((max, sub) => {
    const sequence = extractSubLocationSequence(sub);
    if (sequence !== null && sequence > max) {
      return sequence;
    }
    return max;
  }, 0);
  const next = maxSequence + 1;
  return String(next).padStart(SUBLOCATION_PAD_LENGTH, '0');
};
