"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bomb,
  Crosshair,
  Flame,
  Play,
  Radiation,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import { getCountryDisplayName } from "@/lib/i18n";
import { findNuclearPartners } from "@/lib/nuclear-doctrine";
import {
  getCountryBlocsAndPacts,
  getWarDifficultyProfile,
} from "@/lib/geopolitics";
import type {
  CountryRecord,
  DiplomacyRecord,
  RegionRecord,
  WarOperationRecord,
  WarRiskSummary,
} from "@/lib/client-types";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WarRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  playerCountryCode: string | null;
  countries: CountryRecord[];
  regions: RegionRecord[];
  diplomacies?: DiplomacyRecord[];
  warOperations: WarOperationRecord[];
  warHotspots: WarRiskSummary[];
  playerRisks: Record<string, WarRiskSummary>;
  autoBattleEnabled: boolean;
  onToggleAutoBattle: (enabled: boolean) => void;
  initialTab?: "fronts" | "meddle" | "radar";
  initialTargetCode?: string | null;
  onWarUpdated: () => void;
  onReplayNuke?: (op: WarOperationRecord) => void;
  onOpenLeaderNuclear?: (patronCode?: string) => void;
  onOpenPeaceCouncil?: (councilId: string) => void;
  scenarioKey?: string | null;
  currentDate?: string | null;
  difficulty?: string | null;
}

const OP_TYPE_LABEL: Record<string, { tr: string; en: string }> = {
  TANK_BLITZ: { tr: "Zırhlı Tank Taarruzu", en: "Armored Tank Blitz" },
  SIEGE: { tr: "Piyade Kuşatması", en: "Infantry Siege" },
  ASSAULT: { tr: "Sınır Baskını", en: "Border Assault" },
  AIR_STRIKE: { tr: "Hava Akını / Bombardıman", en: "Air Strike" },
  NAVAL_INVASION: { tr: "Deniz Çıkarması", en: "Naval Invasion" },
  ENVOY_AGITATION: { tr: "Gizli Elçi Sızması", en: "Covert Envoy Agitation" },
  REBEL_UPRISING: { tr: "Halk Ayaklanması (İç İsyan)", en: "Popular Uprising (Internal Revolt)" },
  NUCLEAR_STRIKE: { tr: "Stratejik Nükleer Saldırı", en: "Nuclear Strike" },
};

const RISK_META: Record<
  string,
  { tr: string; en: string; variant: "destructive" | "warning" | "default" | "secondary" }
> = {
  AT_WAR: { tr: "SAVAŞTA", en: "AT WAR", variant: "destructive" },
  CRITICAL: { tr: "KRİTİK", en: "CRITICAL", variant: "destructive" },
  HIGH: { tr: "YÜKSEK", en: "HIGH", variant: "warning" },
  MODERATE: { tr: "ORTA", en: "MODERATE", variant: "default" },
  LOW: { tr: "DÜŞÜK", en: "LOW", variant: "secondary" },
};

