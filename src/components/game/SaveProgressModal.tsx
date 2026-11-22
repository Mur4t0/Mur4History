"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  Save,
} from "lucide-react";
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
import { SaveManagerPanel } from "@/components/save/SaveManagerPanel";
import type { SessionState } from "@/lib/client-types";
import {
  downloadArchiveAsFile,
  fetchSessionArchive,
  saveArchiveToBrowser,
} from "@/lib/browser-saves";
import {
  formatGameDateByLocale,
  getCountryDisplayName,
} from "@/lib/i18n";
import { formatBytesTr } from "@/lib/save-schema";

interface SaveProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionState;
}

export function SaveProgressModal({
  open,
  onOpenChange,
  session,
}: SaveProgressModalProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const isEn = locale === "en";

  const playerCountry = session.countries.find(
    (c) => c.code === session.playerCountryCode
  );
  const playerDisplayName = playerCountry
    ? getCountryDisplayName(playerCountry.code, playerCountry.name, locale)
    : session.name;

  const defaultLabel = `${
    playerCountry ? `${playerCountry.flagEmoji} ${playerDisplayName}` : session.name
  } • ${isEn ? "Turn" : "Tur"} ${session.turnNumber} (${formatGameDateByLocale(
    session.currentDate,
    locale
  )})`;

  const [saveLabel, setSaveLabel] = useState(defaultLabel);
  const [busyMode, setBusyMode] = useState<"browser" | "download" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (open) {
      setSaveLabel(defaultLabel);
      setFeedback(null);
      setError(null);
      setRefreshTrigger((n) => n + 1);
    }
  }, [open, defaultLabel]);

  const handleSaveToBrowser = async () => {
    setError(null);
    setFeedback(null);
    setBusyMode("browser");
    try {
      const archive = await fetchSessionArchive(session.id);
      const entry = await saveArchiveToBrowser(archive, {
        label: saveLabel.trim() || defaultLabel,
      });
      setRefreshTrigger((n) => n + 1);
      setFeedback(
        isEn
          ? `Progress saved to browser: "${entry.label}" (${formatBytesTr(entry.sizeBytes)})`
          : `İlerleme tarayıcıya kaydedildi: "${entry.label}" (${formatBytesTr(entry.sizeBytes)})`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not save to browser."
            : "Tarayıcıya kaydedilemedi."
      );
    } finally {
      setBusyMode(null);
    }
  };

  const handleDownloadToPc = async () => {
    setError(null);
    setFeedback(null);
    setBusyMode("download");
    try {
      const archive = await fetchSessionArchive(session.id);
      const filename = downloadArchiveAsFile(archive);
      setFeedback(
        isEn
          ? `Downloaded save file: ${filename}`
          : `Dosya bilgisayarınıza indirildi: ${filename}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Download failed."
            : "Dosya indirilemedi."
      );
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            {isEn
              ? "Save, Export or Import Progress"
              : "İlerlemeyi Kaydet, İndir veya İçe Aktar"}
          </ModalTitle>
          <ModalDescription>
            {isEn ? (
              <>
                Save your full campaign (nations, 270 provinces, diplomacy,
                news, leader chats, councils, map markers, advisor chat, and
                turn snapshots) in browser storage or download as{" "}
                <code>.mur4history.json</code>.
              </>
            ) : (
              <>
                Mevcut oyununuzdaki tüm ülkeleri, 270 eyaleti, diplomasi
                ilişkilerini, haberleri, başkan sohbetlerini, konseyleri,
                harita tesislerini, AI danışman geçmişini ve tur yedeklerini
                tarayıcıya kaydedin ya da <code>.mur4history.json</code> olarak
                bilgisayarınıza indirin.
              </>
            )}
          </ModalDescription>
        </ModalHeader>

        {/* Current Live Campaign Export Card */}
        <div className="space-y-3 rounded-xl border border-primary/35 bg-[#0e1522] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">
                {playerCountry
                  ? `${playerCountry.flagEmoji} ${playerDisplayName}`
                  : session.name}
              </span>
              <Badge variant="outline">
                {isEn ? "Turn" : "Tur"} {session.turnNumber} •{" "}
                {formatGameDateByLocale(session.currentDate, locale)}
              </Badge>
              <Badge variant="secondary">
                {session.events.length} {isEn ? "News" : "Haber"} •{" "}
                {(session.mapMarkers ?? []).length} {isEn ? "Markers" : "İşaret"}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {session.snapshots.length}{" "}
              {isEn ? "Rollback Snapshots Included" : "Geri Alma Yedeği Dahil"}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label
                htmlFor="save-slot-label"
                className="text-[11px] font-medium text-muted-foreground"
              >
                {isEn
                  ? "Save Label (for Browser Save):"
                  : "Kayıt Etiketi (Tarayıcı Kaydı için):"}
              </label>
              <Input
                id="save-slot-label"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder={
                  isEn
                    ? "e.g. Turkey Campaign Turn 12"
                    : "Örn: Türkiye NATO Denge Tur 12"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busyMode !== null}
                onClick={() => void handleSaveToBrowser()}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                {busyMode === "browser" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <HardDrive className="h-4 w-4" />
                )}
                {isEn ? "Save to Browser" : "Tarayıcıya Kaydet"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={busyMode !== null}
                onClick={() => void handleDownloadToPc()}
                className="border-primary/50 text-primary hover:bg-primary/15"
              >
                {busyMode === "download" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isEn ? "Download (.json)" : "PC'ye İndir (.json)"}
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{feedback}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Shared Drag & Drop Import + Browser Save Slots */}
        <SaveManagerPanel
          variant="modal"
          refreshTrigger={refreshTrigger}
          onSessionImported={(newSessionId) => {
            onOpenChange(false);
            router.push(`/session/${newSessionId}`);
          }}
        />
      </ModalContent>
    </Modal>
  );
}
