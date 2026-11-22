import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/lib/prisma";
import { createGameMasterMcpServer } from "@/lib/mcp-server";
import { getMcpTransportRegistry } from "@/lib/mcp-transport-store";
import {
  registerMcpConnection,
  touchMcpConnection,
  unregisterMcpConnection,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function isInitializePayload(body: unknown): {
  isInit: boolean;
  clientName?: string;
} {
  const list = Array.isArray(body) ? body : [body];
  for (const item of list) {
    if (
      item &&
      typeof item === "object" &&
      "method" in item &&
      (item as { method?: unknown }).method === "initialize"
    ) {
      const params = (item as { params?: { clientInfo?: { name?: string } } })
        .params;
      return {
        isInit: true,
        clientName: params?.clientInfo?.name || "MCP Streamable Client",
      };
    }
  }
  return { isInit: false };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const isLobby = sessionId === "lobby";
  if (!isLobby) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      return withCors(
        Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32001, message: `Game session not found: ${sessionId}` },
            id: null,
          },
          { status: 404 }
        )
      );
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: Invalid JSON body" },
          id: null,
        },
        { status: 400 }
      )
    );
  }

  const registry = getMcpTransportRegistry();
  const mcpSessionId = req.headers.get("mcp-session-id");

  if (mcpSessionId) {
    const existing = registry.streamable.get(mcpSessionId);
    if (!existing || existing.gameSessionId !== sessionId) {
      return withCors(
        Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32001, message: "MCP session not found or expired" },
            id: null,
          },
          { status: 404 }
        )
      );
    }
    touchMcpConnection(sessionId, mcpSessionId);
    if (!isLobby) {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { lastMcpActivityAt: new Date() },
      });
    }
    const res = await existing.transport.handleRequest(req, { parsedBody });
    return withCors(res);
  }

  const initInfo = isInitializePayload(parsedBody);

  if (initInfo.isInit) {
    const server = createGameMasterMcpServer(sessionId);
    const clientName = initInfo.clientName || "MCP Client";
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: async (newMcpSessionId) => {
        registry.streamable.set(newMcpSessionId, {
          gameSessionId: sessionId,
          mcpSessionId: newMcpSessionId,
          transport,
          server,
        });
        registerMcpConnection(sessionId, newMcpSessionId, {
          clientName,
          transport: "streamable-http",
          persistentStream: false,
        });
        if (!isLobby) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              lastMcpClientName: clientName,
              lastMcpActivityAt: new Date(),
            },
          });
        }
      },
      onsessionclosed: async (closedMcpSessionId) => {
        registry.streamable.delete(closedMcpSessionId);
        unregisterMcpConnection(sessionId, closedMcpSessionId);
      },
    });

    await server.connect(transport);
    const res = await transport.handleRequest(req, { parsedBody });
    return withCors(res);
  }

  // Stateless fallback when client sends direct JSON-RPC POST without initialization header
  const statelessTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createGameMasterMcpServer(sessionId);
  await server.connect(statelessTransport);

  touchMcpConnection(sessionId, "stateless-http", "Stateless MCP Client");
  if (!isLobby) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { lastMcpActivityAt: new Date() },
    });
  }

  try {
    const res = await statelessTransport.handleRequest(req, { parsedBody });
    return withCors(res);
  } finally {
    await statelessTransport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const mcpSessionId = req.headers.get("mcp-session-id");

  if (!mcpSessionId) {
    return withCors(
      Response.json(
        {
          service: "Mur4History MCP Server",
          gameSessionId: sessionId,
          transports: {
            streamableHttp: `/api/mcp/${sessionId}`,
            legacySse: `/api/mcp/${sessionId}/sse`,
          },
          hint: "Send Streamable HTTP POST requests here or connect legacy SSE clients to /sse.",
        },
        { status: 200 }
      )
    );
  }

  const registry = getMcpTransportRegistry();
  const existing = registry.streamable.get(mcpSessionId);
  if (!existing || existing.gameSessionId !== sessionId) {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "MCP session not found" },
          id: null,
        },
        { status: 404 }
      )
    );
  }

  registerMcpConnection(sessionId, mcpSessionId, {
    clientName: "",
    transport: "streamable-http",
    persistentStream: true,
  });

  req.signal.addEventListener(
    "abort",
    () => {
      unregisterMcpConnection(sessionId, mcpSessionId);
    },
    { once: true }
  );

  const res = await existing.transport.handleRequest(req);
  return withCors(res);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const mcpSessionId = req.headers.get("mcp-session-id");
  if (!mcpSessionId) {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Missing mcp-session-id header" },
          id: null,
        },
        { status: 400 }
      )
    );
  }

  const registry = getMcpTransportRegistry();
  const existing = registry.streamable.get(mcpSessionId);
  if (!existing || existing.gameSessionId !== sessionId) {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "MCP session not found" },
          id: null,
        },
        { status: 404 }
      )
    );
  }

  const res = await existing.transport.handleRequest(req);
  registry.streamable.delete(mcpSessionId);
  unregisterMcpConnection(sessionId, mcpSessionId);
  await existing.server.close().catch(() => undefined);
  return withCors(res);
}
