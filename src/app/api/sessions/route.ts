import { NextRequest } from "next/server";
import { z } from "zod";
import { createSessionFromScenario } from "@/lib/game-engine";
import { ensurePresetScenariosInDb } from "@/app/api/scenarios/route";
import { listLobbySessionsRaw } from "@/lib/lobby-queries";
import {
  getBrowserSessionActivity,
  getMcpConnectionStatus,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSessionSchema = z.object({
  scenarioId: z.string().min(1),
  name: z.string().optional(),
  playerCountryCode: z.string().optional(),
  difficulty: z
    .enum(["VERY_EASY", "EASY", "NORMAL", "HARD", "IMPOSSIBLE"])
    .default("NORMAL"),
  timeJumpInterval: z
    .enum(["1W", "1M", "3M", "6M", "1Y", "SCENARIO_DEFAULT"])
    .default("SCENARIO_DEFAULT"),
});

export async function GET() {
  const sessions = await listLobbySessionsRaw();

  return Response.json({
    sessions: sessions.map((s) => {
      const browser = getBrowserSessionActivity(s.id);
      return {
        ...s,
        mcpStatus: getMcpConnectionStatus(s.id),
        browserActive: browser.subscriberCount > 0,
        lastBrowserSeenAt: browser.lastSeenAt,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  await ensurePresetScenariosInDb();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Oturum oluşturma verisi geçersiz", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const session = await createSessionFromScenario(
      parsed.data.scenarioId,
      parsed.data.name,
      parsed.data.playerCountryCode,
      parsed.data.difficulty,
      parsed.data.timeJumpInterval
    );
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Oturum oluşturulamadı" },
      { status: 400 }
    );
  }
}
