import { prisma } from "@/lib/prisma";
import { listLobbyScenarios } from "@/lib/lobby-queries";
import { PRESET_SCENARIOS } from "@/lib/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function ensurePresetScenariosInDb() {
  for (const preset of PRESET_SCENARIOS) {
    await prisma.scenario.upsert({
      where: { id: preset.id },
      update: {
        title: preset.title,
        era: preset.era,
        startDate: preset.startDate,
        turnIntervalMonths: preset.turnIntervalMonths,
        description: preset.description,
        isPreset: true,
        configJson: JSON.stringify(preset),
      },
      create: {
        id: preset.id,
        slug: preset.slug,
        title: preset.title,
        era: preset.era,
        startDate: preset.startDate,
        turnIntervalMonths: preset.turnIntervalMonths,
        description: preset.description,
        isPreset: true,
        configJson: JSON.stringify(preset),
      },
    });
  }
}

export async function GET() {
  await ensurePresetScenariosInDb();
  const scenarios = await listLobbyScenarios();

  return Response.json({ scenarios });
}
