"use client";

import { useLocale } from "@/components/LanguageProvider";
import { getCountryDisplayName } from "@/lib/i18n";

import { useEffect, useState } from "react";
import {
  Bot,
  Lightbulb,
  ListPlus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CountryRecord,
  McpConnectionStatus,
  PendingOrderRecord,
  RegionRecord,
} from "@/lib/client-types";

type OrderCategory =
  | "COMMAND"
  | "ECONOMY"
  | "MILITARY"
  | "DIPLOMACY"
  | "COVERT"
  | "INTERNAL"
  | "NOTE_TO_AI";

const ORDER_TABS: Array<{ id: OrderCategory; labelTr: string; labelEn: string }> = [
  { id: "COMMAND", labelTr: "Genel Emir", labelEn: "General Order" },
  { id: "ECONOMY", labelTr: "Ekonomi", labelEn: "Economy" },
  { id: "MILITARY", labelTr: "Askeri", labelEn: "Military" },
  { id: "DIPLOMACY", labelTr: "Diplomasi", labelEn: "Diplomacy" },
  { id: "COVERT", labelTr: "İstihbarat", labelEn: "Intel" },
  { id: "INTERNAL", labelTr: "İç Politika", labelEn: "Internal" },
  { id: "NOTE_TO_AI", labelTr: "AI'ya Not", labelEn: "Note to AI" },
];

interface OrderConsoleProps {
  sessionId: string;
  playerCountryCode: string | null;
  playerCountry?: CountryRecord | null;
  countries: CountryRecord[];
  regions?: RegionRecord[];
  orders: PendingOrderRecord[];
  awaitingAiSimulation: boolean;
  mcpStatus?: McpConnectionStatus;
  preselectedTargetCode: string | null;
  prefillOrderText?: string | null;
  prefillOrderCategory?: string | null;
  onClearPrefillOrder?: () => void;
  onClearPreselectedTarget: () => void;
  onOrdersUpdated: () => void;
  onOpenAiAdvisor?: () => void;
}