export function WarRoomModal({
  open,
  onOpenChange,
  sessionId,
  playerCountryCode,
  countries,
  regions,
  diplomacies = [],
  warOperations,
  warHotspots,
  playerRisks,
  autoBattleEnabled,
  onToggleAutoBattle,
  initialTab = "fronts",
  initialTargetCode = null,
  onWarUpdated,
  onReplayNuke,
  onOpenLeaderNuclear,
  onOpenPeaceCouncil,
  scenarioKey,
  currentDate,
  difficulty,
}: WarRoomModalProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const diffProfile = getWarDifficultyProfile(difficulty);

  const countryByCode = useMemo(
    () => new Map(countries.map((c) => [c.code, c])),
    [countries]
  );

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [attackerCode, setAttackerCode] = useState<string>(
    playerCountryCode || countries[0]?.code || "TUR"
  );
  const attackerCountry = countryByCode.get(attackerCode);
  const attackerWarheads = attackerCountry?.nuclearWarheads ?? 0;
  const nuclearPartners = useMemo(
    () => findNuclearPartners(attackerCode, countries, diplomacies),
    [attackerCode, countries, diplomacies]
  );
  const eligibleNuclearPatrons = nuclearPartners.filter((p) => p.eligible);
  const [defenderCode, setDefenderCode] = useState<string>(
    initialTargetCode ||
      countries.find((c) => c.code !== (playerCountryCode || "TUR"))?.code ||
      "RUS"
  );
  const [targetRegionId, setTargetRegionId] = useState<string>("AUTO");
  const [opType, setOpType] = useState<string>("TANK_BLITZ");

  // Meddle (3rd-party war instigation) state
  const defaultMeddleA =
    initialTargetCode ||
    countries.find((c) => c.code !== playerCountryCode)?.code ||
    "RUS";
  const [meddleA, setMeddleA] = useState<string>(defaultMeddleA);
  const [meddleB, setMeddleB] = useState<string>(
    countries.find(
      (c) => c.code !== playerCountryCode && c.code !== defaultMeddleA
    )?.code || "UKR"
  );
  const [radarSearch, setRadarSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmNuke, setConfirmNuke] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    if (playerCountryCode) setAttackerCode(playerCountryCode);
    if (initialTargetCode) {
      setDefenderCode(initialTargetCode);
      setMeddleA(initialTargetCode);
    }
    setConfirmNuke(false);
    setTargetRegionId("AUTO");
  }, [initialTab, initialTargetCode, open, playerCountryCode]);

  useEffect(() => {
    if (meddleA === meddleB) {
      const alt = countries.find(
        (c) => c.code !== playerCountryCode && c.code !== meddleA
      )?.code;
      if (alt) setMeddleB(alt);
    }
  }, [meddleA, meddleB, countries, playerCountryCode]);

  const defenderRegions = useMemo(
    () => regions.filter((r) => r.ownerCountryCode === defenderCode),
    [regions, defenderCode]
  );

  const sortedCountries = useMemo(
    () =>
      [...countries].sort((a, b) => {
        if (a.isMajor !== b.isMajor) return a.isMajor ? -1 : 1;
        return b.economy - a.economy;
      }),
    [countries]
  );

  const activeOperations = useMemo(
    () =>
      warOperations.filter((op) =>
        ["MARCHING", "BESIEGING", "ACTIVE"].includes(op.status)
      ),
    [warOperations]
  );

  const recentCompleted = useMemo(
    () =>
      warOperations
        .filter((op) =>
          ["CAPTURED", "DETONATED", "REPELLED", "UPRISING", "AGITATED"].includes(
            op.status
          )
        )
        .slice(0, 12),
    [warOperations]
  );

  const meddlePairRisk = useMemo(() => {
    const hotspot = warHotspots.find(
      (h) =>
        (h.countryA === meddleA && h.countryB === meddleB) ||
        (h.countryA === meddleB && h.countryB === meddleA)
    );
    if (hotspot) return hotspot;
    if (meddleA === playerCountryCode && playerRisks[meddleB]) {
      return playerRisks[meddleB];
    }
    if (meddleB === playerCountryCode && playerRisks[meddleA]) {
      return playerRisks[meddleA];
    }
    return null;
  }, [warHotspots, playerRisks, meddleA, meddleB, playerCountryCode]);

  const callWarApi = async (payload: Record<string, unknown>) => {
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/war`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isTr ? "İşlem başarısız." : "Action failed."));
        return null;
      }
      if (data.summary) setFeedback(data.summary);
      onWarUpdated();
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isTr ? "Ağ hatası" : "Network error"
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleLaunchOperation = async () => {
    if (opType === "NUCLEAR_STRIKE") {
      if (!confirmNuke) {
        setConfirmNuke(true);
        return;
      }
      setConfirmNuke(false);
      await callWarApi({
        mode: "nuclear_strike",
        attackerCode,
        defenderCode,
        targetRegionId: targetRegionId === "AUTO" ? undefined : targetRegionId,
      });
      onOpenChange(false);
      return;
    }

    const isCovertOp =
      opType === "REBEL_UPRISING" || opType === "ENVOY_AGITATION";
    const res = await callWarApi({
      mode: "launch_operation",
      attackerCode,
      defenderCode,
      targetRegionId: targetRegionId === "AUTO" ? undefined : targetRegionId,
      operationType: opType,
      intensity: opType === "ENVOY_AGITATION" ? 50 : 78,
      autoDeclareWar: !isCovertOp,
    });
    if (res) {
      setFeedback(
        opType === "ENVOY_AGITATION"
          ? isTr
            ? `${attackerCode} gizli elçileri ${defenderCode} halkını kışkırtmak üzere yola çıktı (toprak ilhak etmez).`
            : `${attackerCode} covert envoys deployed to agitate citizens inside ${defenderCode} (does not annex territory).`
          : opType === "REBEL_UPRISING"
            ? isTr
              ? `${defenderCode} içinde halk ayaklanması tetiklendi — bölge statüsü çekişmeli hale getirilecek (toprak ilhak etmez).`
              : `Internal uprising ignited inside ${defenderCode} (destabilizes regime without annexing land).`
            : isTr
              ? `${attackerCode} birlikleri haritada ${defenderCode} hedefine doğru harekete geçti!`
              : `${attackerCode} units deployed toward ${defenderCode} on the live map!`
      );
    }
  };

  const handleConvenePeaceCouncil = async (codeA: string, codeB: string) => {
    const res = await callWarApi({
      mode: "convene_peace_council",
      countryA: codeA,
      countryB: codeB,
    });
    if (res?.council?.id && onOpenPeaceCouncil) {
      onOpenChange(false);
      onOpenPeaceCouncil(res.council.id);
    }
  };

  const defenderBlocs = useMemo(
    () =>
      getCountryBlocsAndPacts({
        countryCode: defenderCode,
        scenarioKey,
        currentDate,
        diplomacies,
        locale,
      }),
    [defenderCode, scenarioKey, currentDate, diplomacies, locale]
  );

  const filteredRadar = useMemo(() => {
    const q = radarSearch.trim().toLowerCase();
    const playerList = Object.values(playerRisks);
    const mergedMap = new Map<string, WarRiskSummary>();
    for (const r of [...warHotspots, ...playerList]) {
      const key =
        r.countryA < r.countryB
          ? `${r.countryA}::${r.countryB}`
          : `${r.countryB}::${r.countryA}`;
      const prev = mergedMap.get(key);
      if (!prev || r.probability > prev.probability) {
        mergedMap.set(key, r);
      }
    }
    return Array.from(mergedMap.values())
      .filter((item) => {
        if (!q) return true;
        const nameA = getCountryDisplayName(
          item.countryA,
          countryByCode.get(item.countryA)?.name ?? item.countryA,
          locale
        ).toLowerCase();
        const nameB = getCountryDisplayName(
          item.countryB,
          countryByCode.get(item.countryB)?.name ?? item.countryB,
          locale
        ).toLowerCase();
        return (
          item.countryA.toLowerCase().includes(q) ||
          item.countryB.toLowerCase().includes(q) ||
          nameA.includes(q) ||
          nameB.includes(q)
        );
      })
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 40);
  }, [warHotspots, playerRisks, radarSearch, countryByCode, locale]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="flex h-[85vh] max-w-5xl flex-col overflow-hidden p-0">
        <ModalHeader className="border-b border-border/80 bg-[#0b111c] px-5 py-3.5 mb-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <ModalTitle className="flex items-center gap-2 text-base">
                <Swords className="h-5 w-5 text-rose-400" />
                {isTr
                  ? "Canlı Savaş Odası, Kışkırtma & Savaş Olasılığı Merkezi"
                  : "Live War Room, Provocations & Outbreak Radar"}
              </ModalTitle>
              <ModalDescription className="text-xs">
                {isTr
                  ? "Asker/tank kuşatmaları başlatın, nükleer başlık ateşleyin, ülkeleri birbirine düşürün ve canlı oto-savaşı izleyin."
                  : "Deploy animated infantry/tank sieges, launch nuclear strikes, incite rival wars, and watch live combat unfold."}
              </ModalDescription>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5">
              <Activity
                className={`h-4 w-4 ${
                  autoBattleEnabled ? "animate-pulse text-rose-400" : "text-muted-foreground"
                }`}
              />
              <span className="text-xs font-semibold text-foreground">
                {isTr ? "Canlı Oto-Savaş" : "Live Auto-Battle"}
              </span>
              <Switch
                checked={autoBattleEnabled}
                onCheckedChange={onToggleAutoBattle}
              />
            </div>
          </div>
        </ModalHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="border-b border-border/70 bg-[#090e17] px-4 py-2">
            <TabsList>
              <TabsTrigger value="fronts">
                <Swords className="h-3.5 w-3.5 text-rose-400" />
                {isTr
                  ? `Canlı Cepheler (${activeOperations.length})`
                  : `Live Fronts (${activeOperations.length})`}
              </TabsTrigger>
              <TabsTrigger value="meddle">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                {isTr ? "Milletleri Birbirine Karıştır" : "Incite 3rd-Party War"}
              </TabsTrigger>
              <TabsTrigger value="radar">
                <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
                {isTr ? "Savaş Olasılığı Radarı" : "War Probability Radar"}
              </TabsTrigger>
            </TabsList>
          </div>

          {error && (
            <div className="mx-5 mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          {feedback && (
            <div className="mx-5 mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {feedback}
            </div>
          )}

          {/* TAB 1: LIVE FRONTS, SIEGE LAUNCHER & NUKES */}
          <TabsContent value="fronts" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-5">
              <div className="space-y-5">
                {/* Quick Offensive Launcher */}
                <div className="rounded-xl border border-rose-500/35 bg-gradient-to-br from-rose-950/25 via-[#0e1522] to-[#0a0f1a] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-serif text-sm font-bold text-foreground">
                      <Crosshair className="h-4 w-4 text-rose-400" />
                      {isTr
                        ? "Yeni Animasyonlu Taarruz / Kuşatma / Nükleer Saldırı Başlat"
                        : "Launch Animated Offensive / Siege / Nuclear Strike"}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || activeOperations.length === 0}
                      onClick={() => callWarApi({ mode: "advance_battles", tickTensions: true })}
                      className="border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {isTr ? "Cepheleri +1 Aşama İlerlet" : "Advance Battles +1 Step"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Komuta Edilen Ülke (Siz)" : "Your Command"}
                      </label>
                      <div
                        data-testid="warroom-locked-attacker"
                        className="flex h-9 items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-foreground"
                        title={
                          isTr
                            ? "Doğrudan askeri harekât ve nükleer emirleri yalnızca kendi yönettiğiniz ülkeye verebilirsiniz."
                            : "You can only issue direct military and nuclear commands for your own nation."
                        }
                      >
                        <span className="truncate">
                          {attackerCountry?.flagEmoji}{" "}
                          {getCountryDisplayName(
                            attackerCode,
                            attackerCountry?.name ?? attackerCode,
                            locale
                          )}{" "}
                          ({attackerCode})
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Hedef Ülke" : "Defender Target"}
                      </label>
                      <Select
                        value={defenderCode}
                        onValueChange={(v) => {
                          setDefenderCode(v);
                          setTargetRegionId("AUTO");
                          setConfirmNuke(false);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCountries
                            .filter((c) => c.code !== attackerCode)
                            .map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.flagEmoji}{" "}
                                {getCountryDisplayName(c.code, c.name, locale)} ({c.code})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {defenderBlocs.length > 0 && (
                        <div
                          data-testid="warroom-defender-blocs"
                          className="mt-1 flex flex-wrap gap-1"
                        >
                          {defenderBlocs.map((b) => (
                            <span
                              key={b.id}
                              title={b.label}
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${b.colorClass}`}
                            >
                              <Shield className="h-2.5 w-2.5" />
                              {b.shortLabel}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Hedef Eyalet" : "Target Province"}
                      </label>
                      <Select value={targetRegionId} onValueChange={setTargetRegionId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUTO">
                            {isTr ? "En Yakın Sınır Eyaleti (Oto)" : "Nearest Frontier (Auto)"}
                          </SelectItem>
                          {defenderRegions.map((r) => (
                            <SelectItem key={r.regionId} value={r.regionId}>
                              {r.regionName} ({r.regionId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Harekat & Birim Animasyonu" : "Operation & Unit Sprite"}
                      </label>
                      <Select
                        value={opType}
                        onValueChange={(v) => {
                          setOpType(v);
                          setConfirmNuke(false);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TANK_BLITZ">
                            {isTr ? "Zırhlı Tank Taarruzu" : "Armored Tank Blitz"}
                          </SelectItem>
                          <SelectItem value="SIEGE">
                            {isTr ? "Piyade Kuşatması (Askerler)" : "Infantry Siege"}
                          </SelectItem>
                          <SelectItem value="AIR_STRIKE">
                            {isTr ? "Hava Akını / Jetler" : "Air Strike Jets"}
                          </SelectItem>
                          <SelectItem value="NAVAL_INVASION">
                            {isTr ? "Deniz Çıkarması" : "Naval Invasion"}
                          </SelectItem>
                          <SelectItem value="ENVOY_AGITATION">
                            {isTr
                              ? "Gizli Elçi Gönder & Halkı Kışkırt (Toprak Almaz)"
                              : "Send Covert Envoys & Agitate Citizens (No Annex)"}
                          </SelectItem>
                          <SelectItem value="REBEL_UPRISING">
                            {isTr
                              ? "Halk Ayaklanması Çıkar (İç İsyan — Toprak Almaz)"
                              : "Ignite Popular Uprising (Internal Revolt — No Annex)"}
                          </SelectItem>
                          <SelectItem value="NUCLEAR_STRIKE">
                            {attackerWarheads > 0
                              ? isTr
                                ? `Nükleer Başlık Fırlat! (${attackerWarheads} Başlık)`
                                : `Strategic Nuclear Strike! (${attackerWarheads} Left)`
                              : isTr
                                ? "Nükleer Başlık Fırlat (0 Başlık — Kilitli)"
                                : "Nuclear Strike (0 Warheads — Locked)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {opType === "NUCLEAR_STRIKE" && (
                    <div
                      data-testid="warroom-nuclear-status-box"
                      className={`rounded-lg border px-3 py-2.5 text-xs ${
                        attackerWarheads > 0
                          ? "border-amber-500/45 bg-amber-950/20 text-amber-200"
                          : "border-red-500/40 bg-red-950/25 text-red-200"
                      }`}
                    >
                      {attackerWarheads > 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Radiation className="h-4 w-4 text-amber-400" />
                            {isTr
                              ? `${attackerCode} envanterinde ${attackerWarheads} nükleer başlık hazır (Her saldırı 1 başlık harcar).`
                              : `${attackerCode} has ${attackerWarheads} nuclear warhead(s) ready (Each launch consumes 1).`}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 font-medium text-red-200">
                            <Radiation className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                            <span>
                              {isTr
                                ? `${attackerCode} envanterinde nükleer başlık yok (0 başlık). Nükleer füze fırlatabilmek için bir ittifak/savunma antlaşması altındaki müttefik liderle konuşarak nükleer başlık desteği isteyebilir veya yerli nükleer program başlatabilirsiniz.`
                                : `${attackerCode} has 0 nuclear warheads! Negotiate nuclear sharing with a treaty ally leader or start a domestic nuclear program.`}
                            </span>
                          </div>
                          {onOpenLeaderNuclear &&
                            attackerCode === playerCountryCode &&
                            nuclearPartners.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {(eligibleNuclearPatrons.length > 0
                                  ? eligibleNuclearPatrons
                                  : nuclearPartners.slice(0, 4)
                                ).map((patron) => (
                                  <Button
                                    key={patron.code}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    data-testid={`warroom-ask-patron-${patron.code}`}
                                    onClick={() => onOpenLeaderNuclear(patron.code)}
                                    className={`h-7 text-[11px] ${
                                      patron.eligible
                                        ? "border-emerald-500/50 bg-emerald-950/35 text-emerald-200 hover:bg-emerald-500/20"
                                        : "border-amber-500/40 bg-amber-950/25 text-amber-200 hover:bg-amber-500/20"
                                    }`}
                                  >
                                    <span>{patron.flagEmoji}</span>
                                    <span>
                                      {getCountryDisplayName(
                                        patron.code,
                                        patron.name,
                                        locale
                                      )}
                                    </span>
                                    <span className="font-mono text-[10px] opacity-85">
                                      ({patron.warheads} ☢️
                                      {patron.eligible
                                        ? ` • ${patron.treatyName ?? patron.status}`
                                        : isTr
                                          ? " • İttifak Yok"
                                          : " • No Treaty"}
                                      )
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {confirmNuke && opType === "NUCLEAR_STRIKE" ? (
                      <>
                        <span className="text-xs font-semibold text-amber-300">
                          {isTr
                            ? `${defenderCode} üzerine nükleer füzeyi ateşlemeyi onayla:`
                            : `Confirm launching nuclear warhead onto ${defenderCode}:`}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmNuke(false)}
                        >
                          {isTr ? "İptal" : "Cancel"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy || attackerWarheads <= 0}
                          onClick={handleLaunchOperation}
                          className="bg-red-600 text-white hover:bg-red-500"
                        >
                          <Radiation className="h-4 w-4 animate-spin" />
                          {isTr ? "ATEŞLE!" : "DETONATE NOW!"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={
                          busy ||
                          (opType === "NUCLEAR_STRIKE" && attackerWarheads <= 0)
                        }
                        onClick={handleLaunchOperation}
                        className={
                          opType === "NUCLEAR_STRIKE"
                            ? "bg-red-600 text-white hover:bg-red-500 disabled:opacity-45"
                            : ""
                        }
                      >
                        {opType === "NUCLEAR_STRIKE" ? (
                          <Bomb className="h-4 w-4" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        {opType === "NUCLEAR_STRIKE"
                          ? isTr
                            ? "Nükleer Saldırı Başlat"
                            : "Launch Nuclear Strike"
                          : opType === "ENVOY_AGITATION"
                            ? isTr
                              ? "Gizli Elçileri Gönder"
                              : "Dispatch Covert Envoys"
                            : opType === "REBEL_UPRISING"
                              ? isTr
                                ? "Halk Ayaklanması Çıkar"
                                : "Ignite Popular Uprising"
                              : isTr
                                ? "Birlikleri Haritada Yürüt!"
                                : "Deploy Units on Map!"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Ongoing Operations List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isTr
                      ? `Devam Eden Kuşatma & Taarruzlar (${activeOperations.length})`
                      : `Active Sieges & Offensives (${activeOperations.length})`}
                  </h4>

                  {activeOperations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      {isTr
                        ? "Şu anda aktif devam eden bir kuşatma yok. Yukarıdan yeni bir taarruz başlatabilir ya da başka ülkeleri birbirine düşürebilirsiniz."
                        : "No active sieges right now. Launch a tank/infantry offensive above or incite rival nations."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {activeOperations.map((op) => {
                        const atk = countryByCode.get(op.attackerCode);
                        const def = countryByCode.get(op.defenderCode);
                        const typeMeta = OP_TYPE_LABEL[op.operationType];
                        const isEnvoyOp = op.operationType === "ENVOY_AGITATION";
                        const isRebelOp = op.operationType === "REBEL_UPRISING";
                        return (
                          <div
                            key={op.id}
                            className={`rounded-xl border p-3 text-xs space-y-2 ${
                              isEnvoyOp
                                ? "border-purple-500/35 bg-[#120e24]"
                                : isRebelOp
                                  ? "border-orange-500/35 bg-[#1a110b]"
                                  : "border-rose-500/35 bg-[#0e1524]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                  {isRebelOp ? (
                                    <>
                                      <span>{isTr ? "İSYAN" : "REBELS"}</span>
                                      <span className="text-orange-400">⚔</span>
                                      <span>{def?.flagEmoji ?? ""}</span>
                                      <span>{op.defenderCode}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>{atk?.flagEmoji ?? ""}</span>
                                      <span>{op.attackerCode}</span>
                                      <span className={isEnvoyOp ? "text-purple-400" : "text-rose-400"}>
                                        {isEnvoyOp ? "→" : "⚔"}
                                      </span>
                                      <span>{def?.flagEmoji ?? ""}</span>
                                      <span>{op.defenderCode}</span>
                                    </>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[11px] font-medium text-amber-200">
                                  {op.targetRegionName}
                                </div>
                              </div>
                              <Badge variant={isEnvoyOp ? "secondary" : isRebelOp ? "warning" : "destructive"}>
                                {isEnvoyOp
                                  ? isTr
                                    ? "ELÇİ SIZMASI"
                                    : "ENVOYS"
                                  : isRebelOp
                                    ? isTr
                                      ? "İÇ İSYAN"
                                      : "UPRISING"
                                    : op.status === "MARCHING"
                                      ? isTr
                                        ? "YÜRÜYÜŞTE"
                                        : "MARCHING"
                                      : isTr
                                        ? "KUŞATMA"
                                        : "BESIEGING"}
                              </Badge>
                            </div>

                            <div className="text-[11px] text-muted-foreground">
                              {typeMeta?.[locale] ?? op.operationType} •{" "}
                              {isTr ? "Kayıp / Ajan" : "Atk Loss"}: {op.attackerLosses} |{" "}
                              {isTr ? "Hedef Kaybı" : "Def Loss"}: {op.defenderLosses}
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between font-mono text-[10px]">
                                <span>
                                  {isEnvoyOp
                                    ? isTr
                                      ? "Kışkırtma İlerlemesi"
                                      : "Agitation Progress"
                                    : isRebelOp
                                      ? isTr
                                        ? "Ayaklanma İlerlemesi"
                                        : "Uprising Progress"
                                      : isTr
                                        ? "Ele Geçirme"
                                        : "Capture Progress"}
                                </span>
                                <span className="font-bold text-amber-300">
                                  %{op.progress}
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isEnvoyOp
                                      ? "bg-gradient-to-r from-purple-500 via-fuchsia-400 to-amber-400"
                                      : "bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-400"
                                  }`}
                                  style={{ width: `${op.progress}%` }}
                                />
                              </div>
                            </div>

                            {!isEnvoyOp && !isRebelOp && (
                              <div className="flex justify-end pt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  data-testid={`front-peace-council-${op.attackerCode}-${op.defenderCode}`}
                                  onClick={() =>
                                    void handleConvenePeaceCouncil(
                                      op.attackerCode,
                                      op.defenderCode
                                    )
                                  }
                                  className="h-6 border-emerald-500/45 bg-emerald-950/20 px-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                                >
                                  <Users className="h-3 w-3" />
                                  {isTr
                                    ? "Barış Konseyi Topla"
                                    : "Convene Peace Council"}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Captures & Nuclear Strikes (Replayable!) */}
                {recentCompleted.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isTr
                        ? "Son Fetihler, İsyanlar & Nükleer Saldırılar"
                        : "Recent Captures, Uprisings & Nukes"}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {recentCompleted.map((op) => (
                        <div
                          key={op.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">
                              {op.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {op.attackerCode} → {op.targetRegionName} (
                              {op.status === "REPELLED"
                                ? isTr
                                  ? "PÜSKÜRTÜLDÜ"
                                  : "REPELLED"
                                : op.status === "CAPTURED"
                                  ? isTr
                                    ? "ELE GEÇİRİLDİ"
                                    : "CAPTURED"
                                  : op.status === "UPRISING"
                                    ? isTr
                                      ? "İÇ İSYAN"
                                      : "UPRISING"
                                    : op.status === "AGITATED"
                                      ? isTr
                                        ? "HALK KIŞKIRTILDI"
                                        : "AGITATED"
                                      : op.status}
                              )
                            </div>
                          </div>
                          {op.operationType === "NUCLEAR_STRIKE" && onReplayNuke && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onReplayNuke(op);
                                onOpenChange(false);
                              }}
                              className="h-7 shrink-0 border-amber-500/40 text-[10px] text-amber-300"
                            >
                              <RotateCcw className="h-3 w-3" />
                              {isTr ? "Tekrar Oynat" : "Replay"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 2: MEDDLE & INCITE THIRD-PARTY WARS */}
          <TabsContent value="meddle" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-5">
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/25 via-[#0e1522] to-[#0a0f1a] p-5 space-y-4">
                  <div>
                    <h3 className="flex items-center gap-2 font-serif text-base font-bold text-foreground">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      {isTr
                        ? "Milletleri Birbirine Karıştır (Gizli Sahte Bayrak & Kışkırtma)"
                        : "Incite Rival Nations Against Each Other (Covert Meddling)"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isTr
                        ? "İki ülkeyi seçip aralarında sınır olayı, sabotaj veya diplomatik provokasyon tezgahlayın. Gerilim eşiği aşıldığında birbirlerine savaş açarlar ve haritada canlı çatışırlar!"
                        : "Pick any two nations and stage border incidents or covert sabotage between them. Once tension passes threshold, they declare open war and clash live on the map!"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "1. Ülke (Kışkırtılacak)" : "Nation A"}
                      </label>
                      <Select value={meddleA} onValueChange={setMeddleA}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCountries
                            .filter((c) => c.code !== playerCountryCode)
                            .map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.flagEmoji}{" "}
                                {getCountryDisplayName(c.code, c.name, locale)} ({c.code})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "2. Ülke (Rakip Hedef)" : "Nation B"}
                      </label>
                      <Select value={meddleB} onValueChange={setMeddleB}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCountries
                            .filter((c) => c.code !== playerCountryCode && c.code !== meddleA)
                            .map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.flagEmoji}{" "}
                                {getCountryDisplayName(c.code, c.name, locale)} ({c.code})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Live Bilateral Risk Preview */}
                  <div className="rounded-xl border border-border bg-[#070b14] p-3.5 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {countryByCode.get(meddleA)?.flagEmoji} {meddleA} ↔{" "}
                        {countryByCode.get(meddleB)?.flagEmoji} {meddleB}{" "}
                        {isTr ? "Mevcut Savaş Olasılığı:" : "Current War Probability:"}
                      </span>
                      <Badge
                        variant={
                          (meddlePairRisk?.probability ?? 25) >= 70
                            ? "destructive"
                            : (meddlePairRisk?.probability ?? 25) >= 45
                              ? "warning"
                              : "default"
                        }
                      >
                        %{meddlePairRisk?.probability ?? 24}
                      </Badge>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-500 to-rose-600 transition-all duration-500"
                        style={{ width: `${meddlePairRisk?.probability ?? 24}%` }}
                      />
                    </div>
                    {meddlePairRisk?.factors && meddlePairRisk.factors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {meddlePairRisk.factors.map((f) => (
                          <span
                            key={f}
                            className="rounded border border-border/70 bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={busy || meddleA === meddleB}
                      onClick={() =>
                        callWarApi({
                          mode: "provoke",
                          actionType: "INCITE_THIRD_PARTY_WAR",
                          actorCode: playerCountryCode || "TUR",
                          targetCode: meddleA,
                          instigateWithCode: meddleB,
                        })
                      }
                      className="bg-amber-500 text-black hover:bg-amber-400 font-bold"
                    >
                      <Flame className="h-4 w-4" />
                      {isTr
                        ? `Sahte Bayrak & Sınır Sabotajı Tezgahla! (+%${diffProfile.falseFlagTensionDelta} Gerilim • ${diffProfile.falseFlagCost} Bütçe)`
                        : `Stage False-Flag Sabotage! (+${diffProfile.falseFlagTensionDelta}% Tension • ${diffProfile.falseFlagCost} Treasury)`}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      {isTr
                        ? `(Seçili zorlukta savaş çıkma eşiği: %${diffProfile.falseFlagWarThreshold}+ olasılık)`
                        : `(At current difficulty, open war erupts at >=${diffProfile.falseFlagWarThreshold}% probability)`}
                    </span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 3: GLOBAL WAR PROBABILITY RADAR */}
          <TabsContent value="radar" className="mt-0 flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border/70 px-5 py-3">
              <Input
                value={radarSearch}
                onChange={(e) => setRadarSearch(e.target.value)}
                placeholder={
                  isTr
                    ? "Ülke veya kriz çifti ara (örn: Türkiye, Rusya, USA)..."
                    : "Search country or crisis pair..."
                }
                className="h-8 text-xs"
              />
            </div>

            <ScrollArea className="flex-1 p-5">
              <div className="space-y-2.5">
                {filteredRadar.map((risk) => {
                  const meta = RISK_META[risk.riskLevel] ?? RISK_META.LOW;
                  const cA = countryByCode.get(risk.countryA);
                  const cB = countryByCode.get(risk.countryB);
                  const blocsA = getCountryBlocsAndPacts({
                    countryCode: risk.countryA,
                    scenarioKey,
                    currentDate,
                    diplomacies,
                    locale,
                  });
                  const blocsB = getCountryBlocsAndPacts({
                    countryCode: risk.countryB,
                    scenarioKey,
                    currentDate,
                    diplomacies,
                    locale,
                  });
                  return (
                    <div
                      key={`${risk.countryA}-${risk.countryB}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/75 bg-[#0d1422] px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {cA?.flagEmoji ?? ""}{" "}
                            {getCountryDisplayName(
                              risk.countryA,
                              cA?.name ?? risk.countryA,
                              locale
                            )}
                          </span>
                          {blocsA[0] && (
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${blocsA[0].colorClass}`}
                            >
                              {blocsA[0].shortLabel}
                            </span>
                          )}
                          <span className="text-muted-foreground">↔</span>
                          <span className="font-semibold text-foreground">
                            {cB?.flagEmoji ?? ""}{" "}
                            {getCountryDisplayName(
                              risk.countryB,
                              cB?.name ?? risk.countryB,
                              locale
                            )}
                          </span>
                          {blocsB[0] && (
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${blocsB[0].colorClass}`}
                            >
                              {blocsB[0].shortLabel}
                            </span>
                          )}
                          <Badge variant={meta.variant}>
                            {isTr ? `%${risk.probability}` : `${risk.probability}%`} •{" "}
                            {meta[locale]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {risk.factors.map((f) => (
                            <span
                              key={f}
                              className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {risk.status !== "WAR" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              if (
                                risk.countryA === playerCountryCode ||
                                risk.countryB === playerCountryCode
                              ) {
                                const target =
                                  risk.countryA === playerCountryCode
                                    ? risk.countryB
                                    : risk.countryA;
                                void callWarApi({
                                  mode: "provoke",
                                  actionType: "BORDER_SKIRMISH",
                                  actorCode: playerCountryCode || "TUR",
                                  targetCode: target,
                                });
                              } else {
                                void callWarApi({
                                  mode: "provoke",
                                  actionType: "INCITE_THIRD_PARTY_WAR",
                                  actorCode: playerCountryCode || "TUR",
                                  targetCode: risk.countryA,
                                  instigateWithCode: risk.countryB,
                                });
                              }
                            }}
                            className="h-7 border-amber-500/40 text-[11px] text-amber-300"
                          >
                            <Flame className="h-3 w-3" />
                            {isTr ? "Kışkırt" : "Provoke"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            data-testid={`radar-peace-council-${risk.countryA}-${risk.countryB}`}
                            onClick={() =>
                              void handleConvenePeaceCouncil(
                                risk.countryA,
                                risk.countryB
                              )
                            }
                            className="h-7 border-emerald-500/45 bg-emerald-950/20 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <Users className="h-3 w-3" />
                            {isTr ? "Barış Konseyi Topla" : "Convene Peace Council"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </ModalContent>
    </Modal>
  );
}
