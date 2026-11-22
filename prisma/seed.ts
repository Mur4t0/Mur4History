import { prisma } from "../src/lib/prisma";
import { PRESET_SCENARIOS } from "../src/lib/scenarios";
import { createSessionFromScenario } from "../src/lib/game-engine";

async function main() {
  console.log("Mur4History senaryo verileri veritabanına yükleniyor...");

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

  const existingCount = await prisma.gameSession.count();
  if (existingCount === 0) {
    const demo = await createSessionFromScenario(
      "1936",
      "1936 — Örnek Kampanya (Türkiye)",
      "TUR"
    );
    console.log(`Örnek oyun oturumu oluşturuldu: ${demo?.id}`);
  }

  console.log("Seed işlemi başarıyla tamamlandı.");
}

main()
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
