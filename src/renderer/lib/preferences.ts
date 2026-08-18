import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/local-storage";
import { DENSITIES, type Density } from "@/lib/river";

export interface Preferences {
  density: Density;
  hideReadItems: boolean;
  markReadOnScroll: boolean;
  openLinksExternally: boolean;
}

const STORAGE_KEYS = {
  density: 'preferences-density',
  hideReadItems: 'preferences-hide-read-items',
  markReadOnScroll: 'preferences-mark-read-on-scroll',
  openLinksExternally: 'preferences-open-links-externally',
} satisfies Record<keyof Preferences, string>;

function loadEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = readLocalStorageJSON(key);
  return typeof stored === 'string' && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
}

function loadBoolean(key: string, fallback: boolean): boolean {
  const stored = readLocalStorageJSON(key);
  return typeof stored === 'boolean' ? stored : fallback;
}

/** Reads every preference from `localStorage`, falling back to its default when unset or invalid. */
export function loadPreferences(): Preferences {
  return {
    density: loadEnum(STORAGE_KEYS.density, DENSITIES, 'Cards'),
    hideReadItems: loadBoolean(STORAGE_KEYS.hideReadItems, false),
    markReadOnScroll: loadBoolean(STORAGE_KEYS.markReadOnScroll, true),
    openLinksExternally: loadBoolean(STORAGE_KEYS.openLinksExternally, false),
  };
}

/** Persists a single preference to `localStorage`. */
export function savePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  writeLocalStorageJSON(STORAGE_KEYS[key], value);
}
