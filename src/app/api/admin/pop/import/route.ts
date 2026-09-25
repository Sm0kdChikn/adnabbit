import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  matchCreativeId,
  parseCsv,
  parseOptiSignsRow,
  validateOptiSignsHeaders,
  type ParsedPlayRow,
} from "@/lib/pop";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const notesRaw = form.get("notes");
    const notes = notesRaw ? String(notesRaw).trim() || null : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }
    const filename = file.name || "upload.csv";
    if (!filename.toLowerCase().endsWith(".csv") && file.type && !file.type.includes("csv") && file.type !== "text/plain" && file.type !== "application/vnd.ms-excel") {
      // soft check — still allow if content looks like CSV
    }

    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) {
      return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
    }

    const headerError = validateOptiSignsHeaders(headers);
    if (headerError) {
      return NextResponse.json({ error: headerError }, { status: 400 });
    }

    const creatives = await prisma.creative.findMany({
      select: { id: true, name: true, status: true, advertiserId: true },
    });

    const parsed: ParsedPlayRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        parsed.push(parseOptiSignsRow(headers, rows[i], i + 2));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid row";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const hashes = parsed.map((p) => p.rawHash);
    const existing = await prisma.playEvent.findMany({
      where: { rawHash: { in: hashes } },
      select: { rawHash: true },
    });
    const existingSet = new Set(existing.map((e) => e.rawHash));

    const toInsert = parsed.filter((p) => !existingSet.has(p.rawHash));
    // Deduplicate within the same file by rawHash
    const seenInFile = new Set<string>();
    const uniqueInsert: ParsedPlayRow[] = [];
    let intraFileDupes = 0;
    for (const p of toInsert) {
      if (seenInFile.has(p.rawHash)) {
        intraFileDupes += 1;
        continue;
      }
      seenInFile.add(p.rawHash);
      uniqueInsert.push(p);
    }

    const skippedDupes = parsed.length - uniqueInsert.length;

    const result = await prisma.$transaction(async (tx) => {
      const imp = await tx.playImport.create({
        data: {
          uploadedById: auth.user!.id,
          filename,
          rowCount: parsed.length,
          insertedCount: uniqueInsert.length,
          skippedDupes,
          notes,
        },
      });

      if (uniqueInsert.length > 0) {
        await tx.playEvent.createMany({
          data: uniqueInsert.map((p) => ({
            importId: imp.id,
            reportDateUtc: p.reportDateUtc,
            accountId: p.accountId,
            screenUuid: p.screenUuid,
            screenName: p.screenName,
            screenTags: p.screenTags,
            assetId: p.assetId,
            assetName: p.assetName,
            assetTags: p.assetTags,
            startTimeUtc: p.startTimeUtc,
            deviceLocalTime: p.deviceLocalTime,
            deviceTimezone: p.deviceTimezone,
            durationSec: p.durationSec,
            creativeId: matchCreativeId(p.assetName, creatives),
            isHostFiller: p.isHostFiller,
            rawHash: p.rawHash,
          })),
        });
      }

      return imp;
    });

    return NextResponse.json({
      import: {
        id: result.id,
        filename: result.filename,
        rowCount: result.rowCount,
        insertedCount: result.insertedCount,
        skippedDupes: result.skippedDupes,
        importedAt: result.importedAt,
        notes: result.notes,
        intraFileDupes,
      },
    });
  } catch (e) {
    console.error("PoP import error", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
