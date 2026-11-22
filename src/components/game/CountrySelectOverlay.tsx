"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Compass,
  Crown,
  Shield,
  Swords,
  TrendingUp,
} from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CountryRecord } from "@/lib/client-types";
import { getCountryDisplayName } from "@/lib/i18n";

interface CountrySelectOverlayProps {
  sessionId: string;
  countries: CountryRecord[];
  previewCountryCode: string | null;
  onPreviewCountry: (code: string) => void;
  onConfirmed: () => void;
}

export function CountrySelectOverlay({
  sessionId,
  countries,
  previewCountryCode,
  onPreviewCountry,
  onConfirmed,
}: CountrySelectOverlayProps) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [confirming, setConfirming] = useState(false);

  const majorCountries = countries.filter((c) => c.isMajor);
  const previewCountry =
    countries.find((c) => c.code === previewCountryCode) ??
    majorCountries[0] ??
    countries[0];

  const handleConfirm = async () => {
    if (!previewCountry) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerCountryCode: previewCountry.code }),
      });
      if (res.ok) {
        onConfirmed();
      }
    } finally {
      setConfirming(false);
    }
  };

  const previewName = previewCountry
    ? getCountryDisplayName(previewCountry.code, previewCountry.name, locale)
    : "";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 lg:flex-row lg:items-start">
      {/* Left Card: Major Powers quick picker */}
      <div className="pointer-events-auto flex max-h-[76vh] w-full flex-col rounded-xl border border-primary/40 bg-[#0b1019]/92 p-4 shadow-2xl backdrop-blur-md lg:w-96">
        <div className="flex items-center gap-2 text-primary">
          <Compass className="h-5 w-5" />
          <h2 className="font-serif text-lg font-bold">
            {isEn ? "Choose Your Nation" : "Oynanacak Ülkeyi Seçin"}
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isEn
            ? "Click any country directly on the map or pick a major power below."
            : "Doğrudan haritadaki herhangi bir ülkeye tıklayın veya aşağıdaki büyük güçlerden birini seçin."}
        </p>

        <ScrollArea className="mt-3 flex-1 pr-2">
          <div className="space-y-2">
            {majorCountries.map((c) => {
              const selected = previewCountry?.code === c.code;
              const cname = getCountryDisplayName(c.code, c.name, locale);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onPreviewCountry(c.code)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg border p-2.5 text-left transition ${
                    selected
                      ? "border-primary bg-primary/15"
                      : "border-border/80 bg-secondary/40 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.flagEmoji}</span>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {cname}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.leader} • {c.ideology}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-emerald-400">E:{c.economy}</span>
                    <span className="text-rose-400">
                      {isEn ? "M" : "O"}:{c.military}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right Confirm Banner */}
      {previewCountry && (
        <div className="pointer-events-auto mt-3 w-full rounded-xl border border-primary/50 bg-[#0b1019]/95 p-4 shadow-2xl backdrop-blur-md lg:mt-0 lg:w-88">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary text-3xl">
              {previewCountry.flagEmoji}
            </span>
            <div>
              <Badge>
                {isEn ? "SELECTED NATION" : "SEÇİLİ ÜLKE"} • {previewCountry.code}
              </Badge>
              <h3 className="mt-1 font-serif text-lg font-bold text-foreground">
                {previewName}
              </h3>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-primary" />{" "}
                {isEn ? "Leader:" : "Lider:"}
              </span>
              <span className="font-medium text-foreground">
                {previewCountry.leader}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />{" "}
                {isEn ? "Economy:" : "Ekonomi:"}
              </span>
              <span className="font-mono text-foreground">
                {previewCountry.economy} / 100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Swords className="h-3.5 w-3.5 text-rose-400" />{" "}
                {isEn ? "Military:" : "Askeri Güç:"}
              </span>
              <span className="font-mono text-foreground">
                {previewCountry.military} / 100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-sky-400" />{" "}
                {isEn ? "Stability:" : "İstikrar:"}
              </span>
              <span className="font-mono text-foreground">
                {isEn
                  ? `${previewCountry.stability}%`
                  : `%${previewCountry.stability}`}
              </span>
            </div>
          </div>

          {previewCountry.description && (
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {previewCountry.description}
            </p>
          )}

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={confirming}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="h-4 w-4" />
            {confirming
              ? isEn
                ? "Opening Command Center..."
                : "Komuta Merkezi Açılıyor..."
              : isEn
                ? `Start as ${previewName}`
                : `${previewName} ile Başla`}
          </Button>
        </div>
      )}
    </div>
  );
}
