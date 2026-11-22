"use client";

import { useLocale } from "@/components/LanguageProvider";

import { useState } from "react";
import { Bug, Database, Play, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SessionState } from "@/lib/client-types";
import { advanceDateMonths } from "@/lib/utils";

interface McpDebugDrawerProps {
  open: boolean;
  onClose: () => void;
  session: SessionState;
  selectedRegionId: string | null;
}

export function McpDebugDrawer({
  open,
  onClose,
  session,
  selectedRegionId,
}: McpDebugDrawerProps) {
  const [selectedTool, setSelectedTool] = useState("transfer_territory");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);

  // Tool states
  const [regionIds, setRegionIds] = useState(
    selectedRegionId || "FRA_ALSACE"
  );
  const [targetOwner, setTargetOwner] = useState(
    session.playerCountryCode || session.countries[0]?.code || "TUR"
  );
  const [transferReason, setTransferReason] = useState(
    "Askeri harekat sonrası kontrol değişimi"
  );

  const [statCountry, setStatCountry] = useState(
    session.playerCountryCode || "TUR"
  );
  const [ecoDelta, setEcoDelta] = useState("4");
  const [milDelta, setMilDelta] = useState("6");
  const [stabDelta, setStabDelta] = useState("-2");
  const [newIdeology, setNewIdeology] = useState("");

  const [diploA, setDiploA] = useState(session.playerCountryCode || "TUR");
  const [diploB, setDiploB] = useState(
    session.countries.find((c) => c.code !== (session.playerCountryCode || "TUR"))
      ?.code || "FRA"
  );
  const [diploStatus, setDiploStatus] = useState("ALLIANCE");
  const [treatyName, setTreatyName] = useState("Stratejik Dostluk Paktı");

  const [headline, setHeadline] = useState(
    "SINIR HATTINDA BEKLENMEDİK ASKERİ HAREKETLİLİK"
  );
  const [articleBody, setArticleBody] = useState(
    "Diplomatik kaynaklar tarafların sınır garnizonlarını güçlendirdiğini bildiriyor. Başkentlerde olağanüstü güvenlik toplantıları yapılıyor."
  );
  const [eventCategory, setEventCategory] = useState("CRISIS");
  const [involvedCountries, setInvolvedCountries] = useState(
    `${session.playerCountryCode || "TUR"}, FRA`
  );

  const [msgFrom, setMsgFrom] = useState(diploB);
  const [msgTo, setMsgTo] = useState(session.playerCountryCode || "TUR");
  const [msgTitle, setMsgTitle] = useState("Dışişleri Bakanlığı");
  const [msgBody, setMsgBody] = useState(
    "Son sınır hamlelerinizi yakından izliyoruz. Masada uzlaşma kapısı hala açıktır."
  );

  const [chatTarget, setChatTarget] = useState(diploB);
  const [chatReply, setChatReply] = useState(
    "Teklifinizi değerlendirdik. Sınır güvenliği ve ticaret koridorları konusunda yapıcı bir anlaşmaya açığız."
  );

  const [councilTitle, setCouncilTitle] = useState(
    "Doğu Akdeniz Güvenlik Konseyi"
  );
  const [councilTopic, setCouncilTopic] = useState(
    "Son sınır hamleleri ve ortak bölgesel güvenlik garantileri"
  );
  const [councilType, setCouncilType] = useState<
    "COUNCIL" | "COALITION" | "SUMMIT" | "PROTEST"
  >("COUNCIL");
  const [councilParticipants, setCouncilParticipants] = useState(
    `${diploB}, GBR, ${session.playerCountryCode || "TUR"}`
  );
  const [councilStatement, setCouncilStatement] = useState(
    "Tek taraflı hamleler karşısında ortak diplomatik çerçeve talep ediyoruz."
  );
  const [councilIdInput, setCouncilIdInput] = useState(
    session.councils?.[0]?.id || ""
  );
  const [councilReplyCountry, setCouncilReplyCountry] = useState(diploB);
  const [councilReplyMessage, setCouncilReplyMessage] = useState(
    "Karşılıklı güvence verilirse yaptırım tasarısını durdurabiliriz."
  );

  const [nextDate, setNextDate] = useState(
    advanceDateMonths(session.currentDate, session.scenario.turnIntervalMonths)
  );
  const [turnSummary, setTurnSummary] = useState(
    "Sınır değişiklikleri ve diplomatik gelişmelerle yeni döneme girildi."
  );

  const [markerCity, setMarkerCity] = useState("Ankara");
  const [markerCountry, setMarkerCountry] = useState(
    session.playerCountryCode || "TUR"
  );
  const [markerTitle, setMarkerTitle] = useState(
    "Ankara Ağır Makina & Savunma Fabrikası"
  );
  const [markerDesc, setMarkerDesc] = useState(
    "Zırhlı araç, mühimmat ve topçu üretimi yapan stratejik sanayi kompleksi."
  );
  const [markerCategory, setMarkerCategory] = useState<
    | "INDUSTRY"
    | "MILITARY"
    | "INFRASTRUCTURE"
    | "NAVAL"
    | "RESEARCH"
    | "DIPLOMACY"
    | "INTERNAL"
    | "CRISIS"
  >("INDUSTRY");
  const [markerLevel, setMarkerLevel] = useState("2");
  const { locale } = useLocale();
  const isTr = locale === "tr";

  const [advisorReplyText, setAdvisorReplyText] = useState(
    "Mevcut durumda önce Ankara'da ağır sanayi kurmanız, ardından komşularla saldırmazlık paktı önermeniz en güvenli stratejidir."
  );

  if (!open) return null;

  const runDebugCall = async (
    mode: "tool" | "resource",
    name: string,
    args?: Record<string, unknown>
  ) => {
    setRunning(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, name, args }),
      });
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setOutput(String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleTriggerTool = () => {
    switch (selectedTool) {
      case "transfer_territory":
        return runDebugCall("tool", "transfer_territory", {
          region_ids: regionIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          new_owner_country_id: targetOwner,
          reason: transferReason,
        });
      case "update_country_stats":
        return runDebugCall("tool", "update_country_stats", {
          country_id: statCountry,
          economy_delta: Number(ecoDelta),
          military_delta: Number(milDelta),
          stability_delta: Number(stabDelta),
          new_ideology: newIdeology || undefined,
        });
      case "manage_diplomacy":
        return runDebugCall("tool", "manage_diplomacy", {
          country_a: diploA,
          country_b: diploB,
          relation_status: diploStatus,
          treaty_name: treatyName,
        });
      case "publish_world_event":
        return runDebugCall("tool", "publish_world_event", {
          headline,
          article_body: articleBody,
          category: eventCategory,
          involved_countries: involvedCountries
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      case "send_diplomatic_message":
        return runDebugCall("tool", "send_diplomatic_message", {
          from_country_id: msgFrom,
          to_country_id: msgTo,
          sender_title: msgTitle,
          message: msgBody,
        });
      case "reply_leader_chat":
        return runDebugCall("tool", "reply_leader_chat", {
          target_country_id: chatTarget,
          reply_message: chatReply,
        });
      case "convene_diplomatic_council": {
        const participants = councilParticipants
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const initiator = participants[0] || diploB;
        return runDebugCall("tool", "convene_diplomatic_council", {
          title: councilTitle,
          topic: councilTopic,
          council_type: councilType,
          initiator_country_id: initiator,
          participant_country_ids: participants,
          opening_statements: [
            {
              country_id: initiator,
              message: councilStatement,
              stance: "CRITICAL",
            },
          ],
        });
      }
      case "reply_diplomatic_council":
        return runDebugCall("tool", "reply_diplomatic_council", {
          council_id: councilIdInput || session.councils?.[0]?.id || "",
          responses: [
            {
              country_id: councilReplyCountry.trim().toUpperCase() || diploB,
              message: councilReplyMessage,
              stance: "MEDIATOR",
            },
          ],
        });
      case "advance_turn":
        return runDebugCall("tool", "advance_turn", {
          new_date: nextDate,
          turn_summary: turnSummary,
        });
      case "manage_map_markers":
        return runDebugCall("tool", "manage_map_markers", {
          action: "CREATE",
          country_id: markerCountry,
          city_name: markerCity,
          title: markerTitle,
          description: markerDesc,
          category: markerCategory,
          status: "ACTIVE",
          level: Number(markerLevel) || 1,
          is_animated: true,
        });
      case "wait_for_player_action":
        return runDebugCall("tool", "wait_for_player_action", {
          timeout_seconds: 15,
        });
      case "reply_advisor_chat":
        return runDebugCall("tool", "reply_advisor_chat", {
          reply_message: advisorReplyText,
          suggested_orders: [
            {
              title: "Ankara Savunma Sanayii Hamlesi",
              category: "ECONOMY",
              command:
                "Ankara'da zırhlı araç ve mühimmat üreten ağır makina fabrikası kur.",
            },
          ],
        });
    }
  };

  return (
    <div className="fixed right-4 top-16 z-40 flex h-[78vh] w-[420px] max-w-[94vw] flex-col rounded-xl border border-primary/45 bg-[#0b1019]/98 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">MCP Debug &amp; Simulator</span>
          <Badge variant="outline">{isTr ? "Lokal Test" : "Local Test"}</Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Tabs defaultValue="tools" className="flex flex-1 flex-col overflow-hidden p-3">
        <TabsList className="w-full">
          <TabsTrigger value="tools">
            <Wrench className="h-3.5 w-3.5" />
            {isTr ? "MCP Araçları" : "MCP Tools"}
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Database className="h-3.5 w-3.5" />
            {isTr ? "MCP Kaynakları" : "MCP Resources"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-1">
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  {isTr ? "Tetiklenecek MCP Aracı" : "MCP Tool to Invoke"}
                </label>
                <Select value={selectedTool} onValueChange={setSelectedTool}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer_territory">
                      1. transfer_territory ({isTr ? "Harita Sınır Değişimi" : "Map Border Shift"})
                    </SelectItem>
                    <SelectItem value="update_country_stats">
                      2. update_country_stats ({isTr ? "Ülke İstatistikleri" : "Nation Stats"})
                    </SelectItem>
                    <SelectItem value="manage_diplomacy">
                      3. manage_diplomacy ({isTr ? "Savaş / İttifak / Pakt" : "War / Alliance / Pact"})
                    </SelectItem>
                    <SelectItem value="publish_world_event">
                      4. publish_world_event ({isTr ? "Gazete Manşeti" : "Newspaper Headline"})
                    </SelectItem>
                    <SelectItem value="send_diplomatic_message">
                      5. send_diplomatic_message ({isTr ? "Lider Mesajı" : "Leader Dispatch"})
                    </SelectItem>
                    <SelectItem value="reply_leader_chat">
                      6. reply_leader_chat ({isTr ? "Başkan Sohbet Yanıtı" : "Leader Chat Reply"})
                    </SelectItem>
                    <SelectItem value="convene_diplomatic_council">
                      7. convene_diplomatic_council ({isTr ? "Çok Uluslu Konsey Kur" : "Convene Multilateral Council"})
                    </SelectItem>
                    <SelectItem value="reply_diplomatic_council">
                      8. reply_diplomatic_council ({isTr ? "Konseye Çoklu Lider Yanıtı" : "Council Multi-Leader Reply"})
                    </SelectItem>
                    <SelectItem value="advance_turn">
                      9. advance_turn ({isTr ? "Turu İlerlet & Snapshot" : "Advance Turn & Snapshot"})
                    </SelectItem>
                    <SelectItem value="manage_map_markers">
                      10. manage_map_markers ({isTr ? "Harita Tesisi / Animasyonlu Nokta" : "Map Landmark / Beacon"})
                    </SelectItem>
                    <SelectItem value="wait_for_player_action">
                      11. wait_for_player_action ({isTr ? "Canlı Buton Beklemesi" : "Live Action Wait"})
                    </SelectItem>
                    <SelectItem value="reply_advisor_chat">
                      12. reply_advisor_chat ({isTr ? "AI Danışman / Fikir Yanıtı" : "AI Advisor Reply"})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTool === "transfer_territory" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">
                      Bölge ID Listesi (virgülle)
                    </label>
                    <Input
                      value={regionIds}
                      onChange={(e) => setRegionIds(e.target.value)}
                      placeholder="Örn: SYR, GRC, FRA_ALSACE"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">
                      Yeni Sahip Ülke Kodu
                    </label>
                    <Input
                      value={targetOwner}
                      onChange={(e) => setTargetOwner(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">
                      Neden
                    </label>
                    <Input
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedTool === "update_country_stats" && (
                <div className="space-y-2">
                  <Input
                    value={statCountry}
                    onChange={(e) => setStatCountry(e.target.value)}
                    placeholder="Ülke Kodu (örn. TUR)"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">
                        Ekonomi Δ
                      </label>
                      <Input
                        type="number"
                        value={ecoDelta}
                        onChange={(e) => setEcoDelta(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">
                        Ordu Δ
                      </label>
                      <Input
                        type="number"
                        value={milDelta}
                        onChange={(e) => setMilDelta(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">
                        İstikrar Δ
                      </label>
                      <Input
                        type="number"
                        value={stabDelta}
                        onChange={(e) => setStabDelta(e.target.value)}
                      />
                    </div>
                  </div>
                  <Input
                    value={newIdeology}
                    onChange={(e) => setNewIdeology(e.target.value)}
                    placeholder="Yeni İdeoloji (opsiyonel)"
                  />
                </div>
              )}

              {selectedTool === "manage_diplomacy" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={diploA}
                      onChange={(e) => setDiploA(e.target.value)}
                      placeholder="Ülke A"
                    />
                    <Input
                      value={diploB}
                      onChange={(e) => setDiploB(e.target.value)}
                      placeholder="Ülke B"
                    />
                  </div>
                  <Select value={diploStatus} onValueChange={setDiploStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAR">WAR (Savaş)</SelectItem>
                      <SelectItem value="ALLIANCE">ALLIANCE (İttifak)</SelectItem>
                      <SelectItem value="NON_AGGRESSION">
                        NON_AGGRESSION (Saldırmazlık)
                      </SelectItem>
                      <SelectItem value="VASSAL">VASSAL</SelectItem>
                      <SelectItem value="EMBARGO">EMBARGO</SelectItem>
                      <SelectItem value="NEUTRAL">NEUTRAL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={treatyName}
                    onChange={(e) => setTreatyName(e.target.value)}
                    placeholder="Antlaşma Adı"
                  />
                </div>
              )}

              {selectedTool === "publish_world_event" && (
                <div className="space-y-2">
                  <Input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Manşet"
                  />
                  <Textarea
                    value={articleBody}
                    onChange={(e) => setArticleBody(e.target.value)}
                    className="min-h-[70px] text-xs"
                  />
                  <Select value={eventCategory} onValueChange={setEventCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAR">WAR</SelectItem>
                      <SelectItem value="DIPLOMACY">DIPLOMACY</SelectItem>
                      <SelectItem value="ECONOMY">ECONOMY</SelectItem>
                      <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                      <SelectItem value="CRISIS">CRISIS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={involvedCountries}
                    onChange={(e) => setInvolvedCountries(e.target.value)}
                    placeholder="Ülkeler (virgülle)"
                  />
                </div>
              )}

              {selectedTool === "send_diplomatic_message" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={msgFrom}
                      onChange={(e) => setMsgFrom(e.target.value)}
                      placeholder="Gönderen Ülke"
                    />
                    <Input
                      value={msgTo}
                      onChange={(e) => setMsgTo(e.target.value)}
                      placeholder="Alıcı Ülke"
                    />
                  </div>
                  <Input
                    value={msgTitle}
                    onChange={(e) => setMsgTitle(e.target.value)}
                    placeholder="Gönderen Makam"
                  />
                  <Textarea
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    className="min-h-[70px] text-xs"
                  />
                </div>
              )}

              {selectedTool === "reply_leader_chat" && (
                <div className="space-y-2">
                  <Input
                    value={chatTarget}
                    onChange={(e) => setChatTarget(e.target.value)}
                    placeholder="Yanıt Veren Ülke Kodu (örn. USA, RUS, FRA)"
                  />
                  <Textarea
                    value={chatReply}
                    onChange={(e) => setChatReply(e.target.value)}
                    className="min-h-[80px] text-xs"
                    placeholder="Başkanın bire bir sohbet yanıtı..."
                  />
                </div>
              )}

              {selectedTool === "convene_diplomatic_council" && (
                <div className="space-y-2">
                  <Input
                    value={councilTitle}
                    onChange={(e) => setCouncilTitle(e.target.value)}
                    placeholder="Konsey Başlığı"
                  />
                  <Input
                    value={councilTopic}
                    onChange={(e) => setCouncilTopic(e.target.value)}
                    placeholder="Gündem / Rahatsızlık Konusu"
                  />
                  <Select
                    value={councilType}
                    onValueChange={(v) =>
                      setCouncilType(
                        v as "COUNCIL" | "COALITION" | "SUMMIT" | "PROTEST"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COUNCIL">COUNCIL (Ortak Konsey)</SelectItem>
                      <SelectItem value="COALITION">COALITION (Koalisyon)</SelectItem>
                      <SelectItem value="SUMMIT">SUMMIT (Zirve)</SelectItem>
                      <SelectItem value="PROTEST">PROTEST (Ortak Nota)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={councilParticipants}
                    onChange={(e) => setCouncilParticipants(e.target.value)}
                    placeholder="Katılımcılar (virgülle, örn. FRA, GBR, TUR)"
                  />
                  <Textarea
                    value={councilStatement}
                    onChange={(e) => setCouncilStatement(e.target.value)}
                    className="min-h-[65px] text-xs"
                    placeholder="Başlatan liderin açılış bildirisi..."
                  />
                </div>
              )}

              {selectedTool === "reply_diplomatic_council" && (
                <div className="space-y-2">
                  <Input
                    value={councilIdInput}
                    onChange={(e) => setCouncilIdInput(e.target.value)}
                    placeholder={
                      session.councils?.[0]?.id
                        ? `Konsey ID (boşsa: ${session.councils[0].id})`
                        : "Konsey ID"
                    }
                  />
                  <Input
                    value={councilReplyCountry}
                    onChange={(e) => setCouncilReplyCountry(e.target.value)}
                    placeholder="Söz Alan Ülke Kodu (örn. GBR)"
                  />
                  <Textarea
                    value={councilReplyMessage}
                    onChange={(e) => setCouncilReplyMessage(e.target.value)}
                    className="min-h-[70px] text-xs"
                    placeholder="Liderin konsey salonundaki yanıtı..."
                  />
                </div>
              )}

              {selectedTool === "advance_turn" && (
                <div className="space-y-2">
                  <Input
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    placeholder="Yeni Tarih (YYYY-AA-GG)"
                  />
                  <Textarea
                    value={turnSummary}
                    onChange={(e) => setTurnSummary(e.target.value)}
                    className="min-h-[70px] text-xs"
                  />
                </div>
              )}

              {selectedTool === "manage_map_markers" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={markerCity}
                      onChange={(e) => setMarkerCity(e.target.value)}
                      placeholder="Şehir (örn. Ankara, İstanbul)"
                    />
                    <Input
                      value={markerCountry}
                      onChange={(e) => setMarkerCountry(e.target.value)}
                      placeholder="Ülke (örn. TUR)"
                    />
                  </div>
                  <Input
                    value={markerTitle}
                    onChange={(e) => setMarkerTitle(e.target.value)}
                    placeholder="Tesis / İşaret Başlığı"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={markerCategory}
                      onValueChange={(v) =>
                        setMarkerCategory(
                          v as
                            | "INDUSTRY"
                            | "MILITARY"
                            | "INFRASTRUCTURE"
                            | "NAVAL"
                            | "RESEARCH"
                            | "DIPLOMACY"
                            | "INTERNAL"
                            | "CRISIS"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INDUSTRY">INDUSTRY (Fabrika)</SelectItem>
                        <SelectItem value="MILITARY">MILITARY (Askeri Üs)</SelectItem>
                        <SelectItem value="INFRASTRUCTURE">INFRASTRUCTURE (Altyapı)</SelectItem>
                        <SelectItem value="NAVAL">NAVAL (Tersane/Liman)</SelectItem>
                        <SelectItem value="RESEARCH">RESEARCH (Ar-Ge)</SelectItem>
                        <SelectItem value="DIPLOMACY">DIPLOMACY (Zirve)</SelectItem>
                        <SelectItem value="INTERNAL">INTERNAL (İç Proje)</SelectItem>
                        <SelectItem value="CRISIS">CRISIS (Kriz/Çatışma)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={markerLevel}
                      onChange={(e) => setMarkerLevel(e.target.value)}
                      placeholder="Seviye (1-5)"
                    />
                  </div>
                  <Textarea
                    value={markerDesc}
                    onChange={(e) => setMarkerDesc(e.target.value)}
                    className="min-h-[60px] text-xs"
                    placeholder="Harita kartında görünecek açıklama..."
                  />
                </div>
              )}

              {selectedTool === "reply_advisor_chat" && (
                <div className="space-y-2">
                  <Textarea
                    value={advisorReplyText}
                    onChange={(e) => setAdvisorReplyText(e.target.value)}
                    className="min-h-[80px] text-xs"
                    placeholder="AI Danışmanın stratejik yanıtı..."
                  />
                </div>
              )}

              <Button
                className="w-full"
                disabled={running}
                onClick={handleTriggerTool}
              >
                <Play className="h-3.5 w-3.5" />
                {running
                  ? isTr
                    ? "Çalıştırılıyor..."
                    : "Running..."
                  : isTr
                    ? "Aracı Canlı Tetikle"
                    : "Invoke Live Tool"}
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resources" className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 gap-1.5">
            {[
              "world-state",
              "countries",
              "map-ownership",
              "map-markers",
              "advisor-chat",
              "pending-orders",
              "chronicle-history",
              "pending-leader-chats",
              "diplomatic-councils",
            ].map((resName) => (
              <Button
                key={resName}
                size="sm"
                variant="outline"
                disabled={running}
                className="justify-start font-mono text-[11px]"
                onClick={() => runDebugCall("resource", resName)}
              >
                game://session/{session.id.slice(0, 6)}.../{resName}
              </Button>
            ))}
          </div>
        </TabsContent>

        {output && (
          <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-[#06090f] p-2 font-mono text-[10px] text-emerald-300">
            <pre>{output}</pre>
          </div>
        )}
      </Tabs>
    </div>
  );
}
