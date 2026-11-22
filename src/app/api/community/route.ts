import { getCommunityProfileData } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const community = await getCommunityProfileData();
  return Response.json({ community });
}
