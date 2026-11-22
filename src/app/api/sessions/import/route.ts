import { NextRequest } from "next/server";
import { SaveArchiveSchema } from "@/lib/save-schema";
import { importSessionArchive } from "@/lib/session-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json(
      { error: "Dosya geçerli bir JSON formatında değil." },
      { status: 400 }
    );
  }

  let archiveCandidate: unknown = rawBody;
  let customName: string | undefined;

  if (
    rawBody &&
    typeof rawBody === "object" &&
    "archive" in rawBody &&
    (rawBody as Record<string, unknown>).archive !== undefined
  ) {
    const wrapped = rawBody as { archive: unknown; customName?: unknown };
    archiveCandidate = wrapped.archive;
    if (typeof wrapped.customName === "string" && wrapped.customName.trim()) {
      customName = wrapped.customName.trim();
    }
  } else if (
    rawBody &&
    typeof rawBody === "object" &&
    "customName" in rawBody &&
    typeof (rawBody as Record<string, unknown>).customName === "string"
  ) {
    customName = (rawBody as { customName: string }).customName.trim();
  }

  const parsed = SaveArchiveSchema.safeParse(archiveCandidate);
  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Bu dosya geçerli bir Mur4History ilerleme kaydı (.mur4history.json) değil.",
        issues: parsed.error.issues.slice(0, 5),
      },
      { status: 400 }
    );
  }

  try {
    const session = await importSessionArchive(parsed.data, customName);
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "İlerleme kaydı içe aktarılamadı",
      },
      { status: 500 }
    );
  }
}
