import enJson from './en.json';
import jaJson from './ja.json';

export const en = enJson;

export const ja = jaJson as typeof en;

export type TranslationKey = keyof typeof en;
