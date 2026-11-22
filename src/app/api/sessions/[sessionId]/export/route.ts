import { NextRequest } from "next/server";
import { exportSessionArchive } from "@/lib/session-archive";
import { buildSaveFilename } from "@/lib/save-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const asDownload = req.nextUrl.searchParams.get("download") === "1";

  try {
    const archive = await exportSessionArchive(sessionId);
    const json = JSON.stringify(archive, null, 2);
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    };
    if (asDownload) {
      headers["Content-Disposition"] =
        `attachment; filename="${buildSaveFilename(archive)}"`;
    }
    return new Response(json, { status: 200, headers });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Oturum dışa aktarılamadı",
      },
      { status: 404 }
    );
  }
}
