"use client";

import { useLocale } from "@/components/LanguageProvider";
import { getCountryDisplayName } from "@/lib/i18n";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Flag,
  Flame,
  MessageSquare,
  Newspaper,
  Radio,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import {
  type GlobalMcpStatusPayload,
  McpOnboardingHub,
} from "@/components/mcp/McpOnboardingHub";
import type {
  DifficultyLevel,
  McpConnectionStatus,
  MapMode,
  SessionState,
  TimeJumpInterval,
  WarOperationRecord,
  WarRiskSummary,
} from "@/lib/client-types";
import { ambientMusic } from "@/lib/ambient-music";
import { playWarActionSfx } from "@/lib/war-sfx";
import {
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  loadGameSettings,
  saveGameSettings,
} from "@/lib/map-themes";
import { WorldMap } from "./WorldMap";
import type { NuclearAnimationEvent } from "./WarEffectsCanvas";
import { TopHud } from "./TopHud";
import { CountrySidebar } from "./CountrySidebar";
import { ChronicleSidebar } from "./ChronicleSidebar";
import { OrderConsole } from "./OrderConsole";
import { McpConnectModal } from "./McpConnectModal";
import { RollbackModal } from "./RollbackModal";
import { McpDebugDrawer } from "./McpDebugDrawer";
import { CountrySelectOverlay } from "./CountrySelectOverlay";
import { LeaderChatModal } from "./LeaderChatModal";
import { AdvisorModal } from "./AdvisorModal";
import { SaveProgressModal } from "./SaveProgressModal";
import { SettingsModal } from "./SettingsModal";
import { WarRoomModal } from "./WarRoomModal";

interface GameWorkspaceProps {
  initialSession: SessionState;
  initialGlobalMcpStatus?: GlobalMcpStatusPayload;
  projectRoot?: string;
}

const DEFAULT_SESSION_MCP: GlobalMcpStatusPayload = {
  connected: false,
  connectionCount: 0,
  aiWaiting: false,
  waitingCount: 0,
  clients: [],
};

