import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  JSONRPCMessageSchema,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Web Standard legacy SSE transport (for MCP clients using classic GET /sse + POST /messages)
 */
export class WebSseServerTransport implements Transport {
  readonly sessionId: string;
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: unknown) => void;

  constructor(
    private readonly postEndpointUrl: string,
    sessionId?: string
  ) {
    this.sessionId = sessionId ?? randomUUID();
  }

  createSseStream(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
        const endpointPayload = `event: endpoint\ndata: ${this.postEndpointUrl}?transportSessionId=${this.sessionId}\n\n`;
        controller.enqueue(this.encoder.encode(endpointPayload));
        this.keepAliveTimer = setInterval(() => {
          if (this.closed || !this.controller) return;
          try {
            this.controller.enqueue(this.encoder.encode(": keepalive\n\n"));
          } catch {
            void this.close();
          }
        }, 15_000);
      },
      cancel: () => {
        void this.close();
      },
    });
  }

  async start(): Promise<void> {
    // Stream starts immediately upon createSseStream attachment
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed || !this.controller) {
      throw new Error("SSE transport is not connected");
    }
    const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }

  async handlePostMessage(rawBody: unknown, headers: Record<string, string>) {
    let parsed: JSONRPCMessage;
    try {
      parsed = JSONRPCMessageSchema.parse(rawBody);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.onerror?.(error);
      throw error;
    }

    this.onmessage?.(parsed, {
      requestInfo: { headers },
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    try {
      this.controller?.close();
    } catch {
      // Ignore already closed stream
    }
    this.controller = null;
    this.onclose?.();
  }
}

export interface StreamableTransportEntry {
  gameSessionId: string;
  mcpSessionId: string;
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}

export interface LegacySseEntry {
  gameSessionId: string;
  transportSessionId: string;
  transport: WebSseServerTransport;
  server: McpServer;
}

interface McpTransportRegistry {
  streamable: Map<string, StreamableTransportEntry>;
  legacySse: Map<string, LegacySseEntry>;
}

const globalForMcpRegistry = globalThis as unknown as {
  __paxMcpRegistry?: McpTransportRegistry;
};

export function getMcpTransportRegistry(): McpTransportRegistry {
  if (!globalForMcpRegistry.__paxMcpRegistry) {
    globalForMcpRegistry.__paxMcpRegistry = {
      streamable: new Map(),
      legacySse: new Map(),
    };
  }
  return globalForMcpRegistry.__paxMcpRegistry;
}
