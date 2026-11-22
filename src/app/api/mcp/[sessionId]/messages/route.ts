import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMcpTransportRegistry } from "@/lib/mcp-transport-store";
import { touchMcpConnection } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const transportSessionId = req.nextUrl.searchParams.get("transportSessionId");
  if (!transportSessionId) {
    return Response.json(
      { error: "Missing transportSessionId query parameter" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const registry = getMcpTransportRegistry();
  const entry = registry.legacySse.get(transportSessionId);
  if (!entry || entry.gameSessionId !== sessionId) {
    return Response.json(
      { error: "SSE transport session not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const clientInfoName =
    rawBody &&
    typeof rawBody === "object" &&
    "method" in rawBody &&
    (rawBody as { method?: unknown }).method === "initialize"
      ? (rawBody as { params?: { clientInfo?: { name?: string } } }).params
          ?.clientInfo?.name
      : undefined;

  touchMcpConnection(sessionId, transportSessionId, clientInfoName);
  if (sessionId !== "lobby") {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        lastMcpActivityAt: new Date(),
        ...(clientInfoName ? { lastMcpClientName: clientInfoName } : {}),
      },
    });
  }

  try {
    await entry.transport.handlePostMessage(
      rawBody,
      Object.fromEntries(req.headers.entries())
    );
    return new Response("Accepted", { status: 202, headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid JSON-RPC message" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
