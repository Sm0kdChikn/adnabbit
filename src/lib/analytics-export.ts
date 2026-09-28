/**
 * Ticket POP-EXPORT — PlayLog-only PDF + XLSX builders.
 * Data must already be role-scoped via buildPlayLogWhere / resolvePlayLogScope.
 * Soft miss (intentionally skipped): fancy branding, multi-sheet, compare-to-prior.
 */
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type {
  AnalyticsRole,
  DateRange,
  PlayLogExportRow,
  PlaysResult,
} from "./analytics";

function fmtDurMs(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const r = sec % 60;
  if (min < 60) return r ? `${min}m ${r}s` : `${min}m`;
  const h = Math.floor(min / 60);
  const mr = min % 60;
  return mr ? `${h}h ${mr}m` : `${h}h`;
}

function roleLabel(role: AnalyticsRole): string {
  if (role === "ADMIN") return "Admin (all PlayLog)";
  if (role === "HOST") return "Host (own screens only)";
  return "Advertiser (own creatives only)";
}

export type PlaysExportMeta = {
  role: AnalyticsRole;
  range: DateRange;
  generatedAt?: Date;
};

const XLSX_HEADERS = [
  { header: "playedAt", key: "playedAt", width: 24 },
  { header: "creativeId", key: "creativeId", width: 26 },
  { header: "creativeName", key: "creativeName", width: 24 },
  { header: "scheduleId", key: "scheduleId", width: 26 },
  { header: "scheduleLabel", key: "scheduleLabel", width: 32 },
  { header: "screenId", key: "screenId", width: 26 },
  { header: "screenName", key: "screenName", width: 22 },
  { header: "hostId", key: "hostId", width: 26 },
  { header: "hostName", key: "hostName", width: 22 },
  { header: "durationMs", key: "durationMs", width: 12 },
] as const;

/**
 * Single-sheet Excel of raw PlayLog rows.
 * Empty range → headers only (no fabricated rows).
 */
export async function playLogRowsToXlsx(
  rows: PlayLogExportRow[],
  meta: PlaysExportMeta
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AdNabbit";
  wb.created = meta.generatedAt ?? new Date();

  const sheet = wb.addWorksheet("PlayLog");
  sheet.columns = XLSX_HEADERS.map((c) => ({ ...c }));

  for (const r of rows) {
    sheet.addRow({
      playedAt: r.playedAt,
      creativeId: r.creativeId,
      creativeName: r.creativeName,
      scheduleId: r.scheduleId,
      scheduleLabel: r.scheduleLabel,
      screenId: r.screenId,
      screenName: r.screenName,
      hostId: r.hostId,
      hostName: r.hostName,
      durationMs: r.durationMs,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Printable PDF summary from PlayLog aggregates (charts + summary).
 * Empty range → "No plays in this range".
 * Role-appropriate top list: advertiser → creatives; host → screens; admin → both.
 */
export async function playsSummaryToPdf(
  data: PlaysResult,
  meta: PlaysExportMeta
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 48,
      size: "LETTER",
      info: {
        Title: "AdNabbit Played — PlayLog report",
        Author: "AdNabbit",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Played — Proof of play", { align: "left" });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text("Source: first-party PlayLog only (not OptiSigns PlayEvent)");
    doc.text(`Scope: ${roleLabel(meta.role)}`);
    doc.text(
      `Date range: ${meta.range.fromYmd} → ${meta.range.toYmd} (${meta.range.preset})`
    );
    doc.text(`Timezone: ${data.charts.timezone}`);
    doc.moveDown(0.8);

    if (data.summary.playCount === 0) {
      doc
        .fontSize(12)
        .fillColor("#334155")
        .text("No plays in this range");
      doc
        .moveDown(0.4)
        .fontSize(9)
        .fillColor("#64748b")
        .text("Honest empty — no invented rows.");
      doc.end();
      return;
    }

    doc.fontSize(11).fillColor("#0f172a").text("Summary");
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor("#334155")
      .text(`Total plays: ${data.summary.playCount}`)
      .text(`Duration: ${fmtDurMs(data.summary.totalDurationMs)}`)
      .text(`Screens: ${data.summary.screenCount}`)
      .text(`Creatives: ${data.summary.creativeCount}`);
    doc.moveDown(0.8);

    // Plays by day (non-zero days only for compact print; still PlayLog numbers)
    const byDay = data.charts.byDay.filter((p) => p.playCount > 0);
    doc.fontSize(11).fillColor("#0f172a").text("Plays by day");
    doc.moveDown(0.35);
    if (byDay.length === 0) {
      doc.fontSize(9).fillColor("#64748b").text("No daily buckets with plays.");
    } else {
      doc.fontSize(8).fillColor("#64748b");
      const y0 = doc.y;
      doc.text("Day", 0, y0, { width: 90 });
      doc.text("Plays", 100, y0, { width: 60, align: "right" });
      doc.text("Duration", 180, y0, { width: 80, align: "right" });
      doc.moveDown(0.35);
      for (const p of byDay) {
        if (doc.y > doc.page.height - 56) doc.addPage();
        const y = doc.y;
        doc.fillColor("#0f172a");
        doc.text(p.key, 0, y, { width: 90 });
        doc.text(String(p.playCount), 100, y, { width: 60, align: "right" });
        doc.text(fmtDurMs(p.totalDurationMs), 180, y, {
          width: 80,
          align: "right",
        });
        doc.moveDown(0.22);
      }
    }
    doc.moveDown(0.8);

    const showCreatives =
      meta.role === "ADVERTISER" || meta.role === "ADMIN";
    const showScreens = meta.role === "HOST" || meta.role === "ADMIN";

    function drawTop(
      title: string,
      rows: { label: string; sublabel?: string; playCount: number; totalDurationMs: number }[]
    ) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.fontSize(11).fillColor("#0f172a").text(title);
      doc.moveDown(0.35);
      if (rows.length === 0) {
        doc.fontSize(9).fillColor("#64748b").text("None in range.");
        doc.moveDown(0.5);
        return;
      }
      for (const r of rows.slice(0, 10)) {
        if (doc.y > doc.page.height - 56) doc.addPage();
        const y = doc.y;
        doc.fontSize(9).fillColor("#0f172a");
        const label = r.sublabel ? `${r.label} (${r.sublabel})` : r.label;
        doc.text(label, 0, y, { width: 280 });
        doc.text(String(r.playCount), 290, y, { width: 50, align: "right" });
        doc.text(fmtDurMs(r.totalDurationMs), 350, y, {
          width: 80,
          align: "right",
        });
        doc.moveDown(0.28);
      }
      doc.moveDown(0.5);
    }

    if (showCreatives) {
      drawTop("Top creatives", data.charts.byCreative);
    }
    if (showScreens) {
      drawTop("Top screens", data.charts.byScreen);
    }

    doc.end();
  });
}
