"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  formatGameDateByLocale,
  getDifficultyDisplay,
  getScenarioDisplay,
} from "@/lib/i18n";
import { DIFFICULTY_META, getScenarioCoverUrl } from "@/lib/utils";

export interface LobbyScenarioItem {
  id: string;
  slug: string;
  title: string;
  era: string;
  startDate: string;
  turnIntervalMonths: number;
  description: string;
  isPreset: boolean;
}

interface LaunchScenarioModalProps {
  scenario: LobbyScenarioItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  error: string | null;
  onLaunch: (params: {
    scenarioId: string;
    difficulty: string;
    campaignName: string;
  }) => Promise<void>;
}

export function LaunchScenarioModal({
  scenario,
  open,
  onOpenChange,
  creating,
  error,
  onLaunch,
}: LaunchScenarioModalProps) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [difficulty, setDifficulty] = useState("NORMAL");
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    if (open) {
      setCampaignName("");
    }
  }, [open, scenario?.id]);

  if (!scenario) return null;

  const scenDisplay = getScenarioDisplay(scenario, locale);
  const diffDisplay = getDifficultyDisplay(
    difficulty,
    locale,
    DIFFICULTY_META[difficulty]
  );
  const coverUrl =
    getScenarioCoverUrl(scenario.id) || getScenarioCoverUrl(scenario.slug);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl overflow-hidden border-white/15 bg-[#090c14] p-0">
        {/* Scenario Cover Header */}
        <div className="relative h-44 w-full overflow-hidden border-b border-white/10">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={scenDisplay.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,_#2a1b4e,_#090d16_70%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090c14] via-[#090c14]/65 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                {scenDisplay.era}
              </div>
              <h3 className="font-serif text-2xl font-bold text-white">
                {scenDisplay.title}
              </h3>
            </div>
            <Badge
              variant="outline"
              className="border-white/20 bg-black/50 text-white"
            >
              <Calendar className="h-3 w-3 text-amber-300" />
              {formatGameDateByLocale(scenario.startDate, locale)} •{" "}
              {isEn
                ? `1 Turn = ${scenario.turnIntervalMonths} Mo`
                : `1 Tur = ${scenario.turnIntervalMonths} Ay`}
            </Badge>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <ModalHeader className="space-y-1">
            <ModalTitle className="text-base text-white">
              {isEn
                ? "Campaign Settings & Difficulty"
                : "Kampanya Ayarları & Zorluk Modu"}
            </ModalTitle>
            <ModalDescription className="text-xs leading-relaxed text-slate-300">
              {scenDisplay.description}
            </ModalDescription>
          </ModalHeader>

          {/* 5-Tier Difficulty Selector */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-amber-300">
                {isEn
                  ? "Difficulty (AI Treaty Acceptance & Resistance):"
                  : "Zorluk Modu (AI Antlaşma Kabulü & Direnci):"}
              </span>
              <span className="text-[11px] text-slate-400">
                {isEn ? "Acceptance Rate:" : "Kabul Oranı:"}{" "}
                {diffDisplay.treatyAcceptRate}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                ["VERY_EASY", "EASY", "NORMAL", "HARD", "IMPOSSIBLE"] as const
              ).map((lvl) => {
                const meta = getDifficultyDisplay(
                  lvl,
                  locale,
                  DIFFICULTY_META[lvl]
                );
                const selected = difficulty === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-2 text-left transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/15 ring-1 ring-amber-400/40"
                        : "border-white/10 bg-white/[0.03] hover:border-white/30"
                    }`}
                  >
                    <div className="text-xs font-bold text-white">
                      {meta.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {meta.treatyAcceptRate}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              {diffDisplay.shortDesc}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="launch-campaign-name"
              className="text-xs font-medium text-slate-300"
            >
              {isEn ? "Campaign Name (Optional)" : "Kampanya Adı (Opsiyonel)"}
            </label>
            <Input
              id="launch-campaign-name"
              placeholder={
                isEn
                  ? `e.g. ${scenDisplay.title} • New Campaign`
                  : `Örn: ${scenDisplay.title} • Yeni Hikaye`
              }
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {isEn
                  ? "100% Free MCP • Opens nation selector"
                  : "%100 Ücretsiz MCP • Ülke seçim ekranına geçer"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {isEn ? "Cancel" : "Vazgeç"}
              </Button>
              <Button
                type="button"
                disabled={creating}
                onClick={() =>
                  void onLaunch({
                    scenarioId: scenario.id,
                    difficulty,
                    campaignName,
                  })
                }
                className="bg-white font-semibold text-black hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                {creating
                  ? isEn
                    ? "Building Map..."
                    : "Harita Kuruluyor..."
                  : isEn
                    ? "Start Session & Pick Nation"
                    : "Oturumu Başlat & Ülke Seç"}
              </Button>
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
