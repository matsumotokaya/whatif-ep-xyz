"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useEffect,
  useState,
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

// Cookie is the primary store now (a plain "does the user prefer JA"
// preference, not auth — no httpOnly/secure needed). It replaces localStorage
// as the source of truth so a value written on one page is trivially read
// back the same way everywhere, but it is still read only client-side here
// (not in the root layout) so the site keeps its static/ISR rendering — see
// the useLayoutEffect below for why that doesn't reintroduce a visible flash.
const COOKIE_KEY = "whatif_lang";
// Legacy key from before the cookie switch. Only ever read once, as a
// one-time migration source for returning visitors who don't have the
// cookie yet.
const LEGACY_STORAGE_KEY = "whatif_menu_locale";
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

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeLanguageCookie(lang: Language) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

// Resolution order: cookie -> legacy localStorage (one-time migration,
// promoted into the cookie so this branch is never needed again for this
// visitor) -> browser language -> default.
function readPreferredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const cookieValue = readCookie(COOKIE_KEY);
  if (isValidLanguage(cookieValue)) return cookieValue;

  const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (isValidLanguage(legacyValue)) {
    writeLanguageCookie(legacyValue);
    return legacyValue;
  }

  return detectFromNavigator(window.navigator.language);
}

// useLayoutEffect runs synchronously after DOM mutations but before the
// browser paints, so correcting the language here (versus a regular
// useEffect, which runs after paint) avoids a visible flash of English on
// every hard navigation for a returning visitor. It's a no-op warning risk
// during SSR, so fall back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Starts as the SSR-safe default so server and client markup match on the
  // very first paint; the layout effect below swaps in the real preference
  // before the browser actually shows anything.
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE);

  useIsomorphicLayoutEffect(() => {
    const preferred = readPreferredLanguage();
    if (preferred !== DEFAULT_LANGUAGE) {
      setLangState(preferred);
    }
    // Intentionally only on mount — this resolves the initial value once;
    // subsequent changes go through setLang below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    writeLanguageCookie(next);
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
