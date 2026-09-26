import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { takeDownAdvertiser } from "@/lib/take-down";

type Ctx = { params: { id: string } };

/** Ticket S — take down / clear all creatives for one advertiser. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    reason?: string | null;
    undo?: boolean;
  };

  const result = await takeDownAdvertiser({
    advertiserId: params.id,
    adminId: auth.user.id,
    reason: body.reason,
    undo: !!body.undo,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
