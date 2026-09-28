/**
 * Ticket POP-CHARTS — seed sparse-but-real PlayLog rows for local smoke charts.
 * Idempotent via clientEventId prefix pop-charts-demo-*
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const PREFIX = "pop-charts-demo-";

async function main() {
  const devices = await prisma.device.findMany({
    include: {
      screen: { include: { host: true } },
    },
  });
  if (devices.length === 0) {
    console.log("No devices — skip PlayLog seed");
    return;
  }

  const creatives = await prisma.creative.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true, advertiserId: true },
  });
  if (creatives.length === 0) {
    console.log("No approved creatives — skip");
    return;
  }

  // Clear prior demo seed for this ticket
  const deleted = await prisma.playLog.deleteMany({
    where: { clientEventId: { startsWith: PREFIX } },
  });
  console.log(`Cleared ${deleted.count} prior demo PlayLog rows`);

  const now = Date.now();
  const rows: Array<{
    deviceId: string;
    screenId: string;
    creativeId: string;
    startedAt: Date;
    endedAt: Date;
    durationMs: number;
    clientEventId: string;
  }> = [];

  // ~14 days of plays, denser in business hours, varied creatives
  for (let dayAgo = 13; dayAgo >= 0; dayAgo--) {
    const playsToday = 8 + ((13 - dayAgo) % 5) * 3; // 8..20
    for (let i = 0; i < playsToday; i++) {
      const device = devices[i % devices.length];
      const creative = creatives[(dayAgo * 3 + i) % creatives.length];
      // Prefer 9–21 local-ish by using UTC afternoon hours
      const hour = 9 + (i % 12);
      const minute = (i * 7) % 60;
      const startedAt = new Date(now - dayAgo * 86400000);
      startedAt.setUTCHours(hour + 6, minute, (i * 13) % 60, 0); // MT-ish offset
      // Clamp into last 14d window
      if (startedAt.getTime() > now) continue;
      if (startedAt.getTime() < now - 14 * 86400000) continue;
      const durationMs = 10000 + (i % 5) * 2000;
      const endedAt = new Date(startedAt.getTime() + durationMs);
      rows.push({
        deviceId: device.id,
        screenId: device.screenId,
        creativeId: creative.id,
        startedAt,
        endedAt,
        durationMs,
        clientEventId: `${PREFIX}${dayAgo}-${i}-${randomUUID().slice(0, 8)}`,
      });
    }
  }

  // Extra last-24h density for hour toggle
  for (let h = 0; h < 24; h++) {
    const n = h >= 10 && h <= 20 ? 4 : 1;
    for (let j = 0; j < n; j++) {
      const device = devices[j % devices.length];
      const creative = creatives[(h + j) % creatives.length];
      const startedAt = new Date(now - (23 - h) * 3600000 - j * 600000);
      const durationMs = 12000;
      rows.push({
        deviceId: device.id,
        screenId: device.screenId,
        creativeId: creative.id,
        startedAt,
        endedAt: new Date(startedAt.getTime() + durationMs),
        durationMs,
        clientEventId: `${PREFIX}24h-${h}-${j}-${randomUUID().slice(0, 8)}`,
      });
    }
  }

  const chunk = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const res = await prisma.playLog.createMany({ data: slice });
    inserted += res.count;
  }
  console.log(
    `Seeded ${inserted} PlayLog rows across ${devices.length} device(s), ${creatives.length} creative(s)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
