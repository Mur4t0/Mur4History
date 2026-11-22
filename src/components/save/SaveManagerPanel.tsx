"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FolderUp,
  HardDrive,
  Loader2,
  Play,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type BrowserSaveEntry,
  deleteBrowserSave,
  downloadArchiveAsFile,
  importArchiveToServer,
  listBrowserSaves,
  parseSaveFile,
  saveArchiveToBrowser,
} from "@/lib/browser-saves";
import {
  formatGameDateByLocale,
  getDifficultyDisplay,
} from "@/lib/i18n";
import { formatBytesTr } from "@/lib/save-schema";
import { DIFFICULTY_META } from "@/lib/utils";

interface SaveManagerPanelProps {
  variant?: "lobby" | "modal";
  refreshTrigger?: number;
  onSessionImported?: (newSessionId: string) => void;
}

export function SaveManagerPanel({
  variant = "lobby",
  refreshTrigger = 0,
  onSessionImported,
}: SaveManagerPanelProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const [browserSaves, setBrowserSaves] = useState<BrowserSaveEntry[]>([]);
  const [loadingSaves, setLoadingSaves] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [backupImportedToBrowser, setBackupImportedToBrowser] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSaves = useCallback(async () => {
    setLoadingSaves(true);
    try {
      const items = await listBrowserSaves();
      setBrowserSaves(items);
    } finally {
      setLoadingSaves(false);
    }
  }, []);

  useEffect(() => {
    void loadSaves();
  }, [loadSaves, refreshTrigger]);

  const navigateToSession = useCallback(
    (newSessionId: string) => {
      if (onSessionImported) {
        onSessionImported(newSessionId);
      } else {
        router.push(`/session/${newSessionId}`);
      }
    },
    [onSessionImported, router]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setStatusMessage(
        isEn
          ? `Validating "${file.name}" and restoring full world state...`
          : `"${file.name}" doğrulanıyor ve tüm harita yükleniyor...`
      );
      setBusyAction("importing-file");
      try {
        const archive = await parseSaveFile(file);
        if (backupImportedToBrowser) {
          await saveArchiveToBrowser(archive).catch(() => null);
          await loadSaves();
        }
        const { sessionId } = await importArchiveToServer(archive);
        setStatusMessage(
          isEn
            ? `Save imported! Opening Turn ${archive.session.turnNumber}...`
            : `Kayıt yüklendi! Tur ${archive.session.turnNumber} (${archive.meta.playerCountryName || archive.meta.scenarioTitle}) açılıyor...`
        );
        navigateToSession(sessionId);
      } catch (err) {
        setStatusMessage(null);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : isEn
              ? "Failed to import save file."
              : "İlerleme dosyası içe aktarılamadı."
        );
      } finally {
        setBusyAction(null);
      }
    },
    [backupImportedToBrowser, isEn, loadSaves, navigateToSession]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      setErrorMessage(
        isEn
          ? "No valid save file found in dropped item."
          : "Bırakılan öğede geçerli bir kayıt dosyası bulunamadı."
      );
      return;
    }
    await handleImportFile(file);
  };

  const handleLoadBrowserSave = async (entry: BrowserSaveEntry) => {
    setErrorMessage(null);
    setStatusMessage(
      isEn
        ? `Restoring "${entry.label}" session...`
        : `"${entry.label}" oturumu yükleniyor...`
    );
    setBusyAction(`load:${entry.id}`);
    try {
      const { sessionId } = await importArchiveToServer(entry.archive);
      navigateToSession(sessionId);
    } catch (err) {
      setStatusMessage(null);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : isEn
            ? "Could not load browser save onto server."
            : "Tarayıcı kaydı sunucuya yüklenemedi."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteBrowserSave = async (id: string) => {
    setErrorMessage(null);
    await deleteBrowserSave(id);
    setBrowserSaves((prev) => prev.filter((item) => item.id !== id));
  };

  const isLobby = variant === "lobby";

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${
        isLobby ? "lg:grid-cols-12" : "md:grid-cols-2"
      }`}
    >
      {/* Drag & Drop File Import Area */}
      <div className={isLobby ? "lg:col-span-5" : ""}>
        <div
          role="button"
          tabIndex={0}
          data-testid="save-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          className={`flex h-full min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all ${
            isDragging
              ? "border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-400/40"
              : "border-primary/40 bg-[#0d1523]/90 hover:border-primary/80 hover:bg-[#101a2c]"
          }`}
        >
          <input
            ref={fileInputRef}
            data-testid="save-file-input"
            type="file"
            accept=".json,.mur4history.json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
              e.target.value = "";
            }}
          />

          <div
            className={`mb-2.5 flex h-11 w-11 items-center justify-center rounded-full border ${
              isDragging
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                : "border-primary/40 bg-primary/15 text-primary"
            }`}
          >
            {busyAction === "importing-file" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>

          <div className="text-sm font-semibold text-foreground">
            {isDragging
              ? isEn
                ? "Drop File Here — Instant Import!"
                : "Dosyayı Buraya Bırakın — Anında Yüklenecek!"
              : isEn
                ? "Import Save File (Drag & Drop)"
                : "Kayıt Dosyası İçe Aktar (Sürükle & Bırak)"}
          </div>
          <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
            {isEn ? (
              <>
                Drop a downloaded{" "}
                <code className="rounded bg-secondary px-1 py-0.5 text-primary">
                  .mur4history.json
                </code>{" "}
                save file here or click to browse. Map state, turn history,
                leader chats, councils, markers, and advisor history are restored.
              </>
            ) : (
              <>
                Bilgisayarınıza indirdiğiniz{" "}
                <code className="rounded bg-secondary px-1 py-0.5 text-primary">
                  .mur4history.json
                </code>{" "}
                dosyasını buraya sürükleyin ya da tıklayıp seçin. Harita, tur
                geçmişi, lider sohbetleri, konseyler, tesisler ve AI danışman
                kayıtları eksiksiz yüklenir.
              </>
            )}
          </p>

          <div
            className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px]"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={backupImportedToBrowser}
                onChange={(e) => setBackupImportedToBrowser(e.target.checked)}
                className="accent-amber-400"
              />
              {isEn
                ? "Also back up to browser saves"
                : "Yüklerken tarayıcı kayıtlarına da yedekle"}
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busyAction !== null}
            >
              <FolderUp className="h-3.5 w-3.5" />
              {isEn ? "Select File" : "Dosya Seç"}
            </Button>
          </div>
        </div>
      </div>

      {/* Browser Saves List (IndexedDB) */}
      <div
        className={`flex flex-col rounded-xl border border-border/80 bg-[#0b111d]/90 p-4 ${
          isLobby ? "lg:col-span-7" : ""
        }`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-foreground">
              {isEn ? "Browser Saved Games" : "Tarayıcıya Kaydedilmiş Oyunlar"}
            </h3>
            <Badge variant="outline">
              {browserSaves.length} {isEn ? "Saves" : "Kayıt"}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {isEn
              ? "Browser Storage (IndexedDB)"
              : "Tarayıcı Yerel Deposu (IndexedDB)"}
          </span>
        </div>

        {statusMessage && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {loadingSaves ? (
          <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isEn ? "Reading browser saves..." : "Tarayıcı kayıtları okunuyor..."}
          </div>
        ) : browserSaves.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
            {isEn ? (
              <>
                No browser saves yet. Use{" "}
                <strong className="text-foreground">&quot;Save / Export&quot;</strong>{" "}
                in-game or drop a save file on the left to add one.
              </>
            ) : (
              <>
                Tarayıcınızda henüz kayıtlı ilerleme yok. Oyun içindeki{" "}
                <strong className="text-foreground">&quot;Kaydet / İndir&quot;</strong>{" "}
                butonundan veya soldaki sürükle-bırak alanından ilk yedeğinizi
                ekleyebilirsiniz.
              </>
            )}
          </div>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {browserSaves.map((entry) => {
              const isBusy = busyAction === `load:${entry.id}`;
              const diffLabel = getDifficultyDisplay(
                entry.difficulty,
                locale,
                DIFFICULTY_META[entry.difficulty] ?? DIFFICULTY_META.NORMAL
              ).label;
              return (
                <div
                  key={entry.id}
                  data-testid="browser-save-item"
                  className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-secondary/35 p-2.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {entry.label}
                      </span>
                      <Badge variant="outline">
                        {isEn ? "Turn" : "Tur"} {entry.turnNumber} •{" "}
                        {formatGameDateByLocale(entry.currentDate, locale)}
                      </Badge>
                      <Badge variant="secondary">{diffLabel}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{entry.scenarioTitle}</span>
                      <span>
                        {entry.counts.events} {isEn ? "News" : "Haber"}
                      </span>
                      <span>
                        {entry.counts.markers} {isEn ? "Markers" : "İşaret"}
                      </span>
                      <span>
                        {entry.counts.snapshots}{" "}
                        {isEn ? "Snapshots" : "Tur Yedeği"}
                      </span>
                      <span>{formatBytesTr(entry.sizeBytes)}</span>
                      <span>
                        {new Date(entry.savedAt).toLocaleString(
                          isEn ? "en-US" : "tr-TR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      disabled={busyAction !== null}
                      onClick={() => void handleLoadBrowserSave(entry)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {isEn ? "Load" : "Yükle"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={
                        isEn
                          ? "Download file to PC"
                          : "Dosya olarak bilgisayara indir"
                      }
                      onClick={() => downloadArchiveAsFile(entry.archive)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={
                        isEn ? "Delete browser save" : "Tarayıcı kaydını sil"
                      }
                      className="hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-300"
                      onClick={() => void handleDeleteBrowserSave(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
