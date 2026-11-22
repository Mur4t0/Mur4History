"use client";

import { useLocale } from "@/components/LanguageProvider";
import {
  formatGameDateByLocale,
  getCountryDisplayName,
  getDifficultyDisplay,
} from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Compass,
  Copy,
  Lightbulb,
  ListPlus,
  Send,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AdvisorSuggestedOrder, SessionState } from "@/lib/client-types";
import { DIFFICULTY_META } from "@/lib/utils";

interface AdvisorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionState;
  onApplyOrderSuggestion: (text: string, category?: string) => void;
  onSessionUpdated?: () => void;
}

const QUICK_AI_PROMPTS = [
  {
    tr: "Bu tur için en güçlü 3 stratejik hamleyi ve şehir/fabrika önerilerini yaz.",
    en: "Suggest the top 3 strategic moves and city/factory projects for this turn.",
  },
  {
    tr: "Ekonomimi ve sanayimi hangi şehirlerde nasıl büyütebilirim?",
    en: "Where and how should I grow my economy and heavy industry?",
  },
  {
    tr: "Mevcut savaş, konsey ve koalisyon tehlikelerini analiz et.",
    en: "Analyze active war risks, councils, and potential coalition threats.",
  },
  {
    tr: "Komşulara karşı diplomatik veya gizli istihbarat hamlesi öner.",
    en: "Recommend a diplomatic or covert intelligence move against neighbors.",
  },
];

