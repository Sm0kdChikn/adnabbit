import { handlePlaysExportXlsxGet } from "@/lib/analytics-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handlePlaysExportXlsxGet(req, ["ADMIN"]);
}
