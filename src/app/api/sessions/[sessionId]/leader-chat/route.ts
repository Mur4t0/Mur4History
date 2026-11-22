import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPlayerLeaderChat } from "@/lib/game-engine";

import { resolveAndSyncRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SendChatSchema = z.object({
  targetCountryCode: z.string().min(2).max(16),
  content: z.string().min(1).max(4000),
  locale: z.enum(["tr", "en"]).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const countryCode = req.nextUrl.searchParams.get("countryCode");

  const messages = await prisma.leaderChatMessage.findMany({
    where: {
      sessionId,
      ...(countryCode ? { countryCode } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ messages });
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
    return Response.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = SendChatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Mesaj verisi geçersiz", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    resolveAndSyncRequestLocale(req, sessionId, parsed.data.locale);
    const message = await sendPlayerLeaderChat({
      sessionId,
      targetCountryCode: parsed.data.targetCountryCode,
      content: parsed.data.content,
    });
    return Response.json({ message }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Mesaj gönderilemedi" },
      { status: 400 }
    );
  }
}
