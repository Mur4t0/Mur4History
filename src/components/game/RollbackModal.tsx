"use client";

import { useLocale } from "@/components/LanguageProvider";
import { formatGameDateByLocale } from "@/lib/i18n";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/dialog";
import type { TurnSnapshotSummary } from "@/lib/client-types";

interface RollbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  currentTurn: number;
  snapshots: TurnSnapshotSummary[];
  onRolledBack: () => void;
}

export function RollbackModal({
  open,
  onOpenChange,
  sessionId,
  currentTurn,
  snapshots,
  onRolledBack,
}: RollbackModalProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const [loadingTurn, setLoadingTurn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRollback = async (turnNumber: number) => {
    setError(null);
    setLoadingTurn(turnNumber);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTurnNumber: turnNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isTr ? "Geri alma başarısız" : "Rollback failed"));
        return;
      }
      onRolledBack();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isTr ? "Ağ hatası" : "Network error"
      );
    } finally {
      setLoadingTurn(null);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {isTr
              ? "Zaman Yolculuğu / Tur Geri Alma"
              : "Time Travel / Turn Rollback"}
          </ModalTitle>
          <ModalDescription>
            {isTr
              ? "Bağlı yapay zeka hatalı bir sınır değişimi veya araç çağrısı yaparsa önceki herhangi bir turun anlık yedeğine geri dönebilirsiniz."
              : "If the connected AI makes a faulty border shift or tool call, restore any previous turn's instant snapshot."}
          </ModalDescription>
        </ModalHeader>

        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
          {snapshots.map((snap) => {
            const isCurrent = snap.turnNumber === currentTurn;
            return (
              <div
                key={snap.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">
                      {isTr ? "TUR" : "TURN"} {snap.turnNumber}
                    </span>
                    <span className="text-muted-foreground">
                      {formatGameDateByLocale(snap.gameDate, locale)}
                    </span>
                    {isCurrent && (
                      <Badge variant="success">
                        {isTr ? "Mevcut" : "Current"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-foreground/85">{snap.summary}</p>
                </div>

                <Button
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={loadingTurn !== null}
                  onClick={() => handleRollback(snap.turnNumber)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {loadingTurn === snap.turnNumber
                    ? isTr
                      ? "Dönülüyor..."
                      : "Rolling back..."
                    : isTr
                      ? "Bu Tura Dön"
                      : "Restore Turn"}
                </Button>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
