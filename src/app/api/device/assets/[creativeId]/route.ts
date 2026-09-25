import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireDeviceAuth } from "@/lib/device";
import { allowedCreativeIdsForScreen } from "@/lib/playlist";
import { absoluteUploadPath } from "@/lib/uploads";

type Ctx = { params: { creativeId: string } };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const creativeId = params.creativeId;
  if (!creativeId) {
    return NextResponse.json({ error: "Missing creativeId" }, { status: 400 });
  }

  const allowed = await allowedCreativeIdsForScreen(auth.device.screenId);
  if (!allowed.has(creativeId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creative = await prisma.creative.findUnique({
    where: { id: creativeId },
  });
  if (!creative) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = absoluteUploadPath(creative.storedName);
  try {
    const st = await stat(filePath);
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": creative.mimeType,
        "Content-Length": String(st.size),
        "Content-Disposition": `inline; filename="${creative.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }
}
