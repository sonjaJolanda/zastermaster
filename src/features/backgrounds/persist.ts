import type { BackgroundOption } from "./operations";

export type BackgroundTabKey =
  | "transaktionen"
  | "analyse"
  | "upload"
  | "einstellungen";

export type BackgroundPrefs = Record<BackgroundTabKey, string | null>;

export const BACKGROUND_PREFS_STORAGE_KEY = "zm-backgrounds-v1";
export const BACKGROUND_PREFS_EVENT = "zm-backgrounds-changed";

export const TAB_PATHS: Record<BackgroundTabKey, string> = {
  transaktionen: "/",
  analyse: "/analyse",
  upload: "/upload",
  einstellungen: "/einstellungen",
};

export function tabKeyForPath(pathname: string): BackgroundTabKey {
  if (pathname.startsWith("/analyse")) return "analyse";
  if (pathname.startsWith("/upload")) return "upload";
  if (pathname.startsWith("/einstellungen")) return "einstellungen";
  return "transaktionen";
}

export function defaultBackgroundPrefs(
  defaultUrl: string | null = null,
): BackgroundPrefs {
  return {
    transaktionen: defaultUrl,
    analyse: defaultUrl,
    upload: defaultUrl,
    einstellungen: defaultUrl,
  };
}

export function loadBackgroundPrefs(
  defaultUrl: string | null = null,
): BackgroundPrefs {
  const defaults = defaultBackgroundPrefs(defaultUrl);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(BACKGROUND_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<BackgroundPrefs>;
    return {
      transaktionen:
        typeof parsed.transaktionen === "string"
          ? parsed.transaktionen
          : defaults.transaktionen,
      analyse:
        typeof parsed.analyse === "string" ? parsed.analyse : defaults.analyse,
      upload:
        typeof parsed.upload === "string" ? parsed.upload : defaults.upload,
      einstellungen:
        typeof parsed.einstellungen === "string"
          ? parsed.einstellungen
          : defaults.einstellungen,
    };
  } catch {
    return defaults;
  }
}

export function saveBackgroundPrefs(prefs: BackgroundPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BACKGROUND_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event(BACKGROUND_PREFS_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

export function normalizePrefsToOptions(
  prefs: BackgroundPrefs,
  options: BackgroundOption[],
): BackgroundPrefs {
  const valid = new Set(options.map((o) => o.url));
  const fallback = options[0]?.url ?? null;
  const normalize = (url: string | null) =>
    url && valid.has(url) ? url : fallback;
  return {
    transaktionen: normalize(prefs.transaktionen),
    analyse: normalize(prefs.analyse),
    upload: normalize(prefs.upload),
    einstellungen: normalize(prefs.einstellungen),
  };
}
