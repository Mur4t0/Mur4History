import { ensurePresetScenariosInDb } from "@/app/api/scenarios/route";
import { LobbyClient } from "@/components/lobby/LobbyClient";
import {
  listLobbyScenarios,
  listLobbySessionsRaw,
} from "@/lib/lobby-queries";
import { getCommunityProfileData } from "@/lib/community";
import {
  getGlobalMcpStatus,
  setActiveMcpLocale,
} from "@/lib/realtime";
import { detectServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [, params, serverLocale, community] = await Promise.all([
    ensurePresetScenariosInDb(),
    searchParams,
    detectServerLocale(),
    getCommunityProfileData(),
  ]);
  setActiveMcpLocale(serverLocale, { broadcast: false });

  const [scenarios, sessions] = await Promise.all([
    listLobbyScenarios(),
    listLobbySessionsRaw(),
  ]);

  return (
    <LobbyClient
      initialScenarios={scenarios}
      initialSessions={sessions}
      initialTab={params?.tab}
      initialMcpStatus={getGlobalMcpStatus()}
      initialCommunity={community}
      projectRoot={process.cwd()}
    />
  );
}
