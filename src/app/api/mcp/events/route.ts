import { NextRequest } from "next/server";
import {
  getGlobalMcpStatus,
  subscribeGlobalMcpStatus,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: global_mcp_status\ndata: ${JSON.stringify(payload)}\n\n`
            )
          );
        } catch {
          // Stream closed
        }
      };

      send(getGlobalMcpStatus());
      const unsub = subscribeGlobalMcpStatus((status) => {
        send(status);
      });

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 20_000);

      req.signal.addEventListener("abort", () => {
        unsub();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
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
