"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

// Language set matches the sister IMAGINE app exactly.
export type Language = "en" | "ja" | "zh-CN" | "zh-TW" | "ko";

export interface LanguageOption {
  code: Language;
  // Native label shown in the dropdown list.
  label: string;
  // Compact code shown on the switcher trigger.
  short: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "ja", label: "日本語", short: "JA" },
  { code: "zh-CN", label: "简体中文", short: "CN" },
  { code: "zh-TW", label: "繁體中文", short: "TW" },
  { code: "ko", label: "한국어", short: "KO" },
];

// Shared with the legacy per-component locale wiring for backward compat.
const STORAGE_KEY = "whatif_menu_locale";
const DEFAULT_LANGUAGE: Language = "en";

const VALID_CODES = new Set<Language>(LANGUAGES.map((item) => item.code));

function isValidLanguage(value: string | null | undefined): value is Language {
  return typeof value === "string" && VALID_CODES.has(value as Language);
}

// Map a raw navigator.language tag to one of the 5 supported languages.
function detectFromNavigator(rawLanguage: string | undefined): Language {
  const tag = (rawLanguage ?? "").toLowerCase();
  if (!tag) return DEFAULT_LANGUAGE;
  if (tag.startsWith("zh")) {
    if (tag.includes("tw") || tag.includes("hk") || tag.includes("hant")) {
      return "zh-TW";
    }
    // zh-CN / zh-Hans / any other zh* defaults to simplified.
    return "zh-CN";
  }
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("ja")) return "ja";
  return "en";
}

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  languages: typeof LANGUAGES;
}

function subscribeLanguageStore() {
  return () => {};
}

function readPreferredLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isValidLanguage(stored)) {
    return stored;
  }

  return detectFromNavigator(window.navigator.language);
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Null means "follow the persisted / auto-detected preference" while keeping
  // the server render deterministic in English.
  const [langOverride, setLangOverride] = useState<Language | null>(null);
  const hasHydrated = useSyncExternalStore(
    subscribeLanguageStore,
    () => true,
    () => false
  );
  const lang =
    langOverride ?? (hasHydrated ? readPreferredLanguage() : DEFAULT_LANGUAGE);

  // Keep the document language attribute in sync with the active language.
  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangOverride(next);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
