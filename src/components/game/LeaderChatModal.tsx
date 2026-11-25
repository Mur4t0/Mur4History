"use client";

import { useLocale } from "@/components/LanguageProvider";
import { formatGameDateByLocale, getCountryDisplayName } from "@/lib/i18n";
import { isTreatyEligibleForNuclearSharing } from "@/lib/nuclear-doctrine";
import {
  evaluatePeaceCouncilReadiness,
  getCountryBlocsAndPacts,
  getWarDifficultyProfile,
} from "@/lib/geopolitics";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  MessageSquare,
  Plus,
  Radiation,
  Search,
  Send,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CountryRecord,
  DiplomacyCouncilRecord,
  DiplomacyRecord,
  LeaderChatMessageRecord,
  RegionRecord,
} from "@/lib/client-types";

interface LeaderChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  playerCountryCode: string | null;
  countries: CountryRecord[];
  regions?: RegionRecord[];
  diplomacies: DiplomacyRecord[];
  leaderChats: LeaderChatMessageRecord[];
  councils: DiplomacyCouncilRecord[];
  initialTargetCode: string | null;
  initialTab?: "direct" | "councils";
  initialCouncilId?: string | null;
  scenarioKey?: string | null;
  currentDate?: string | null;
  difficulty?: string | null;
  onMessageSent: () => void;
}

const DIPLO_LABEL: Record<
  string,
  {
    labelTr: string;
    labelEn: string;
    variant: "destructive" | "success" | "warning" | "default" | "secondary";
  }
> = {
  WAR: { labelTr: "SAVAŞTA", labelEn: "AT WAR", variant: "destructive" },
  ALLIANCE: { labelTr: "MÜTTEFİK", labelEn: "ALLY", variant: "success" },
  NON_AGGRESSION: {
    labelTr: "SALDIRMAZLIK",
    labelEn: "NON-AGGRESSION",
    variant: "default",
  },
  VASSAL: { labelTr: "VASAL", labelEn: "VASSAL", variant: "secondary" },
  EMBARGO: { labelTr: "AMBARGO", labelEn: "EMBARGO", variant: "warning" },
  NEUTRAL: { labelTr: "TARAFSIZ", labelEn: "NEUTRAL", variant: "secondary" },
};

const STANCE_BADGE: Record<
  string,
  {
    labelTr: string;
    labelEn: string;
    variant: "destructive" | "success" | "warning" | "default" | "secondary";
  }
> = {
  SUPPORTIVE: {
    labelTr: "DESTEKLEYİCİ",
    labelEn: "SUPPORTIVE",
    variant: "success",
  },
  CRITICAL: {
    labelTr: "ELEŞTİREL / TEPKİLİ",
    labelEn: "CRITICAL",
    variant: "warning",
  },
  THREATENING: {
    labelTr: "TEHDİTKAR / ÜLTİMATOM",
    labelEn: "THREATENING",
    variant: "destructive",
  },
  MEDIATOR: { labelTr: "ARABULUCU", labelEn: "MEDIATOR", variant: "default" },
  NEUTRAL: { labelTr: "TARAFSIZ", labelEn: "NEUTRAL", variant: "secondary" },
};

const COUNCIL_TYPE_LABEL: Record<string, { tr: string; en: string }> = {
  COUNCIL: { tr: "ULUSLARARASI KONSEY", en: "INTERNATIONAL COUNCIL" },
  COALITION: { tr: "KOALİSYON ZİRVESİ", en: "COALITION SUMMIT" },
  PROTEST: { tr: "ORTAK PROTESTO GRUBU", en: "JOINT PROTEST BLOC" },
  SUMMIT: { tr: "ÇOK ULUSLU ZİRVE", en: "MULTILATERAL SUMMIT" },
};

const COUNCIL_STATUS_LABEL: Record<string, { tr: string; en: string }> = {
  OPEN: { tr: "AÇIK", en: "OPEN" },
  RESOLVED: { tr: "KARARA BAĞLANDI", en: "RESOLVED" },
  COLLAPSED: { tr: "ÇÖKTÜ", en: "COLLAPSED" },
};

const QUICK_TOPICS = [
  {
    tr: "İki ülke arasında ticaret hacmini artıracak ve sınır güvenliğini sağlayacak bir saldırmazlık paktı imzalamayı teklif ediyoruz.",
    en: "We propose signing a non-aggression and trade pact to expand bilateral commerce and border security.",
  },
  {
    tr: "Mevcut bölgesel kriz karşısında ortak savunma ittifakı kurmaya hazır mısınız?",
    en: "Are you prepared to form a mutual defense alliance against the current regional crisis?",
  },
  {
    tr: "Sınır hattımızdaki askeri hareketlilikten rahatsızız; birliklerinizi geri çekmenizi talep ediyoruz.",
    en: "We are concerned by military movements along our border; we demand you pull back your forces.",
  },
  {
    tr: "Stratejik enerji ve savunma sanayii alanında gizli bir işbirliği zirvesi öneriyoruz.",
    en: "We propose a confidential summit on strategic energy and defense industrial cooperation.",
  },
  {
    tr: "Ortak savunma antlaşmamız kapsamında ülkemize 2 adet taktik nükleer başlık konuşlandırılmasını talep ediyoruz.",
    en: "Under our mutual defense treaty umbrella, we request deploying 2 tactical nuclear warheads to bolster joint deterrence.",
  },
];

