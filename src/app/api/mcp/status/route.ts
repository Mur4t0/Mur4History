import path from "node:path";
import { getGlobalMcpStatus } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projectRoot = process.cwd();
  const stdioScriptPath = path.join(projectRoot, "scripts", "mcp-stdio.mjs");
  return Response.json({
    ...getGlobalMcpStatus(),
    projectRoot,
    stdioScriptPath,
  });
}
