"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Gamepad2,
  Globe,
  HardDrive,
  Infinity as InfinityIcon,
  Lock,
  Play,
  Plus,
  PlugZap,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { LanguageSwitcher, useLocale } from "@/components/LanguageProvider";
import {
  CommunityNavBadges,
  CreatorCommunityShowcase,
  DiscordLogoIcon,
} from "@/components/community/CreatorCommunityShowcase";
import {
  type GlobalMcpStatusPayload,
  McpOnboardingHub,
} from "@/components/mcp/McpOnboardingHub";
import { Button } from "@/components/ui/button";
import {
  type CommunityShowcaseData,
  DEFAULT_COMMUNITY_DATA,
} from "@/lib/community";
import { SaveManagerPanel } from "@/components/save/SaveManagerPanel";
import {
  downloadArchiveAsFile,
  fetchSessionArchive,
  importArchiveToServer,
  parseSaveFile,
  saveArchiveToBrowser,
} from "@/lib/browser-saves";
import {
  formatGameDateByLocale,
  formatRelativeTimeByLocale,
  getCountryDisplayName,
  getDifficultyDisplay,
  getScenarioDisplay,
} from "@/lib/i18n";
import { DIFFICULTY_META, getScenarioCoverUrl } from "@/lib/utils";
import { CosmicGlobeCanvas } from "./CosmicGlobeCanvas";
import {
  LaunchScenarioModal,
  type LobbyScenarioItem,
} from "./LaunchScenarioModal";

export interface LobbySessionItem {
  id: string;
  name: string;
  scenarioId: string;
  playerCountryCode: string | null;
  playerCountry: {
    code: string;
    name: string;
    flagEmoji: string;
  } | null;
  currentDate: string;
  turnNumber: number;
  difficulty: string;
  globalTension: number;
  awaitingAiSimulation: boolean;
  lastMcpClientName: string | null;
  updatedAt: string;
  scenario: {
    id: string;
    slug: string;
    title: string;
    era: string;
  };
  _count: {
    events: number;
    orders: number;
    mapMarkers: number;
    snapshots: number;
  };
}

type LobbyTab = "welcome" | "games" | "presets" | "saves";

interface LobbyClientProps {
  initialScenarios: LobbyScenarioItem[];
  initialSessions: LobbySessionItem[];
  initialTab?: string;
  initialMcpStatus?: GlobalMcpStatusPayload;
  initialCommunity?: CommunityShowcaseData;
  projectRoot?: string;
}

const DEFAULT_GLOBAL_MCP: GlobalMcpStatusPayload = {
  connected: false,
  connectionCount: 0,
  aiWaiting: false,
  waitingCount: 0,
  clients: [],
};

function resolveInitialTab(raw?: string): LobbyTab {
  if (raw === "games" || raw === "presets" || raw === "saves" || raw === "welcome") {
    return raw;
  }
  return "welcome";
}

function ScenarioArtwork({
  scenarioId,
  scenarioSlug,
  title,
  className = "",
}: {
  scenarioId?: string | null;
  scenarioSlug?: string | null;
  title: string;
  className?: string;
}) {
  const coverUrl =
    getScenarioCoverUrl(scenarioId) || getScenarioCoverUrl(scenarioSlug);
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,_#2d1b54_0%,_#111829_55%,_#07090f_100%)] ${className}`}
    >
      <div className="flex flex-col items-center gap-1.5 text-center opacity-75">
        <Globe className="h-9 w-9 text-amber-300/80" />
        <span className="px-3 font-serif text-xs font-semibold text-slate-200">
          {title}
        </span>
      </div>
    </div>
  );
}

