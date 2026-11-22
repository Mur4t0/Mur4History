import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createPlayerCouncil,
  postPlayerCouncilMessage,
} from "@/lib/game-engine";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateCouncilSchema = z.object({
  mode: z.literal("create"),
  title: z.string().min(2).max(140),
  topic: z.string().min(2).max(600),
  councilType: z
    .enum(["COUNCIL", "COALITION", "SUMMIT", "PROTEST"])
    .default("SUMMIT"),
  participantCountryCodes: z.array(z.string()).min(1),
  openingMessage: z.string().min(1).max(4000),
  locale: z.enum(["tr", "en"]).optional(),
});

const PostMessageSchema = z.object({
  mode: z.literal("message"),
  councilId: z.string().min(1),
  content: z.string().min(1).max(4000),
  locale: z.enum(["tr", "en"]).optional(),
});

const CouncilActionSchema = z.discriminatedUnion("mode", [
  CreateCouncilSchema,
  PostMessageSchema,
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const councils = await prisma.diplomacyCouncil.findMany({
    where: { sessionId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return Response.json({
    councils: councils.map((c) => ({
      ...c,
      participantCodes: safeJsonParse<string[]>(c.participantCodes, []),
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
    return Response.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = CouncilActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Konsey verisi geçersiz", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    resolveAndSyncRequestLocale(req, sessionId, parsed.data.locale);
    if (parsed.data.mode === "create") {
      const council = await createPlayerCouncil({
        sessionId,
        title: parsed.data.title,
        topic: parsed.data.topic,
        councilType: parsed.data.councilType,
        participantCountryCodes: parsed.data.participantCountryCodes,
        openingMessage: parsed.data.openingMessage,
      });
      return Response.json({ council }, { status: 201 });
    } else {
      const message = await postPlayerCouncilMessage({
        sessionId,
        councilId: parsed.data.councilId,
        content: parsed.data.content,
      });
      return Response.json({ message }, { status: 201 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Konsey işlemi başarısız" },
      { status: 400 }
    );
  }
}
