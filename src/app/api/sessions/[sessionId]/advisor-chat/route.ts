import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPlayerAdvisorChat } from "@/lib/game-engine";
import { safeJsonParse } from "@/lib/utils";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import type { AdvisorSuggestedOrder } from "@/lib/client-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AdvisorPostSchema = z.object({
  content: z.string().min(1).max(4000),
  locale: z.enum(["tr", "en"]).optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const rows = await prisma.advisorChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    messages: rows.map((m) => ({
      ...m,
      suggestedOrders: m.suggestedOrdersJson
        ? safeJsonParse<AdvisorSuggestedOrder[]>(m.suggestedOrdersJson, [])
        : [],
    })),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = AdvisorPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Danışman mesajı geçersiz", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    resolveAndSyncRequestLocale(req, sessionId, parsed.data.locale);
    const message = await sendPlayerAdvisorChat({
      sessionId,
      content: parsed.data.content,
    });
    return Response.json({ message }, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Danışman mesajı gönderilemedi",
      },
      { status: 400 }
    );
  }
}
