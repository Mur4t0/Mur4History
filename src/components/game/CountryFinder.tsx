"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, MapPin, Search, Sparkles, X } from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import type { CountryRecord, RegionRecord } from "@/lib/client-types";
import { getCountryDisplayName } from "@/lib/i18n";

interface CountryFinderProps {
  countries: CountryRecord[];
  regions: RegionRecord[];
  playerCountryCode: string | null;
  activeHighlightCode: string | null;
  onSelectCountry: (countryCode: string) => void;
}

/** Normalize Turkish/Latin diacritics so ascii searches (e.g. "turkiye", "cin") match cleanly. */
function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function CountryFinder({
  countries,
  regions,
  playerCountryCode,
  activeHighlightCode,
  onSelectCountry,
}: CountryFinderProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const provinceCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of regions) {
      map.set(r.ownerCountryCode, (map.get(r.ownerCountryCode) ?? 0) + 1);
    }
    return map;
  }, [regions]);

  const survivingCountries = useMemo(
    () =>
      countries
        .filter((c) => (provinceCountByCode.get(c.code) ?? 0) > 0)
        .map((c) => {
          const localizedName = getCountryDisplayName(c.code, c.name, locale);
          return {
            country: c,
            localizedName,
            provinces: provinceCountByCode.get(c.code) ?? 0,
            normCode: normalizeSearchText(c.code),
            normLocal: normalizeSearchText(localizedName),
            normRaw: normalizeSearchText(c.name),
            normLeader: normalizeSearchText(c.leader),
          };
        }),
    [countries, provinceCountByCode, locale]
  );

  const results = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    if (!q) {
      return [...survivingCountries]
        .sort((a, b) => {
          if (a.country.code === playerCountryCode) return -1;
          if (b.country.code === playerCountryCode) return 1;
          if (a.country.isMajor !== b.country.isMajor) {
            return a.country.isMajor ? -1 : 1;
          }
          return b.provinces - a.provinces;
        })
        .slice(0, 8);
    }

    const scored: Array<{
      item: (typeof survivingCountries)[number];
      score: number;
    }> = [];
    for (const item of survivingCountries) {
      let score = -1;
      if (item.normCode === q || item.normLocal === q || item.normRaw === q) {
        score = 100;
      } else if (
        item.normLocal.startsWith(q) ||
        item.normRaw.startsWith(q) ||
        item.normCode.startsWith(q)
      ) {
        score = 80;
      } else if (item.normLocal.includes(q) || item.normRaw.includes(q)) {
        score = 60;
      } else if (item.normLeader.includes(q)) {
        score = 40;
      }
      if (score >= 0) {
        if (item.country.isMajor) score += 4;
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.provinces - a.item.provinces;
    });
    return scored.slice(0, 9).map((s) => s.item);
  }, [query, survivingCountries, playerCountryCode]);

  useEffect(() => {
    setHighlightedIdx(0);
  }, [query, results.length]);

  // Global keyboard shortcut: Ctrl+K or '/' focuses the country finder cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (!inEditable && e.key === "/") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const activeHighlightCountry = useMemo(() => {
    if (!activeHighlightCode) return null;
    return (
      survivingCountries.find((c) => c.country.code === activeHighlightCode) ??
      null
    );
  }, [activeHighlightCode, survivingCountries]);

  const handlePickCountry = (code: string) => {
    onSelectCountry(code);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="country-finder"
      className="pointer-events-auto relative w-64 sm:w-80"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-border/90 bg-[#090e18]/92 px-3 py-1.5 text-xs shadow-2xl backdrop-blur-md transition focus-within:border-amber-400/75 focus-within:ring-2 focus-within:ring-amber-400/25">
        <Search className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          data-testid="country-finder-input"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlightedIdx((prev) =>
                results.length > 0 ? (prev + 1) % results.length : 0
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setHighlightedIdx((prev) =>
                results.length > 0
                  ? (prev - 1 + results.length) % results.length
                  : 0
              );
            } else if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              const chosen = results[highlightedIdx] ?? results[0];
              if (chosen) handlePickCountry(chosen.country.code);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          placeholder={
            isTr
              ? "Haritada ülke bul (örn: Brezilya, TUR)..."
              : "Find nation on map (e.g. Brazil, TUR)..."
          }
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            title={isTr ? "Temizle" : "Clear"}
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-border/80 bg-secondary/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:inline-block">
            Ctrl+K
          </kbd>
        )}
      </div>

      {activeHighlightCountry && !open && (
        <div
          data-testid="country-finder-glow-badge"
          className="mt-1.5 flex items-center justify-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-[#141106]/92 px-3 py-1 text-[11px] font-semibold text-amber-200 shadow-lg backdrop-blur-md">
            <Sparkles className="h-3 w-3 animate-pulse text-amber-300" />
            <span>
              {activeHighlightCountry.country.flagEmoji}{" "}
              {activeHighlightCountry.localizedName}
            </span>
            <span className="text-[10px] text-amber-300/80">
              • {isTr ? "Haritada vurgulanıyor (5sn)" : "Highlighted on map (5s)"}
            </span>
          </span>
        </div>
      )}

      {open && (
        <div
          data-testid="country-finder-dropdown"
          className="mt-1.5 overflow-hidden rounded-2xl border border-border/90 bg-[#090f1b]/96 shadow-2xl backdrop-blur-xl"
        >
          {results.length === 0 ? (
            <div className="px-3.5 py-3 text-center text-[11px] text-muted-foreground">
              {isTr
                ? "Haritada eşleşen hayatta ülke bulunamadı."
                : "No matching active nation found on the map."}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.map((entry, idx) => {
                const isSelected = idx === highlightedIdx;
                const isPlayer = entry.country.code === playerCountryCode;
                return (
                  <button
                    key={entry.country.code}
                    type="button"
                    data-testid={`country-finder-option-${entry.country.code}`}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => handlePickCountry(entry.country.code)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/45"
                        : "text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-base shrink-0">
                        {entry.country.flagEmoji}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">
                            {entry.localizedName}
                          </span>
                          <span className="rounded bg-secondary/80 px-1 py-0.2 font-mono text-[9px] text-muted-foreground">
                            {entry.country.code}
                          </span>
                          {isPlayer && (
                            <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[9px] font-bold text-sky-300">
                              {isTr ? "SİZ" : "YOU"}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {entry.country.leader}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-amber-300">
                      <span className="font-mono text-muted-foreground">
                        {entry.provinces}{" "}
                        {isTr ? "eyalet" : "prov."}
                      </span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10">
                        <MapPin className="h-3 w-3 text-amber-300" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border/60 bg-[#070b14] px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Compass className="h-3 w-3 text-amber-400" />
              {isTr
                ? "Ülkeye ışınlanır ve 5 saniye parlatır"
                : "Teleports camera & glows borders for 5s"}
            </span>
            <span className="font-mono">{survivingCountries.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
