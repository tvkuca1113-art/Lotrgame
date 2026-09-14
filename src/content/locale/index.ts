import { EN_UI } from './en-ui';
import { EN_RINGS } from './en-rings';
import { EN_STORY } from './en-story';

export type LocaleId = 'en';

/**
 * The localisation dictionary. Every player-facing string in the game is looked
 * up here, so a translation is a single extra dictionary and the franchise
 * names and lore all sit in this replaceable content layer.
 */
export const LOCALES: Record<LocaleId, Record<string, string>> = {
  en: { ...EN_UI, ...EN_RINGS, ...EN_STORY },
};

let current: LocaleId = 'en';

export function setLocale(id: LocaleId): void {
  if (LOCALES[id]) current = id;
}

export function getLocale(): LocaleId {
  return current;
}

/** Look up a string. Missing keys return the key itself so gaps are obvious. */
export function t(key: string, ...args: (string | number)[]): string {
  const dict = LOCALES[current];
  let s = dict[key];
  if (s === undefined) {
    if (import.meta.env?.DEV) console.warn(`[locale] missing key: ${key}`);
    return key;
  }
  for (let i = 0; i < args.length; i++) s = s.split(`{${i}}`).join(String(args[i]));
  return s;
}

export function hasKey(key: string): boolean {
  return LOCALES[current][key] !== undefined;
}

export function allKeys(): string[] {
  return Object.keys(LOCALES.en);
}
