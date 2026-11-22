"use client";

import { useState } from "react";
import {
  Check,
  Map as MapIcon,
  Music,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LanguageSwitcher, useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/dialog";
import { AMBIENT_TRACKS } from "@/lib/ambient-music";
import { getMapThemeDisplay, getMusicTrackDisplay } from "@/lib/i18n";
import {
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  MAP_THEMES,
  type MapThemeDefinition,
} from "@/lib/map-themes";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  initialTab?: "map" | "audio";
  audioUnlocked?: boolean;
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  initialTab = "map",
  audioUnlocked = false,
}: SettingsModalProps) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [tab, setTab] = useState<"map" | "audio">(initialTab);

  const selectTheme = (theme: MapThemeDefinition) => {
    onUpdateSettings({
      ...settings,
      map: {
        ...settings.map,
        themeId: theme.id,
        showCurvedLabels: theme.defaultCurvedLabels,
      },
    });
  };

  const toggleMapOption = (
    key:
      | "showTerrainRelief"
      | "showCurvedLabels"
      | "showCoastalGlow"
      | "showProvinceBorders"
  ) => {
    onUpdateSettings({
      ...settings,
      map: {
        ...settings.map,
        [key]: !settings.map[key],
      },
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {isEn
              ? "Game Settings • Map Appearance, Music & Language"
              : "Oyun Ayarları • Harita Görünümü, Fon Müziği & Dil"}
          </ModalTitle>
          <ModalDescription>
            {isEn
              ? `Switch instantly across ${MAP_THEMES.length} map styles (including the original classic look), configure ${AMBIENT_TRACKS.length} built-in background music tracks, or switch UI language.`
              : `Haritanın görsel stilini ${MAP_THEMES.length} farklı tema arasından anında seçebilir (mevcut klasik görünüm dahil), ${AMBIENT_TRACKS.length} arka plan fon müziğini yönetebilir veya arayüz dilini değiştirebilirsiniz.`}
          </ModalDescription>
        </ModalHeader>

        {/* Sub-Tabs + Language Switch + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("map")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tab === "map"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              {isEn
                ? `Map Themes (${MAP_THEMES.length})`
                : `Harita Temaları (${MAP_THEMES.length})`}
            </button>
            <button
              type="button"
              onClick={() => setTab("audio")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tab === "audio"
                  ? "border-sky-400 bg-sky-500/15 text-sky-300"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              {isEn
                ? `Background Music (${AMBIENT_TRACKS.length})`
                : `Fon Müziği (${AMBIENT_TRACKS.length} Parça)`}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                  settings.audio.musicEnabled
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {settings.audio.musicEnabled
                  ? isEn
                    ? "On"
                    : "Açık"
                  : isEn
                    ? "Off"
                    : "Kapalı"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateSettings(DEFAULT_GAME_SETTINGS)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isEn ? "Reset Defaults" : "Varsayılanlara Sıfırla"}
            </Button>
          </div>
        </div>

        {/* ============================================================
            MAP APPEARANCES TAB
           ============================================================ */}
        {tab === "map" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-secondary/35 p-3 sm:grid-cols-4">
              {(
                [
                  {
                    key: "showCurvedLabels",
                    label: isEn
                      ? "Curved Nation Labels"
                      : "Kıvrımlı Ülke Yazıları",
                  },
                  {
                    key: "showTerrainRelief",
                    label: isEn
                      ? "Terrain Relief Shading"
                      : "Fiziki Arazi Kabartması",
                  },
                  {
                    key: "showCoastalGlow",
                    label: isEn
                      ? "Coastal Shelf Glow"
                      : "Kıyı Sahanlık Parıltısı",
                  },
                  {
                    key: "showProvinceBorders",
                    label: isEn
                      ? "Province Borders"
                      : "Eyalet İç Sınırları",
                  },
                ] as const
              ).map((opt) => {
                const checked = settings.map[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleMapOption(opt.key)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                      checked
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/40 text-muted-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        checked ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MAP_THEMES.map((theme) => {
                const isSelected = settings.map.themeId === theme.id;
                const [cOcean, cLand, cAccent] = theme.previewColors;
                const display = getMapThemeDisplay(theme, locale);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    data-testid={`map-theme-${theme.id}`}
                    onClick={() => selectTheme(theme)}
                    className={`group flex cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                        : "border-border/80 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="relative flex h-12 w-full overflow-hidden rounded-lg border border-white/10">
                      <div className="flex-1" style={{ backgroundColor: cOcean }} />
                      <div className="w-1/3" style={{ backgroundColor: cLand }} />
                      <div className="w-4" style={{ backgroundColor: cAccent }} />
                      <div className="absolute inset-0 flex items-center justify-between px-2.5">
                        <Badge
                          variant="outline"
                          className="border-white/20 bg-black/65 text-[10px] text-white backdrop-blur-sm"
                        >
                          {display.badge}
                        </Badge>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-black shadow">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {display.name}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {display.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================
            AMBIENT SOUNDTRACK TAB
           ============================================================ */}
        {tab === "audio" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-secondary/35 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={settings.audio.musicEnabled ? "default" : "outline"}
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      audio: {
                        ...settings.audio,
                        musicEnabled: !settings.audio.musicEnabled,
                      },
                    })
                  }
                >
                  {settings.audio.musicEnabled ? (
                    <>
                      <Volume2 className="h-4 w-4" />
                      {isEn ? "Turn Music Off" : "Müziği Kapat"}
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4" />
                      {isEn ? "Turn Music On" : "Müziği Aç"}
                    </>
                  )}
                </Button>
                <div className="text-xs">
                  <div className="font-semibold text-foreground">
                    {settings.audio.musicEnabled
                      ? audioUnlocked
                        ? isEn
                          ? "Playing (Live Synthesis)"
                          : "Çalıyor (Canlı Sentez)"
                        : isEn
                          ? "Ready (Starts on first click)"
                          : "Hazır (İlk tıklamayla çalar)"
                      : isEn
                        ? "Background Music Off"
                        : "Fon Müziği Kapalı"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isEn
                      ? "Built-in offline Web Audio synthesizer"
                      : "İnternet gerektirmeyen yerleşik Web Audio motoru"}
                  </div>
                </div>
              </div>

              <div className="flex min-w-[210px] items-center gap-3">
                <Volume2 className="h-4 w-4 shrink-0 text-sky-400" />
                <input
                  type="range"
                  aria-label={
                    isEn
                      ? "Background music volume"
                      : "Fon müziği ses seviyesi"
                  }
                  min={0}
                  max={100}
                  step={1}
                  value={settings.audio.volume}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      audio: {
                        ...settings.audio,
                        volume: Number(e.target.value),
                      },
                    })
                  }
                  className="h-1.5 w-full cursor-pointer accent-sky-400"
                />
                <span className="w-10 text-right font-mono text-xs text-foreground">
                  {isEn
                    ? `${settings.audio.volume}%`
                    : `%${settings.audio.volume}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {AMBIENT_TRACKS.map((track, idx) => {
                const isSelected = settings.audio.trackId === track.id;
                const isActivePlaying =
                  isSelected && settings.audio.musicEnabled;
                const display = getMusicTrackDisplay(track, locale);
                return (
                  <button
                    key={track.id}
                    type="button"
                    data-testid={`music-track-${track.id}`}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        audio: {
                          ...settings.audio,
                          trackId: track.id,
                          musicEnabled: true,
                          volume:
                            settings.audio.volume < 5
                              ? 35
                              : settings.audio.volume,
                        },
                      })
                    }
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-500/15 ring-1 ring-sky-400/40"
                        : "border-border/80 bg-secondary/30 hover:border-sky-400/45"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          0{idx + 1}.
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {display.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {display.eraTag}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {display.mood} • {track.bpm} BPM
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isActivePlaying ? (
                        <Badge variant="success">
                          {isEn ? "Active" : "Seçili • Açık"}
                        </Badge>
                      ) : isSelected ? (
                        <Badge variant="secondary">
                          {isEn ? "Selected" : "Seçili"}
                        </Badge>
                      ) : (
                        <span className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground">
                          {isEn ? "Play" : "Çal"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
