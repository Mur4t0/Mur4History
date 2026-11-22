"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Globe2 } from "lucide-react";
import {
  type AppLocale,
  DOCUMENT_TITLES,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  resolvePreferredLocale,
} from "@/lib/i18n";

interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => undefined,
  toggleLocale: () => undefined,
});

function persistLocaleToBrowser(locale: AppLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore
  }
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.title = DOCUMENT_TITLES[locale];

  const sessionMatch = window.location.pathname.match(/^\/session\/([^/?#]+)/);
  void fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locale,
      ...(sessionMatch?.[1] ? { sessionId: sessionMatch[1] } : {}),
    }),
  }).catch(() => undefined);
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    let resolved: AppLocale | null = null;
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "tr" || saved === "en") {
        resolved = saved;
      }
    } catch {
      // Ignore
    }

    if (!resolved) {
      // Check navigator.language strictly on first visit if SSR didn't match client navigator
      const navLang =
        navigator.languages?.[0] || navigator.language || initialLocale;
      resolved = resolvePreferredLocale(navLang);
    }

    setLocaleState(resolved);
    persistLocaleToBrowser(resolved);
  }, [initialLocale]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    persistLocaleToBrowser(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: AppLocale = prev === "tr" ? "en" : "tr";
      persistLocaleToBrowser(next);
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLocale() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={locale === "tr" ? "Dil seçimi" : "Language selector"}
      className={`inline-flex items-center rounded-lg border border-white/15 bg-[#0c111b] p-0.5 text-[11px] font-semibold ${className}`}
    >
      {!compact && (
        <Globe2 className="mx-1.5 h-3.5 w-3.5 text-slate-400" />
      )}
      <button
        type="button"
        data-testid="lang-btn-tr"
        onClick={() => setLocale("tr")}
        className={`cursor-pointer rounded-md px-2 py-0.5 transition ${
          locale === "tr"
            ? "bg-primary text-black shadow-sm"
            : "text-slate-400 hover:text-white"
        }`}
      >
        TR
      </button>
      <button
        type="button"
        data-testid="lang-btn-en"
        onClick={() => setLocale("en")}
        className={`cursor-pointer rounded-md px-2 py-0.5 transition ${
          locale === "en"
            ? "bg-primary text-black shadow-sm"
            : "text-slate-400 hover:text-white"
        }`}
      >
        EN
      </button>
    </div>
  );
}
