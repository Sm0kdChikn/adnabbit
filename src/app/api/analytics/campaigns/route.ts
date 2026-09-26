import { handleCampaignsGet } from "@/lib/analytics-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleCampaignsGet(req, ["ADVERTISER"]);
}
