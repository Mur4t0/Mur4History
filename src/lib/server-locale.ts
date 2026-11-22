import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import {
  type AppLocale,
  LOCALE_COOKIE_NAME,
  resolvePreferredLocale,
} from "@/lib/i18n";
import { getActiveMcpLocale, setActiveMcpLocale } from "@/lib/realtime";

/**
 * Determine initial SSR locale from user cookie (if explicitly toggled)
 * or HTTP `Accept-Language` header (`tr*` -> `tr`, anything else -> `en`).
 */
export async function detectServerLocale(): Promise<AppLocale> {
  try {
    const cookieStore = await cookies();
    const saved = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    if (saved === "tr" || saved === "en") {
      return saved;
    }

    const headerStore = await headers();
    const acceptLang = headerStore.get("accept-language");
    return resolvePreferredLocale(acceptLang);
  } catch {
    return "en";
  }
}

/**
 * Sync and resolve the effective MCP locale from an incoming API request
 * (explicit body `locale` > locale cookie > current active session/global MCP locale).
 */
export function resolveAndSyncRequestLocale(
  req: NextRequest,
  sessionId?: string,
  explicitLocale?: AppLocale
): AppLocale {
  if (explicitLocale === "tr" || explicitLocale === "en") {
    setActiveMcpLocale(explicitLocale, { sessionId, broadcast: true });
    return explicitLocale;
  }
  const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale === "tr" || cookieLocale === "en") {
    setActiveMcpLocale(cookieLocale, { sessionId, broadcast: false });
    return cookieLocale;
  }
  return getActiveMcpLocale(sessionId);
}
