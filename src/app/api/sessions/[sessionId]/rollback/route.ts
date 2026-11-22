import { NextRequest } from "next/server";
import { z } from "zod";
import { rollbackSessionToTurn } from "@/lib/game-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RollbackSchema = z.object({
  targetTurnNumber: z.number().int().min(1),
});

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

  const parsed = RollbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz tur numarası", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const session = await rollbackSessionToTurn(
      sessionId,
      parsed.data.targetTurnNumber
    );
    return Response.json({ session });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Geri alma başarısız" },
      { status: 400 }
    );
  }
}
