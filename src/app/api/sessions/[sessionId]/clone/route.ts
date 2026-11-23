import { NextRequest } from "next/server";
import { z } from "zod";
import { cloneSessionArchive } from "@/lib/session-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CloneSessionSchema = z.object({
  name: z.string().max(120).optional(),
  locale: z.enum(["tr", "en"]).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    rawBody = "";
  }

  let parsedInput: unknown = {};
  if (rawBody.trim().length > 0) {
    try {
      parsedInput = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
  }

  const parsed = CloneSessionSchema.safeParse(parsedInput);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz klonlama verisi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const session = await cloneSessionArchive(sessionId, parsed.data);
    if (!session) {
      return Response.json(
        { error: "Klonlanan oturum yüklenemedi" },
        { status: 500 }
      );
    }
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Oturum klonlanamadı";
    const status = message.toLowerCase().includes("bulunamad") ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
