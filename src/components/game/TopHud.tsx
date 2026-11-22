"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bug,
  Calendar,
  Coins,
  Compass,
  Flame,
  Globe,
  History,
  MessageSquare,
  PlugZap,
  Save,
  Settings2,
  ShieldAlert,
  Swords,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LanguageSwitcher, useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DifficultyLevel,
  MapMode,
  SessionState,
  TimeJumpInterval,
} from "@/lib/client-types";
import {
  formatGameDateByLocale,
  getDifficultyDisplay,
  getScenarioDisplay,
  getTimeJumpDisplay,
} from "@/lib/i18n";
import { DIFFICULTY_META, TIME_JUMP_LABELS } from "@/lib/utils";

interface TopHudProps {
  session: SessionState;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onTimeJumpChange: (interval: TimeJumpInterval) => void;
  onOpenMcpModal: () => void;
  onOpenLeaderChat: () => void;
  onOpenAdvisor: () => void;
  onOpenSaveModal: () => void;
  onOpenSettingsModal: () => void;
  onToggleMuteMusic: () => void;
  musicEnabled: boolean;
  onOpenRollbackModal: () => void;
  onToggleDebugDrawer: () => void;
  debugDrawerOpen: boolean;
  pendingDiplomacyCount?: number;
  pendingAdvisorCount?: number;
}