export function LobbyClient({
  initialScenarios,
  initialSessions,
  initialTab,
  initialMcpStatus = DEFAULT_GLOBAL_MCP,
  initialCommunity = DEFAULT_COMMUNITY_DATA,
  projectRoot,
}: LobbyClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const welcomeFileInputRef = useRef<HTMLInputElement | null>(null);
  const community = initialCommunity;

  const [mcpStatus, setMcpStatus] =
    useState<GlobalMcpStatusPayload>(initialMcpStatus);
  const [resolvedRoot, setResolvedRoot] = useState<string | undefined>(
    projectRoot
  );
  const [gatePulse, setGatePulse] = useState(false);

  const [activeTab, setActiveTab] = useState<LobbyTab>(() =>
    resolveInitialTab(initialTab)
  );
  const mcpConnected = mcpStatus.connected;
  const effectiveTab: LobbyTab = mcpConnected ? activeTab : "welcome";
  const [scenarios, setScenarios] =
    useState<LobbyScenarioItem[]>(initialScenarios);
  const [sessions, setSessions] = useState<LobbySessionItem[]>(initialSessions);

  // Presets carousel state
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  // Launch modal state
  const [launchTarget, setLaunchTarget] = useState<LobbyScenarioItem | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Games tab management & quick actions
  const [showManageTools, setShowManageTools] = useState(false);
  const [saveRefreshTick, setSaveRefreshTick] = useState(0);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [gamesFeedback, setGamesFeedback] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);

  // Welcome hero direct drag-drop save support
  const [welcomeDragging, setWelcomeDragging] = useState(false);
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);

  // Live global MCP status stream + fallback heartbeat poll while unlocked state pending
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/mcp/status", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = (await res.json()) as GlobalMcpStatusPayload & {
          projectRoot?: string;
        };
        setMcpStatus({
          connected: Boolean(data.connected),
          connectionCount: data.connectionCount ?? 0,
          aiWaiting: Boolean(data.aiWaiting),
          waitingCount: data.waitingCount ?? 0,
          clients: data.clients ?? [],
        });
        if (data.projectRoot) setResolvedRoot(data.projectRoot);
      } catch {
        // Ignore transient network failures
      }
    };

    void fetchStatus();
    const es = new EventSource("/api/mcp/events");
    es.addEventListener("global_mcp_status", (e) => {
      try {
        const payload = JSON.parse(
          (e as MessageEvent).data
        ) as GlobalMcpStatusPayload;
        if (active) setMcpStatus(payload);
      } catch {
        // Ignore malformed event
      }
    });

    const poll = window.setInterval(() => {
      void fetchStatus();
    }, 3500);

    return () => {
      active = false;
      es.close();
      window.clearInterval(poll);
    };
  }, []);

  const focusMcpGate = useCallback(() => {
    setActiveTab("welcome");
    setGatePulse(true);
    window.setTimeout(() => setGatePulse(false), 1800);
    setWelcomeError(
      isEn
        ? "MCP connection required: Please configure & connect your AI client below before entering Mur4History."
        : "MCP bağlantısı zorunlu: Oyuna girebilmek için lütfen aşağıdaki rehberi izleyerek veya AI promptunu yapıştırarak MCP bağlayın."
    );
    document
      .getElementById("mcp-onboarding-gate")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isEn]);

  const switchTab = useCallback(
    (next: LobbyTab) => {
      if (!mcpStatus.connected && next !== "welcome") {
        focusMcpGate();
        return;
      }
      setWelcomeError(null);
      setActiveTab(next);
      if (typeof window !== "undefined") {
        const nextUrl = next === "welcome" ? "/" : `/?tab=${next}`;
        window.history.replaceState(null, "", nextUrl);
      }
    },
    [mcpStatus.connected, focusMcpGate]
  );

  // Gentle auto-advance on Presets showcase carousel
  useEffect(() => {
    if (effectiveTab !== "presets" || heroPaused || scenarios.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeroIndex((idx) => (idx + 1) % scenarios.length);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [effectiveTab, heroPaused, scenarios.length]);

  const refreshAll = async () => {
    const [scenRes, sessRes] = await Promise.all([
      fetch("/api/scenarios", { cache: "no-store" }),
      fetch("/api/sessions", { cache: "no-store" }),
    ]);
    if (scenRes.ok) {
      const sData = await scenRes.json();
      setScenarios(sData.scenarios ?? []);
    }
    if (sessRes.ok) {
      const ssData = await sessRes.json();
      setSessions(ssData.sessions ?? []);
    }
  };

  const handleLaunchCampaign = async (params: {
    scenarioId: string;
    difficulty: string;
    campaignName: string;
  }) => {
    if (!mcpConnected) {
      setLaunchTarget(null);
      focusMcpGate();
      return;
    }
    setLaunchError(null);
    setCreating(true);
    try {
      const scenario = scenarios.find((s) => s.id === params.scenarioId);
      const scenDisplay = scenario
        ? getScenarioDisplay(scenario, locale)
        : null;
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: params.scenarioId,
          difficulty: params.difficulty,
          name:
            params.campaignName.trim() ||
            `${scenDisplay?.title ?? (isEn ? "New Campaign" : "Yeni Kampanya")} • ${new Date().toLocaleTimeString(
              isEn ? "en-US" : "tr-TR",
              { hour: "2-digit", minute: "2-digit" }
            )}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLaunchError(
          data.error ||
            (isEn ? "Could not create session." : "Oturum oluşturulamadı.")
        );
        return;
      }
      setLaunchTarget(null);
      router.push(`/session/${data.session.id}`);
    } catch (err) {
      setLaunchError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Connection error"
            : "Bağlantı hatası"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCloneSession = async (id: string) => {
    setGamesError(null);
    setGamesFeedback(null);
    setSessionBusyId(`cl:${id}`);
    try {
      const res = await fetch(`/api/sessions/${id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (!res.ok || !data?.session?.id) {
        throw new Error(
          data?.error ||
            (isEn ? "Could not clone session." : "Oturum klonlanamadı.")
        );
      }
      await refreshAll();
      setGamesFeedback(
        isEn
          ? `Campaign cloned: "${data.session.name}"`
          : `Oyun klonlandı: "${data.session.name}"`
      );
    } catch (err) {
      setGamesError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not clone session."
            : "Oturum klonlanamadı."
      );
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleDeleteSession = async (id: string) => {
    setGamesError(null);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDownloadSession = async (id: string) => {
    setGamesError(null);
    setGamesFeedback(null);
    setSessionBusyId(`dl:${id}`);
    try {
      const archive = await fetchSessionArchive(id);
      const fname = downloadArchiveAsFile(archive);
      setGamesFeedback(
        isEn ? `Save downloaded: ${fname}` : `Kayıt indirildi: ${fname}`
      );
    } catch (err) {
      setGamesError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not download save."
            : "Kayıt dosyası indirilemedi."
      );
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleBackupSessionToBrowser = async (id: string) => {
    setGamesError(null);
    setGamesFeedback(null);
    setSessionBusyId(`br:${id}`);
    try {
      const archive = await fetchSessionArchive(id);
      const saved = await saveArchiveToBrowser(archive);
      setSaveRefreshTick((t) => t + 1);
      setGamesFeedback(
        isEn
          ? `Saved to browser storage: ${saved.label}`
          : `Tarayıcıya kaydedildi: ${saved.label}`
      );
    } catch (err) {
      setGamesError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not save to browser."
            : "Tarayıcıya kaydedilemedi."
      );
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleWelcomeSaveFile = async (file: File) => {
    if (!mcpConnected) {
      focusMcpGate();
      return;
    }
    setWelcomeError(null);
    setWelcomeBusy(true);
    try {
      const archive = await parseSaveFile(file);
      await saveArchiveToBrowser(archive).catch(() => null);
      const { sessionId } = await importArchiveToServer(archive);
      router.push(`/session/${sessionId}`);
    } catch (err) {
      setWelcomeError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not import save file."
            : "İlerleme dosyası içe aktarılamadı."
      );
    } finally {
      setWelcomeBusy(false);
    }
  };

  const safeHeroIndex =
    scenarios.length > 0 ? heroIndex % scenarios.length : 0;
  const featuredScenario = scenarios[safeHeroIndex] ?? null;
  const featuredDisplay = featuredScenario
    ? getScenarioDisplay(featuredScenario, locale)
    : null;

  const renderSessionCard = (s: LobbySessionItem) => {
    const diffLabel = getDifficultyDisplay(
      s.difficulty,
      locale,
      DIFFICULTY_META[s.difficulty] ?? DIFFICULTY_META.NORMAL
    ).label;
    const countryLabel = s.playerCountry
      ? `${s.playerCountry.flagEmoji} ${getCountryDisplayName(
          s.playerCountry.code,
          s.playerCountry.name,
          locale
        )}`
      : s.playerCountryCode || (isEn ? "No Nation Selected" : "Ülke Seçilmedi");

    return (
      <div key={s.id} className="group flex flex-col gap-2.5">
        {/* 16:9 Artwork Card */}
        <div
          onClick={() => {
            if (!mcpConnected) {
              focusMcpGate();
              return;
            }
            router.push(`/session/${s.id}`);
          }}
          className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#0d1018] shadow-lg transition-all duration-300 group-hover:border-white/25 group-hover:shadow-2xl"
        >
          <ScenarioArtwork
            scenarioId={s.scenario.id}
            scenarioSlug={s.scenario.slug}
            title={getScenarioDisplay(s.scenario, locale).title}
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

          {/* Bottom-left frosted country tag */}
          <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
            <span>{countryLabel}</span>
          </div>

          {/* Quick Actions overlay */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-2.5 top-2.5 flex items-center gap-1 transition-opacity duration-200 ${
              showManageTools
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              type="button"
              data-testid="clone-lobby-session-btn"
              disabled={sessionBusyId !== null}
              onClick={() => void handleCloneSession(s.id)}
              className="cursor-pointer rounded-md border border-white/15 bg-black/80 p-1.5 text-emerald-300 backdrop-blur-md hover:bg-emerald-500/25 disabled:opacity-40"
              title={isEn ? "Clone Save / Campaign" : "Kaydı Klonla"}
            >
              <Copy
                className={`h-3.5 w-3.5 ${
                  sessionBusyId === `cl:${s.id}` ? "animate-pulse" : ""
                }`}
              />
            </button>
            <button
              type="button"
              disabled={sessionBusyId !== null}
              onClick={() => void handleBackupSessionToBrowser(s.id)}
              className="cursor-pointer rounded-md border border-white/15 bg-black/80 p-1.5 text-sky-300 backdrop-blur-md hover:bg-sky-500/25 disabled:opacity-40"
              title={
                isEn
                  ? "Save to Browser (IndexedDB)"
                  : "Tarayıcıya Kaydet (IndexedDB)"
              }
            >
              <HardDrive className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={sessionBusyId !== null}
              onClick={() => void handleDownloadSession(s.id)}
              className="cursor-pointer rounded-md border border-white/15 bg-black/80 p-1.5 text-amber-300 backdrop-blur-md hover:bg-amber-500/25 disabled:opacity-40"
              title={
                isEn
                  ? "Download as .mur4history.json"
                  : ".mur4history.json Olarak İndir"
              }
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSession(s.id)}
              className="cursor-pointer rounded-md border border-white/15 bg-black/80 p-1.5 text-red-400 backdrop-blur-md hover:bg-red-500/25"
              title={isEn ? "Delete Session" : "Oturumu Sil"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clean Title + Subline underneath */}
        <div
          onClick={() => {
            if (!mcpConnected) {
              focusMcpGate();
              return;
            }
            router.push(`/session/${s.id}`);
          }}
          className="cursor-pointer space-y-0.5 px-0.5"
        >
          <div className="truncate text-sm font-semibold text-white group-hover:text-amber-300">
            {s.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>
              {s.turnNumber} {isEn ? (s.turnNumber === 1 ? "turn" : "turns") : "tur"}
            </span>
            <span>•</span>
            <span>{formatRelativeTimeByLocale(s.updatedAt, locale)}</span>
            <span>•</span>
            <span>{diffLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#04060a] text-foreground">
      {/* Sleek Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070c]/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0">
          {/* Left Brand -> Welcome Splash */}
          <button
            type="button"
            onClick={() => switchTab("welcome")}
            title="Mur4History"
            className="flex cursor-pointer items-center gap-2.5 text-left transition hover:opacity-90"
          >
            <img
              src="/images/brand/mur4history-icon.png"
              alt="Mur4History"
              className="h-8 w-8 rounded-lg object-cover shadow-sm"
            />
            <span className="font-serif text-base font-bold tracking-tight">
              <span className="text-[#eee3c9]">Mur4</span>
              <span className="bg-gradient-to-r from-[#d4885e] to-[#b56642] bg-clip-text text-transparent">
                History
              </span>
            </span>
          </button>

          {/* Compact mobile badge & language switch */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={focusMcpGate}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                mcpConnected
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-400/50 bg-amber-500/15 text-amber-300"
              }`}
            >
              {mcpConnected ? (
                <InfinityIcon className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              <span>{mcpConnected ? "MCP" : isEn ? "Lock" : "Kilit"}</span>
            </button>
          </div>

          {/* Center Nav Pills */}
          <nav
            aria-label={isEn ? "Main Menu Navigation" : "Ana Menü Gezintisi"}
            className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-1.5"
          >
            <button
              type="button"
              data-testid="nav-tab-games"
              title={
                mcpConnected
                  ? undefined
                  : isEn
                    ? "Connect MCP first to enter Games"
                    : "Oyunlara girmek için önce MCP bağlayın"
              }
              onClick={() => switchTab("games")}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                effectiveTab === "games"
                  ? "border border-purple-400/35 bg-[#231238] text-white shadow-[0_0_16px_rgba(168,85,247,0.18)]"
                  : !mcpConnected
                    ? "text-slate-500 hover:bg-white/[0.04] hover:text-amber-300"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {!mcpConnected ? (
                <Lock className="h-3 w-3 text-amber-400/90" />
              ) : (
                <Gamepad2 className="h-3.5 w-3.5" />
              )}
              {isEn ? "Games" : "Oyunlar"}
              {sessions.length > 0 && (
                <span className="ml-0.5 rounded-full bg-white/10 px-1.5 text-[10px] text-slate-200">
                  {sessions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="nav-tab-presets"
              title={
                mcpConnected
                  ? undefined
                  : isEn
                    ? "Connect MCP first to browse Presets"
                    : "Presetlere girmek için önce MCP bağlayın"
              }
              onClick={() => switchTab("presets")}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                effectiveTab === "presets"
                  ? "border border-purple-400/35 bg-[#231238] text-white shadow-[0_0_16px_rgba(168,85,247,0.18)]"
                  : !mcpConnected
                    ? "text-slate-500 hover:bg-white/[0.04] hover:text-amber-300"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {!mcpConnected ? (
                <Lock className="h-3 w-3 text-amber-400/90" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isEn ? "Presets" : "Presetler"}
            </button>

            <button
              type="button"
              data-testid="nav-tab-saves"
              title={
                mcpConnected
                  ? undefined
                  : isEn
                    ? "Connect MCP first to open Saves"
                    : "Kayıtlara girmek için önce MCP bağlayın"
              }
              onClick={() => switchTab("saves")}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                effectiveTab === "saves"
                  ? "border border-purple-400/35 bg-[#231238] text-white shadow-[0_0_16px_rgba(168,85,247,0.18)]"
                  : !mcpConnected
                    ? "text-slate-500 hover:bg-white/[0.04] hover:text-amber-300"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {!mcpConnected ? (
                <Lock className="h-3 w-3 text-amber-400/90" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isEn ? "Saves & Load" : "Kayıtlar & Yükle"}
              </span>
              <span className="sm:hidden">{isEn ? "Saves" : "Kayıtlar"}</span>
            </button>
          </nav>

          {/* Right Community Badges + Signature Pill + Language Switcher */}
          <div className="hidden items-center gap-2 sm:flex">
            <CommunityNavBadges data={community} />
            <LanguageSwitcher />
            <button
              type="button"
              onClick={focusMcpGate}
              title={
                isEn
                  ? "100% Free MCP Architecture — View live connection & tutorial"
                  : "%100 Ücretsiz MCP Mimarisi — Canlı bağlantı durumunu ve rehberi aç"
              }
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                mcpConnected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  : "border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  mcpConnected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400 animate-ping"
                }`}
              />
              <span>
                {mcpConnected
                  ? isEn
                    ? "MCP Connected"
                    : "MCP Bağlı"
                  : isEn
                    ? "Connect MCP"
                    : "MCP Bekleniyor"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchTab("welcome")}
              title={isEn ? "Welcome Screen" : "Karşılama Ekranı"}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition ${
                effectiveTab === "welcome"
                  ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                  : "border-white/15 bg-[#0c0f17] text-slate-400 hover:border-white/30 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          TAB 1: COSMIC WELCOME SPLASH + MCP TUTORIAL & GATE
         ============================================================ */}
      {effectiveTab === "welcome" && (
        <main
          onDragOver={(e) => {
            if (!mcpConnected) return;
            e.preventDefault();
            setWelcomeDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) {
              setWelcomeDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setWelcomeDragging(false);
            if (!mcpConnected) {
              focusMcpGate();
              return;
            }
            const file = e.dataTransfer?.files?.[0];
            if (file) {
              void handleWelcomeSaveFile(file);
            }
          }}
          className="relative flex flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-visible bg-[#020306] px-4 pt-6 pb-16 sm:pt-8"
        >
          <CosmicGlobeCanvas />

          {welcomeDragging && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
              <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-500/15 px-8 py-6 text-center shadow-2xl">
                <UploadCloud className="mx-auto mb-2 h-9 w-9 text-emerald-300" />
                <div className="text-base font-bold text-white">
                  {isEn
                    ? "Drop Save File — Instant Restore"
                    : "Kayıt Dosyasını Bırakın — Oyun Anında Yüklenecek"}
                </div>
                <div className="mt-1 text-xs text-emerald-200">
                  {isEn
                    ? "Your .mur4history.json archive opens immediately with full map and history"
                    : ".mur4history.json ilerleme paketiniz tüm harita ve geçmişiyle açılır"}
                </div>
              </div>
            </div>
          )}

          {/* Hero Copy Stack */}
          <div className="relative z-10 flex max-w-2xl flex-col items-center rounded-3xl px-6 py-4 text-center">
            <img
              src="/images/brand/mur4history-logo.png"
              alt="Mur4History"
              className="mb-3 h-28 w-auto select-none drop-shadow-[0_4px_24px_rgba(205,134,90,0.18)] sm:h-36"
            />
            <div className="relative inline-block">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                {isEn ? "Welcome to Mur4History" : "Hoş Geldiniz Mur4History"}
              </h1>
              <span className="absolute -right-2 -top-3 rotate-[-10deg] rounded bg-amber-300 px-1.5 py-0.5 text-[11px] font-extrabold text-black shadow sm:-right-7 sm:-top-2">
                MCP!
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              {isEn
                ? "An alternate history sandbox & grand strategy game"
                : "Bir alternatif tarih sandbox & büyük strateji oyunu"}
            </p>

            {/* Live MCP Gate Status Pill */}
            <div
              data-testid="welcome-mcp-pill"
              className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold backdrop-blur-md ${
                mcpConnected
                  ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-400/55 bg-amber-500/15 text-amber-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  mcpConnected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400 animate-ping"
                }`}
              />
              {mcpConnected
                ? isEn
                  ? `MCP Connected (${mcpStatus.clients[0]?.clientName || "AI Ready"}) — Entry Unlocked`
                  : `MCP Bağlı (${mcpStatus.clients[0]?.clientName || "AI Hazır"}) — Giriş Açık`
                : isEn
                  ? "MCP Required — Connect your AI below before playing"
                  : "MCP Zorunlu — Başlamadan önce aşağıdan MCP bağlayın"}
            </div>

            {/* Gradient-Bordered Pill Launch CTA */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                data-testid="welcome-start-btn"
                onClick={() => {
                  if (!mcpConnected) {
                    focusMcpGate();
                    return;
                  }
                  switchTab("presets");
                }}
                className={`group inline-flex cursor-pointer items-center justify-center rounded-full p-[1.5px] transition-transform duration-200 hover:scale-[1.03] ${
                  mcpConnected
                    ? "bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 shadow-[0_0_26px_rgba(168,85,247,0.3)]"
                    : "bg-gradient-to-r from-amber-500/80 via-orange-500/80 to-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
                }`}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-[#05070c] px-8 py-2.5 text-sm font-semibold text-white transition group-hover:bg-[#0b0e18]">
                  {mcpConnected ? (
                    <>
                      {isEn ? "Start" : "Başla"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-amber-300" />
                      {isEn ? "Connect MCP to Start" : "Önce MCP Bağlayın"}
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Quick Shortcuts + Drag-Drop Save Pill */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => switchTab("games")}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur-md transition ${
                  mcpConnected
                    ? "border-white/15 bg-black/55 text-slate-200 hover:border-white/35 hover:text-white"
                    : "border-white/10 bg-black/45 text-slate-400 hover:border-amber-400/40 hover:text-amber-200"
                }`}
              >
                {!mcpConnected ? (
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Gamepad2 className="h-3.5 w-3.5 text-purple-300" />
                )}
                {isEn ? `My Games (${sessions.length})` : `Oyunlarım (${sessions.length})`}
              </button>

              <input
                ref={welcomeFileInputRef}
                type="file"
                accept=".json,.mur4history.json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleWelcomeSaveFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={welcomeBusy}
                onClick={() => {
                  if (!mcpConnected) {
                    focusMcpGate();
                    return;
                  }
                  welcomeFileInputRef.current?.click();
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-4 py-1.5 text-xs font-medium backdrop-blur-md transition ${
                  mcpConnected
                    ? "border-amber-300/45 bg-black/55 text-amber-200 hover:border-amber-300 hover:bg-amber-400/10"
                    : "border-white/15 bg-black/45 text-slate-400 hover:border-amber-400/40 hover:text-amber-200"
                }`}
              >
                {!mcpConnected ? (
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                {welcomeBusy
                  ? isEn
                    ? "Loading Save..."
                    : "Kayıt Yükleniyor..."
                  : isEn
                    ? "Drop or Import Save (.json)"
                    : "Kayıt Sürükle veya İçe Aktar (.json)"}
              </button>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("mcp-onboarding-gate")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-medium text-amber-100 backdrop-blur-md transition hover:bg-primary/20"
              >
                <PlugZap className="h-3.5 w-3.5 text-primary" />
                {isEn
                  ? "MCP Tutorial & AI Setup Prompt ↓"
                  : "MCP Rehberi & AI Kurulum Promptu ↓"}
              </button>
            </div>

            {welcomeError && (
              <div className="mt-4 rounded-lg border border-amber-500/45 bg-amber-950/80 px-4 py-2 text-xs text-amber-200 backdrop-blur-md">
                {welcomeError}
              </div>
            )}
          </div>

          {/* Interactive MCP Onboarding Tutorial, Gate & Master AI Setup Prompt */}
          <div className="relative z-10 mt-10 w-full max-w-5xl space-y-8">
            <McpOnboardingHub
              mcpStatus={mcpStatus}
              projectRoot={resolvedRoot}
              highlightPulse={gatePulse}
            />

            {/* Modern Animated Discord Server & GitHub Creator Profile Cards */}
            <CreatorCommunityShowcase data={community} />
          </div>
        </main>
      )}

      {/* ============================================================
          TAB 2: GAMES & SAVE DROPZONE
         ============================================================ */}
      {effectiveTab === "games" && (
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {isEn ? "Your Games" : "Oyunlarınız"}{" "}
              <span className="font-normal text-slate-500">
                / {isEn ? "All" : "Tümü"}
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showManageTools}
                  onClick={() => setShowManageTools((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                    showManageTools
                      ? "border-purple-400 bg-purple-600"
                      : "border-white/20 bg-white/10"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      showManageTools ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                {isEn
                  ? "Show backup & delete tools"
                  : "Yedek & silme butonlarını göster"}
              </label>

              <Button
                size="sm"
                onClick={() => switchTab("presets")}
                className="bg-white text-black hover:bg-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
                {isEn ? "Start New Game" : "Yeni Oyun Başlat"}
              </Button>
            </div>
          </div>

          {gamesFeedback && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
              {gamesFeedback}
            </div>
          )}
          {gamesError && (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
              {gamesError}
            </div>
          )}

          {/* First-Screen Save / Drag-Drop Import & Browser Storage Panel */}
          <section
            aria-label={
              isEn
                ? "Load Progress and Browser Saves"
                : "İlerleme Yükle ve Tarayıcı Kayıtları"
            }
            className="rounded-2xl border border-white/10 bg-[#080b12] p-4 sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <HardDrive className="h-4 w-4 text-amber-300" />
                {isEn
                  ? "Load Progress & Browser Saves (Drag & Drop)"
                  : "İlerleme Yükle & Tarayıcı Kayıtları (Sürükle-Bırak)"}
              </div>
              <span className="text-[11px] text-slate-400">
                {isEn ? (
                  <>
                    Drag your downloaded <code>.mur4history.json</code> save or
                    resume from browser storage
                  </>
                ) : (
                  <>
                    İndirdiğiniz <code>.mur4history.json</code> kaydını
                    sürükleyin ya da tarayıcınızdaki yedeği açın
                  </>
                )}
              </span>
            </div>
            <SaveManagerPanel
              variant="lobby"
              refreshTrigger={saveRefreshTick}
            />
          </section>

          {/* Continue Playing */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-slate-100">
              {isEn ? "Continue playing" : "Oynamaya devam et"}
            </h2>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#080b12] px-6 py-12 text-center">
                <Globe className="mb-3 h-8 w-8 text-slate-500" />
                <div className="text-sm font-medium text-slate-200">
                  {isEn
                    ? "No active game sessions yet"
                    : "Henüz aktif oyun oturumunuz yok"}
                </div>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  {isEn
                    ? "Switch to Presets to start a new historical era, or drop an exported save file above."
                    : "Yeni bir tarihsel dönem seçmek için Presetler sekmesine geçin veya yukarıdan kayıtlı bir ilerleme dosyası sürükleyin."}
                </p>
                <Button
                  size="sm"
                  onClick={() => switchTab("presets")}
                  className="mt-4 bg-white text-black hover:bg-slate-200"
                >
                  <Play className="h-3.5 w-3.5" />
                  {isEn ? "Browse Presets" : "Presetlere Git"}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {sessions.map(renderSessionCard)}
              </div>
            )}
          </section>

          {/* Recently Started */}
          {sessions.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-slate-100">
                {isEn ? "Recently started" : "Son başlananlar"}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[...sessions]
                  .sort((a, b) => a.turnNumber - b.turnNumber)
                  .slice(0, 4)
                  .map(renderSessionCard)}
              </div>
            </section>
          )}
        </main>
      )}

      {/* ============================================================
          TAB 3: PRESETS SHOWCASE
         ============================================================ */}
      {effectiveTab === "presets" && (
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-6 py-7">
          {featuredScenario && featuredDisplay && (
            <section
              aria-label={isEn ? "Featured Scenario" : "Öne Çıkan Senaryo"}
              onMouseEnter={() => setHeroPaused(true)}
              onMouseLeave={() => setHeroPaused(false)}
              className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#090c14] shadow-2xl sm:h-[400px]"
            >
              <ScenarioArtwork
                scenarioId={featuredScenario.id}
                scenarioSlug={featuredScenario.slug}
                title={featuredDisplay.title}
                className="transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-black/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/25" />

              {scenarios.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={isEn ? "Previous scenario" : "Önceki senaryo"}
                    onClick={() =>
                      setHeroIndex(
                        (idx) => (idx - 1 + scenarios.length) % scenarios.length
                      )
                    }
                    className="absolute right-14 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/85 sm:left-3 sm:right-auto sm:top-1/2 sm:h-9 sm:w-9 sm:-translate-y-1/2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={isEn ? "Next scenario" : "Sonraki senaryo"}
                    onClick={() =>
                      setHeroIndex((idx) => (idx + 1) % scenarios.length)
                    }
                    className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/85 sm:top-1/2 sm:h-9 sm:w-9 sm:-translate-y-1/2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <div className="absolute bottom-8 left-4 right-4 z-10 max-w-xl space-y-2 sm:left-14 sm:right-6 sm:space-y-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur-md">
                  <span>{featuredDisplay.era}</span>
                  <span>•</span>
                  <span>
                    {featuredScenario.isPreset
                      ? isEn
                        ? "Official Preset"
                        : "Resmi Preset"
                      : isEn
                        ? "Custom JSON"
                        : "Özel JSON"}
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                  {featuredDisplay.title}
                </h1>

                <div className="text-xs text-slate-300">
                  {isEn
                    ? `Start: ${formatGameDateByLocale(
                        featuredScenario.startDate,
                        locale
                      )} • 1 Turn = ${featuredScenario.turnIntervalMonths} Mo • 270 Interactive Provinces`
                    : `Başlangıç: ${formatGameDateByLocale(
                        featuredScenario.startDate,
                        locale
                      )} • 1 Tur = ${featuredScenario.turnIntervalMonths} Ay • 270 Etkileşimli Eyalet`}
                </div>

                <p className="line-clamp-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {featuredDisplay.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLaunchError(null);
                      setLaunchTarget(featuredScenario);
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black shadow-lg transition hover:bg-slate-200"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {isEn ? "Open" : "Aç"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab("games")}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:border-white/40"
                  >
                    {isEn
                      ? `Saved Games (${sessions.length})`
                      : `Kayıtlı Oyunlar (${sessions.length})`}
                  </button>
                </div>
              </div>

              {scenarios.length > 1 && (
                <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
                  {scenarios.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={
                        isEn
                          ? `Go to slide ${getScenarioDisplay(s, locale).title}`
                          : `${getScenarioDisplay(s, locale).title} slaytına git`
                      }
                      onClick={() => setHeroIndex(idx)}
                      className={`h-1.5 cursor-pointer rounded-full transition-all ${
                        idx === safeHeroIndex
                          ? "w-5 bg-white"
                          : "w-1.5 bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Numbered Scenario Shelf */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-semibold text-white">
                  {isEn ? "Historical Scenarios" : "Tarihsel Senaryolar"}
                </h2>
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchTab("saves")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#0c1018] px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/35 hover:text-white"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-sky-300" />
                  {isEn ? "Manage Saves" : "Kayıtları Yönet"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {scenarios.map((scen, idx) => {
                const sd = getScenarioDisplay(scen, locale);
                return (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => {
                      setLaunchError(null);
                      setLaunchTarget(scen);
                    }}
                    className="group relative flex cursor-pointer flex-col gap-2.5 text-left"
                  >
                    <div className="flex items-end gap-2">
                      <span className="select-none font-serif text-5xl font-black leading-none text-white/20 transition-colors group-hover:text-amber-300/65 sm:text-6xl">
                        {idx + 1}
                      </span>

                      <div className="relative aspect-[16/10] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d1018] shadow-lg transition-all duration-300 group-hover:border-white/30">
                        <ScenarioArtwork
                          scenarioId={scen.id}
                          scenarioSlug={scen.slug}
                          title={sd.title}
                          className="transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur-md">
                          {scen.isPreset
                            ? isEn
                              ? "Official"
                              : "Resmi"
                            : isEn
                              ? "Custom"
                              : "Özel"}
                        </div>
                      </div>
                    </div>

                    <div className="pl-7 sm:pl-9">
                      <div className="truncate text-sm font-semibold text-white group-hover:text-amber-300">
                        {sd.title}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {sd.era} • {formatGameDateByLocale(scen.startDate, locale)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          TAB 4: DEDICATED SAVE MANAGER & FILE DROPZONE
         ============================================================ */}
      {effectiveTab === "saves" && (
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {isEn ? "Save Center" : "Kayıt Merkezi"}{" "}
                <span className="font-normal text-slate-500">
                  /{" "}
                  {isEn
                    ? "Import & Browser Storage"
                    : "İçe Aktar & Tarayıcı Depolama"}
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                {isEn ? (
                  <>
                    Download your progress as <code>.mur4history.json</code>,
                    store campaigns inside your browser, or drop a save file to
                    restore everything seamlessly.
                  </>
                ) : (
                  <>
                    İlerlemenizi bilgisayarınıza <code>.mur4history.json</code>{" "}
                    olarak indirin, tarayıcıda saklayın veya daha önce
                    indirdiğiniz bir kaydı sürükleyip bırakarak eksiksiz geri
                    yükleyin.
                  </>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => switchTab("games")}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              {isEn ? "Back to Games" : "Oyunlar'a Dön"}
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#080b12] p-5">
            <SaveManagerPanel
              variant="lobby"
              refreshTrigger={saveRefreshTick}
            />
          </div>
        </main>
      )}

      {/* Clean Minimal Footer */}
      <footer className="border-t border-white/10 bg-[#030508] py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/brand/mur4history-icon.png"
              alt="Mur4History"
              className="h-7 w-7 rounded-lg object-cover shadow-sm"
            />
            <span className="font-medium text-slate-300">
              Mur4History © 2026
            </span>
            <span className="text-slate-600">•</span>
            <span>
              {isEn
                ? "Local MCP Grand Strategy Simulator"
                : "Yerel MCP Büyük Strateji Simülatörü"}
            </span>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="inline-flex items-center gap-2 text-[11px] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {isEn
                ? "MCP Bridge Ready (Antigravity / Cursor / Claude)"
                : "MCP Köprüsü Hazır (Antigravity / Cursor / Claude)"}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <a
                href={community.discord.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-300 transition hover:text-cyan-200"
              >
                <DiscordLogoIcon className="h-3.5 w-3.5" />
                Discord ({community.discord.guildName})
              </a>
              <a
                href={community.github.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-200 transition hover:text-white"
              >
                <img
                  src={community.github.fallbackAvatarUrl}
                  alt={community.github.login}
                  className="h-4 w-4 rounded-full object-cover ring-1 ring-amber-300/40"
                />
                @{community.github.login}
              </a>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={() => switchTab("games")}
                className="cursor-pointer hover:text-white"
              >
                {isEn ? "Games" : "Oyunlar"}
              </button>
              <button
                type="button"
                onClick={() => switchTab("presets")}
                className="cursor-pointer hover:text-white"
              >
                {isEn ? "Presets" : "Presetler"}
              </button>
              <button
                type="button"
                onClick={() => switchTab("saves")}
                className="cursor-pointer hover:text-white"
              >
                {isEn ? "Saves & Load" : "Kayıtlar & Yükle"}
              </button>
            </div>
          </div>
        </div>
      </footer>

      <LaunchScenarioModal
        scenario={launchTarget}
        open={launchTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLaunchTarget(null);
        }}
        creating={creating}
        error={launchError}
        onLaunch={handleLaunchCampaign}
      />
    </div>
  );
}