export function AdvisorModal({
  open,
  onOpenChange,
  session,
  onApplyOrderSuggestion,
  onSessionUpdated,
}: AdvisorModalProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [queuedKey, setQueuedKey] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRisks, setShowRisks] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = session.advisorChats ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  const player = session.countries.find(
    (c) => c.code === session.playerCountryCode
  );
  if (!player) return null;

  const playerDisplayName = getCountryDisplayName(
    player.code,
    player.name,
    locale
  );

  const activeWars = session.diplomacies.filter(
    (d) =>
      d.status === "WAR" &&
      (d.countryA === player.code || d.countryB === player.code)
  );
  const openCouncils = (session.councils ?? []).filter(
    (c) => c.status === "OPEN"
  );
  const diffMeta = getDifficultyDisplay(
    session.difficulty,
    locale,
    DIFFICULTY_META[session.difficulty] ?? DIFFICULTY_META.NORMAL
  );

  const risks: string[] = [];
  if (player.infamy >= 35) {
    risks.push(
      isTr
        ? `Yüksek Agresiflik (%${player.infamy}): Komşular ve büyük güçler yaptırım veya koalisyon konseyi toplayabilir.`
        : `High Infamy (${player.infamy}%): Neighbors and major powers may impose sanctions or convene a coalition council.`
    );
  }
  if (player.stability < 50) {
    risks.push(
      isTr
        ? `İç İstikrar Kırılgan (%${player.stability}): Yeni savaşlar veya ağır yükler iç huzursuzluğu artırabilir.`
        : `Fragile Stability (${player.stability}%): New wars or heavy burdens could spark domestic unrest.`
    );
  }
  if (activeWars.length > 0) {
    risks.push(
      isTr
        ? `${activeWars.length} Aktif Savaş Cephesi: Savaş yorgunluğu (%${player.warExhaustion ?? 0}) yükseliyor.`
        : `${activeWars.length} Active War Front(s): War exhaustion (${player.warExhaustion ?? 0}%) is rising.`
    );
  }
  if (openCouncils.length > 0) {
    risks.push(
      isTr
        ? `${openCouncils.length} Açık Konsey: Masadaki tartışmalar yanıt bekliyor.`
        : `${openCouncils.length} Open Council(s): Discussions await your response.`
    );
  }

  const hasPendingReply = messages.some(
    (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
  );

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/advisor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (isTr ? "Mesaj gönderilemedi." : "Failed to send message.")
        );
        return;
      }
      if (!textOverride) setDraft("");
      onSessionUpdated?.();
    } catch {
      setError(isTr ? "Sunucuya bağlanılamadı." : "Could not reach server.");
    } finally {
      setSending(false);
    }
  };

  const queueSuggestedOrder = async (
    order: AdvisorSuggestedOrder,
    key: string
  ) => {
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue",
          content: order.command,
          orderType: order.category || "COMMAND",
          locale,
        }),
      });
      if (res.ok) {
        setQueuedKey(key);
        setTimeout(() => setQueuedKey(null), 2200);
        onSessionUpdated?.();
      }
    } finally {
      setSending(false);
    }
  };

  const copyAdvisorMcpPrompt = async () => {
    const prompt = isTr
      ? `Bağlı mur4history MCP sunucusundan 'advisor-chat', 'world-state', 'countries', 'map-markers' ve 'diplomatic-councils' kaynaklarını oku. ${playerDisplayName} (${player.code}) Başdanışmanı rolüyle 'advisor-chat' içindeki sorumu 'reply_advisor_chat' aracıyla yanıtla (tek tıkla emir kartları için suggested_orders da ekle; turu ilerletme!) ve ardından DERHAL 'wait_for_player_action' ile canlı beklemeye geç.`
      : `Read 'advisor-chat', 'world-state', 'countries', 'map-markers', and 'diplomatic-councils' resources from the connected mur4history MCP server. Acting as Chief Strategic Advisor of ${playerDisplayName} (${player.code}), answer my question in 'advisor-chat' using 'reply_advisor_chat' (include suggested_orders cards; do NOT advance the turn!) and then IMMEDIATELY call 'wait_for_player_action' to return to live standby.`;
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const mcpWaiting = session.mcpStatus?.aiWaiting ?? false;
  const mcpConnected = session.mcpStatus?.connected ?? false;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="flex h-[84vh] max-w-4xl flex-col overflow-hidden p-0">
        <ModalHeader className="border-b border-border/80 bg-[#0b1019] px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <ModalTitle className="flex items-center gap-2 text-base">
                <Compass className="h-5 w-5 text-primary" />
                {isTr
                  ? "AI Strateji Danışmanı & Fikir Odası (MCP)"
                  : "AI Strategic Advisor & War Room (MCP)"}{" "}
                — {player.flagEmoji} {playerDisplayName}
              </ModalTitle>
              <ModalDescription className="text-xs">
                {isTr
                  ? "Doğrudan bağlı MCP yapay zekasıyla fikir alışverişi yapın, strateji sorun ve tek tıkla emre dönüşen öneriler alın."
                  : "Brainstorm directly with your connected MCP AI, ask strategic questions, and receive one-click actionable order cards."}
              </ModalDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={mcpConnected ? "success" : "warning"}>
                {mcpWaiting
                  ? isTr
                    ? "MCP AI: Canlı Beklemede"
                    : "MCP AI: Live Standby"
                  : mcpConnected
                    ? isTr
                      ? "MCP: Bağlı"
                      : "MCP: Connected"
                    : isTr
                      ? "MCP: Bekleniyor"
                      : "MCP: Waiting"}
              </Badge>
              <Badge variant="outline">
                {isTr ? "Zorluk" : "Difficulty"}: {diffMeta.label} (
                {diffMeta.treatyAcceptRate})
              </Badge>
              <Badge variant="outline">
                Infamy: {player.infamy ?? 0}/100
              </Badge>
            </div>
          </div>

          {/* Compact Collapsible Risk Strip */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setShowRisks((v) => !v)}
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>
                {isTr ? "Kabine Risk Özeti:" : "Cabinet Risk Briefing:"}{" "}
                {risks.length > 0
                  ? isTr
                    ? `${risks.length} aktif uyarı var (${showRisks ? "gizle" : "göster"})`
                    : `${risks.length} active alert(s) (${showRisks ? "hide" : "show"})`
                  : isTr
                    ? "Cepheler sakin, reform veya diplomasi için uygun"
                    : "Fronts stable — favorable window for reform or diplomacy"}
              </span>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyAdvisorMcpPrompt}
              className="h-6 px-2 text-[10px]"
            >
              {copiedPrompt ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {isTr
                ? "AI Başlatma Komutu Kopyala"
                : "Copy AI Prompt Command"}
            </Button>
          </div>

          {showRisks && risks.length > 0 && (
            <div className="mt-2 space-y-1">
              {risks.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </ModalHeader>

        {/* Chat History */}
        <ScrollArea className="flex-1 bg-[#080d16] p-4">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-center">
                <Bot className="mx-auto h-8 w-8 text-primary" />
                <div className="text-sm font-semibold text-foreground">
                  {isTr
                    ? "MCP AI Strateji Danışmanına Hoş Geldin"
                    : "Welcome to the MCP AI Strategic Advisor"}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isTr ? (
                    <>
                      Buradan turu bitirmeden yapay zekaya{" "}
                      <em>&ldquo;Ankara&apos;ya ne kurayım?&rdquo;</em>,{" "}
                      <em>&ldquo;Bu ittifak tutar mı?&rdquo;</em> veya{" "}
                      <em>&ldquo;Gizli operasyon fikri ver&rdquo;</em> diye serbestçe
                      soru sorabilirsin. Mesaj yazdığın an MCP AI otomatik uyanıp
                      analiz ve tek tıkla emre aktarılan öneri kartları gönderecektir.
                    </>
                  ) : (
                    <>
                      Ask the AI openly without ending your turn — e.g.,{" "}
                      <em>&ldquo;What should I build in the capital?&rdquo;</em>,{" "}
                      <em>&ldquo;Will this alliance hold?&rdquo;</em>, or{" "}
                      <em>&ldquo;Give me a covert operation idea&rdquo;</em>. MCP AI
                      wakes immediately with strategic analysis and one-click order cards.
                    </>
                  )}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isPlayer = msg.senderRole === "PLAYER";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isPlayer ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl border px-4 py-3 text-xs shadow-md ${
                        isPlayer
                          ? "border-primary/40 bg-primary/15 text-foreground"
                          : "border-border bg-[#0f1623] text-foreground"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
                        <span
                          className={`font-semibold ${
                            isPlayer ? "text-primary" : "text-emerald-300"
                          }`}
                        >
                          {isPlayer
                            ? `${player.flagEmoji} ${isTr ? "Sen" : "You"}`
                            : `🧠 ${msg.senderName}`}
                        </span>
                        <span className="text-muted-foreground">
                          {isTr ? "Tur" : "Turn"} {msg.turnNumber} •{" "}
                          {formatGameDateByLocale(msg.gameDate, locale)}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>

                      {msg.suggestedOrders && msg.suggestedOrders.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <Sparkles className="h-3 w-3" />
                            {isTr
                              ? "Önerilen Aksiyon Kartları"
                              : "Suggested Action Cards"}
                          </div>
                          {msg.suggestedOrders.map((ord, idx) => {
                            const key = `${msg.id}-${idx}`;
                            return (
                              <div
                                key={key}
                                className="rounded-lg border border-primary/30 bg-secondary/45 p-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <Badge variant="outline">
                                      {ord.category || "COMMAND"}
                                    </Badge>
                                    <span>{ord.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => queueSuggestedOrder(ord, key)}
                                      disabled={sending}
                                    >
                                      {queuedKey === key ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <ListPlus className="h-3 w-3" />
                                      )}
                                      {isTr ? "Kuyruğa Ekle" : "Queue Order"}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => {
                                        onApplyOrderSuggestion(
                                          ord.command,
                                          ord.category
                                        );
                                        onOpenChange(false);
                                      }}
                                    >
                                      <Wand2 className="h-3 w-3" />
                                      {isTr ? "Emre Aktar" : "Load Draft"}
                                    </Button>
                                  </div>
                                </div>
                                <p className="mt-1.5 text-[11px] text-muted-foreground">
                                  {ord.command}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isPlayer && msg.status === "PENDING_REPLY" && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-300">
                          <Clock className="h-3 w-3 animate-spin" />
                          {isTr
                            ? "MCP AI'ya iletildi — danışman yanıtı bekleniyor..."
                            : "Sent to MCP AI — awaiting advisor reply..."}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {hasPendingReply && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                <span>
                  {isTr ? (
                    <>
                      Mesajın <code>advisor-chat</code> kuyruğunda; canlı beklemedeki
                      MCP AI (<code className="font-mono">wait_for_player_action</code>)
                      otomatik uyanıp <code>reply_advisor_chat</code> ile yanıt
                      verecektir.
                    </>
                  ) : (
                    <>
                      Your message is in <code>advisor-chat</code>; standing-by MCP
                      AI (<code className="font-mono">wait_for_player_action</code>)
                      will wake up and respond via <code>reply_advisor_chat</code>.
                    </>
                  )}
                </span>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </ScrollArea>

        {/* Quick Prompts + Chat Input */}
        <div className="border-t border-border/80 bg-[#0b1019] p-3.5 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_AI_PROMPTS.map((q) => {
              const label = isTr ? q.tr : q.en;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={sending}
                  onClick={() => sendMessage(label)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[10.5px] text-muted-foreground transition hover:border-primary/60 hover:text-primary cursor-pointer"
                >
                  <Lightbulb className="h-3 w-3 text-amber-400" />
                  {label}
                </button>
              );
            })}
          </div>

          {error && <div className="text-[11px] text-red-400">{error}</div>}

          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              placeholder={
                isTr
                  ? "AI Danışmana sor veya fikir iste... (Örn: 'Ankara ve İstanbul için en iyi sanayi/askeri plan ne olur?')"
                  : "Ask your AI Advisor for ideas... (e.g. 'What is the best industrial/military plan for my key cities?')"
              }
              className="min-h-[52px] flex-1 resize-none text-xs"
            />
            <Button
              type="button"
              disabled={!draft.trim() || sending}
              onClick={() => sendMessage()}
              className="h-[52px] px-4"
            >
              <Send className="h-4 w-4" />
              {isTr ? "Gönder" : "Send"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
