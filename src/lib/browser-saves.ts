"use client";

import {
  buildSaveFilename,
  formatCloneSessionName,
  type Mur4SaveArchive,
  SaveArchiveSchema,
} from "@/lib/save-schema";

export interface BrowserSaveEntry {
  id: string;
  label: string;
  savedAt: string;
  sizeBytes: number;
  originalSessionId: string;
  playerCountryCode: string | null;
  playerCountryName: string | null;
  scenarioTitle: string;
  currentDate: string;
  turnNumber: number;
  difficulty: string;
  counts: {
    events: number;
    orders: number;
    markers: number;
    snapshots: number;
    councils: number;
    leaderChats: number;
    advisorChats: number;
  };
  archive: Mur4SaveArchive;
}

const DB_NAME = "mur4history_saves_db";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const LS_FALLBACK_KEY = "mur4history_saves_fallback_v1";

function isTurkishClient(): boolean {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang.toLowerCase().startsWith("tr");
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("tr");
  }
  return false;
}

function openSaveDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLocalStorageFallback(): BrowserSaveEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrowserSaveEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStorageFallback(entries: BrowserSaveEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(entries));
  } catch {
    throw new Error(
      isTurkishClient()
        ? "Tarayıcı depolama alanı dolu. Eski bir kaydı silin veya dosyayı PC'nize indirin."
        : "Browser storage is full. Delete an older save or download the file to your PC."
    );
  }
}