export function LeaderChatModal({
  open,
  onOpenChange,
  sessionId,
  playerCountryCode,
  countries,
  regions,
  diplomacies,
  leaderChats,
  councils,
  initialTargetCode,
  initialTab = "direct",
  initialCouncilId = null,
  scenarioKey,
  currentDate,
  difficulty,
  onMessageSent,
}: LeaderChatModalProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const survivingCountryCodes = useMemo(
    () => (regions ? new Set(regions.map((r) => r.ownerCountryCode)) : null),
    [regions]
  );

  const otherCountries = useMemo(
    () =>
      countries.filter(
        (c) =>
          c.code !== playerCountryCode &&
          (!survivingCountryCodes || survivingCountryCodes.has(c.code))
      ),
    [countries, playerCountryCode, survivingCountryCodes]
  );

  const countryByCode = useMemo(
    () => new Map(countries.map((c) => [c.code, c])),
    [countries]
  );

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedCode, setSelectedCode] = useState<string>(
    (initialTargetCode &&
    (!survivingCountryCodes || survivingCountryCodes.has(initialTargetCode))
      ? initialTargetCode
      : null) ||
      otherCountries[0]?.code ||
      ""
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [nukeCount, setNukeCount] = useState<number>(1);
  const [nukeBusy, setNukeBusy] = useState(false);
  const [nukeFeedback, setNukeFeedback] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Council state
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>(
    councils[0]?.id || ""
  );
  const [creatingCouncil, setCreatingCouncil] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newType, setNewType] = useState<"SUMMIT" | "COUNCIL" | "COALITION" | "PROTEST">("SUMMIT");
  const [invitedCodes, setInvitedCodes] = useState<string[]>([]);
  const [councilSearch, setCouncilSearch] = useState("");
  const [newOpeningMsg, setNewOpeningMsg] = useState("");
  const [councilDraft, setCouncilDraft] = useState("");
  const [peaceVoteBusy, setPeaceVoteBusy] = useState(false);
  const [peaceVoteFeedback, setPeaceVoteFeedback] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const councilEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (open && initialCouncilId) {
      setSelectedCouncilId(initialCouncilId);
      setCreatingCouncil(false);
      setActiveTab("councils");
    }
  }, [open, initialCouncilId]);

  useEffect(() => {
    setPeaceVoteFeedback(null);
  }, [selectedCouncilId, open]);

  useEffect(() => {
    if (
      open &&
      initialTargetCode &&
      initialTargetCode !== playerCountryCode &&
      (!survivingCountryCodes || survivingCountryCodes.has(initialTargetCode))
    ) {
      setSelectedCode(initialTargetCode);
    }
  }, [open, initialTargetCode, playerCountryCode, survivingCountryCodes]);

  useEffect(() => {
    if (
      (!selectedCode ||
        (survivingCountryCodes && !survivingCountryCodes.has(selectedCode))) &&
      otherCountries[0]
    ) {
      setSelectedCode(otherCountries[0].code);
    } else if (
      selectedCode &&
      survivingCountryCodes &&
      !survivingCountryCodes.has(selectedCode) &&
      !otherCountries[0]
    ) {
      setSelectedCode("");
    }
  }, [selectedCode, otherCountries, survivingCountryCodes]);

  useEffect(() => {
    if (!survivingCountryCodes) return;
    setInvitedCodes((prev) => {
      const next = prev.filter((code) => survivingCountryCodes.has(code));
      return next.length === prev.length ? prev : next;
    });
  }, [survivingCountryCodes]);

  useEffect(() => {
    if (!selectedCouncilId && councils[0]) {
      setSelectedCouncilId(councils[0].id);
    }
  }, [councils, selectedCouncilId]);

  const activeCountry =
    otherCountries.find((c) => c.code === selectedCode) ?? otherCountries[0];

  const activeCouncil =
    councils.find((c) => c.id === selectedCouncilId) ?? councils[0] ?? null;

  const threadMessages = useMemo(
    () =>
      leaderChats.filter((m) => m.countryCode === (activeCountry?.code ?? "")),
    [leaderChats, activeCountry?.code]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length, open, selectedCode]);

  useEffect(() => {
    councilEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeCouncil?.messages.length, open, selectedCouncilId]);

  const matchesCountryQuery = (c: CountryRecord, query: string) => {
    if (!query) return true;
    const localized = getCountryDisplayName(c.code, c.name, locale);
    return (
      c.name.toLowerCase().includes(query) ||
      localized.toLowerCase().includes(query) ||
      c.leader.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query)
    );
  };

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = otherCountries.filter((c) => matchesCountryQuery(c, q));
    return [...list].sort((a, b) => {
      const aCount = leaderChats.filter((m) => m.countryCode === a.code).length;
      const bCount = leaderChats.filter((m) => m.countryCode === b.code).length;
      if (aCount !== bCount) return bCount - aCount;
      if (a.isMajor !== b.isMajor) return a.isMajor ? -1 : 1;
      return b.economy - a.economy;
    });
  }, [otherCountries, search, leaderChats, locale]);

  const filteredCouncilCountries = useMemo(() => {
    const q = councilSearch.trim().toLowerCase();
    const list = otherCountries.filter((c) => matchesCountryQuery(c, q));
    return [...list].sort((a, b) => {
      if (a.isMajor !== b.isMajor) return a.isMajor ? -1 : 1;
      if (a.economy !== b.economy) return b.economy - a.economy;
      return getCountryDisplayName(a.code, a.name, locale).localeCompare(
        getCountryDisplayName(b.code, b.name, locale),
        locale
      );
    });
  }, [otherCountries, councilSearch, locale]);

  const getRelationRecordWithPlayer = (code: string) => {
    if (!playerCountryCode) return null;
    return (
      diplomacies.find(
        (d) =>
          (d.countryA === playerCountryCode && d.countryB === code) ||
          (d.countryB === playerCountryCode && d.countryA === code)
      ) ?? null
    );
  };

  const getRelationWithPlayer = (code: string) => {
    return getRelationRecordWithPlayer(code)?.status ?? "NEUTRAL";
  };

  const playerCountry = playerCountryCode
    ? countryByCode.get(playerCountryCode) ?? null
    : null;
  const playerWarheads = playerCountry?.nuclearWarheads ?? 0;
  const activeRelationRecord = activeCountry
    ? getRelationRecordWithPlayer(activeCountry.code)
    : null;
  const activeTreatyEligible =
    isTreatyEligibleForNuclearSharing(activeRelationRecord);

  useEffect(() => {
    setNukeFeedback(null);
  }, [selectedCode, open]);

  const handleRequestNuclearSupport = async (
    dispatch: "treaty_protocol" | "ai"
  ) => {
    if (!activeCountry || !playerCountryCode) return;
    setError(null);
    setNukeFeedback(null);
    setNukeBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/nuclear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "request_sharing",
          patronCode: activeCountry.code,
          count: nukeCount,
          customMessage: draft.trim() || undefined,
          dispatch,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (isTr ? "Nükleer talep gönderilemedi." : "Nuclear request failed.")
        );
        return;
      }
      if (draft.trim()) setDraft("");
      if (data.summary) setNukeFeedback(data.summary);
      onMessageSent();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isTr ? "Bağlantı hatası" : "Connection error"
      );
    } finally {
      setNukeBusy(false);
    }
  };

  const isWaitingForAi = threadMessages.some(
    (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
  );

  const isCouncilWaitingForAi =
    activeCouncil?.messages.some(
      (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
    ) ?? false;

  const handleSendDirect = async () => {
    if (!draft.trim() || !activeCountry) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/leader-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCountryCode: activeCountry.code,
          content: draft.trim(),
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (isTr ? "Mesaj gönderilemedi." : "Failed to send message.")
        );
        return;
      }
      setDraft("");
      onMessageSent();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isTr ? "Ağ hatası" : "Network error"
      );
    } finally {
      setSending(false);
    }
  };

  const handleCreateCouncil = async () => {
    if (
      !newTitle.trim() ||
      !newTopic.trim() ||
      !newOpeningMsg.trim() ||
      invitedCodes.length === 0
    ) {
      setError(
        isTr
          ? "Başlık, konu, en az 1 ülke ve açılış mesajı girin."
          : "Enter a title, agenda topic, at least 1 nation, and an opening statement."
      );
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/councils`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          title: newTitle.trim(),
          topic: newTopic.trim(),
          councilType: newType,
          participantCountryCodes: invitedCodes,
          openingMessage: newOpeningMsg.trim(),
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (isTr ? "Konsey açılamadı." : "Could not open council.")
        );
        return;
      }
      setCreatingCouncil(false);
      setNewTitle("");
      setNewTopic("");
      setNewOpeningMsg("");
      setInvitedCodes([]);
      setCouncilSearch("");
      if (data.council?.id) setSelectedCouncilId(data.council.id);
      onMessageSent();
    } finally {
      setSending(false);
    }
  };

  const handleSendCouncilReply = async () => {
    if (!councilDraft.trim() || !activeCouncil) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/councils`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "message",
          councilId: activeCouncil.id,
          content: councilDraft.trim(),
          locale,
        }),
      });
      if (res.ok) {
        setCouncilDraft("");
        onMessageSent();
      }
    } finally {
      setSending(false);
    }
  };

  const copyCommand = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPrompt(key);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const activeRelation = activeCountry
    ? getRelationWithPlayer(activeCountry.code)
    : "NEUTRAL";
  const relBadge = DIPLO_LABEL[activeRelation] ?? DIPLO_LABEL.NEUTRAL;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="flex h-[84vh] max-w-6xl flex-col overflow-hidden p-0">
        <ModalHeader className="border-b border-border/80 bg-[#0b111c] px-5 py-3 mb-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div>
              <ModalTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-primary" />
                {isTr
                  ? "Diplomasi Salonu: Liderler & Çok Uluslu Konseyler (MCP)"
                  : "Diplomacy Hall: World Leaders & Multilateral Councils (MCP)"}
              </ModalTitle>
              <ModalDescription className="text-xs">
                {isTr
                  ? "Tek tek ülke başkanlarıyla konuşun ya da birden fazla ülkenin tartıştığı Konsey / Koalisyon zirvelerine katılın."
                  : "Speak 1-on-1 with foreign heads of state or join multi-nation Council & Coalition summits."}
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="border-b border-border/70 bg-[#090e17] px-4 py-2">
            <TabsList className="w-full max-w-md">
              <TabsTrigger value="direct">
                <MessageSquare className="h-3.5 w-3.5" />
                {isTr
                  ? `Bire Bir Liderler (${otherCountries.length})`
                  : `Direct Leaders (${otherCountries.length})`}
              </TabsTrigger>
              <TabsTrigger value="councils">
                <Users className="h-3.5 w-3.5" />
                {isTr
                  ? `Konseyler & Gruplar (${councils.length})`
                  : `Councils & Summits (${councils.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: 1-ON-1 LEADER CHATS */}
          <TabsContent
            value="direct"
            className="mt-0 grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12"
          >
            <div className="flex flex-col border-b border-border/80 bg-[#080d16] md:col-span-4 md:border-b-0 md:border-r overflow-hidden">
              <div className="p-3 border-b border-border/60">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      isTr ? "Ülke veya lider ara..." : "Search nation or leader..."
                    }
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {filteredCountries.map((c) => {
                    const selected = c.code === activeCountry?.code;
                    const msgs = leaderChats.filter((m) => m.countryCode === c.code);
                    const hasPending = msgs.some(
                      (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
                    );
                    const rel = getRelationWithPlayer(c.code);
                    const relInfo = DIPLO_LABEL[rel];
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedCode(c.code)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition cursor-pointer ${
                          selected
                            ? "border-primary bg-primary/15"
                            : "border-transparent hover:border-border hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="text-xl shrink-0">{c.flagEmoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {getCountryDisplayName(c.code, c.name, locale)}
                              </span>
                              {hasPending && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse"
                                  title={
                                    isTr ? "AI yanıtı bekleniyor" : "Awaiting AI reply"
                                  }
                                />
                              )}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {c.leader}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {rel !== "NEUTRAL" && (
                            <span
                              className={`text-[9px] font-bold uppercase ${
                                rel === "WAR"
                                  ? "text-red-400"
                                  : rel === "ALLIANCE"
                                    ? "text-emerald-400"
                                    : "text-amber-300"
                              }`}
                            >
                              {relInfo
                                ? isTr
                                  ? relInfo.labelTr
                                  : relInfo.labelEn
                                : rel}
                            </span>
                          )}
                          {msgs.length > 0 && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                              {msgs.length}
                            </span>
                          )}
                          {(c.nuclearWarheads ?? 0) > 0 && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                              ☢️ {c.nuclearWarheads}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col overflow-hidden bg-[#0b1019] md:col-span-8">
              {activeCountry ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-[#0e1522] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-2xl">
                        {activeCountry.flagEmoji}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-sm font-bold text-foreground">
                            {activeCountry.leader}
                          </h3>
                          <Badge variant={relBadge.variant}>
                            {isTr ? relBadge.labelTr : relBadge.labelEn}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {getCountryDisplayName(
                              activeCountry.code,
                              activeCountry.name,
                              locale
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-primary">{activeCountry.ideology}</span>
                          {getCountryBlocsAndPacts({
                            countryCode: activeCountry.code,
                            scenarioKey,
                            currentDate,
                            diplomacies,
                            locale,
                          }).map((b) => (
                            <span
                              key={b.id}
                              title={b.label}
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${b.colorClass}`}
                            >
                              <Shield className="h-2.5 w-2.5" />
                              {b.shortLabel}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                      <span
                        title={
                          isTr ? "Nükleer Başlık Stoğu" : "Nuclear Warheads"
                        }
                        className={`flex items-center gap-1 ${
                          (activeCountry.nuclearWarheads ?? 0) > 0
                            ? "font-bold text-amber-300"
                            : ""
                        }`}
                      >
                        <Radiation className="h-3 w-3 text-amber-400" />
                        {activeCountry.nuclearWarheads ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                        {activeCountry.economy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Swords className="h-3 w-3 text-rose-400" />
                        {activeCountry.military}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-sky-400" />%
                        {activeCountry.stability}
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {threadMessages.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/80 bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
                          <Crown className="mx-auto mb-2 h-6 w-6 text-primary/70" />
                          <p className="font-semibold text-foreground">
                            {isTr
                              ? `${activeCountry.leader} ile doğrudan diplomatik hat açık.`
                              : `Direct diplomatic line open with ${activeCountry.leader}.`}
                          </p>
                          <p className="mt-1">
                            {isTr
                              ? "İttifak, ticaret, ültimatom veya gizli müzakere teklifinizi aşağıdan gönderin."
                              : "Send your alliance, trade, ultimatum, or secret negotiation proposal below."}
                          </p>
                        </div>
                      ) : (
                        threadMessages.map((msg) => {
                          const isPlayer = msg.senderRole === "PLAYER";
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${
                                isPlayer ? "items-end" : "items-start"
                              }`}
                            >
                              <div
                                className={`max-w-[82%] rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                                  isPlayer
                                    ? "border-primary/40 bg-primary/15 text-foreground"
                                    : "border-border bg-[#121a28] text-slate-100"
                                }`}
                              >
                                <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                                  <span className="font-semibold text-primary">
                                    {msg.senderName}
                                  </span>
                                  <span>
                                    {formatGameDateByLocale(msg.gameDate, locale)}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {isWaitingForAi && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                            <strong>{activeCountry.leader}</strong>{" "}
                            {isTr
                              ? "mesajınızı okuyor — bağlı MCP AI üzerinden yanıt bekleniyor..."
                              : "is reading your message — awaiting reply via MCP AI..."}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyCommand(
                                "direct",
                                isTr
                                  ? `mur4history MCP sunucusundaki 'pending-leader-chats' ve 'world-state' kaynaklarını oku. Aktif zorluk modunu dikkate alarak bekleyen tüm lider mesajlarına 'reply_leader_chat' aracıyla yanıt ver.`
                                  : `Read 'pending-leader-chats' and 'world-state' from mur4history MCP. Accounting for active difficulty, reply to all pending leader messages via 'reply_leader_chat'.`
                              )
                            }
                            className="h-7 text-[10px] border-amber-400/50 text-amber-200"
                          >
                            {copiedPrompt === "direct" ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {isTr
                              ? "AI Yanıt Komutu Kopyala"
                              : "Copy AI Reply Prompt"}
                          </Button>
                        </div>
                      )}
                      <div ref={endRef} />
                    </div>
                  </ScrollArea>

                  <div className="border-t border-border/70 bg-[#0d1420] p-3 space-y-2">
                    {playerCountryCode &&
                      ((activeCountry.nuclearWarheads ?? 0) > 0 ||
                        playerWarheads > 0) && (
                        <div
                          data-testid="leader-nuclear-sharing-panel"
                          className="rounded-lg border border-amber-500/35 bg-gradient-to-r from-amber-950/30 via-[#101828] to-[#0b111c] px-3 py-2 text-[11px] space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                              <Radiation className="h-3.5 w-3.5 text-amber-400" />
                              {isTr
                                ? "Nükleer Silah & Antlaşma Desteği"
                                : "Nuclear Sharing & Treaty Umbrella"}
                            </span>
                            <span className="font-mono text-[10px] text-slate-300">
                              {isTr ? "Senin Stoğun" : "Yours"}:{" "}
                              <strong className="text-amber-300">
                                {playerWarheads}
                              </strong>{" "}
                              • {activeCountry.code}:{" "}
                              <strong className="text-amber-300">
                                {activeCountry.nuclearWarheads ?? 0}
                              </strong>{" "}
                              ☢️
                            </span>
                          </div>

                          {(activeCountry.nuclearWarheads ?? 0) > 0 &&
                            (activeTreatyEligible ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                                  🛡️{" "}
                                  {activeRelationRecord?.treatyName ??
                                    activeRelationRecord?.status}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <select
                                    value={nukeCount}
                                    onChange={(e) =>
                                      setNukeCount(Number(e.target.value))
                                    }
                                    aria-label="Warhead count"
                                    className="h-7 rounded border border-border bg-secondary px-1.5 font-mono text-[11px] text-foreground"
                                  >
                                    <option value={1}>
                                      1 {isTr ? "Başlık" : "Warhead"}
                                    </option>
                                    <option value={2}>
                                      2 {isTr ? "Başlık" : "Warheads"}
                                    </option>
                                    <option value={3}>
                                      3 {isTr ? "Başlık" : "Warheads"}
                                    </option>
                                  </select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    data-testid="request-nuclear-protocol-btn"
                                    disabled={
                                      nukeBusy ||
                                      (activeCountry.nuclearWarheads ?? 0) <
                                        nukeCount + 1
                                    }
                                    onClick={() =>
                                      void handleRequestNuclearSupport(
                                        "treaty_protocol"
                                      )
                                    }
                                    className="h-7 bg-amber-600 px-2.5 text-[10px] font-semibold text-white hover:bg-amber-500"
                                  >
                                    {nukeBusy ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Radiation className="h-3 w-3" />
                                    )}
                                    {isTr
                                      ? "Antlaşmayla Başlık İste"
                                      : "Request via Treaty"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    data-testid="request-nuclear-ai-btn"
                                    disabled={nukeBusy}
                                    onClick={() =>
                                      void handleRequestNuclearSupport("ai")
                                    }
                                    className="h-7 border-primary/45 px-2.5 text-[10px] text-primary hover:bg-primary/15"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    {isTr
                                      ? "AI Lidere Sor"
                                      : "Ask Leader (AI)"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-amber-200/90">
                                <span>
                                  {isTr
                                    ? "Nükleer destek istemek için önce bu ülkeyle İttifak / Savunma Antlaşması imzalamalısınız."
                                    : "Sign an Alliance or Defense Umbrella treaty first to request nuclear warheads."}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  data-testid="propose-nuclear-pact-btn"
                                  onClick={() =>
                                    setDraft(
                                      isTr
                                        ? `Sayın ${activeCountry.leader}, bölgesel caydırıcılık için aramızda resmi bir Savunma İttifakı ve Nükleer Şemsiye Antlaşması imzalamayı ve ardından ülkemize ${nukeCount} taktik nükleer başlık desteği sağlamanızı teklif ediyoruz.`
                                        : `Dear ${activeCountry.leader}, we propose signing a formal Defense Alliance & Nuclear Umbrella Pact and deploying ${nukeCount} tactical nuclear warhead(s) under joint security.`
                                    )
                                  }
                                  className="h-6 border-amber-500/45 px-2 text-[10px] text-amber-300 hover:bg-amber-500/15"
                                >
                                  {isTr
                                    ? "İttifak & Nükleer Teklif Hazırla"
                                    : "Draft Alliance & Nuke Pact"}
                                </Button>
                              </div>
                            ))}

                          {nukeFeedback && (
                            <div
                              data-testid="nuclear-request-feedback"
                              className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200"
                            >
                              {nukeFeedback}
                            </div>
                          )}
                        </div>
                      )}

                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TOPICS.map((topic, idx) => {
                        const topicText = isTr ? topic.tr : topic.en;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDraft(topicText)}
                            className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-primary" />
                            {topicText.slice(0, 38)}...
                          </button>
                        );
                      })}
                    </div>

                    {error && (
                      <div className="text-[11px] text-red-400">{error}</div>
                    )}

                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendDirect();
                          }
                        }}
                        disabled={!playerCountryCode || sending}
                        placeholder={
                          playerCountryCode
                            ? isTr
                              ? `${activeCountry.leader} ile doğrudan görüşün... (Enter ile gönder)`
                              : `Speak directly with ${activeCountry.leader}... (Press Enter to send)`
                            : isTr
                              ? "Önce ülkenizi seçin..."
                              : "Select your nation first..."
                        }
                        className="min-h-[54px] max-h-[110px] resize-none text-xs"
                      />
                      <Button
                        disabled={!playerCountryCode || !draft.trim() || sending}
                        onClick={handleSendDirect}
                        className="h-[54px] px-4 shrink-0"
                      >
                        <Send className="h-4 w-4" />
                        {isTr ? "Gönder" : "Send"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </TabsContent>

          {/* TAB 2: MULTI-NATION COUNCILS & GROUP DEBATES */}
          <TabsContent
            value="councils"
            className="mt-0 grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12"
          >
            <div className="flex flex-col border-b border-border/80 bg-[#080d16] md:col-span-4 md:border-b-0 md:border-r overflow-hidden">
              <div className="p-3 border-b border-border/60">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setCreatingCouncil(true);
                    setError(null);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isTr ? "Yeni Konsey / Grup Topla" : "Convene New Council / Summit"}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-1.5 p-2">
                  {councils.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      {isTr
                        ? "Henüz açılmış bir konsey veya ortak tepki grubu yok. Birden fazla ülke hamlelerinizden rahatsız olursa AI otomatik konsey toplayacaktır; dilerseniz kendiniz de zirve başlatabilirsiniz."
                        : "No open councils or reaction blocs yet. When multiple nations react to your moves, the AI convenes one automatically — or start a summit yourself."}
                    </div>
                  ) : (
                    councils.map((cn) => {
                      const active = !creatingCouncil && cn.id === activeCouncil?.id;
                      const pending = cn.messages.some(
                        (m) =>
                          m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
                      );
                      return (
                        <button
                          key={cn.id}
                          type="button"
                          onClick={() => {
                            setCreatingCouncil(false);
                            setSelectedCouncilId(cn.id);
                          }}
                          className={`w-full rounded-lg border p-2.5 text-left transition cursor-pointer ${
                            active
                              ? "border-primary bg-primary/15"
                              : "border-border/60 bg-secondary/25 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              {COUNCIL_TYPE_LABEL[cn.councilType]?.[locale] ??
                                cn.councilType}
                            </span>
                            {pending && (
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                            )}
                          </div>
                          <div className="mt-0.5 text-xs font-bold text-foreground">
                            {cn.title}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cn.participantCodes.slice(0, 8).map((code) => (
                              <span
                                key={code}
                                className="rounded bg-secondary px-1.5 py-0.5 text-[10px]"
                              >
                                {countryByCode.get(code)?.flagEmoji ?? "🏳️"} {code}
                              </span>
                            ))}
                            {cn.participantCodes.length > 8 && (
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                +{cn.participantCodes.length - 8}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col overflow-hidden bg-[#0b1019] md:col-span-8">
              {creatingCouncil ? (
                <ScrollArea className="flex-1 p-5">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-serif text-base font-bold text-foreground">
                        {isTr
                          ? "Çok Uluslu Konsey / Zirve Başlat"
                          : "Launch Multilateral Council / Summit"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isTr
                          ? "Birden fazla ülkeyi aynı masada toplayıp hak, sınır, ittifak veya kriz müzakeresi açın."
                          : "Bring multiple nations to the same table to negotiate rights, borders, alliances, or crises."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          {isTr ? "Konsey Başlığı" : "Council Title"}
                        </label>
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={
                            isTr
                              ? "Örn: Karadeniz Güvenlik & Ticaret Zirvesi"
                              : "e.g., Black Sea Security & Trade Summit"
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          {isTr ? "Toplantı Türü" : "Summit Type"}
                        </label>
                        <Select
                          value={newType}
                          onValueChange={(v) =>
                            setNewType(
                              v as "SUMMIT" | "COUNCIL" | "COALITION" | "PROTEST"
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUMMIT">
                              {isTr ? "Çok Uluslu Zirve" : "Multilateral Summit"}
                            </SelectItem>
                            <SelectItem value="COUNCIL">
                              {isTr
                                ? "Uluslararası Konsey"
                                : "International Council"}
                            </SelectItem>
                            <SelectItem value="COALITION">
                              {isTr
                                ? "Ortak İttifak / Koalisyon"
                                : "Joint Alliance / Coalition"}
                            </SelectItem>
                            <SelectItem value="PROTEST">
                              {isTr
                                ? "Hak Savunusu / Protesto"
                                : "Diplomatic Protest"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Gündem / Tartışma Konusu" : "Agenda / Topic"}
                      </label>
                      <Input
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        placeholder={
                          isTr
                            ? "Örn: Boğazlar geçiş hakları ve bölgesel yaptırımların kaldırılması"
                            : "e.g., Strait transit rights and lifting regional sanctions"
                        }
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-[11px] text-muted-foreground">
                          {isTr
                            ? `Davet Edilecek Ülkeler (Seçili: ${invitedCodes.length} / ${otherCountries.length})`
                            : `Nations to Invite (Selected: ${invitedCodes.length} / ${otherCountries.length})`}
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const major = otherCountries
                                .filter((c) => c.isMajor)
                                .map((c) => c.code);
                              setInvitedCodes((prev) =>
                                Array.from(new Set([...prev, ...major]))
                              );
                            }}
                            className="rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
                          >
                            {isTr ? "Büyük Güçleri Ekle" : "Add Major Powers"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const visibleCodes = filteredCouncilCountries.map(
                                (c) => c.code
                              );
                              setInvitedCodes((prev) =>
                                Array.from(new Set([...prev, ...visibleCodes]))
                              );
                            }}
                            className="rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
                          >
                            {councilSearch.trim()
                              ? isTr
                                ? `Filtrelenenleri Seç (${filteredCouncilCountries.length})`
                                : `Select Matching (${filteredCouncilCountries.length})`
                              : isTr
                                ? `Tümünü Seç (${otherCountries.length})`
                                : `Select All (${otherCountries.length})`}
                          </button>
                          {invitedCodes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setInvitedCodes([])}
                              className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                            >
                              {isTr ? "Temizle" : "Clear"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={councilSearch}
                          onChange={(e) => setCouncilSearch(e.target.value)}
                          placeholder={
                            isTr
                              ? `Tüm ülkelerde ara (${otherCountries.length} ülke: ad, lider veya kod)...`
                              : `Search all ${otherCountries.length} nations (name, leader, or code)...`
                          }
                          className="h-8 pl-8 text-xs"
                        />
                      </div>

                      <div
                        data-testid="council-country-picker"
                        className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2 sm:grid-cols-3"
                      >
                        {filteredCouncilCountries.length === 0 ? (
                          <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                            {isTr
                              ? "Aramayla eşleşen ülke bulunamadı."
                              : "No matching countries found."}
                          </div>
                        ) : (
                          filteredCouncilCountries.map((c) => {
                            const checked = invitedCodes.includes(c.code);
                            return (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() =>
                                  setInvitedCodes((prev) =>
                                    checked
                                      ? prev.filter((x) => x !== c.code)
                                      : [...prev, c.code]
                                  )
                                }
                                className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] cursor-pointer ${
                                  checked
                                    ? "border-primary bg-primary/20 text-foreground"
                                    : "border-border/50 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="shrink-0">{c.flagEmoji}</span>
                                  <span className="truncate">
                                    {getCountryDisplayName(c.code, c.name, locale)}
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-[9px] opacity-60">
                                  {c.code}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        {isTr ? "Açılış Konuşmanız" : "Opening Statement"}
                      </label>
                      <Textarea
                        value={newOpeningMsg}
                        onChange={(e) => setNewOpeningMsg(e.target.value)}
                        placeholder={
                          isTr
                            ? "Masadaki tüm liderlere hitaben açılış konuşmanızı yazın..."
                            : "Address all attending leaders with your opening statement..."
                        }
                        className="min-h-[84px] text-xs"
                      />
                    </div>

                    {error && (
                      <div className="text-xs text-red-400">{error}</div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setCreatingCouncil(false)}
                      >
                        {isTr ? "İptal" : "Cancel"}
                      </Button>
                      <Button disabled={sending} onClick={handleCreateCouncil}>
                        <Users className="h-4 w-4" />
                        {isTr ? "Konseyi Başlat" : "Launch Council"}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              ) : activeCouncil ? (
                <>
                  <div className="border-b border-border/70 bg-[#0e1522] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="warning">
                            {COUNCIL_TYPE_LABEL[activeCouncil.councilType]?.[
                              locale
                            ] ?? activeCouncil.councilType}
                          </Badge>
                          <h3 className="font-serif text-sm font-bold text-foreground">
                            {activeCouncil.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isTr ? "Gündem" : "Agenda"}: {activeCouncil.topic}
                        </p>
                      </div>
                      <Badge
                        variant={
                          activeCouncil.status === "RESOLVED"
                            ? "success"
                            : activeCouncil.status === "COLLAPSED"
                              ? "destructive"
                              : "default"
                        }
                      >
                        {COUNCIL_STATUS_LABEL[activeCouncil.status]?.[locale] ??
                          activeCouncil.status}
                      </Badge>
                    </div>
                    <div className="mt-2 max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
                      {activeCouncil.participantCodes.map((code) => {
                        const c = countryByCode.get(code);
                        const isEliminated =
                          survivingCountryCodes && !survivingCountryCodes.has(code);
                        const cBlocs = getCountryBlocsAndPacts({
                          countryCode: code,
                          scenarioKey,
                          currentDate,
                          diplomacies,
                          locale,
                        });
                        return (
                          <span
                            key={code}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                              isEliminated
                                ? "border-border/40 bg-secondary/20 text-muted-foreground line-through opacity-60"
                                : "border-border/70 bg-secondary/50"
                            }`}
                          >
                            {c?.flagEmoji ?? "🏳️"}{" "}
                            {getCountryDisplayName(code, c?.name ?? code, locale)}
                            {cBlocs[0] && (
                              <span className="ml-0.5 rounded bg-primary/20 px-1 py-0.2 font-mono text-[9px] text-primary">
                                {cBlocs[0].shortLabel}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* Multilateral Peace Council Resolution Panel when warring nations are at this council table */}
                    {(() => {
                      const pSet = new Set(activeCouncil.participantCodes);
                      const warRels = diplomacies.filter(
                        (d) =>
                          d.status === "WAR" &&
                          pSet.has(d.countryA) &&
                          pSet.has(d.countryB) &&
                          (!survivingCountryCodes ||
                            (survivingCountryCodes.has(d.countryA) &&
                              survivingCountryCodes.has(d.countryB)))
                      );
                      const warPair = warRels[0];
                      if (!warPair || activeCouncil.status !== "OPEN") return null;
                      const cA = countryByCode.get(warPair.countryA);
                      const cB = countryByCode.get(warPair.countryB);
                      if (!cA || !cB) return null;
                      const playerC = playerCountryCode
                        ? countryByCode.get(playerCountryCode)
                        : null;
                      const majorCount = activeCouncil.participantCodes.filter(
                        (code) => countryByCode.get(code)?.isMajor
                      ).length;
                      const whiteEval = evaluatePeaceCouncilReadiness({
                        countryA: cA,
                        countryB: cB,
                        mediatorMilitary: playerC?.military ?? 55,
                        attendeeCount: activeCouncil.participantCodes.length,
                        majorAttendeeCount: majorCount,
                        difficulty,
                        proposalType: "WHITE_PEACE",
                        locale,
                      });
                      const prof = getWarDifficultyProfile(difficulty);
                      const medCost = Math.round(220 * prof.costMultiplier);
                      const coerceCost = Math.round(160 * prof.costMultiplier);

                      const handlePeaceVote = async (
                        proposalType:
                          | "WHITE_PEACE"
                          | "MEDIATED_PACKAGE"
                          | "COERCIVE_COALITION"
                      ) => {
                        setPeaceVoteBusy(true);
                        setPeaceVoteFeedback(null);
                        setError(null);
                        try {
                          const res = await fetch(`/api/sessions/${sessionId}/war`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              mode: "resolve_peace_council",
                              councilId: activeCouncil.id,
                              countryA: cA.code,
                              countryB: cB.code,
                              proposalType,
                              locale,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setError(
                              data.error ||
                                (isTr
                                  ? "Barış oylaması başarısız."
                                  : "Peace vote failed.")
                            );
                          } else {
                            setPeaceVoteFeedback(data.summary);
                            onMessageSent();
                          }
                        } catch {
                          setError(
                            isTr
                              ? "Konsey oylaması sırasında ağ hatası oluştu."
                              : "Network error during council peace vote."
                          );
                        } finally {
                          setPeaceVoteBusy(false);
                        }
                      };

                      return (
                        <div
                          data-testid="council-peace-vote-panel"
                          className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 text-xs space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-semibold text-emerald-300">
                              <Shield className="h-4 w-4 text-emerald-400" />
                              <span>
                                {isTr
                                  ? `Çok Uluslu Barış Oylaması: ${cA.flagEmoji} ${getCountryDisplayName(cA.code, cA.name, locale)} ⚔ ${cB.flagEmoji} ${getCountryDisplayName(cB.code, cB.name, locale)}`
                                  : `Multilateral Peace Vote: ${cA.flagEmoji} ${getCountryDisplayName(cA.code, cA.name, locale)} ⚔ ${cB.flagEmoji} ${getCountryDisplayName(cB.code, cB.name, locale)}`}
                              </span>
                            </div>
                            <Badge
                              variant={
                                whiteEval.score >= whiteEval.threshold
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {isTr
                                ? `Baz Uzlaşı: %${whiteEval.score} / Eşik: %${whiteEval.threshold}`
                                : `Base Consensus: ${whiteEval.score}% / Threshold: ${whiteEval.threshold}%`}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-300">
                            {isTr
                              ? `Seçili zorluk seviyesinde savaşı bitirmek için en az %${whiteEval.threshold} konsey uzlaşısı gerekir. Savaş yorgunluğu (${cA.code}: %${cA.warExhaustion}, ${cB.code}: %${cB.warExhaustion}) düşükse garantör bütçe fonu veya koalisyon baskısı ile oylamayı geçirebilirsiniz.`
                              : `At current difficulty, ending the war requires >=${whiteEval.threshold}% council consensus. If war exhaustion (${cA.code}: ${cA.warExhaustion}%, ${cB.code}: ${cB.warExhaustion}%) is low, use a Reconstruction Fund or Coalition Ultimatum to pass the resolution.`}
                          </p>

                          {peaceVoteFeedback && (
                            <div className="rounded-lg border border-amber-500/40 bg-black/40 px-2.5 py-1.5 text-[11px] text-amber-200">
                              {peaceVoteFeedback}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={peaceVoteBusy}
                              data-testid="council-vote-white-peace-btn"
                              onClick={() => void handlePeaceVote("WHITE_PEACE")}
                              className="h-7 border-emerald-500/45 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                            >
                              {isTr
                                ? `Statüko Ateşkesi Oyla (%${whiteEval.score})`
                                : `Vote Status Quo Ceasefire (${whiteEval.score}%)`}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={peaceVoteBusy}
                              data-testid="council-vote-mediated-btn"
                              onClick={() => void handlePeaceVote("MEDIATED_PACKAGE")}
                              className="h-7 border-amber-500/45 text-[11px] text-amber-200 hover:bg-amber-500/20"
                            >
                              {isTr
                                ? `Garantör Barış Fonu Sun (+%22 • ${medCost} Bütçe)`
                                : `Guarantor Peace Fund (+22% • ${medCost} Treasury)`}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={peaceVoteBusy}
                              data-testid="council-vote-coercive-btn"
                              onClick={() =>
                                void handlePeaceVote("COERCIVE_COALITION")
                              }
                              className="h-7 border-rose-500/45 text-[11px] text-rose-200 hover:bg-rose-500/20"
                            >
                              {isTr
                                ? `Konsey Yaptırım Ültimatomu (+%28 • ${coerceCost} Bütçe)`
                                : `Council Sanction Ultimatum (+28% • ${coerceCost} Treasury)`}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {activeCouncil.messages.map((msg) => {
                        const isPlayer = msg.senderRole === "PLAYER";
                        const senderCountry = countryByCode.get(msg.senderCode);
                        const stanceInfo = msg.stance
                          ? STANCE_BADGE[msg.stance]
                          : null;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${
                              isPlayer ? "items-end" : "items-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                                isPlayer
                                  ? "border-primary/40 bg-primary/15 text-foreground"
                                  : "border-border bg-[#121a28] text-slate-100"
                              }`}
                            >
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                <span className="flex items-center gap-1.5 font-semibold text-primary">
                                  <span>{senderCountry?.flagEmoji ?? "🏳️"}</span>
                                  {msg.senderName}
                                </span>
                                {stanceInfo && !isPlayer && (
                                  <Badge variant={stanceInfo.variant}>
                                    {isTr
                                      ? stanceInfo.labelTr
                                      : stanceInfo.labelEn}
                                  </Badge>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })}

                      {isCouncilWaitingForAi && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                            {isTr
                              ? "Konsey üyeleri mesajınızı tartışıyor (MCP AI bekleniyor)..."
                              : "Council members are debating your proposal (awaiting MCP AI)..."}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyCommand(
                                "council",
                                isTr
                                  ? `mur4history MCP'deki 'diplomatic-councils' ve 'world-state' kaynaklarını oku. Konsey ${activeCouncil.id} için aktif zorluk moduna uygun olarak katılımcı liderlerin birbirine ve oyuncuya karşı argümanlarını 'reply_diplomatic_council' aracıyla ekle.`
                                  : `Read 'diplomatic-councils' and 'world-state' from mur4history MCP. For council ${activeCouncil.id}, add responses from attending leaders reacting to each other and the player via 'reply_diplomatic_council'.`
                              )
                            }
                            className="h-7 text-[10px] border-amber-400/50 text-amber-200"
                          >
                            {copiedPrompt === "council" ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {isTr
                              ? "Konsey Tartışma Komutu Kopyala"
                              : "Copy Council Debate Prompt"}
                          </Button>
                        </div>
                      )}
                      <div ref={councilEndRef} />
                    </div>
                  </ScrollArea>

                  <div className="border-t border-border/70 bg-[#0d1420] p-3">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={councilDraft}
                        onChange={(e) => setCouncilDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendCouncilReply();
                          }
                        }}
                        disabled={!playerCountryCode || sending}
                        placeholder={
                          isTr
                            ? "Konsey masasına hitap edin veya haklarınızı savunun..."
                            : "Address the council table or defend your position..."
                        }
                        className="min-h-[54px] max-h-[110px] resize-none text-xs"
                      />
                      <Button
                        disabled={
                          !playerCountryCode || !councilDraft.trim() || sending
                        }
                        onClick={handleSendCouncilReply}
                        className="h-[54px] px-4 shrink-0"
                      >
                        <Send className="h-4 w-4" />
                        {isTr ? "Konseye Sun" : "Present"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-xs text-muted-foreground">
                  <Users className="h-10 w-10 text-primary/60" />
                  <p className="max-w-md">
                    {isTr
                      ? "Birden fazla ülke aynı hamle veya kriz nedeniyle bize başvurduğunda burada otomatik **Ortak Konsey / Koalisyon** oturumları açılır. İsterseniz sol üstten kendiniz de çok uluslu zirve başlatabilirsiniz."
                      : "When multiple nations react to the same move or crisis, automated Joint Council / Coalition sessions open here. You can also launch your own multilateral summit from the top left."}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </ModalContent>
    </Modal>
  );
}