export function GameWorkspace({
  initialSession,
  initialGlobalMcpStatus = DEFAULT_SESSION_MCP,
  projectRoot,
}: GameWorkspaceProps) {
  const [session, setSession] = useState<SessionState>(initialSession);
  const [globalMcpStatus, setGlobalMcpStatus] =
    useState<GlobalMcpStatusPayload>(initialGlobalMcpStatus);
  const [resolvedRoot, setResolvedRoot] = useState<string | undefined>(
    projectRoot
  );
  const [mapMode, setMapMode] = useState<MapMode>("political");
  const [gameSettings, setGameSettings] = useState<GameSettings>(
    DEFAULT_GAME_SETTINGS
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [inspectedCountryCode, setInspectedCountryCode] = useState<string | null>(
    initialSession.playerCountryCode ?? initialSession.countries[0]?.code ?? null
  );
  const [flashedRegionIds, setFlashedRegionIds] = useState<string[]>([]);
  const [flashedMarkerIds, setFlashedMarkerIds] = useState<string[]>([]);
  const [focusMarkerCoord, setFocusMarkerCoord] = useState<{
    lng: number;
    lat: number;
    ts: number;
  } | null>(null);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const [leaderChatOpen, setLeaderChatOpen] = useState(false);
  const [leaderChatTab, setLeaderChatTab] = useState<"direct" | "councils">("direct");
  const [leaderChatTarget, setLeaderChatTarget] = useState<string | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [warRoomOpen, setWarRoomOpen] = useState(false);
  const [warRoomTab, setWarRoomTab] = useState<"fronts" | "meddle" | "radar">("fronts");
  const [warRoomTarget, setWarRoomTarget] = useState<string | null>(null);
  const [warHotspots, setWarHotspots] = useState<WarRiskSummary[]>([]);
  const [playerRisks, setPlayerRisks] = useState<Record<string, WarRiskSummary>>({});
  const [activeNukes, setActiveNukes] = useState<NuclearAnimationEvent[]>([]);
  const [nukeShake, setNukeShake] = useState(false);
  const [autoBattleEnabled, setAutoBattleEnabled] = useState(true);
  const [quickDiploTarget, setQuickDiploTarget] = useState<string | null>(null);
  const [prefillOrderText, setPrefillOrderText] = useState<string | null>(null);
  const [prefillOrderCategory, setPrefillOrderCategory] = useState<string | null>(
    null
  );

  const [showCountryPanel, setShowCountryPanel] = useState(false);
  const [showChroniclePanel, setShowChroniclePanel] = useState(false);
  const [showOrderConsole, setShowOrderConsole] = useState(true);

  const { locale } = useLocale();
  const isTr = locale === "tr";
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    if (window.innerWidth >= 1280) {
      setShowCountryPanel(true);
      setShowChroniclePanel(true);
    }
    const loaded = loadGameSettings();
    setGameSettings(loaded);
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    saveGameSettings(gameSettings);
    void ambientMusic
      .configure({
        enabled: gameSettings.audio.musicEnabled,
        trackId: gameSettings.audio.trackId,
        volume: gameSettings.audio.volume,
      })
      .then((running) => setAudioUnlocked(running));
  }, [gameSettings, settingsLoaded]);

  useEffect(() => {
    const unlock = () => {
      if (!gameSettings.audio.musicEnabled) return;
      void ambientMusic.tryUnlockIfEnabled().then((running) => {
        if (running) setAudioUnlocked(true);
      });
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [gameSettings.audio.musicEnabled]);

  useEffect(() => {
    return () => {
      ambientMusic.stop();
    };
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setGameSettings(next);
  }, []);

  const handleToggleMuteMusic = useCallback(() => {
    setGameSettings((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        musicEnabled: !prev.audio.musicEnabled,
      },
    }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setLiveToast(msg);
    setTimeout(() => {
      setLiveToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const soundEnabledRef = useRef(true);
  useEffect(() => {
    soundEnabledRef.current = gameSettings.audio.musicEnabled;
  }, [gameSettings.audio.musicEnabled]);

  const triggerNukeVisual = useCallback((op: WarOperationRecord) => {
    const evt: NuclearAnimationEvent = {
      id: `${op.id}-${Date.now()}`,
      attackerCode: op.attackerCode,
      defenderCode: op.defenderCode,
      fromLng: op.fromLng,
      fromLat: op.fromLat,
      targetLng: op.targetLng,
      targetLat: op.targetLat,
      targetName: op.targetRegionName,
      startedAt: Date.now(),
    };
    setActiveNukes((prev) => [...prev, evt]);
    playWarActionSfx("nuke", soundEnabledRef.current);
    setTimeout(() => {
      setNukeShake(true);
      setTimeout(() => setNukeShake(false), 1500);
    }, 1520);
  }, []);

  const refreshWarData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/war`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.globalHotspots)) setWarHotspots(data.globalHotspots);
      if (data.playerRisks) setPlayerRisks(data.playerRisks);
    } catch {
      // Ignore transient polling error
    }
  }, [session.id]);

  const refreshSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${session.id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    }
    void refreshWarData();
  }, [session.id, refreshWarData]);

  useEffect(() => {
    void refreshWarData();
  }, [refreshWarData, session.playerCountryCode]);

  // Real-time SSE listener for instant MCP tool updates & live connection badge
  useEffect(() => {
    const source = new EventSource(`/api/sessions/${session.id}/events`);

    source.addEventListener("mcp_status", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload: McpConnectionStatus;
        };
        setSession((prev) => ({
          ...prev,
          mcpStatus: parsed.payload,
        }));
      } catch {
        // Ignore
      }
    });

    source.addEventListener("territory_transferred", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: {
            regionIds?: string[];
            newOwnerCountryCode?: string;
            reason?: string;
          };
        };
        const ids = parsed.payload?.regionIds ?? [];
        if (ids.length > 0) {
          setFlashedRegionIds(ids);
          setTimeout(() => setFlashedRegionIds([]), 3200);
        }
        const trMode = localeRef.current === "tr";
        showToast(
          trMode
            ? `Sınır Değişimi: ${ids.join(", ")} → ${parsed.payload?.newOwnerCountryCode ?? ""}`
            : `Border Shift: ${ids.join(", ")} → ${parsed.payload?.newOwnerCountryCode ?? ""}`
        );
      } catch {
        // Ignore
      }
      void refreshSession();
    });

    source.addEventListener("stats_updated", () => {
      showToast(
        localeRef.current === "tr"
          ? "Ülke istatistikleri AI tarafından güncellendi."
          : "Nation statistics updated by AI."
      );
      void refreshSession();
    });

    source.addEventListener("diplomacy_updated", () => {
      showToast(
        localeRef.current === "tr"
          ? "Diplomatik statü değişti!"
          : "Diplomatic status updated!"
      );
      void refreshSession();
    });

    source.addEventListener("event_published", () => {
      showToast(
        localeRef.current === "tr"
          ? "Dünya Gazetesi'nde son dakika haberi yayınlandı!"
          : "Breaking news published in the World Gazette!"
      );
      void refreshSession();
    });

    source.addEventListener("message_sent", () => {
      showToast(
        localeRef.current === "tr"
          ? "Yeni diplomatik mesaj geldi."
          : "New diplomatic message received."
      );
      void refreshSession();
    });

    source.addEventListener("leader_chat_reply", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { countryCode?: string; message?: { senderName?: string } };
        };
        showToast(
          trMode
            ? `${parsed.payload?.message?.senderName ?? "Ülke Lideri"} görüşmede yanıt verdi!`
            : `${parsed.payload?.message?.senderName ?? "World Leader"} replied in diplomacy!`
        );
      } catch {
        showToast(
          trMode
            ? "Lider görüşmesine yeni yanıt geldi!"
            : "New reply received in leader diplomacy!"
        );
      }
      void refreshSession();
    });

    source.addEventListener("leader_chat_updated", () => {
      void refreshSession();
    });

    source.addEventListener("council_updated", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { title?: string; message?: { senderName?: string } };
        };
        if (parsed.payload?.title) {
          showToast(
            `${trMode ? "Diplomatik Konsey" : "Diplomatic Council"}: ${parsed.payload.title}`
          );
        } else if (parsed.payload?.message?.senderName) {
          showToast(
            trMode
              ? `Konsey Toplantısı: ${parsed.payload.message.senderName} söz aldı!`
              : `Council Summit: ${parsed.payload.message.senderName} spoke up!`
          );
        } else {
          showToast(
            trMode
              ? "Yeni Konsey / Zirve güncellemesi!"
              : "New Council / Summit update!"
          );
        }
      } catch {
        showToast(
          trMode
            ? "Yeni Konsey / Zirve güncellemesi!"
            : "New Council / Summit update!"
        );
      }
      void refreshSession();
    });

    source.addEventListener("turn_advanced", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { turnNumber?: number; currentDate?: string };
        };
        showToast(
          trMode
            ? `Tur ${parsed.payload?.turnNumber ?? ""} tamamlandı (${parsed.payload?.currentDate ?? ""})`
            : `Turn ${parsed.payload?.turnNumber ?? ""} completed (${parsed.payload?.currentDate ?? ""})`
        );
      } catch {
        showToast(trMode ? "Yeni tura geçildi!" : "Advanced to next turn!");
      }
      void refreshSession();
    });

    source.addEventListener("session_rolled_back", () => {
      showToast(
        localeRef.current === "tr"
          ? "Zaman yolculuğu uygulandı — önceki tura dönüldü."
          : "Time travel applied — rolled back to earlier turn."
      );
      void refreshSession();
    });

    source.addEventListener("player_action_triggered", () => {
      showToast(
        localeRef.current === "tr"
          ? "Hamleniz MCP'de bekleyen yapay zekaya otomatik iletildi!"
          : "Your action was dispatched to waiting MCP AI!"
      );
      void refreshSession();
    });

    source.addEventListener("advisor_chat_updated", () => {
      void refreshSession();
    });

    source.addEventListener("advisor_chat_reply", () => {
      showToast(
        localeRef.current === "tr"
          ? "AI Danışman stratejik fikrini / cevabını gönderdi!"
          : "AI Advisor sent strategic advice / response!"
      );
      void refreshSession();
    });

    source.addEventListener("map_marker_updated", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: {
            action?: string;
            marker?: { id?: string; title?: string; cityName?: string | null };
            title?: string;
            cityName?: string | null;
          };
        };
        const m = parsed.payload?.marker;
        const mId = m?.id;
        if (mId) {
          setFlashedMarkerIds((prev) => [...new Set([...prev, mId])]);
          setTimeout(() => {
            setFlashedMarkerIds((prev) => prev.filter((id) => id !== mId));
          }, 5000);
        }
        const label =
          m?.title ??
          parsed.payload?.title ??
          (trMode ? "Harita İşareti" : "Map Landmark");
        const place = m?.cityName ?? parsed.payload?.cityName;
        const verb =
          parsed.payload?.action === "REMOVED"
            ? trMode
              ? "Kaldırıldı"
              : "Removed"
            : parsed.payload?.action === "UPDATED"
              ? trMode
                ? "Güncellendi"
                : "Updated"
              : trMode
                ? "Kuruldu"
                : "Built";
        showToast(
          `${trMode ? "Harita Projesi" : "Map Project"} ${verb}: ${label}${place ? ` (${place})` : ""}`
        );
      } catch {
        showToast(
          trMode
            ? "Harita üzerindeki tesis/olay işareti güncellendi!"
            : "Map facility/event landmark updated!"
        );
      }
      void refreshSession();
    });

    source.addEventListener("war_operation_started", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { operation?: WarOperationRecord };
        };
        const op = parsed.payload?.operation;
        if (op && op.operationType !== "NUCLEAR_STRIKE") {
          playWarActionSfx("launch", soundEnabledRef.current);
          showToast(
            trMode
              ? `Askeri Harekat: ${op.attackerCode} → ${op.targetRegionName} (${op.defenderCode})`
              : `Military Operation: ${op.attackerCode} → ${op.targetRegionName} (${op.defenderCode})`
          );
        }
      } catch {
        // Ignore parse issues
      }
      void refreshSession();
    });

    source.addEventListener("war_operation_updated", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { operation?: WarOperationRecord };
        };
        const op = parsed.payload?.operation;
        if (op?.status === "CAPTURED") {
          playWarActionSfx("capture", soundEnabledRef.current);
        }
      } catch {
        // Ignore
      }
      void refreshSession();
    });

    source.addEventListener("nuclear_strike", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: { operation?: WarOperationRecord };
        };
        const op = parsed.payload?.operation;
        if (op) {
          triggerNukeVisual(op);
          showToast(
            trMode
              ? `NÜKLEER SALDIRI: ${op.attackerCode} → ${op.targetRegionName}!`
              : `NUCLEAR STRIKE: ${op.attackerCode} → ${op.targetRegionName}!`
          );
        }
      } catch {
        // Ignore
      }
      void refreshSession();
    });

    source.addEventListener("diplomatic_provocation", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: {
            actorCode?: string;
            targetCode?: string;
            thirdCode?: string;
            warErupted?: boolean;
            probability?: number;
          };
        };
        const p = parsed.payload;
        if (p?.warErupted) {
          playWarActionSfx("launch", soundEnabledRef.current);
          showToast(
            trMode
              ? `SAVAŞ PATLAK VERDİ: ${p.targetCode} ↔ ${p.thirdCode ?? p.actorCode}!`
              : `WAR ERUPTED: ${p.targetCode} ↔ ${p.thirdCode ?? p.actorCode}!`
          );
        } else if (p) {
          playWarActionSfx("skirmish", soundEnabledRef.current);
          showToast(
            trMode
              ? `Gerilim Yükseldi! Savaş Olasılığı: %${p.probability ?? 50}`
              : `Tension Escalated! War Risk: ${p.probability ?? 50}%`
          );
        }
      } catch {
        // Ignore
      }
      void refreshSession();
    });

    const syncHandler = () => {
      void refreshSession();
    };
    source.addEventListener("nuclear_transferred", (e) => {
      const trMode = localeRef.current === "tr";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          payload?: {
            fromCode?: string;
            toCode?: string;
            count?: number;
            treatyName?: string;
          };
        };
        const p = parsed.payload;
        if (p?.fromCode && p?.toCode) {
          showToast(
            trMode
              ? `NÜKLEER PAYLAŞIM: ${p.fromCode} → ${p.toCode} (+${p.count ?? 1} Başlık • ${p.treatyName ?? "Antlaşma"})`
              : `NUCLEAR SHARING: ${p.fromCode} → ${p.toCode} (+${p.count ?? 1} Warheads • ${p.treatyName ?? "Treaty"})`
          );
        }
      } catch {
        // Ignore
      }
      void refreshSession();
    });
    source.addEventListener("order_queued", syncHandler);
    source.addEventListener("country_selected", syncHandler);
    source.addEventListener("state_sync", syncHandler);

    return () => {
      source.close();
    };
  }, [session.id, refreshSession, showToast, triggerNukeVisual]);

  // Live Real-Time Auto-Battle Ticker: marches armies, advances sieges, captures territory!
  const activeWarOpsCount = (session.warOperations ?? []).filter((w) =>
    ["MARCHING", "BESIEGING", "ACTIVE"].includes(w.status)
  ).length;
  useEffect(() => {
    if (!autoBattleEnabled || activeWarOpsCount === 0) return;
    let busyTick = false;
    const id = window.setInterval(async () => {
      if (busyTick) return;
      busyTick = true;
      try {
        const res = await fetch(`/api/sessions/${session.id}/war`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "advance_battles", tickTensions: false }),
        });
        if (res.ok) {
          void refreshSession();
        }
      } catch {
        // Ignore transient interval error
      } finally {
        busyTick = false;
      }
    }, 3400);
    return () => window.clearInterval(id);
  }, [autoBattleEnabled, activeWarOpsCount, session.id, refreshSession]);

  // Listen for live global MCP connection status so Lock Gate unlocks automatically
  useEffect(() => {
    let active = true;
    const syncGlobal = async () => {
      try {
        const res = await fetch("/api/mcp/status", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = (await res.json()) as GlobalMcpStatusPayload & {
          projectRoot?: string;
        };
        setGlobalMcpStatus({
          connected: Boolean(data.connected),
          connectionCount: data.connectionCount ?? 0,
          aiWaiting: Boolean(data.aiWaiting),
          waitingCount: data.waitingCount ?? 0,
          clients: data.clients ?? [],
        });
        if (data.projectRoot) setResolvedRoot(data.projectRoot);
      } catch {
        // Ignore transient network errors
      }
    };

    void syncGlobal();
    const es = new EventSource("/api/mcp/events");
    es.addEventListener("global_mcp_status", (e) => {
      try {
        const payload = JSON.parse(
          (e as MessageEvent).data
        ) as GlobalMcpStatusPayload;
        if (active) setGlobalMcpStatus(payload);
      } catch {
        // Ignore
      }
    });

    const timer = window.setInterval(() => {
      void syncGlobal();
    }, 3500);

    return () => {
      active = false;
      es.close();
      window.clearInterval(timer);
    };
  }, []);

  const handleSelectRegion = useCallback(
    (regionId: string, ownerCountryCode: string) => {
      setSelectedRegionId(regionId);
      setInspectedCountryCode(ownerCountryCode);
    },
    []
  );

  const openLeaderChatWith = useCallback(
    (countryCode?: string, tab: "direct" | "councils" = "direct") => {
      if (countryCode) setLeaderChatTarget(countryCode);
      setLeaderChatTab(tab);
      setLeaderChatOpen(true);
    },
    []
  );

  const handleDifficultyChange = useCallback(
    async (difficulty: DifficultyLevel) => {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      if (res.ok) {
        setSession((prev) => ({ ...prev, difficulty }));
        showToast(
          localeRef.current === "tr"
            ? `Zorluk seviyesi güncellendi: ${difficulty}`
            : `Difficulty updated: ${difficulty}`
        );
        void refreshSession();
      }
    },
    [session.id, refreshSession, showToast]
  );

  const handleTimeJumpChange = useCallback(
    async (timeJumpInterval: TimeJumpInterval) => {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeJumpInterval }),
      });
      if (res.ok) {
        setSession((prev) => ({ ...prev, timeJumpInterval }));
        showToast(
          localeRef.current === "tr"
            ? `Zaman atlama aralığı güncellendi: ${timeJumpInterval}`
            : `Time jump interval updated: ${timeJumpInterval}`
        );
        void refreshSession();
      }
    },
    [session.id, refreshSession, showToast]
  );

  const activeCountryCode =
    inspectedCountryCode ??
    session.playerCountryCode ??
    session.countries[0]?.code ??
    null;

  const activeCountry =
    session.countries.find((c) => c.code === activeCountryCode) ?? null;

  const playerCountry =
    session.countries.find((c) => c.code === session.playerCountryCode) ?? null;

  const selectedRegion =
    session.regions.find((r) => r.regionId === selectedRegionId) ?? null;

  const pendingLeaderRepliesCount = (session.leaderChats ?? []).filter(
    (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
  ).length;
  const openCouncilsCount = (session.councils ?? []).filter(
    (c) => c.status === "OPEN"
  ).length;
  const pendingDiplomacyCount = pendingLeaderRepliesCount + openCouncilsCount;
  const pendingAdvisorCount = (session.advisorChats ?? []).filter(
    (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
  ).length;
  const activeWarOps = (session.warOperations ?? []).filter((op) =>
    ["MARCHING", "BESIEGING", "ACTIVE"].includes(op.status)
  );
  const liveWarsCount =
    session.diplomacies.filter((d) => d.status === "WAR").length +
    activeWarOps.length;

  const handleQuickWarAction = useCallback(
    async (params: {
      mode: "provoke" | "launch_operation" | "nuclear_strike";
      actionType?: string;
      operationType?: string;
      targetCode: string;
      targetRegionId?: string;
    }) => {
      const actor = session.playerCountryCode || "TUR";
      const body =
        params.mode === "provoke"
          ? {
              mode: "provoke",
              actionType: params.actionType ?? "BORDER_SKIRMISH",
              actorCode: actor,
              targetCode: params.targetCode,
              targetRegionId: params.targetRegionId,
              locale,
            }
          : params.mode === "nuclear_strike"
            ? {
                mode: "nuclear_strike",
                attackerCode: actor,
                defenderCode: params.targetCode,
                targetRegionId: params.targetRegionId,
                locale,
              }
            : {
                mode: "launch_operation",
                attackerCode: actor,
                defenderCode: params.targetCode,
                targetRegionId: params.targetRegionId,
                operationType: params.operationType ?? "TANK_BLITZ",
                autoDeclareWar: true,
                locale,
              };

      const res = await fetch(`/api/sessions/${session.id}/war`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (data?.summary) showToast(data.summary);
        void refreshSession();
      } else if (data?.error) {
        showToast(data.error);
      }
    },
    [session.id, session.playerCountryCode, locale, refreshSession, showToast]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopHud
        session={session}
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        onDifficultyChange={handleDifficultyChange}
        onTimeJumpChange={handleTimeJumpChange}
        onOpenMcpModal={() => setMcpModalOpen(true)}
        onOpenLeaderChat={() =>
          openLeaderChatWith(
            undefined,
            openCouncilsCount > 0 && pendingLeaderRepliesCount === 0
              ? "councils"
              : "direct"
          )
        }
        onOpenWarRoom={() => {
          setWarRoomTab("fronts");
          setWarRoomOpen(true);
        }}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onOpenSaveModal={() => setSaveModalOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        onToggleMuteMusic={handleToggleMuteMusic}
        musicEnabled={gameSettings.audio.musicEnabled}
        onOpenRollbackModal={() => setRollbackModalOpen(true)}
        onToggleDebugDrawer={() => setDebugDrawerOpen((v) => !v)}
        debugDrawerOpen={debugDrawerOpen}
        pendingDiplomacyCount={pendingDiplomacyCount}
        pendingAdvisorCount={pendingAdvisorCount}
        liveWarsCount={liveWarsCount}
      />

      {/* Full-bleed Map Workspace with Floating Translucent Panels */}
      <div className="relative flex-1 overflow-hidden">
        <WorldMap
          regions={session.regions}
          countries={session.countries}
          diplomacies={session.diplomacies}
          mapMarkers={session.mapMarkers ?? []}
          warOperations={session.warOperations ?? []}
          warHotspots={warHotspots}
          playerRisks={playerRisks}
          activeNukes={activeNukes}
          onExpireNuke={(id) =>
            setActiveNukes((prev) => prev.filter((item) => item.id !== id))
          }
          nukeShake={nukeShake}
          mapMode={mapMode}
          mapSettings={gameSettings.map}
          perspectiveCountryCode={activeCountryCode}
          selectedRegionId={selectedRegionId}
          flashedRegionIds={flashedRegionIds}
          flashedMarkerIds={flashedMarkerIds}
          focusMarkerCoord={focusMarkerCoord}
          onSelectRegion={handleSelectRegion}
        />

        {/* Floating Left Country & Diplomacy Glass Panel */}
        {session.playerCountryCode && showCountryPanel && (
          <div className="absolute left-3 top-3 bottom-16 z-20 w-[340px] max-w-[90vw] overflow-hidden rounded-xl border border-border/80 shadow-2xl">
            <CountrySidebar
              country={activeCountry}
              playerCountryCode={session.playerCountryCode}
              selectedRegion={selectedRegion}
              allCountries={session.countries}
              regions={session.regions}
              diplomacies={session.diplomacies}
              mapMarkers={session.mapMarkers ?? []}
              warRiskWithPlayer={
                activeCountry && activeCountry.code !== session.playerCountryCode
                  ? playerRisks[activeCountry.code] ?? null
                  : null
              }
              onFocusPlayerCountry={() =>
                setInspectedCountryCode(session.playerCountryCode)
              }
              onQuickDiplomacy={(targetCode) => {
                setQuickDiploTarget(targetCode);
                setShowOrderConsole(true);
              }}
              onOpenLeaderChat={(targetCode) => openLeaderChatWith(targetCode)}
              onInspectCountry={(code) => setInspectedCountryCode(code)}
              onFocusMarker={(mk) =>
                setFocusMarkerCoord({
                  lng: mk.lng,
                  lat: mk.lat,
                  ts: Date.now(),
                })
              }
              onQuickWarAction={handleQuickWarAction}
              onRequestNuclearSharing={(patronCode) =>
                openLeaderChatWith(patronCode, "direct")
              }
              onOpenWarMeddle={(targetCode) => {
                setWarRoomTarget(targetCode);
                setWarRoomTab("meddle");
                setWarRoomOpen(true);
              }}
            />
          </div>
        )}

        {/* Floating Right Newspaper & Chronicle Glass Panel */}
        {session.playerCountryCode && showChroniclePanel && (
          <div className="absolute right-3 top-3 bottom-16 z-20 w-92 max-w-[92vw] overflow-hidden rounded-xl border border-border/80 shadow-2xl">
            <ChronicleSidebar
              events={session.events}
              messages={session.messages}
              snapshots={session.snapshots}
              countries={session.countries}
              currentTurn={session.turnNumber}
            />
          </div>
        )}

        {/* Pax Historia Style Bottom-Left Floating Action Buttons */}
        {session.playerCountryCode && (
          <div
            className={`absolute bottom-4 z-20 flex flex-wrap items-center gap-2 transition-all ${
              showCountryPanel ? "left-3 lg:left-[22.75rem]" : "left-3"
            }`}
          >
            <button
              type="button"
              onClick={() => openLeaderChatWith(undefined, "direct")}
              title={
                isTr
                  ? "Ülke Başkanlarıyla Bire Bir Konuş (AI / MCP)"
                  : "Talk 1-on-1 with World Leaders (AI / MCP)"
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/50 bg-[#0c1320]/90 px-3 text-xs font-semibold text-primary shadow-xl backdrop-blur-md transition hover:bg-primary/20 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{isTr ? "Başkanlar" : "Leaders"}</span>
              {pendingLeaderRepliesCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {pendingLeaderRepliesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openLeaderChatWith(undefined, "councils")}
              title={
                isTr
                  ? "Çok Uluslu Konseyler & Koalisyon Toplantıları"
                  : "Multilateral Councils & Coalition Summits"
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-500/45 bg-[#0c1320]/90 px-3 text-xs font-semibold text-amber-200 shadow-xl backdrop-blur-md transition hover:bg-amber-500/20 cursor-pointer"
            >
              <Users className="h-4 w-4 text-amber-400" />
              <span>{isTr ? "Konseyler" : "Councils"}</span>
              {openCouncilsCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {openCouncilsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAdvisorOpen(true)}
              title={
                isTr
                  ? "MCP AI Danışman ile canlı mesajlaş ve fikir al"
                  : "Live chat & brainstorm with MCP AI Advisor"
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-[#0c1320]/90 px-3 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur-md transition hover:border-emerald-400 cursor-pointer"
            >
              <Compass className="h-4 w-4 text-emerald-400" />
              <span>{isTr ? "AI Danışman" : "AI Advisor"}</span>
              {pendingAdvisorCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {pendingAdvisorCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setWarRoomTab("fronts");
                setWarRoomOpen(true);
              }}
              title={
                isTr
                  ? "Canlı Savaş Odası, Kışkırtma & Nükleer Saldırı"
                  : "Live War Room, Provocations & Nuclear Strikes"
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-500/50 bg-[#0c1320]/90 px-3 text-xs font-semibold text-rose-300 shadow-xl backdrop-blur-md transition hover:bg-rose-950/60 cursor-pointer"
            >
              <Swords className={`h-4 w-4 ${liveWarsCount > 0 ? "animate-pulse" : ""}`} />
              <span>{isTr ? "Savaş Odası" : "War Room"}</span>
              {liveWarsCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {liveWarsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowOrderConsole((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/90 bg-[#0c1320]/90 px-3 text-xs font-medium text-foreground shadow-xl backdrop-blur-md transition hover:border-primary/60 cursor-pointer"
            >
              <Zap className="h-4 w-4 text-amber-400" />
              <span>{isTr ? "Emir Konsolu" : "Order Console"}</span>
              {showOrderConsole ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCountryPanel((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/90 bg-[#0c1320]/90 px-3 text-xs font-medium text-foreground shadow-xl backdrop-blur-md transition hover:border-primary/60 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5 text-sky-400" />
              {showCountryPanel
                ? isTr
                  ? "Ülkeyi Gizle"
                  : "Hide Nation"
                : isTr
                  ? "Ülke Paneli"
                  : "Nation Panel"}
            </button>

            <button
              type="button"
              onClick={() => setShowChroniclePanel((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/90 bg-[#0c1320]/90 px-3 text-xs font-medium text-foreground shadow-xl backdrop-blur-md transition hover:border-primary/60 cursor-pointer"
            >
              <Newspaper className="h-3.5 w-3.5 text-amber-300" />
              {showChroniclePanel
                ? isTr
                  ? "Gazeteyi Gizle"
                  : "Hide Gazette"
                : isTr
                  ? "Dünya Gazetesi"
                  : "World Gazette"}
            </button>
          </div>
        )}

        {/* Bottom-Right Player Flag Pill (Pax Historia signature) */}
        {playerCountry && (
          <button
            type="button"
            onClick={() => setInspectedCountryCode(playerCountry.code)}
            className="absolute bottom-4 right-14 z-20 hidden items-center gap-2 rounded-xl border border-border/90 bg-[#0b111c]/90 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md hover:border-primary sm:flex cursor-pointer"
            title={isTr ? "Kendi ülkene odaklan" : "Focus your nation"}
          >
            <span className="text-xl">{playerCountry.flagEmoji}</span>
            <span className="font-semibold text-foreground">
              {getCountryDisplayName(
                playerCountry.code,
                playerCountry.name,
                locale
              )}
            </span>
          </button>
        )}

        {/* Top-Center Live War Ticker & Notification Stack */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          {(mapMode === "war" || activeWarOps.length > 0) && session.playerCountryCode && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-rose-500/50 bg-[#090d16]/95 px-3.5 py-1.5 text-xs shadow-2xl backdrop-blur-md">
              <span className="flex items-center gap-1.5 font-semibold text-rose-300">
                <Activity
                  className={`h-3.5 w-3.5 ${
                    activeWarOps.length > 0 ? "animate-pulse text-rose-400" : "text-amber-300"
                  }`}
                />
                {activeWarOps.length > 0
                  ? `${activeWarOps[0].attackerCode} ⚔ ${activeWarOps[0].defenderCode} @ ${activeWarOps[0].targetRegionName} (%${activeWarOps[0].progress})`
                  : isTr
                    ? "Canlı Savaş Haritası Aktif"
                    : "Live War Theater Active"}
              </span>

              {activeWarOps.length > 1 && (
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                  +{activeWarOps.length - 1}
                </span>
              )}

              <button
                type="button"
                onClick={() => setAutoBattleEnabled((v) => !v)}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  autoBattleEnabled
                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
                    : "border-white/20 bg-white/5 text-slate-300"
                }`}
              >
                {autoBattleEnabled
                  ? isTr
                    ? "Oto-Savaş: AÇIK"
                    : "Auto-Battle: ON"
                  : isTr
                    ? "Oto-Savaş: KAPALI"
                    : "Auto-Battle: OFF"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setWarRoomTab(activeWarOps.length > 0 ? "fronts" : "meddle");
                  setWarRoomOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500 cursor-pointer"
              >
                <Flame className="h-3 w-3" />
                {isTr ? "Savaş & Kışkırt" : "War Room"}
              </button>
            </div>
          )}

          {liveToast && (
            <div className="flex items-center gap-2 rounded-full border border-primary/60 bg-[#0c121d]/95 px-4 py-1.5 text-xs font-medium text-amber-100 shadow-2xl backdrop-blur-md">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              {liveToast}
            </div>
          )}
        </div>

        {/* Country Picker Overlay when starting a fresh campaign */}
        {!session.playerCountryCode && (
          <CountrySelectOverlay
            sessionId={session.id}
            countries={session.countries}
            previewCountryCode={inspectedCountryCode}
            onPreviewCountry={(code) => setInspectedCountryCode(code)}
            onConfirmed={() => {
              void refreshSession();
            }}
          />
        )}
      </div>

      {/* Collapsible Bottom Free-Text Command Console */}
      {session.playerCountryCode && showOrderConsole && (
        <OrderConsole
          sessionId={session.id}
          playerCountryCode={session.playerCountryCode}
          playerCountry={playerCountry}
          countries={session.countries}
          orders={session.orders}
          awaitingAiSimulation={session.awaitingAiSimulation}
          mcpStatus={session.mcpStatus}
          preselectedTargetCode={quickDiploTarget}
          prefillOrderText={prefillOrderText}
          prefillOrderCategory={prefillOrderCategory}
          onClearPrefillOrder={() => {
            setPrefillOrderText(null);
            setPrefillOrderCategory(null);
          }}
          onClearPreselectedTarget={() => setQuickDiploTarget(null)}
          onOrdersUpdated={() => {
            void refreshSession();
          }}
          onOpenAiAdvisor={() => setAdvisorOpen(true)}
        />
      )}

      {/* Modals & Debug Drawer */}
      <McpConnectModal
        open={mcpModalOpen}
        onOpenChange={setMcpModalOpen}
        sessionId={session.id}
      />

      <LeaderChatModal
        open={leaderChatOpen}
        onOpenChange={setLeaderChatOpen}
        sessionId={session.id}
        playerCountryCode={session.playerCountryCode}
        countries={session.countries}
        diplomacies={session.diplomacies}
        leaderChats={session.leaderChats ?? []}
        councils={session.councils ?? []}
        initialTargetCode={leaderChatTarget}
        initialTab={leaderChatTab}
        onMessageSent={() => {
          void refreshSession();
        }}
      />

      <AdvisorModal
        open={advisorOpen}
        onOpenChange={setAdvisorOpen}
        session={session}
        onApplyOrderSuggestion={(text, category) => {
          setPrefillOrderText(text);
          setPrefillOrderCategory(category ?? null);
          setShowOrderConsole(true);
        }}
        onSessionUpdated={() => {
          void refreshSession();
        }}
      />

      <SaveProgressModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        session={session}
      />

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        settings={gameSettings}
        onUpdateSettings={handleUpdateSettings}
        audioUnlocked={audioUnlocked}
      />

      <RollbackModal
        open={rollbackModalOpen}
        onOpenChange={setRollbackModalOpen}
        sessionId={session.id}
        currentTurn={session.turnNumber}
        snapshots={session.snapshots}
        onRolledBack={() => {
          void refreshSession();
        }}
      />

      <McpDebugDrawer
        open={debugDrawerOpen}
        onClose={() => setDebugDrawerOpen(false)}
        session={session}
        selectedRegionId={selectedRegionId}
      />

      <WarRoomModal
        open={warRoomOpen}
        onOpenChange={setWarRoomOpen}
        sessionId={session.id}
        playerCountryCode={session.playerCountryCode}
        countries={session.countries}
        regions={session.regions}
        diplomacies={session.diplomacies}
        warOperations={session.warOperations ?? []}
        warHotspots={warHotspots}
        playerRisks={playerRisks}
        autoBattleEnabled={autoBattleEnabled}
        onToggleAutoBattle={setAutoBattleEnabled}
        initialTab={warRoomTab}
        initialTargetCode={warRoomTarget}
        onWarUpdated={() => {
          void refreshSession();
        }}
        onReplayNuke={(op) => triggerNukeVisual(op)}
        onOpenLeaderNuclear={(patronCode) => {
          setWarRoomOpen(false);
          openLeaderChatWith(patronCode, "direct");
        }}
      />

      {!(globalMcpStatus.connected || (session.mcpStatus?.connected ?? false)) && (
        <div
          data-testid="session-mcp-gate-overlay"
          className="fixed inset-0 z-50 overflow-y-auto bg-[#03050a]/90 p-4 backdrop-blur-md sm:p-8"
        >
          <div className="mx-auto max-w-4xl space-y-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isTr ? "Ana Sayfaya Dön" : "Back to Home"}
              </Link>
              <span className="font-mono text-[11px] text-amber-300">
                {isTr ? "Oturum" : "Session"}: {session.id}
              </span>
            </div>

            <McpOnboardingHub
              mcpStatus={globalMcpStatus}
              projectRoot={resolvedRoot}
              sessionId={session.id}
              variant="gate-overlay"
            />
          </div>
        </div>
      )}
    </div>
  );
}
