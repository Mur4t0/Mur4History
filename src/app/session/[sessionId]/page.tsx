import { notFound } from "next/navigation";
import { getFullSessionState } from "@/lib/game-engine";
import { GameWorkspace } from "@/components/game/GameWorkspace";
import type { SessionState } from "@/lib/client-types";
import {
  getGlobalMcpStatus,
  setActiveMcpLocale,
} from "@/lib/realtime";
import { detectServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [{ sessionId }, serverLocale] = await Promise.all([
    params,
    detectServerLocale(),
  ]);
  setActiveMcpLocale(serverLocale, { sessionId, broadcast: false });
  const session = await getFullSessionState(sessionId);
  if (!session) {
    notFound();
  }

  const serialized: SessionState = {
    ...session,
    lastMcpActivityAt: session.lastMcpActivityAt
      ? session.lastMcpActivityAt.toISOString()
      : null,
    orders: session.orders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })),
    events: session.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    messages: session.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    leaderChats: session.leaderChats.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    councils: session.councils.map((cn) => ({
      ...cn,
      createdAt: cn.createdAt.toISOString(),
      updatedAt: cn.updatedAt.toISOString(),
      messages: cn.messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    })),
    mapMarkers: (session.mapMarkers ?? []).map((mk) => ({
      ...mk,
      createdAt: mk.createdAt.toISOString(),
      updatedAt: mk.updatedAt.toISOString(),
    })),
    advisorChats: (session.advisorChats ?? []).map((ac) => ({
      ...ac,
      createdAt: ac.createdAt.toISOString(),
    })),
    snapshots: session.snapshots.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return (
    <GameWorkspace
      initialSession={serialized}
      initialGlobalMcpStatus={getGlobalMcpStatus()}
      projectRoot={process.cwd()}
    />
  );
}
