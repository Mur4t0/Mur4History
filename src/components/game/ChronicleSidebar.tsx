"use client";

import { useLocale } from "@/components/LanguageProvider";
import { formatGameDateByLocale, getCountryDisplayName } from "@/lib/i18n";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderArchive,
  History,
  Layers,
  Mail,
  Newspaper,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CountryRecord,
  DiplomaticMessageRecord,
  TurnSnapshotSummary,
  WorldEventRecord,
} from "@/lib/client-types";
import { formatGameDateTr } from "@/lib/utils";

interface ChronicleSidebarProps {
  events: WorldEventRecord[];
  messages: DiplomaticMessageRecord[];
  snapshots: TurnSnapshotSummary[];
  countries: CountryRecord[];
  currentTurn?: number;
}

type GroupMode = "turn" | "topic" | "flat";

interface ArchiveBucket<T> {
  key: string;
  title: string;
  subtitle?: string;
  isLatest: boolean;
  sortTurn: number;
  items: T[];
}

const CATEGORY_STYLE: Record<
  string,
  {
    labelTr: string;
    labelEn: string;
    variant: "destructive" | "default" | "success" | "warning" | "secondary";
  }
> = {
  WAR: { labelTr: "SAVAŞ", labelEn: "WAR", variant: "destructive" },
  DIPLOMACY: { labelTr: "DİPLOMASİ", labelEn: "DIPLOMACY", variant: "default" },
  ECONOMY: { labelTr: "EKONOMİ", labelEn: "ECONOMY", variant: "success" },
  CRISIS: { labelTr: "KRİZ", labelEn: "CRISIS", variant: "warning" },
  INTERNAL: { labelTr: "İÇ POLİTİKA", labelEn: "INTERNAL", variant: "secondary" },
};

