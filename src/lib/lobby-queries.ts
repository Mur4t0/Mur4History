import { prisma } from "@/lib/prisma";

const PRESET_DISPLAY_ORDER: Record<string, number> = {
  "2026": 0,
  "1936": 1,
  "1962": 2,
  "1444": 3,
};

export async function listLobbyScenarios() {
  const raw = await prisma.scenario.findMany({
    where: { isPreset: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      era: true,
      startDate: true,
      turnIntervalMonths: true,
      description: true,
      isPreset: true,
    },
  });

  return [...raw].sort((a, b) => {
    const rankA = PRESET_DISPLAY_ORDER[a.id] ?? (a.isPreset ? 50 : 100);
    const rankB = PRESET_DISPLAY_ORDER[b.id] ?? (b.isPreset ? 50 : 100);
    return rankA - rankB;
  });
}

export async function listLobbySessionsRaw() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      scenario: {
        select: { id: true, slug: true, title: true, era: true },
      },
      _count: {
        select: {
          events: true,
          orders: true,
          mapMarkers: true,
          snapshots: true,
        },
      },
    },
  });

  const playerLookupPairs = sessions
    .filter((s) => Boolean(s.playerCountryCode))
    .map((s) => ({ sessionId: s.id, code: s.playerCountryCode! }));

  const playerCountries =
    playerLookupPairs.length > 0
      ? await prisma.country.findMany({
          where: { OR: playerLookupPairs },
          select: {
            sessionId: true,
            code: true,
            name: true,
            flagEmoji: true,
          },
        })
      : [];

  const countryBySessionId = new Map(
    playerCountries.map((c) => [c.sessionId, c])
  );

  return sessions.map((s) => {
    const pc = countryBySessionId.get(s.id) ?? null;
    return {
      ...s,
      playerCountry: pc
        ? { code: pc.code, name: pc.name, flagEmoji: pc.flagEmoji }
        : null,
      updatedAt: s.updatedAt.toISOString(),
    };
  });
}