export function TopHud({
  session,
  mapMode,
  onMapModeChange,
  onDifficultyChange,
  onTimeJumpChange,
  onOpenMcpModal,
  onOpenLeaderChat,
  onOpenAdvisor,
  onOpenSaveModal,
  onOpenSettingsModal,
  onToggleMuteMusic,
  musicEnabled,
  onOpenRollbackModal,
  onToggleDebugDrawer,
  debugDrawerOpen,
  pendingDiplomacyCount = 0,
  pendingAdvisorCount = 0,
}: TopHudProps) {
  const { locale } = useLocale();
  const isEn = locale === "en";

  const mcpConnected = session.mcpStatus?.connected ?? false;
  const aiWaiting = session.mcpStatus?.aiWaiting ?? false;
  const activeClient =
    session.mcpStatus?.clients?.[0]?.clientName || session.lastMcpClientName;

  const scenarioDisplay = getScenarioDisplay(session.scenario, locale);

  const tensionColor =
    session.globalTension >= 75
      ? "bg-red-500"
      : session.globalTension >= 45
        ? "bg-amber-500"
        : "bg-sky-500";

  return (
    <header className="z-30 flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-[#090e17]/95 px-3 py-2 backdrop-blur-md">
      {/* Left: Brand Logo, Navigation, Date, Time Jump, Difficulty, Global Tension */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          title="Mur4History"
          className="flex shrink-0 items-center transition hover:scale-105 hover:opacity-90"
        >
          <img
            src="/images/brand/mur4history-icon.png"
            alt="Mur4History"
            className="h-8 w-8 rounded-lg object-cover shadow-sm"
          />
        </Link>

        <Link
          href="/?tab=games"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-2.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isEn ? "Lobby" : "Lobi"}
        </Link>

        <div className="hidden flex-col sm:flex">
          <span className="font-serif text-xs font-bold leading-tight text-foreground">
            {scenarioDisplay.title}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {session.name}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {formatGameDateByLocale(session.currentDate, locale)}
          </span>
          <span className="text-border">•</span>
          <span className="font-mono text-xs text-primary">
            {isEn ? "TURN" : "TUR"} {session.turnNumber}
          </span>
        </div>

        <div className="w-32">
          <Select
            value={session.timeJumpInterval || "SCENARIO_DEFAULT"}
            onValueChange={(v) => onTimeJumpChange(v as TimeJumpInterval)}
          >
            <SelectTrigger
              className="h-8 text-[11px]"
              title={isEn ? "Time Jump Interval" : "Zaman Atlama Süresi"}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TIME_JUMP_LABELS).map((k) => (
                <SelectItem key={k} value={k}>
                  {isEn ? "Jump:" : "Atlama:"}{" "}
                  {getTimeJumpDisplay(k, locale, TIME_JUMP_LABELS)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-28">
          <Select
            value={session.difficulty || "NORMAL"}
            onValueChange={(v) => onDifficultyChange(v as DifficultyLevel)}
          >
            <SelectTrigger
              className="h-8 text-[11px]"
              title={
                isEn
                  ? "Difficulty (AI resistance & treaty acceptance)"
                  : "Zorluk (AI direnci ve anlaşma kabulü)"
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                ["VERY_EASY", "EASY", "NORMAL", "HARD", "IMPOSSIBLE"] as const
              ).map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {getDifficultyDisplay(lvl, locale, DIFFICULTY_META[lvl]).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1 xl:flex">
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <div className="h-2 w-14 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-500 ${tensionColor}`}
              style={{ width: `${session.globalTension}%` }}
            />
          </div>
          <span className="font-mono text-[11px] font-semibold">
            {isEn ? `${session.globalTension}%` : `%${session.globalTension}`}
          </span>
        </div>
      </div>

      {/* Center: Map Modes */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1">
        <button
          type="button"
          onClick={() => onMapModeChange("political")}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
            mapMode === "political"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          {isEn ? "Political" : "Siyasi"}
        </button>
        <button
          type="button"
          onClick={() => onMapModeChange("diplomacy")}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
            mapMode === "diplomacy"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Swords className="h-3.5 w-3.5" />
          {isEn ? "Diplomacy" : "Diplomasi"}
        </button>
        <button
          type="button"
          onClick={() => onMapModeChange("economy")}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
            mapMode === "economy"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Coins className="h-3.5 w-3.5" />
          {isEn ? "Economy" : "Ekonomi"}
        </button>
        <button
          type="button"
          onClick={() => onMapModeChange("threat")}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
            mapMode === "threat"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {isEn ? "Threat" : "Tehdit"}
        </button>
      </div>

      {/* Right: MCP Status, Language Switch, & Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={mcpConnected ? "success" : "warning"}>
          <span
            className={`h-2 w-2 rounded-full ${
              aiWaiting
                ? "bg-emerald-300 animate-ping"
                : mcpConnected
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
            }`}
          />
          {aiWaiting
            ? isEn
              ? "MCP: AI Awaiting Move (Live)"
              : "MCP: AI Hamlenizi Bekliyor (Canlı)"
            : mcpConnected
              ? `${isEn ? "MCP: Connected" : "MCP: Bağlı"}${
                  activeClient ? ` (${activeClient})` : ""
                }`
              : isEn
                ? "MCP: Waiting"
                : "MCP: Bekleniyor"}
        </Badge>

        <Button size="sm" onClick={onOpenMcpModal}>
          <PlugZap className="h-3.5 w-3.5" />
          {isEn ? "Connect MCP" : "MCP Bağla"}
        </Button>

        {session.playerCountryCode && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenLeaderChat}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {isEn ? "Councils & Leaders" : "Konsey & Liderler"}
              {pendingDiplomacyCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">
                  {pendingDiplomacyCount}
                </span>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenAdvisor}>
              <Compass className="h-3.5 w-3.5 text-sky-400" />
              {isEn ? "AI Advisor" : "AI Fikir & Danışman"}
              {pendingAdvisorCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">
                  {pendingAdvisorCount}
                </span>
              )}
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSettingsModal}
          className="border-sky-500/40 text-sky-300 hover:bg-sky-500/15"
          title={
            isEn
              ? "Map Appearances (14) and Background Music (8 Tracks)"
              : "Harita Temaları (14) ve Fon Müziği Ayarları (8 Parça)"
          }
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isEn ? "Settings" : "Ayarlar"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onToggleMuteMusic}
          title={
            musicEnabled
              ? isEn
                ? "Mute background music"
                : "Fon müziğini kapat"
              : isEn
                ? "Unmute background music"
                : "Fon müziğini aç"
          }
          className={
            musicEnabled
              ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
              : "text-muted-foreground"
          }
        >
          {musicEnabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSaveModal}
          className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
        >
          <Save className="h-3.5 w-3.5" />
          {isEn ? "Save / Export" : "Kaydet / İndir"}
        </Button>

        <Button size="sm" variant="outline" onClick={onOpenRollbackModal}>
          <History className="h-3.5 w-3.5" />
          {isEn ? "Rollback" : "Geri Al"} ({session.snapshots.length})
        </Button>

        <LanguageSwitcher compact />

        <Button
          size="sm"
          variant={debugDrawerOpen ? "secondary" : "outline"}
          onClick={onToggleDebugDrawer}
        >
          <Bug className="h-3.5 w-3.5" />
          Debug
        </Button>
      </div>
    </header>
  );
}
