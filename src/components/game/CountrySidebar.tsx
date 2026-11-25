"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LanguageProvider";
import { getCountryDisplayName } from "@/lib/i18n";
import {
  findNuclearPartners,
  isTreatyEligibleForNuclearSharing,
} from "@/lib/nuclear-doctrine";
import {
  evaluateWarAttackReadiness,
  getCountryBlocsAndPacts,
} from "@/lib/geopolitics";
import {
  computeCountryDemographics,
  getRegionDemographics,
} from "@/lib/demographics";

import {
  Bomb,
  Coins,
  Crown,
  Eraser,
  Flame,
  Landmark,
  MapPin,
  MessageSquare,
  Radiation,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  CountryRecord,
  DiplomacyRecord,
  MapMarkerRecord,
  RegionRecord,
  WarRiskSummary,
} from "@/lib/client-types";

interface CountrySidebarProps {
  country: CountryRecord | null;
  playerCountryCode: string | null;
  selectedRegion: RegionRecord | null;
  allCountries: CountryRecord[];
  regions: RegionRecord[];
  diplomacies: DiplomacyRecord[];
  mapMarkers?: MapMarkerRecord[];
  warRiskWithPlayer?: WarRiskSummary | null;
  onFocusPlayerCountry: () => void;
  onQuickDiplomacy: (targetCode: string) => void;
  onOpenLeaderChat: (targetCode: string) => void;
  onInspectCountry: (code: string) => void;
  onFocusMarker?: (marker: MapMarkerRecord) => void;
  onQuickWarAction?: (params: {
    mode: "provoke" | "launch_operation" | "nuclear_strike";
    actionType?: string;
    operationType?: string;
    targetCode: string;
    targetRegionId?: string;
  }) => Promise<void> | void;
  onRequestNuclearSharing?: (patronCode?: string) => void;
  onOpenWarMeddle?: (targetCode: string) => void;
  onConvenePeaceCouncil?: (targetCode: string) => void;
  onCleanCountryMarkers?: (targetCode: string) => Promise<void> | void;
  scenarioKey?: string | null;
  currentDate?: string | null;
  currentTurn?: number;
}

const DIPLO_BADGE: Record<
  string,
  {
    labelTr: string;
    labelEn: string;
    variant: "destructive" | "success" | "warning" | "default" | "secondary";
  }
> = {
  WAR: { labelTr: "SAVAŞ", labelEn: "WAR", variant: "destructive" },
  ALLIANCE: { labelTr: "İTTİFAK", labelEn: "ALLIANCE", variant: "success" },
  NON_AGGRESSION: {
    labelTr: "SALDIRMAZLIK",
    labelEn: "NON-AGGRESSION",
    variant: "default",
  },
  VASSAL: { labelTr: "VASAL", labelEn: "VASSAL", variant: "secondary" },
  EMBARGO: { labelTr: "AMBARGO", labelEn: "EMBARGO", variant: "warning" },
  NEUTRAL: { labelTr: "TARAFSIZ", labelEn: "NEUTRAL", variant: "secondary" },
};

const STRATEGIC_STATUS_LABEL: Record<string, { tr: string; en: string }> = {
  CAPITAL: { tr: "Başkent", en: "Capital" },
  CORE: { tr: "Çekirdek", en: "Core" },
  FRONTIER: { tr: "Sınır", en: "Frontier" },
  OCCUPIED: { tr: "İşgal Altında", en: "Occupied" },
  CONTESTED: { tr: "Çekişmeli (İsyan)", en: "Contested (Unrest)" },
  FORTIFIED: { tr: "Müstahkem", en: "Fortified" },
  ECONOMIC_HUB: { tr: "Ekonomi Merkezi", en: "Economic Hub" },
  STANDARD: { tr: "Standart", en: "Standard" },
};