export async function listBrowserSaves(): Promise<BrowserSaveEntry[]> {
  const db = await openSaveDb();
  if (!db) {
    return readLocalStorageFallback().sort((a, b) =>
      b.savedAt.localeCompare(a.savedAt)
    );
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as BrowserSaveEntry[]) ?? [];
        resolve(items.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function buildBrowserSaveEntry(
  archive: Mur4SaveArchive,
  options?: { id?: string; label?: string }
): BrowserSaveEntry {
  const jsonStr = JSON.stringify(archive);
  const sizeBytes = new Blob([jsonStr]).size;
  const isTr = isTurkishClient();
  const fallbackLabel = `${archive.meta.playerCountryName || archive.meta.playerCountryCode || archive.meta.sessionName} • ${isTr ? "Tur" : "Turn"} ${archive.session.turnNumber}`;
  return {
    id:
      options?.id ||
      `save_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: options?.label?.trim() || fallbackLabel,
    savedAt: new Date().toISOString(),
    sizeBytes,
    originalSessionId: archive.meta.originalSessionId || "",
    playerCountryCode: archive.meta.playerCountryCode ?? null,
    playerCountryName: archive.meta.playerCountryName ?? null,
    scenarioTitle: archive.meta.scenarioTitle,
    currentDate: archive.session.currentDate,
    turnNumber: archive.session.turnNumber,
    difficulty: archive.session.difficulty,
    counts: {
      events: archive.events.length,
      orders: archive.orders.length,
      markers: archive.mapMarkers.length,
      snapshots: archive.snapshots.length,
      councils: archive.councils.length,
      leaderChats: archive.leaderChats.length,
      advisorChats: archive.advisorChats.length,
    },
    archive,
  };
}

export async function saveArchiveToBrowser(
  archive: Mur4SaveArchive,
  options?: { id?: string; label?: string }
): Promise<BrowserSaveEntry> {
  const entry = buildBrowserSaveEntry(archive, options);
  const db = await openSaveDb();

  if (!db) {
    const existing = readLocalStorageFallback().filter((x) => x.id !== entry.id);
    writeLocalStorageFallback([entry, ...existing]);
    return entry;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve(entry);
      tx.onerror = () =>
        reject(
          new Error(
            isTurkishClient()
              ? "Tarayıcı veritabanına kayıt yazılırken hata oluştu."
              : "Failed to write save record into browser storage."
          )
        );
    } catch (err) {
      reject(
        err instanceof Error
          ? err
          : new Error(
              isTurkishClient()
                ? "Tarayıcıya kaydetme desteklenmiyor."
                : "Saving to browser storage is not supported."
            )
      );
    }
  });
}

export async function deleteBrowserSave(id: string): Promise<void> {
  const db = await openSaveDb();
  if (!db) {
    const remaining = readLocalStorageFallback().filter((x) => x.id !== id);
    writeLocalStorageFallback(remaining);
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            isTurkishClient()
              ? "Tarayıcı kaydı silinemedi."
              : "Could not delete browser save."
          )
        );
    } catch {
      resolve();
    }
  });
}

export async function fetchSessionArchive(
  sessionId: string
): Promise<Mur4SaveArchive> {
  const res = await fetch(`/api/sessions/${sessionId}/export`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error ||
        (isTurkishClient()
          ? "Oturum verisi dışa aktarılamadı."
          : "Could not export session archive.")
    );
  }
  const parsed = SaveArchiveSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      isTurkishClient()
        ? "Sunucudan gelen kayıt paketi doğrulamadan geçemedi."
        : "Exported save package from server failed schema validation."
    );
  }
  return parsed.data;
}

export function downloadArchiveAsFile(
  archive: Mur4SaveArchive,
  customFilename?: string
): string {
  const filename = customFilename?.trim()
    ? customFilename.trim().endsWith(".json")
      ? customFilename.trim()
      : `${customFilename.trim()}.mur4history.json`
    : buildSaveFilename(archive);

  const json = JSON.stringify(archive, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export async function parseSaveFile(file: File): Promise<Mur4SaveArchive> {
  let rawText: string;
  const isTr = isTurkishClient();
  try {
    rawText = await file.text();
  } catch {
    throw new Error(isTr ? "Dosya okunamadı." : "Could not read file.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new Error(
      isTr
        ? `"${file.name}" geçerli bir JSON dosyası değil. Lütfen .mur4history.json kayıt dosyası seçin.`
        : `"${file.name}" is not valid JSON. Please pick a .mur4history.json save file.`
    );
  }

  // Handle accidental wrapper { archive: ... } gracefully if user edited JSON
  const candidate =
    parsedJson &&
    typeof parsedJson === "object" &&
    "archive" in parsedJson &&
    (parsedJson as Record<string, unknown>).archive
      ? (parsedJson as { archive: unknown }).archive
      : parsedJson;

  const validated = SaveArchiveSchema.safeParse(candidate);
  if (!validated.success) {
    const looksLikeScenario =
      candidate &&
      typeof candidate === "object" &&
      "countries" in candidate &&
      "startDate" in candidate &&
      !("format" in candidate);
    if (looksLikeScenario) {
      throw new Error(
        isTr
          ? `"${file.name}" bir senaryo tanım dosyasına benziyor; lütfen buradan yalnızca kaydedilmiş oyun ilerlemesi (.mur4history.json) yükleyin.`
          : `"${file.name}" looks like a scenario definition file; please upload a saved campaign progress file (.mur4history.json).`
      );
    }
    throw new Error(
      isTr
        ? `"${file.name}" geçerli bir Mur4History ilerleme kaydı değil.`
        : `"${file.name}" is not a valid Mur4History progress save.`
    );
  }

  return validated.data;
}

export async function importArchiveToServer(
  archive: Mur4SaveArchive,
  customName?: string
): Promise<{ sessionId: string }> {
  const res = await fetch("/api/sessions/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive, customName }),
  });
  const data = await res.json();
  if (!res.ok || !data?.session?.id) {
    throw new Error(
      data?.error ||
        (isTurkishClient()
          ? "İlerleme kaydı sunucuya yüklenirken hata oluştu."
          : "Error uploading save progress to server.")
    );
  }
  return { sessionId: data.session.id as string };
}

/** Duplicate an existing IndexedDB browser save into an independent new slot. */
export async function cloneBrowserSave(
  entry: BrowserSaveEntry,
  locale: "tr" | "en" = "tr"
): Promise<BrowserSaveEntry> {
  const nextLabel = formatCloneSessionName(entry.label, locale);
  const nextSessionName = formatCloneSessionName(
    entry.archive.session.name || entry.label,
    locale
  );
  const clonedArchive: Mur4SaveArchive = {
    ...entry.archive,
    meta: {
      ...entry.archive.meta,
      sessionName: nextSessionName,
    },
    session: {
      ...entry.archive.session,
      name: nextSessionName,
    },
  };
  return saveArchiveToBrowser(clonedArchive, { label: nextLabel });
}
