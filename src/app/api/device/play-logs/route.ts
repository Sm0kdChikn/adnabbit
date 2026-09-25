import { NextResponse } from "next/server";
import { requireDeviceAuth } from "@/lib/device";

/**
 * Ticket J stub — accept play-log batches, return 202, persist nothing.
 * F2 will store proof-of-play from the software player.
 */
export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = Array.isArray(body) ? body : [];
  console.log(
    `[play-logs stub] device=${auth.device.id} screen=${auth.device.screenId} count=${events.length}`
  );

  return NextResponse.json(
    { accepted: events.length, persisted: false },
    { status: 202 }
  );
}