const MARKER_CAT_LABEL: Record<string, { tr: string; en: string }> = {
  MILITARY: { tr: "ASKERİ", en: "MILITARY" },
  INDUSTRY: { tr: "SANAYİ", en: "INDUSTRY" },
  INFRASTRUCTURE: { tr: "ALTYAPI", en: "INFRASTRUCTURE" },
  NAVAL: { tr: "DENİZ", en: "NAVAL" },
  RESEARCH: { tr: "AR-GE", en: "RESEARCH" },
  DIPLOMACY: { tr: "DİPLOMASİ", en: "DIPLOMACY" },
  INTERNAL: { tr: "İÇ POLİTİKA", en: "INTERNAL" },
  CRISIS: { tr: "KRİZ", en: "CRISIS" },
};

function StatBar({
  label,
  value,
  icon,
  barClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  barClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-mono font-semibold text-foreground">
          {value} / 100
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function CountrySidebar({
  country,
  playerCountryCode,
  selectedRegion,
  allCountries,
  regions,
  diplomacies,
  mapMarkers = [],
  warRiskWithPlayer = null,
  onFocusPlayerCountry,
  onQuickDiplomacy,
  onOpenLeaderChat,
  onInspectCountry,
  onFocusMarker,
  onQuickWarAction,
  onRequestNuclearSharing,
  onOpenWarMeddle,
  onConvenePeaceCouncil,
  onCleanCountryMarkers,
  scenarioKey,
  currentDate,
  currentTurn = 1,
}: CountrySidebarProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const [warBusy, setWarBusy] = useState(false);
  const [confirmSidebarNuke, setConfirmSidebarNuke] = useState(false);

  useEffect(() => {
    setConfirmSidebarNuke(false);
  }, [country?.code, selectedRegion?.regionId]);

  if (!country) {
    return (
      <aside className="flex h-full w-full flex-col justify-center p-4 text-center text-xs text-muted-foreground">
        {isTr
          ? "Ülke istatistiklerini görmek için haritadan bir bölgeye tıklayın."
          : "Click any region on the map to inspect nation statistics."}
      </aside>
    );
  }

  const ownedRegions = regions.filter(
    (r) => r.ownerCountryCode === country.code
  );
  const countryDemographics = computeCountryDemographics({
    ownedRegions,
    gameDate: currentDate,
    locale,
  });
  const selectedRegionDemographics = selectedRegion
    ? getRegionDemographics({
        regionId: selectedRegion.regionId,
        regionName: selectedRegion.regionName,
        baseValue: selectedRegion.baseValue,
        gameDate: currentDate,
        locale,
      })
    : null;
  const survivingCountryCodes = new Set(
    regions.map((r) => r.ownerCountryCode)
  );
  const isEliminated = ownedRegions.length === 0;
  const countryMarkers = mapMarkers.filter(
    (m) => m.countryCode === country.code
  );
  const countryMap = new Map(allCountries.map((c) => [c.code, c]));
  const isPlayerCountry = country.code === playerCountryCode;
  const countryWarheads = country.nuclearWarheads ?? 0;
  const playerWarheads = playerCountryCode
    ? (countryMap.get(playerCountryCode)?.nuclearWarheads ?? 0)
    : 0;
  const activeAllCountries = allCountries.filter((c) =>
    survivingCountryCodes.has(c.code)
  );
  const nuclearPartners = findNuclearPartners(
    playerCountryCode,
    activeAllCountries,
    diplomacies
  );
  const eligibleNuclearPatron = nuclearPartners.find((p) => p.eligible) ?? null;
  const playerRelationWithInspected = playerCountryCode
    ? diplomacies.find(
        (d) =>
          (d.countryA === playerCountryCode && d.countryB === country.code) ||
          (d.countryB === playerCountryCode && d.countryA === country.code)
      )
    : undefined;
  const canAskInspectedCountryForNuke =
    !isPlayerCountry &&
    !isEliminated &&
    countryWarheads > 1 &&
    isTreatyEligibleForNuclearSharing(playerRelationWithInspected);

  const warReadiness = evaluateWarAttackReadiness({
    currentTurn,
    relation: playerRelationWithInspected,
    targetName: getCountryDisplayName(country.code, country.name, locale),
    locale,
  });

  const relations = isEliminated
    ? []
    : diplomacies.filter(
        (d) =>
          (d.countryA === country.code || d.countryB === country.code) &&
          d.status !== "NEUTRAL" &&
          survivingCountryCodes.has(d.countryA) &&
          survivingCountryCodes.has(d.countryB)
      );

  const countryBlocs = getCountryBlocsAndPacts({
    countryCode: country.code,
    scenarioKey,
    currentDate,
    diplomacies,
    locale,
  });

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-border/80 bg-[#0b1019]/90 backdrop-blur-md">
      {/* Header */}
      <div className="border-b border-border/70 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/70 text-2xl">
              {country.flagEmoji}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif text-base font-bold leading-tight text-foreground">
                  {getCountryDisplayName(country.code, country.name, locale)}
                </h2>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-white/30"
                  style={{ backgroundColor: country.color }}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {country.code}
                </span>
                {isPlayerCountry && (
                  <Badge variant="default">
                    {isTr ? "SİZİN ÜLKENİZ" : "YOUR NATION"}
                  </Badge>
                )}
                {isEliminated && (
                  <Badge variant="destructive" data-testid="sidebar-eliminated-badge">
                    {isTr ? "HARİTADAN SİLİNDİ (0 EYALET)" : "ELIMINATED (0 PROVINCES)"}
                  </Badge>
                )}
              </div>
              {countryBlocs.length > 0 && (
                <div
                  data-testid="sidebar-country-blocs"
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {countryBlocs.map((b) => (
                    <span
                      key={b.id}
                      title={b.label}
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-tight ${b.colorClass}`}
                    >
                      <Shield className="h-2.5 w-2.5" />
                      {b.shortLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isPlayerCountry && playerCountryCode && !isEliminated && (
          <div className="mt-3 space-y-1.5">
            <Button
              size="sm"
              className="w-full text-[11px]"
              onClick={() => onOpenLeaderChat(country.code)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {isTr
                ? `Başkanla Görüş (${country.leader})`
                : `Meet Leader (${country.leader})`}
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-[11px]"
                onClick={onFocusPlayerCountry}
              >
                {isTr
                  ? `Ülkeme Dön (${playerCountryCode})`
                  : `My Nation (${playerCountryCode})`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-[11px]"
                onClick={() => onQuickDiplomacy(country.code)}
              >
                {isTr ? "Nota Yaz" : "Send Note"}
              </Button>
            </div>
          </div>
        )}
        {isEliminated && (
          <div
            data-testid="sidebar-eliminated-notice"
            className="mt-3 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200"
          >
            {isTr
              ? "Bu devlet tamamen fethedildiği veya başka bir ülkeye katıldığı için diplomatik hatları ve orduları lağvedilmiştir."
              : "This nation has been annexed/eliminated from the map; all diplomatic channels and active armies have been dissolved."}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-w-0">
        <div className="space-y-4 p-4 pr-3.5">
          {/* War Risk & Instant Provocation / Strike Console for Foreign Countries */}
          {!isPlayerCountry && playerCountryCode && warRiskWithPlayer && !isEliminated && (
            <div
              data-testid="sidebar-war-risk-card"
              className="space-y-2.5 rounded-lg border border-rose-500/35 bg-gradient-to-br from-rose-950/30 via-[#101624] to-[#0b1019] p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-rose-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {isTr ? "Savaş Çıkma Olasılığı" : "War Outbreak Risk"}
                </span>
                <Badge
                  variant={
                    warRiskWithPlayer.probability >= 70
                      ? "destructive"
                      : warRiskWithPlayer.probability >= 45
                        ? "warning"
                        : "default"
                  }
                >
                  {isTr
                    ? `%${warRiskWithPlayer.probability}`
                    : `${warRiskWithPlayer.probability}%`}
                </Badge>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-500 to-red-600 transition-all duration-500"
                  style={{ width: `${warRiskWithPlayer.probability}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {warRiskWithPlayer.factors.map((f) => (
                  <span
                    key={f}
                    className="rounded border border-white/10 bg-black/35 px-1.5 py-0.5 text-[10px] text-slate-300"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {onQuickWarAction && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={warBusy}
                    onClick={async () => {
                      setWarBusy(true);
                      try {
                        await onQuickWarAction({
                          mode: "provoke",
                          actionType: "BORDER_SKIRMISH",
                          targetCode: country.code,
                          targetRegionId: selectedRegion?.regionId,
                        });
                      } finally {
                        setWarBusy(false);
                      }
                    }}
                    className="h-7 border-amber-500/40 text-[10px] text-amber-300 hover:bg-amber-500/15"
                  >
                    <Flame className="h-3 w-3" />
                    {isTr ? "Kışkırt / Sınır" : "Skirmish"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={warBusy}
                    title={
                      isTr
                        ? "Gizli elçi gönderip halkı kışkırtır; maliyet, karşı istihbarat yakalanma riski ve sıkıyönetim engeli zorluğa göre ölçeklenir (toprak ilhakı yapmaz)"
                        : "Dispatches covert envoys to erode stability; cost, counter-intel risk & martial-law blocks scale by difficulty (does not annex land)"
                    }
                    onClick={async () => {
                      setWarBusy(true);
                      try {
                        await onQuickWarAction({
                          mode: "provoke",
                          actionType: "SPONSOR_REBELS",
                          targetCode: country.code,
                          targetRegionId: selectedRegion?.regionId,
                        });
                      } finally {
                        setWarBusy(false);
                      }
                    }}
                    className="h-7 border-purple-500/45 text-[10px] text-purple-300 hover:bg-purple-500/15"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isTr ? "Elçi & İsyan" : "Send Envoys"}
                  </Button>

                  {warReadiness.reasonCode === "NO_WAR_DECLARED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="sidebar-declare-war-btn"
                      disabled={warBusy}
                      title={
                        isTr
                          ? "Resmi savaş ilan eder ve müttefikleri uyarır; birlikler 1 tur seferberlik sonrası (sonraki tur) kuşatma başlatabilir"
                          : "Declares formal war and alerts alliances; forces must wait 1 turn of mobilization before launching sieges"
                      }
                      onClick={async () => {
                        setWarBusy(true);
                        try {
                          await onQuickWarAction({
                            mode: "provoke",
                            actionType: "DECLARE_WAR",
                            targetCode: country.code,
                            targetRegionId: selectedRegion?.regionId,
                          });
                        } finally {
                          setWarBusy(false);
                        }
                      }}
                      className="h-7 border-rose-500/60 bg-rose-950/35 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/25"
                    >
                      <Swords className="h-3 w-3" />
                      {isTr ? "Savaş İlan Et" : "Declare War"}
                    </Button>
                  ) : warReadiness.reasonCode === "MOBILIZING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="sidebar-mobilizing-btn"
                      disabled={warBusy}
                      title={warReadiness.message}
                      onClick={async () => {
                        setWarBusy(true);
                        try {
                          await onQuickWarAction({
                            mode: "launch_operation",
                            operationType: "TANK_BLITZ",
                            targetCode: country.code,
                            targetRegionId: selectedRegion?.regionId,
                          });
                        } finally {
                          setWarBusy(false);
                        }
                      }}
                      className="h-7 border-amber-500/50 bg-amber-950/35 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
                    >
                      <Swords className="h-3 w-3" />
                      {isTr
                        ? `Seferber (Tur ${warReadiness.unlockTurn})`
                        : `Mobilizing (T${warReadiness.unlockTurn})`}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="sidebar-tank-blitz-btn"
                      disabled={warBusy}
                      title={warReadiness.message}
                      onClick={async () => {
                        setWarBusy(true);
                        try {
                          await onQuickWarAction({
                            mode: "launch_operation",
                            operationType: "TANK_BLITZ",
                            targetCode: country.code,
                            targetRegionId: selectedRegion?.regionId,
                          });
                        } finally {
                          setWarBusy(false);
                        }
                      }}
                      className="h-7 border-rose-500/45 text-[10px] text-rose-300 hover:bg-rose-500/15"
                    >
                      <Swords className="h-3 w-3" />
                      {isTr ? "Kuşat / Tank Sür" : "Tank Blitz"}
                    </Button>
                  )}

                  {onOpenWarMeddle && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenWarMeddle(country.code)}
                      className="h-7 border-sky-500/40 text-[10px] text-sky-300 hover:bg-sky-500/15"
                    >
                      <Flame className="h-3 w-3" />
                      {isTr ? "Birbirine Düşür" : "Incite War"}
                    </Button>
                  )}

                  {warRiskWithPlayer.status === "WAR" && onConvenePeaceCouncil && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="sidebar-peace-council-btn"
                      onClick={() => onConvenePeaceCouncil(country.code)}
                      className="col-span-2 h-7 border-emerald-500/50 bg-emerald-950/25 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Users className="h-3 w-3" />
                      {isTr
                        ? "Savaşı Bitirmek İçin Barış Konseyi Topla"
                        : "Convene Peace Council to End War"}
                    </Button>
                  )}

                  {playerWarheads <= 0 ? (
                    <div className="col-span-2 space-y-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        data-testid="sidebar-nuke-locked-btn"
                        className="h-7 w-full border-red-500/25 bg-red-950/15 text-[10px] text-red-300/60"
                      >
                        <Radiation className="h-3 w-3" />
                        {isTr
                          ? "Nükleer Füze Kilitli (0 Başlık)"
                          : "Nuclear Strike Locked (0 Warheads)"}
                      </Button>
                      {onRequestNuclearSharing && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="sidebar-request-nuke-btn"
                          onClick={() =>
                            onRequestNuclearSharing(
                              canAskInspectedCountryForNuke
                                ? country.code
                                : eligibleNuclearPatron?.code ??
                                    nuclearPartners[0]?.code
                            )
                          }
                          className="h-7 w-full border-amber-500/45 bg-amber-950/25 text-[10px] text-amber-300 hover:bg-amber-500/20"
                        >
                          <Radiation className="h-3 w-3" />
                          {canAskInspectedCountryForNuke
                            ? isTr
                              ? `Antlaşmayla ${country.code}'dan Nükleer İste`
                              : `Request Nuclear Sharing from ${country.code}`
                            : eligibleNuclearPatron
                              ? isTr
                                ? `Müttefik ${eligibleNuclearPatron.code}'dan Nükleer İste`
                                : `Ask Ally ${eligibleNuclearPatron.code} for Nukes`
                              : isTr
                                ? "Nükleer Güçle Antlaşma Görüş"
                                : "Negotiate Nuclear Treaty"}
                        </Button>
                      )}
                    </div>
                  ) : confirmSidebarNuke ? (
                    <Button
                      size="sm"
                      disabled={warBusy}
                      onClick={async () => {
                        setWarBusy(true);
                        setConfirmSidebarNuke(false);
                        try {
                          await onQuickWarAction({
                            mode: "nuclear_strike",
                            targetCode: country.code,
                            targetRegionId: selectedRegion?.regionId,
                          });
                        } finally {
                          setWarBusy(false);
                        }
                      }}
                      className="col-span-2 h-7 bg-red-600 text-[10px] font-bold text-white hover:bg-red-500"
                    >
                      <Radiation className="h-3.5 w-3.5 animate-spin" />
                      {isTr
                        ? `ONAYLA: ${selectedRegion?.regionName ?? country.code} Nükleer Vur! (${playerWarheads} Başlık)`
                        : `CONFIRM NUKING ${selectedRegion?.regionName ?? country.code}! (${playerWarheads} Left)`}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={warBusy}
                      onClick={() => setConfirmSidebarNuke(true)}
                      className="col-span-2 h-7 border-red-500/50 bg-red-950/35 text-[10px] text-red-300 hover:bg-red-900/50"
                    >
                      <Bomb className="h-3 w-3" />
                      {isTr
                        ? `Nükleer Füze Fırlat (${playerWarheads} Başlık)`
                        : `Launch Nuclear Strike (${playerWarheads} Left)`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Leader & Ideology */}
          <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/35 p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Crown className="h-3.5 w-3.5 text-primary" />
                {isTr ? "Lider" : "Leader"}
              </span>
              <span className="min-w-0 break-words text-right font-semibold text-foreground">
                {country.leader}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Landmark className="h-3.5 w-3.5 text-primary" />
                {isTr ? "İdeoloji" : "Ideology"}
              </span>
              <span className="min-w-0 break-words text-right font-medium text-primary">
                {country.ideology}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 border-t border-border/50 pt-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                {isTr ? "Devlet Hazinesi" : "State Treasury"}
              </span>
              <span className="min-w-0 break-words text-right font-mono font-bold text-amber-300">
                {country.treasury.toLocaleString(isTr ? "tr-TR" : "en-US")}{" "}
                {isTr ? "Bütçe" : "Budget"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-sky-400" />
                {isTr ? "Kontrol Edilen Eyalet" : "Controlled Provinces"}
              </span>
              <span className="shrink-0 font-mono font-semibold text-foreground">
                {ownedRegions.length} {isTr ? "Bölge" : "Regions"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                {isTr ? "Toplam Nüfus" : "Total Population"}
              </span>
              <span
                data-testid="sidebar-population-total"
                className="shrink-0 font-mono font-bold text-emerald-300"
              >
                {countryDemographics.formattedPopulation}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Radiation
                  className={`h-3.5 w-3.5 ${
                    countryWarheads > 0 ? "text-amber-400" : "text-muted-foreground"
                  }`}
                />
                {isTr ? "Nükleer Başlık Stoğu" : "Nuclear Warheads"}
              </span>
              <span
                data-testid="sidebar-nuclear-count"
                className={`shrink-0 font-mono font-bold ${
                  countryWarheads > 0 ? "text-amber-300" : "text-muted-foreground"
                }`}
              >
                {countryWarheads} {isTr ? "Başlık" : "Warheads"}
              </span>
            </div>
          </div>

          {/* Population Composition & Majority People Card */}
          {!isEliminated && countryDemographics.groups.length > 0 && (
            <div
              data-testid="sidebar-demographics-card"
              className="space-y-2.5 rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#0f1623] to-[#0b1019] p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Users className="h-3.5 w-3.5" />
                  {isTr ? "İç Nüfus & Halk Çoğunluğu" : "Population & Majority"}
                </span>
                {countryDemographics.majority && (
                  <Badge
                    variant="secondary"
                    data-testid="sidebar-population-majority"
                    className="border border-emerald-500/40 bg-emerald-500/15 text-[10px] font-bold text-emerald-200"
                  >
                    {isTr
                      ? `Çoğunluk: %${countryDemographics.majority.percent} ${countryDemographics.majority.label}`
                      : `Majority: ${countryDemographics.majority.percent}% ${countryDemographics.majority.label}`}
                  </Badge>
                )}
              </div>

              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                {countryDemographics.groups.map((grp) => (
                  <div
                    key={grp.id}
                    style={{
                      width: `${Math.max(2, grp.percent)}%`,
                      backgroundColor: grp.color,
                    }}
                    title={`${grp.label}: %${grp.percent}`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                {countryDemographics.groups.map((grp, idx) => (
                  <div
                    key={grp.id}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-foreground/90">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: grp.color }}
                      />
                      <span className="truncate font-medium">
                        {grp.label}
                        {idx === 0 && (
                          <span className="ml-1 text-[9px] font-bold text-emerald-300">
                            ({isTr ? "Çoğunluk" : "Majority"})
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      <strong className="text-foreground">
                        {isTr ? `%${grp.percent}` : `${grp.percent}%`}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {country.description && (
            <p className="break-words text-xs leading-relaxed text-muted-foreground">
              {country.description}
            </p>
          )}

          {/* Core Stat Bars */}
          <div className="space-y-3 rounded-lg border border-border/70 bg-secondary/25 p-3">
            <StatBar
              label={isTr ? "Ekonomi Gücü" : "Economic Strength"}
              value={country.economy}
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              barClass="bg-emerald-500"
            />
            <StatBar
              label={isTr ? "Askeri Güç" : "Military Strength"}
              value={country.military}
              icon={<Swords className="h-3.5 w-3.5 text-rose-400" />}
              barClass="bg-rose-500"
            />
            <StatBar
              label={isTr ? "İç İstikrar" : "Internal Stability"}
              value={country.stability}
              icon={<Shield className="h-3.5 w-3.5 text-sky-400" />}
              barClass="bg-sky-500"
            />
            <StatBar
              label={isTr ? "Agresiflik (Infamy)" : "Aggression (Infamy)"}
              value={country.infamy ?? 0}
              icon={<Sparkles className="h-3.5 w-3.5 text-amber-400" />}
              barClass="bg-amber-500"
            />
            <StatBar
              label={isTr ? "Savaş Yorgunluğu" : "War Exhaustion"}
              value={country.warExhaustion ?? 0}
              icon={<Swords className="h-3.5 w-3.5 text-orange-400" />}
              barClass="bg-orange-500"
            />
          </div>

          {/* Clicked Province Details */}
          {selectedRegion && (
            <div className="space-y-1.5 rounded-lg border border-primary/35 bg-primary/5 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {isTr ? "Seçili Eyalet" : "Selected Province"}
                </span>
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-primary">
                  {selectedRegion.regionId}
                </span>
              </div>
              <div className="font-semibold text-foreground">
                {selectedRegion.regionName}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {isTr ? "Statü" : "Status"}:{" "}
                  {STRATEGIC_STATUS_LABEL[selectedRegion.strategicStatus]?.[
                    locale
                  ] ?? selectedRegion.strategicStatus}
                </span>
                <span>
                  {isTr ? "Stratejik Değer" : "Strategic Value"}:{" "}
                  {selectedRegion.baseValue}
                </span>
              </div>
              {selectedRegionDemographics && (
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-primary/20 pt-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono text-emerald-300">
                    {isTr ? "Nüfus" : "Pop"}: {selectedRegionDemographics.formattedPopulation}
                  </span>
                  {selectedRegionDemographics.majority && (
                    <span className="text-foreground/90">
                      {isTr ? "Çoğunluk" : "Majority"}:{" "}
                      <strong>
                        {isTr
                          ? `%${selectedRegionDemographics.majority.percent}`
                          : `${selectedRegionDemographics.majority.percent}%`}{" "}
                        {selectedRegionDemographics.majority.label}
                      </strong>
                    </span>
                  )}
                </div>
              )}
              {selectedRegion.transferReason && (
                <div className="mt-1 rounded bg-secondary/70 p-1.5 text-[11px] text-amber-300">
                  {isTr
                    ? `Son Değişim (Tur ${selectedRegion.lastTransferredTurn ?? 1}):`
                    : `Last Change (Turn ${selectedRegion.lastTransferredTurn ?? 1}):`}{" "}
                  {selectedRegion.transferReason}
                </div>
              )}
            </div>
          )}

          {/* Constructed Facilities & AI Map Landmarks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isTr
                  ? `Kurulan Tesisler & İşaretler (${countryMarkers.length})`
                  : `Facilities & Map Landmarks (${countryMarkers.length})`}
              </h3>
              {onCleanCountryMarkers &&
                countryMarkers.some(
                  (m) =>
                    m.category === "CRISIS" ||
                    m.status === "COMPLETED" ||
                    m.status === "DAMAGED"
                ) && (
                  <button
                    type="button"
                    disabled={warBusy}
                    onClick={async () => {
                      setWarBusy(true);
                      try {
                        await onCleanCountryMarkers(country.code);
                      } finally {
                        setWarBusy(false);
                      }
                    }}
                    title={
                      isTr
                        ? "Fabrika ve askeri üsleri koruyup eski savaş/kriz işaretlerini kaldır"
                        : "Remove stale crisis/war pins while keeping factories & bases"
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/20 cursor-pointer"
                  >
                    <Eraser className="h-3 w-3" />
                    {isTr ? "Temizle" : "Clean"}
                  </button>
                )}
            </div>
            {countryMarkers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                {isTr
                  ? "Bu ülkede henüz harita üzerinde kurulmuş bir tesis veya olay noktası yok. Emir verdiğinizde MCP AI haritada animasyonlu nokta oluşturacaktır."
                  : "No facilities or event landmarks built in this nation yet. When you submit orders, MCP AI places animated landmarks on the map."}
              </div>
            ) : (
              <div className="space-y-1.5">
                {countryMarkers.map((mk) => (
                  <button
                    key={mk.id}
                    type="button"
                    onClick={() => onFocusMarker?.(mk)}
                    className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/70 bg-secondary/35 px-2.5 py-2 text-left text-xs transition hover:border-primary/60 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
                        <span className="truncate">{mk.title}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {mk.cityName ||
                          mk.regionId ||
                          getCountryDisplayName(
                            country.code,
                            country.name,
                            locale
                          )}{" "}
                        • {isTr ? "Svy" : "Lv"} {mk.level}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {MARKER_CAT_LABEL[mk.category]?.[locale] ?? mk.category}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Alliances, Blocs & International Organizations (NATO, Warsaw Pact, EU, BRICS, etc.) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isTr
                ? `Üye Olduğu Paktlar & Birlikler (${countryBlocs.length})`
                : `Blocs, Pacts & Memberships (${countryBlocs.length})`}
            </h3>
            {countryBlocs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                {isTr
                  ? "Bu ülke şu anda NATO, Varşova Paktı veya herhangi bir çok uluslu ittifak bloğuna üye değil (Bağımsız / Tarafsız)."
                  : "This nation is not currently part of NATO, Warsaw Pact, or any major multilateral bloc (Independent / Non-Aligned)."}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/70 bg-secondary/25 p-2.5">
                {countryBlocs.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${b.colorClass}`}
                  >
                    <Shield className="h-3 w-3 shrink-0" />
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diplomatic Relations */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isTr
                ? `Diplomatik İlişkiler (${relations.length})`
                : `Diplomatic Relations (${relations.length})`}
            </h3>
            {relations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                {isTr
                  ? "Aktif savaş, ittifak veya pakt kaydı bulunmuyor."
                  : "No active war, alliance, or pact records."}
              </div>
            ) : (
              <div className="space-y-1.5">
                {relations.map((rel) => {
                  const otherCode =
                    rel.countryA === country.code ? rel.countryB : rel.countryA;
                  const other = countryMap.get(otherCode);
                  const badgeEntry = DIPLO_BADGE[rel.status];
                  const badgeLabel = badgeEntry
                    ? isTr
                      ? badgeEntry.labelTr
                      : badgeEntry.labelEn
                    : rel.status;
                  const badgeVariant = badgeEntry?.variant ?? ("secondary" as const);
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onInspectCountry(otherCode)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-2.5 py-2 text-left text-xs transition hover:border-primary/50 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="shrink-0">{other?.flagEmoji ?? "🏳️"}</span>
                          <span className="truncate">
                            {getCountryDisplayName(
                              otherCode,
                              other?.name ?? otherCode,
                              locale
                            )}
                          </span>
                        </div>
                        {rel.treatyName && (
                          <div className="truncate text-[10px] text-muted-foreground">
                            {rel.treatyName}
                          </div>
                        )}
                      </div>
                      <Badge variant={badgeVariant} className="shrink-0">
                        {badgeLabel}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