export function OrderConsole({
  sessionId,
  playerCountryCode,
  playerCountry,
  countries,
  regions,
  orders,
  awaitingAiSimulation,
  mcpStatus,
  preselectedTargetCode,
  prefillOrderText,
  prefillOrderCategory,
  onClearPrefillOrder,
  onClearPreselectedTarget,
  onOrdersUpdated,
  onOpenAiAdvisor,
}: OrderConsoleProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const survivingCountryCodes = regions
    ? new Set(regions.map((r) => r.ownerCountryCode))
    : null;

  const [content, setContent] = useState("");
  const [orderType, setOrderType] = useState<OrderCategory>("COMMAND");
  const [targetCountryCode, setTargetCountryCode] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [brainstormIdeas, setBrainstormIdeas] = useState<string[]>([]);

  useEffect(() => {
    if (
      preselectedTargetCode &&
      preselectedTargetCode !== playerCountryCode &&
      (!survivingCountryCodes || survivingCountryCodes.has(preselectedTargetCode))
    ) {
      setOrderType("DIPLOMACY");
      setTargetCountryCode(preselectedTargetCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedTargetCode, playerCountryCode, regions]);

  useEffect(() => {
    if (prefillOrderText) {
      setContent(prefillOrderText);
      if (
        prefillOrderCategory &&
        ORDER_TABS.some((t) => t.id === prefillOrderCategory)
      ) {
        setOrderType(prefillOrderCategory as OrderCategory);
      }
      onClearPrefillOrder?.();
    }
  }, [prefillOrderText, prefillOrderCategory, onClearPrefillOrder]);

  const otherCountries = countries.filter(
    (c) =>
      c.code !== playerCountryCode &&
      (!survivingCountryCodes || survivingCountryCodes.has(c.code))
  );

  useEffect(() => {
    if (
      targetCountryCode &&
      survivingCountryCodes &&
      !survivingCountryCodes.has(targetCountryCode)
    ) {
      setTargetCountryCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, targetCountryCode]);

  const handleBrainstorm = () => {
    const rawName = playerCountry?.name ?? playerCountryCode ?? "";
    const name = playerCountryCode
      ? getCountryDisplayName(playerCountryCode, rawName, locale)
      : isTr
        ? "Ülkemiz"
        : "Our Nation";
    const ideas = isTr
      ? [
          `${name} genelinde demiryolu, enerji ve ağır sanayi koridorlarını birbirine bağlayan 5 yıllık kalkınma hamlesi başlat; sanayi vergi teşvikleriyle üretimi artır.`,
          `Sınır birliklerini modernize et, zırhlı ve hava savunma envanterini güçlendir; komşu sınırında caydırıcı savunma tatbikatı ilan et.`,
          `Bölgesel ticaret ortaklarıyla gümrük birliği ve saldırmazlık paktı önererek uluslararası konseyde meşruiyeti artır.`,
          `Yabancı başkentlerde istihbarat ağını genişlet, karşı-casusluk birimleri kur ve stratejik kaynak tedarikini güvenceye al.`,
        ]
      : [
          `Launch a 5-year development drive linking rail, energy, and heavy industry corridors across ${name}; boost output through industrial tax incentives.`,
          `Modernize frontier forces, upgrade armor and air-defense stockpiles, and announce deterrent defensive drills along neighboring borders.`,
          `Propose customs unions and non-aggression pacts with regional trade partners to bolster legitimacy in international councils.`,
          `Expand intelligence networks in foreign capitals, establish counter-espionage units, and secure strategic resource supply lines.`,
        ];
    setBrainstormIdeas(ideas);
  };

  const handleEnhance = () => {
    const raw = content.trim();
    if (!raw) return;
    const tab = ORDER_TABS.find((t) => t.id === orderType);
    const tabLabel = tab ? (isTr ? tab.labelTr : tab.labelEn) : isTr ? "Direktif" : "Directive";
    const targetDisplay = targetCountryCode
      ? getCountryDisplayName(
          targetCountryCode,
          countries.find((c) => c.code === targetCountryCode)?.name ?? targetCountryCode,
          locale
        )
      : "";
    const targetNote =
      orderType === "DIPLOMACY" && targetCountryCode
        ? isTr
          ? ` (${targetDisplay} muhatap alınarak)`
          : ` (Addressed to ${targetDisplay})`
        : "";
    const enhanced = isTr
      ? `[${tabLabel}${targetNote}] ${raw.charAt(0).toUpperCase() + raw.slice(1)}. Uygulama planı: Hazine bütçesinden ayrılan kaynakla aşamalı lojistik hazırlık yürütülsün, kamuoyu ve meclis desteği sağlanarak iç istikrar korunsun, uluslararası tepkiler ve komşu ülkelerin olası itirazları diplomatik kanallardan dengelensin.`
      : `[${tabLabel}${targetNote}] ${raw.charAt(0).toUpperCase() + raw.slice(1)}. Implementation plan: Execute phased logistical preparation from treasury reserves, maintain domestic stability via public and parliamentary backing, and balance international reactions through active diplomatic channels.`;
    setContent(enhanced);
  };

  const sendOrderRequest = async (
    action: "queue" | "complete_turn" | "wake_ai"
  ) => {
    if (action === "queue" && !content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          content: content.trim(),
          orderType,
          targetCountryCode:
            orderType === "DIPLOMACY" && targetCountryCode
              ? targetCountryCode
              : undefined,
          locale,
        }),
      });
      if (res.ok) {
        setContent("");
        setBrainstormIdeas([]);
        onClearPreselectedTarget();
        onOrdersUpdated();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    await fetch(`/api/sessions/${sessionId}/orders?orderId=${orderId}`, {
      method: "DELETE",
    });
    onOrdersUpdated();
  };

  const aiWaiting = mcpStatus?.aiWaiting ?? false;

  return (
    <div className="z-20 border-t border-border/80 bg-[#090e17]/95 px-4 py-2.5 backdrop-blur-md">
      {aiWaiting && !awaitingAiSimulation && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 animate-bounce text-emerald-400" />
            <span>
              {isTr ? (
                <>
                  <strong>MCP AI Süresiz Beklemede (Token Harcanmıyor):</strong>{" "}
                  Siz bir şey yapmadığınız sürece bağlantı kapanmaz. <em>&ldquo;Turu
                  Tamamla&rdquo;</em>, <em>&ldquo;AI&apos;dan Fikir Al&rdquo;</em>{" "}
                  veya lider/konsey penceresinde <em>&ldquo;Gönder&rdquo;</em>{" "}
                  butonuna bastığınız an otomatik uyanır!
                </>
              ) : (
                <>
                  <strong>MCP AI Standing By Indefinitely (Zero Token Idle):</strong>{" "}
                  Connection stays open while you plan. Wakes automatically the moment you click{" "}
                  <em>&ldquo;Complete Turn&rdquo;</em>, <em>&ldquo;AI Advisor&rdquo;</em>, or{" "}
                  <em>&ldquo;Send&rdquo;</em> in leader/council chats!
                </>
              )}
            </span>
          </div>
          <Badge variant="success">
            {isTr ? "Otomatik Tetikleme Hazır" : "Auto-Trigger Ready"}
          </Badge>
        </div>
      )}

      {awaitingAiSimulation && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 animate-pulse text-amber-400" />
            <span>
              <strong>
                {isTr
                  ? "AI Simülasyonu İşleniyor / Bekleniyor:"
                  : "AI Simulation Processing / Waiting:"}
              </strong>{" "}
              {aiWaiting
                ? isTr
                  ? "Emirleriniz beklemedeki MCP AI'ya iletildi, simülasyon araçları çalıştırılıyor..."
                  : "Your orders were dispatched to waiting MCP AI; simulation tools are running..."
                : isTr
                  ? "Emirler kuyruğa alındı. Beklemedeki MCP AI'yı hemen tetiklemek için sağdaki butona basabilirsiniz."
                  : "Orders queued. Click the button on the right to wake waiting MCP AI immediately."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="warning">
              {isTr
                ? `Kuyruk Hazır (${orders.length} Emir)`
                : `Queue Ready (${orders.length} Orders)`}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => sendOrderRequest("wake_ai")}
              className="h-7 border-amber-400/50 bg-amber-500/20 text-[11px] text-amber-100 hover:bg-amber-500/30"
            >
              <Send className="h-3 w-3" />
              {isTr ? "Şimdi MCP AI'ya Gönder" : "Dispatch to MCP AI Now"}
            </Button>
          </div>
        </div>
      )}

      {brainstormIdeas.length > 0 && (
        <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {brainstormIdeas.map((idea, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setContent(idea);
                setBrainstormIdeas([]);
              }}
              className="flex items-start gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-primary/20 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <span className="line-clamp-2">{idea}</span>
            </button>
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {orders.map((ord) => {
            const ordTab = ORDER_TABS.find((t) => t.id === ord.orderType);
            const ordLabel = ordTab
              ? isTr
                ? ordTab.labelTr
                : ordTab.labelEn
              : ord.orderType;
            return (
              <div
                key={ord.id}
                className="flex max-w-md items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] text-foreground"
              >
                <Badge
                  variant={
                    ord.orderType === "NOTE_TO_AI"
                      ? "warning"
                      : ord.orderType === "DIPLOMACY"
                        ? "default"
                        : "secondary"
                  }
                >
                  {ord.orderType === "DIPLOMACY"
                    ? `${isTr ? "DİPLOMASİ" : "DIPLOMACY"} → ${ord.targetCountryCode ?? "?"}`
                    : ordLabel}
                </Badge>
                <span className="truncate">{ord.content}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(ord.id)}
                  className="text-muted-foreground hover:text-red-400 cursor-pointer"
                  title={isTr ? "Emri İptal Et" : "Cancel Order"}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1">
          {ORDER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOrderType(tab.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                orderType === tab.id
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isTr ? tab.labelTr : tab.labelEn}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {orderType === "DIPLOMACY" && (
            <div className="w-52">
              <Select
                value={targetCountryCode}
                onValueChange={setTargetCountryCode}
              >
                <SelectTrigger className="h-8 text-[11px]">
                  <SelectValue
                    placeholder={
                      isTr ? "Hedef ülke seçin..." : "Select target nation..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {otherCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flagEmoji} {getCountryDisplayName(c.code, c.name, locale)} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {onOpenAiAdvisor && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenAiAdvisor}
              disabled={!playerCountryCode}
              className="bg-emerald-600/90 text-white hover:bg-emerald-500"
              title={
                isTr
                  ? "MCP AI Danışman ile canlı mesajlaş ve fikir al"
                  : "Live chat & brainstorm with MCP AI Advisor"
              }
            >
              <Bot className="h-3.5 w-3.5" />
              {isTr ? "AI'dan Fikir Al (MCP)" : "Ask AI Advisor (MCP)"}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBrainstorm}
            disabled={!playerCountryCode}
            title={
              isTr ? "Hızlı Örnek Emir Şablonları" : "Quick Sample Order Prompts"
            }
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
            {isTr ? "Örnek Fikirler" : "Sample Ideas"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleEnhance}
            disabled={!playerCountryCode || !content.trim()}
            title={
              isTr
                ? "Emrini detaylı ve lojistik temelli direktife dönüştür"
                : "Expand draft into a detailed logistics directive"
            }
          >
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            {isTr ? "Güçlendir" : "Enhance"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!playerCountryCode || submitting}
            placeholder={
              orderType === "NOTE_TO_AI"
                ? isTr
                  ? "[AI'ya Not] Simülasyonu yönlendirmek için sahne arkası senaryo talimatı yazın..."
                  : "[Note to AI] Write a behind-the-scenes directive to guide simulation tone..."
                : playerCountryCode
                  ? isTr
                    ? "Emrinizi serbest metinle yazın... (Örn: 'Doğu sınırına ordu yığ ve boğazlardan geçen ticaret gemilerine denetim başlat')"
                    : "Write your freeform order... (e.g. 'Deploy armored corps to the eastern frontier and inspect strait shipping')"
                  : isTr
                    ? "Önce haritadan yöneteceğiniz ülkeyi seçin..."
                    : "Select your nation on the map first..."
            }
            className="min-h-[54px] resize-none text-xs"
          />
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!playerCountryCode || !content.trim() || submitting}
            onClick={() => sendOrderRequest("queue")}
          >
            <ListPlus className="h-4 w-4" />
            {isTr ? "Emri Kuyruğa Ekle" : "Queue Order"}
          </Button>
          <Button
            type="button"
            disabled={!playerCountryCode || submitting}
            onClick={() => sendOrderRequest("complete_turn")}
          >
            <Send className="h-4 w-4" />
            {isTr
              ? "Turu Tamamla (AI Simülasyonunu Başlat)"
              : "Complete Turn (Start AI Simulation)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
