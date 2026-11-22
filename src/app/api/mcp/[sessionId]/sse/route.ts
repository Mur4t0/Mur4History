import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createGameMasterMcpServer } from "@/lib/mcp-server";
import {
  getMcpTransportRegistry,
  WebSseServerTransport,
} from "@/lib/mcp-transport-store";
import {
  registerMcpConnection,
  unregisterMcpConnection,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
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
      return Response.json(
        { error: `Game session not found: ${sessionId}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }
  }

  const transport = new WebSseServerTransport(`/api/mcp/${sessionId}/messages`);
  const server = createGameMasterMcpServer(sessionId);
  const registry = getMcpTransportRegistry();

  registry.legacySse.set(transport.sessionId, {
    gameSessionId: sessionId,
    transportSessionId: transport.sessionId,
    transport,
    server,
  });

  const clientLabel = req.headers.get("user-agent")?.includes("node")
    ? "MCP SSE Bridge"
    : "MCP SSE Client";

  registerMcpConnection(sessionId, transport.sessionId, {
    clientName: clientLabel,
    transport: "sse",
    persistentStream: true,
  });

  if (!isLobby) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        lastMcpClientName: clientLabel,
        lastMcpActivityAt: new Date(),
      },
    });
  }

  transport.onclose = () => {
    registry.legacySse.delete(transport.sessionId);
    unregisterMcpConnection(sessionId, transport.sessionId);
    void server.close().catch(() => undefined);
  };

  req.signal.addEventListener("abort", () => {
    void transport.close();
  });

  const stream = transport.createSseStream();
  await server.connect(transport);

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
