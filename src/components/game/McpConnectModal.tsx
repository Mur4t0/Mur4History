"use client";

import { useLocale } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import { Check, Copy, PlugZap, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface McpConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

export function McpConnectModal({
  open,
  onOpenChange,
  sessionId,
}: McpConnectModalProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const streamableUrl = `${origin}/api/mcp/${sessionId}`;
  const sseUrl = `${origin}/api/mcp/${sessionId}/sse`;

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        [`mur4history-${sessionId.slice(-6)}`]: {
          url: streamableUrl,
        },
      },
    },
    null,
    2
  );

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        [`mur4history-${sessionId.slice(-6)}`]: {
          command: "npx",
          args: ["-y", "mcp-remote", streamableUrl],
        },
      },
    },
    null,
    2
  );

  const legacySseConfig = JSON.stringify(
    {
      mcpServers: {
        [`mur4history-${sessionId.slice(-6)}`]: {
          url: sseUrl,
        },
      },
    },
    null,
    2
  );

  const gmStarterCommand = isTr
    ? `Bağlı mur4history MCP sunucusundaki 'pax_game_master_prompt' kurallarını uygula. Önce read_game_context (veya 10 MCP kaynağını) oku; bekleyen emir, savaş hamlesi, bire bir lider mesajı, konsey tartışması veya AI Danışman sorusu varsa ilgili MCP araçlarıyla (reply_advisor_chat, reply_leader_chat, transfer_nuclear_warheads, provoke_country, trigger_war_operation, launch_nuclear_strike, convene_diplomatic_council, reply_diplomatic_council, manage_map_markers, transfer_territory, update_country_stats, manage_diplomacy, publish_world_event, advance_turn) simüle et. İşin biter bitmez (veya şu an bekleyen bir işlem yoksa hemen şimdi) 'wait_for_player_action' aracını parametre vermeden (timeout_seconds=0 -> SÜRESİZ BEKLEME) çağır. Oyuncu yeni bir hamle veya mesaj gönderene kadar bağlantı açık ve süresiz beklemede kalacaktır (boşuna token yakmaz); her hamle geldikten ve uyguladıktan sonra yeniden 'wait_for_player_action' çağırarak süresiz beklemeye geç.`
    : `Follow the 'pax_game_master_prompt' rules on the connected mur4history MCP server. First call read_game_context (or read the 10 MCP resources); if there are pending orders, war actions, 1-on-1 leader messages, council debates, or AI Advisor questions, simulate them with the relevant MCP tools (reply_advisor_chat, reply_leader_chat, transfer_nuclear_warheads, provoke_country, trigger_war_operation, launch_nuclear_strike, convene_diplomatic_council, reply_diplomatic_council, manage_map_markers, transfer_territory, update_country_stats, manage_diplomacy, publish_world_event, advance_turn). As soon as you finish (or right now if nothing is pending), call 'wait_for_player_action' without parameters (timeout_seconds=0 -> INDEFINITE WAIT). The connection stays open indefinitely with zero idle tokens until the player sends a new move or message; after handling each update, call 'wait_for_player_action' again.`;

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-primary" />
            {isTr
              ? `MCP Bağlantı Merkezi (Oturum: ${sessionId})`
              : `MCP Connection Hub (Session: ${sessionId})`}
          </ModalTitle>
          <ModalDescription>
            {isTr
              ? "Bu oyun oturumu için özel MCP Sunucusu aktif. Kendi yapay zeka istemcinizi aşağıdaki tek tıkla kopyalanabilir konfigürasyonla bağlayarak sıfır token maliyetiyle oynayın."
              : "A dedicated MCP Server is live for this session. Connect your AI client using the one-click configurations below to play at zero middleman token cost."}
          </ModalDescription>
        </ModalHeader>

        {/* Endpoints */}
        <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-primary">
                Streamable HTTP Endpoint:
              </span>
              <div className="mt-0.5 font-mono text-[11px] text-foreground break-all">
                {streamableUrl}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText("streamableUrl", streamableUrl)}
            >
              {copiedKey === "streamableUrl" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isTr ? "Kopyala" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <div>
              <span className="font-semibold text-amber-400">
                Legacy SSE Endpoint:
              </span>
              <div className="mt-0.5 font-mono text-[11px] text-foreground break-all">
                {sseUrl}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText("sseUrl", sseUrl)}
            >
              {copiedKey === "sseUrl" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isTr ? "Kopyala" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Client Config Tabs */}
        <Tabs defaultValue="cursor" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="cursor">Cursor / Streamable HTTP</TabsTrigger>
            <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
            <TabsTrigger value="sse">Cline / Legacy SSE</TabsTrigger>
          </TabsList>

          <TabsContent value="cursor" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isTr ? (
                  <>
                    <code>.cursor/mcp.json</code> dosyanıza ekleyin:
                  </>
                ) : (
                  <>
                    Add to your <code>.cursor/mcp.json</code> file:
                  </>
                )}
              </span>
              <Button
                size="sm"
                onClick={() => copyText("cursor", cursorConfig)}
              >
                {copiedKey === "cursor" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {isTr ? "mcp_config.json Kopyala" : "Copy mcp_config.json"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-[#070a10] p-3 font-mono text-xs text-emerald-300">
              {cursorConfig}
            </pre>
          </TabsContent>

          <TabsContent value="claude" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isTr ? (
                  <>
                    <code>claude_desktop_config.json</code> içine yapıştırın:
                  </>
                ) : (
                  <>
                    Paste into <code>claude_desktop_config.json</code>:
                  </>
                )}
              </span>
              <Button
                size="sm"
                onClick={() => copyText("claude", claudeDesktopConfig)}
              >
                {copiedKey === "claude" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {isTr ? "Claude Config Kopyala" : "Copy Claude Config"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-[#070a10] p-3 font-mono text-xs text-emerald-300">
              {claudeDesktopConfig}
            </pre>
          </TabsContent>

          <TabsContent value="sse" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isTr
                  ? "Klasik SSE destekli MCP istemcileri için:"
                  : "For legacy SSE-compatible MCP clients:"}
              </span>
              <Button
                size="sm"
                onClick={() => copyText("sse", legacySseConfig)}
              >
                {copiedKey === "sse" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {isTr ? "SSE Config Kopyala" : "Copy SSE Config"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-[#070a10] p-3 font-mono text-xs text-emerald-300">
              {legacySseConfig}
            </pre>
          </TabsContent>
        </Tabs>

        {/* Starter AI Prompt */}
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Terminal className="h-4 w-4" />
              {isTr
                ? "AI İstemcinize Göndereceğiniz Tur Komutu"
                : "Starter Game Master Prompt for Your AI Client"}
              <Badge variant="outline">Game Master</Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText("prompt", gmStarterCommand)}
            >
              {copiedKey === "prompt" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isTr ? "Komutu Kopyala" : "Copy Command"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {gmStarterCommand}
          </p>
        </div>
      </ModalContent>
    </Modal>
  );
}
