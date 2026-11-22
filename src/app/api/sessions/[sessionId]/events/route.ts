import { NextRequest } from "next/server";
import {
  getMcpConnectionStatus,
  markBrowserSessionActive,
  subscribeSessionEvents,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const releaseBrowser = () => {
    if (closed) return;
    closed = true;
    markBrowserSessionActive(sessionId, -1);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      markBrowserSessionActive(sessionId, 1);

      const sendSse = (eventName: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          // Stream closed
        }
      };

      sendSse("mcp_status", {
        type: "mcp_status",
        sessionId,
        timestamp: new Date().toISOString(),
        payload: getMcpConnectionStatus(sessionId),
      });

      unsubscribe = subscribeSessionEvents(sessionId, (event) => {
        sendSse(event.type, event);
      });

      keepAliveTimer = setInterval(() => {
        try {
          markBrowserSessionActive(sessionId, 0);
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
        }
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        unsubscribe?.();
        releaseBrowser();
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      unsubscribe?.();
      releaseBrowser();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