function sortNewestFirst<T extends { turnNumber: number; createdAt: string }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    if (b.turnNumber !== a.turnNumber) return b.turnNumber - a.turnNumber;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function groupByBucket<T extends { turnNumber: number }>(
  items: T[],
  describe: (item: T) => {
    key: string;
    title: string;
    subtitle?: string;
    isLatest: boolean;
  }
): ArchiveBucket<T>[] {
  const map = new Map<string, ArchiveBucket<T>>();
  for (const item of items) {
    const info = describe(item);
    const existing = map.get(info.key);
    if (existing) {
      existing.items.push(item);
      if (item.turnNumber > existing.sortTurn) {
        existing.sortTurn = item.turnNumber;
      }
      if (info.isLatest) existing.isLatest = true;
    } else {
      map.set(info.key, {
        key: info.key,
        title: info.title,
        subtitle: info.subtitle,
        isLatest: info.isLatest,
        sortTurn: item.turnNumber,
        items: [item],
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.isLatest !== b.isLatest) return a.isLatest ? -1 : 1;
    return b.sortTurn - a.sortTurn;
  });
}

function TurnStatusStamp({
  isLatest,
  isTr,
}: {
  isLatest: boolean;
  isTr: boolean;
}) {
  if (isLatest) {
    return (
      <span
        data-testid="status-stamp-guncel"
        className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-emerald-300"
      >
        {isTr ? "GÜNCEL" : "LATEST"}
      </span>
    );
  }
  return (
    <span
      data-testid="status-stamp-eski"
      className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-300"
    >
      {isTr ? "ESKİ" : "OLD"}
    </span>
  );
}

export function ChronicleSidebar({
  events,
  messages,
  snapshots,
  countries,
  currentTurn,
}: ChronicleSidebarProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const [activeTab, setActiveTab] = useState<"gazette" | "diplomacy" | "chronicle">(
    "gazette"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("turn");
  const [onlyLatest, setOnlyLatest] = useState(false);
  const [expandAllOld, setExpandAllOld] = useState(false);
  const [openedGroups, setOpenedGroups] = useState<Record<string, boolean>>({});

  const countryByCode = useMemo(
    () => new Map(countries.map((c) => [c.code, c])),
    [countries]
  );

  const normalizedQuery = searchQuery
    .trim()
    .toLocaleLowerCase(isTr ? "tr-TR" : "en-US");
  const isSearching = normalizedQuery.length > 0;

  const toggleGroup = (key: string, defaultOpen: boolean) => {
    setOpenedGroups((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? defaultOpen),
    }));
  };

  // ==========================================================
  // 1. GAZETTE FILTERING & GROUPING
  // ==========================================================
  const latestEventTurn = useMemo(
    () =>
      events.length > 0
        ? Math.max(...events.map((e) => e.turnNumber))
        : currentTurn ?? 1,
    [events, currentTurn]
  );

  const filteredEvents = useMemo(() => {
    const sorted = sortNewestFirst(events);
    return sorted.filter((ev) => {
      const isLatest = ev.turnNumber >= latestEventTurn;
      if (onlyLatest && !isLatest) return false;
      if (!isSearching) return true;
      const catEntry = CATEGORY_STYLE[ev.category];
      const catNames = catEntry
        ? `${catEntry.labelTr} ${catEntry.labelEn}`
        : ev.category;
      const countryNames = ev.involvedCountries
        .map((c) => {
          const raw = countryByCode.get(c)?.name ?? "";
          return `${c} ${raw} ${getCountryDisplayName(c, raw, "tr")} ${getCountryDisplayName(c, raw, "en")}`;
        })
        .join(" ");
      const haystack = `${ev.headline} ${ev.articleBody} ${catNames} ${ev.category} tur ${ev.turnNumber} turn ${ev.turnNumber} ${ev.gameDate} ${formatGameDateByLocale(ev.gameDate, "tr")} ${formatGameDateByLocale(ev.gameDate, "en")} ${countryNames}`.toLocaleLowerCase(
        isTr ? "tr-TR" : "en-US"
      );
      return haystack.includes(normalizedQuery);
    });
  }, [
    events,
    latestEventTurn,
    onlyLatest,
    isSearching,
    normalizedQuery,
    countryByCode,
    isTr,
  ]);

  const eventBuckets = useMemo(() => {
    if (groupMode === "flat") return [];
    if (groupMode === "topic") {
      return groupByBucket(filteredEvents, (ev) => {
        const entry = CATEGORY_STYLE[ev.category];
        const cat = entry
          ? isTr
            ? entry.labelTr
            : entry.labelEn
          : ev.category;
        return {
          key: `ev-cat-${ev.category}`,
          title: cat,
          isLatest: ev.turnNumber >= latestEventTurn,
        };
      });
    }
    return groupByBucket(filteredEvents, (ev) => {
      const isLatest = ev.turnNumber >= latestEventTurn;
      return {
        key: `ev-turn-${ev.turnNumber}`,
        title: `${isTr ? "TUR" : "TURN"} ${ev.turnNumber} • ${formatGameDateByLocale(ev.gameDate, locale)}`,
        subtitle: isLatest
          ? isTr
            ? "Son Gelişmeler"
            : "Latest Developments"
          : isTr
            ? "Önceki Tur Arşivi"
            : "Prior Turn Archive",
        isLatest,
      };
    });
  }, [filteredEvents, groupMode, latestEventTurn, isTr, locale]);

  // ==========================================================
  // 2. MESSAGES FILTERING & GROUPING
  // ==========================================================
  const latestMessageTurn = useMemo(
    () =>
      messages.length > 0
        ? Math.max(...messages.map((m) => m.turnNumber))
        : currentTurn ?? 1,
    [messages, currentTurn]
  );

  const filteredMessages = useMemo(() => {
    const sorted = sortNewestFirst(messages);
    return sorted.filter((msg) => {
      const isLatest = msg.turnNumber >= latestMessageTurn;
      if (onlyLatest && !isLatest) return false;
      if (!isSearching) return true;
      const fromName = countryByCode.get(msg.fromCountryCode)?.name ?? "";
      const toName = countryByCode.get(msg.toCountryCode)?.name ?? "";
      const fromEn = getCountryDisplayName(msg.fromCountryCode, fromName, "en");
      const toEn = getCountryDisplayName(msg.toCountryCode, toName, "en");
      const haystack = `${msg.senderTitle} ${msg.message} ${msg.fromCountryCode} ${fromName} ${fromEn} ${msg.toCountryCode} ${toName} ${toEn} tur ${msg.turnNumber} turn ${msg.turnNumber} ${msg.gameDate} ${formatGameDateByLocale(msg.gameDate, "tr")} ${formatGameDateByLocale(msg.gameDate, "en")}`.toLocaleLowerCase(
        isTr ? "tr-TR" : "en-US"
      );
      return haystack.includes(normalizedQuery);
    });
  }, [
    messages,
    latestMessageTurn,
    onlyLatest,
    isSearching,
    normalizedQuery,
    countryByCode,
    isTr,
  ]);

  const messageBuckets = useMemo(() => {
    if (groupMode === "flat") return [];
    if (groupMode === "topic") {
      return groupByBucket(filteredMessages, (msg) => {
        const pair = [msg.fromCountryCode, msg.toCountryCode].sort();
        const nameA = getCountryDisplayName(
          pair[0],
          countryByCode.get(pair[0])?.name ?? pair[0],
          locale
        );
        const nameB = getCountryDisplayName(
          pair[1],
          countryByCode.get(pair[1])?.name ?? pair[1],
          locale
        );
        return {
          key: `msg-pair-${pair[0]}-${pair[1]}`,
          title: `${nameA} ↔ ${nameB}`,
          subtitle: `${pair[0]} / ${pair[1]}`,
          isLatest: msg.turnNumber >= latestMessageTurn,
        };
      });
    }
    return groupByBucket(filteredMessages, (msg) => {
      const isLatest = msg.turnNumber >= latestMessageTurn;
      return {
        key: `msg-turn-${msg.turnNumber}`,
        title: `${isTr ? "TUR" : "TURN"} ${msg.turnNumber} • ${formatGameDateByLocale(msg.gameDate, locale)}`,
        subtitle: isLatest
          ? isTr
            ? "Güncel Telgraflar"
            : "Latest Dispatches"
          : isTr
            ? "Önceki Tur Telgrafları"
            : "Prior Turn Dispatches",
        isLatest,
      };
    });
  }, [filteredMessages, groupMode, latestMessageTurn, countryByCode, isTr, locale]);

  // ==========================================================
  // 3. CHRONICLE SNAPSHOTS FILTERING & GROUPING
  // ==========================================================
  const latestSnapshotTurn = useMemo(
    () =>
      snapshots.length > 0
        ? Math.max(...snapshots.map((s) => s.turnNumber))
        : currentTurn ?? 1,
    [snapshots, currentTurn]
  );

  const filteredSnapshots = useMemo(() => {
    const sorted = sortNewestFirst(snapshots);
    return sorted.filter((snap) => {
      const isLatest = snap.turnNumber >= latestSnapshotTurn;
      if (onlyLatest && !isLatest) return false;
      if (!isSearching) return true;
      const haystack = `tur ${snap.turnNumber} turn ${snap.turnNumber} ${snap.gameDate} ${formatGameDateByLocale(snap.gameDate, "tr")} ${formatGameDateByLocale(snap.gameDate, "en")} ${snap.summary}`.toLocaleLowerCase(
        isTr ? "tr-TR" : "en-US"
      );
      return haystack.includes(normalizedQuery);
    });
  }, [snapshots, latestSnapshotTurn, onlyLatest, isSearching, normalizedQuery, isTr]);

  const snapshotBuckets = useMemo(() => {
    if (groupMode === "flat") return [];
    if (groupMode === "topic") {
      return groupByBucket(filteredSnapshots, (snap) => {
        const year = snap.gameDate.slice(0, 4) || (isTr ? "Dönem" : "Era");
        return {
          key: `snap-yr-${year}`,
          title: isTr ? `${year} Yılı Kayıtları` : `${year} Archive`,
          isLatest: snap.turnNumber >= latestSnapshotTurn,
        };
      });
    }
    return groupByBucket(filteredSnapshots, (snap) => {
      const isLatest = snap.turnNumber >= latestSnapshotTurn;
      if (isLatest) {
        return {
          key: "snap-latest",
          title: isTr
            ? `GÜNCEL TUR • TUR ${snap.turnNumber}`
            : `LATEST TURN • TURN ${snap.turnNumber}`,
          subtitle: formatGameDateByLocale(snap.gameDate, locale),
          isLatest: true,
        };
      }
      // Group older turns cleanly in compact 5-turn archive spans (e.g., Tur 11–7)
      const bandTop =
        Math.ceil(snap.turnNumber / 5) * 5 >= latestSnapshotTurn
          ? Math.max(1, latestSnapshotTurn - 1)
          : Math.ceil(snap.turnNumber / 5) * 5;
      const bandBottom = Math.max(1, Math.floor((snap.turnNumber - 1) / 5) * 5 + 1);
      return {
        key: `snap-band-${bandBottom}-${bandTop}`,
        title:
          bandTop === bandBottom
            ? isTr
              ? `Tur ${bandTop} Arşivi`
              : `Turn ${bandTop} Archive`
            : isTr
              ? `Tur ${bandTop} – Tur ${bandBottom} Arşivi`
              : `Turns ${bandBottom}–${bandTop} Archive`,
        subtitle: isTr ? "Önceki Turlar" : "Prior Turns",
        isLatest: false,
      };
    });
  }, [filteredSnapshots, groupMode, latestSnapshotTurn, isTr, locale]);

  const searchPlaceholder =
    activeTab === "gazette"
      ? isTr
        ? "Gazetede ara (başlık, ülke, içerik, tur)..."
        : "Search news (headline, nation, content, turn)..."
      : activeTab === "diplomacy"
        ? isTr
          ? "Mesajlarda ara (ülke, lider, metin, tur)..."
          : "Search messages (nation, leader, text, turn)..."
        : isTr
          ? "Kronolojide ara (tur, tarih, özet)..."
          : "Search chronicle (turn, date, summary)...";

  const activeCounts =
    activeTab === "gazette"
      ? { shown: filteredEvents.length, total: events.length }
      : activeTab === "diplomacy"
        ? { shown: filteredMessages.length, total: messages.length }
        : { shown: filteredSnapshots.length, total: snapshots.length };

  const renderGroupSection = <T,>(
    bucket: ArchiveBucket<T>,
    unitLabel: string,
    renderItem: (item: T) => React.ReactNode
  ) => {
    const defaultOpen = bucket.isLatest || expandAllOld || isSearching;
    const isOpen = isSearching ? true : openedGroups[bucket.key] ?? defaultOpen;

    return (
      <div key={bucket.key} className="space-y-2">
        <button
          type="button"
          onClick={() => toggleGroup(bucket.key, defaultOpen)}
          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
            bucket.isLatest
              ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15"
              : "border-border/75 bg-secondary/40 hover:border-amber-500/45"
          }`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate font-semibold text-foreground">
              {bucket.title}
            </span>
            <TurnStatusStamp isLatest={bucket.isLatest} isTr={isTr} />
          </div>
          <span className="shrink-0 rounded bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {bucket.items.length} {unitLabel}
          </span>
        </button>

        {isOpen && (
          <div className="space-y-2.5 pl-1">{bucket.items.map(renderItem)}</div>
        )}
      </div>
    );
  };

  const renderEventCard = (ev: WorldEventRecord) => {
    const isLatest = ev.turnNumber >= latestEventTurn;
    const catEntry = CATEGORY_STYLE[ev.category];
    const catLabel = catEntry
      ? isTr
        ? catEntry.labelTr
        : catEntry.labelEn
      : ev.category;
    const catVariant = catEntry?.variant ?? ("secondary" as const);
    return (
      <article
        key={ev.id}
        data-testid="gazette-event-card"
        className={`rounded-lg border p-3.5 shadow-sm transition ${
          isLatest
            ? "border-border/90 border-l-2 border-l-emerald-400 bg-[#101827]"
            : "border-border/60 bg-[#0d131f]/85 opacity-90"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-border/50 pb-1.5 text-[10px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">
              {isTr ? "TUR" : "TURN"} {ev.turnNumber} •{" "}
              {formatGameDateByLocale(ev.gameDate, locale)}
            </span>
            <TurnStatusStamp isLatest={isLatest} isTr={isTr} />
          </div>
          <Badge variant={catVariant}>{catLabel}</Badge>
        </div>
        <h4 className="break-words font-serif text-sm font-bold leading-snug tracking-tight text-amber-100">
          {ev.headline}
        </h4>
        <p className="mt-1.5 break-words text-xs leading-relaxed text-slate-300">
          {ev.articleBody}
        </p>
        {ev.involvedCountries.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {ev.involvedCountries.map((code) => {
              const c = countryByCode.get(code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {c?.flagEmoji ?? "🏳️"}{" "}
                  {getCountryDisplayName(code, c?.name ?? code, locale)}
                </span>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  const renderMessageCard = (msg: DiplomaticMessageRecord) => {
    const isLatest = msg.turnNumber >= latestMessageTurn;
    const fromC = countryByCode.get(msg.fromCountryCode);
    const toC = countryByCode.get(msg.toCountryCode);
    return (
      <div
        key={msg.id}
        data-testid="diplomacy-message-card"
        className={`rounded-lg border p-3 text-xs ${
          msg.isFromPlayer
            ? "border-primary/40 bg-primary/10"
            : isLatest
              ? "border-border border-l-2 border-l-emerald-400 bg-secondary/50"
              : "border-border/60 bg-secondary/30 opacity-90"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
          <span>
            {fromC?.flagEmoji ?? "🏳️"} {msg.fromCountryCode} →{" "}
            {toC?.flagEmoji ?? "🏳️"} {msg.toCountryCode}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono">
              {isTr ? "Tur" : "Turn"} {msg.turnNumber}
            </span>
            <TurnStatusStamp isLatest={isLatest} isTr={isTr} />
          </div>
        </div>
        <div className="mt-1 break-words font-semibold text-primary">
          {msg.senderTitle}
        </div>
        <p className="mt-1 break-words leading-relaxed text-foreground/90">
          &ldquo;{msg.message}&rdquo;
        </p>
      </div>
    );
  };

  const renderSnapshotCard = (snap: TurnSnapshotSummary) => {
    const isLatest = snap.turnNumber >= latestSnapshotTurn;
    return (
      <div
        key={snap.id}
        data-testid="chronicle-snapshot-card"
        className={`rounded-lg border p-3 text-xs ${
          isLatest
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-border/70 bg-secondary/30 opacity-90"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-primary">
              {isTr ? "TUR" : "TURN"} {snap.turnNumber}
            </span>
            <TurnStatusStamp isLatest={isLatest} isTr={isTr} />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatGameDateByLocale(snap.gameDate, locale)}
          </span>
        </div>
        <p className="mt-1.5 break-words leading-relaxed text-foreground/90">
          {snap.summary}
        </p>
      </div>
    );
  };

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-border/80 bg-[#0b1019]/90 backdrop-blur-md">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "gazette" | "diplomacy" | "chronicle")
        }
        className="flex h-full min-h-0 flex-col"
      >
        <div className="space-y-2.5 border-b border-border/70 p-3">
          <TabsList className="w-full">
            <TabsTrigger value="gazette">
              <Newspaper className="h-3.5 w-3.5" />
              {isTr ? "Gazete" : "News"} ({events.length})
            </TabsTrigger>
            <TabsTrigger value="diplomacy">
              <Mail className="h-3.5 w-3.5" />
              {isTr ? "Mesaj" : "Messages"} ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="chronicle">
              <History className="h-3.5 w-3.5" />
              {isTr ? "Kronoloji" : "Chronicle"} ({snapshots.length})
            </TabsTrigger>
          </TabsList>

          {/* Instant Search Input across Gazette / Messages / Chronicle */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="chronicle-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label={isTr ? "Aramayı temizle" : "Clear search"}
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Grouping Mode & Latest/Old Controls */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGroupMode("turn")}
                title={
                  isTr
                    ? "En günceller en üstte, önceki turlar ESKİ gruplarında"
                    : "Newest on top, earlier turns collapsed into OLD groups"
                }
                className={`inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-1 font-medium transition ${
                  groupMode === "turn"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderArchive className="h-3 w-3" />
                {isTr ? "Tura Göre" : "By Turn"}
              </button>
              <button
                type="button"
                onClick={() => setGroupMode("topic")}
                title={
                  activeTab === "gazette"
                    ? isTr
                      ? "Kategoriye göre grupla"
                      : "Group by category"
                    : activeTab === "diplomacy"
                      ? isTr
                        ? "Ülke çiftine göre grupla"
                        : "Group by nation pair"
                      : isTr
                        ? "Yıla göre grupla"
                        : "Group by year"
                }
                className={`inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-1 font-medium transition ${
                  groupMode === "topic"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3 w-3" />
                {activeTab === "gazette"
                  ? isTr
                    ? "Konu"
                    : "Topic"
                  : activeTab === "diplomacy"
                    ? isTr
                      ? "Ülke"
                      : "Nation"
                    : isTr
                      ? "Yıl"
                      : "Year"}
              </button>
              <button
                type="button"
                onClick={() => setGroupMode("flat")}
                className={`inline-flex cursor-pointer items-center rounded border px-1.5 py-1 font-medium transition ${
                  groupMode === "flat"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {isTr ? "Düz" : "Flat"}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOnlyLatest((v) => !v)}
                className={`inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-1 font-medium transition ${
                  onlyLatest
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                    : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {isTr ? "Sadece Güncel" : "Latest Only"}
              </button>
              {groupMode !== "flat" && !onlyLatest && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenedGroups({});
                    setExpandAllOld((v) => !v);
                  }}
                  className="cursor-pointer rounded border border-border/70 bg-secondary/40 px-1.5 py-1 text-muted-foreground hover:text-foreground"
                >
                  {expandAllOld
                    ? isTr
                      ? "Daralt"
                      : "Collapse"
                    : isTr
                      ? "Hepsini Aç"
                      : "Expand All"}
                </button>
              )}
            </div>
          </div>

          {(isSearching || onlyLatest) && (
            <div className="text-[10px] text-muted-foreground">
              {isTr ? "Gösterilen:" : "Showing:"}{" "}
              <span className="font-mono font-semibold text-foreground">
                {activeCounts.shown}
              </span>{" "}
              / {activeCounts.total} {isTr ? "kayıt" : "records"}
            </div>
          )}
        </div>

        {/* ==========================================================
            GAZETTE TAB
           ========================================================== */}
        <TabsContent
          value="gazette"
          className="mt-0 min-h-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              {filteredEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {events.length === 0
                    ? isTr
                      ? "Henüz gazete manşeti yayınlanmadı."
                      : "No world gazette headlines yet."
                    : isTr
                      ? "Aramanıza veya filtreye uygun haber bulunamadı."
                      : "No articles match your search or filter."}
                </div>
              ) : groupMode === "flat" ? (
                filteredEvents.map(renderEventCard)
              ) : (
                eventBuckets.map((b) =>
                  renderGroupSection(
                    b,
                    isTr ? "Haber" : "Articles",
                    renderEventCard
                  )
                )
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ==========================================================
            DIPLOMACY MESSAGES TAB
           ========================================================== */}
        <TabsContent
          value="diplomacy"
          className="mt-0 min-h-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              {filteredMessages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {messages.length === 0
                    ? isTr
                      ? "Henüz diplomatik telgraf veya lider yanıtı yok."
                      : "No diplomatic dispatches or leader replies yet."
                    : isTr
                      ? "Aramanıza veya filtreye uygun mesaj bulunamadı."
                      : "No messages match your search or filter."}
                </div>
              ) : groupMode === "flat" ? (
                filteredMessages.map(renderMessageCard)
              ) : (
                messageBuckets.map((b) =>
                  renderGroupSection(
                    b,
                    isTr ? "Mesaj" : "Msgs",
                    renderMessageCard
                  )
                )
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ==========================================================
            CHRONICLE TIMELINE TAB
           ========================================================== */}
        <TabsContent
          value="chronicle"
          className="mt-0 min-h-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              {filteredSnapshots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {isTr
                    ? "Aramanıza veya filtreye uygun kronoloji kaydı bulunamadı."
                    : "No chronicle entries match your filter."}
                </div>
              ) : groupMode === "flat" ? (
                filteredSnapshots.map(renderSnapshotCard)
              ) : (
                snapshotBuckets.map((b) =>
                  renderGroupSection(
                    b,
                    isTr ? "Tur" : "Turns",
                    renderSnapshotCard
                  )
                )
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
