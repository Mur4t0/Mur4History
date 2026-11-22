import { NextRequest } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { getActiveMcpLocale, setActiveMcpLocale } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LocaleBodySchema = z.object({
  locale: z.enum(["tr", "en"]),
  sessionId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || undefined;
  return Response.json({ locale: getActiveMcpLocale(sessionId) });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LocaleBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid locale", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { locale, sessionId } = parsed.data;
  setActiveMcpLocale(locale, { sessionId, broadcast: true });

  const res = Response.json({
    ok: true,
    locale: getActiveMcpLocale(sessionId),
  });
  res.headers.append(
    "Set-Cookie",
    `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
  );
  return res;
}
