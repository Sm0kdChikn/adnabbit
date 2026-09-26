import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { takeDownScreenPlayback } from "@/lib/take-down";

type Ctx = { params: { id: string } };

/** Ticket S — soft-kill paid playlist for one screen. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    reason?: string | null;
    undo?: boolean;
  };

  const result = await takeDownScreenPlayback({
    screenId: params.id,
    adminId: auth.user.id,
    reason: body.reason,
    undo: !!body.undo,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
