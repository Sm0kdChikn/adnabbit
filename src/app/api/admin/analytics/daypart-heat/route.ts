import { handleDaypartHeatGet } from "@/lib/analytics-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleDaypartHeatGet(req, ["ADMIN"]);
}
