import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@adnabbit.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "admin123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "ADMIN",
      name: "AdNabbit Admin",
    },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      name: "AdNabbit Admin",
    },
  });

  console.log(`Seeded ADMIN user: ${admin.email} (id=${admin.id})`);

  // Ticket A — sample hosts + screens (idempotent by name)
  const samples: Array<{
    name: string;
    vertical: string;
    otherLabel?: string;
    notes?: string;
    screens: Array<{
      name: string;
      city: string;
      zip: string;
      inventoryStatus: string;
      notes?: string;
    }>;
  }> = [
    {
      name: "Denver Peak Fitness",
      vertical: "GYM",
      notes: "Downtown flagship gym",
      screens: [
        { name: "Lobby TV", city: "Denver", zip: "80202", inventoryStatus: "OPEN" },
        {
          name: "Cardio wall",
          city: "Denver",
          zip: "80202",
          inventoryStatus: "LIMITED",
          notes: "2 of 4 slots open",
        },
      ],
    },
    {
      name: "Mile High Sports Bar",
      vertical: "SPORTS_BAR",
      screens: [
        {
          name: "Bar main screen",
          city: "Denver",
          zip: "80205",
          inventoryStatus: "FULL",
        },
        {
          name: "Patio screen",
          city: "Denver",
          zip: "80205",
          inventoryStatus: "OPEN",
        },
      ],
    },
    {
      name: "Cherry Creek Dental",
      vertical: "MEDICAL_DENTAL",
      screens: [
        {
          name: "Waiting room A",
          city: "Denver",
          zip: "80206",
          inventoryStatus: "OPEN",
        },
      ],
    },
    {
      name: "Front Range Co-Working",
      vertical: "OTHER",
      otherLabel: "Coworking",
      notes: "Demo OTHER vertical",
      screens: [
        {
          name: "Reception display",
          city: "Boulder",
          zip: "80301",
          inventoryStatus: "LIMITED",
        },
      ],
    },
  ];

  for (const s of samples) {
    let host = await prisma.host.findFirst({ where: { name: s.name } });
    if (!host) {
      host = await prisma.host.create({
        data: {
          name: s.name,
          vertical: s.vertical,
          otherLabel: s.otherLabel ?? null,
          timezone: "America/Denver",
          notes: s.notes ?? null,
        },
      });
      console.log(`Seeded host: ${host.name} (${host.vertical})`);
    } else {
      host = await prisma.host.update({
        where: { id: host.id },
        data: {
          vertical: s.vertical,
          otherLabel: s.otherLabel ?? null,
          timezone: "America/Denver",
          notes: s.notes ?? null,
        },
      });
      console.log(`Updated host: ${host.name}`);
    }

    for (const sc of s.screens) {
      const existing = await prisma.screen.findFirst({
        where: { hostId: host.id, name: sc.name },
      });
      if (!existing) {
        const screen = await prisma.screen.create({
          data: {
            name: sc.name,
            city: sc.city,
            zip: sc.zip,
            inventoryStatus: sc.inventoryStatus,
            notes: sc.notes ?? null,
            hostId: host.id,
          },
        });
        console.log(`  + screen: ${screen.name} (${screen.city} ${screen.zip})`);
      }
    }
  }


  // Ticket G — demo HOST user linked to Denver Peak Fitness
  const hostEmail = "demo.host@adnabbit.com";
  const hostPassword = "host123!";
  const hostHash = await bcrypt.hash(hostPassword, 12);
  const hostUser = await prisma.user.upsert({
    where: { email: hostEmail },
    update: {
      passwordHash: hostHash,
      role: "HOST",
      name: "Demo Host",
    },
    create: {
      email: hostEmail,
      passwordHash: hostHash,
      role: "HOST",
      name: "Demo Host",
    },
  });
  console.log(`Seeded demo HOST: ${hostUser.email} (password: host123!)`);

  const peak = await prisma.host.findFirst({ where: { name: "Denver Peak Fitness" } });
  if (peak) {
    // Detach if another host currently owns this userId
    await prisma.host.updateMany({
      where: { userId: hostUser.id, NOT: { id: peak.id } },
      data: { userId: null },
    });
    await prisma.host.update({
      where: { id: peak.id },
      data: { userId: hostUser.id },
    });
    console.log(`Linked HOST ${hostUser.email} → ${peak.name}`);
  } else {
    console.log("Denver Peak Fitness not found — skip HOST link");
  }

  // Ticket B — demo advertiser + published public profile
  const demoEmail = "demo.advertiser@adnabbit.com";
  const demoPassword = "demo123!";
  const demoHash = await bcrypt.hash(demoPassword, 12);
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      passwordHash: demoHash,
      role: "ADVERTISER",
      name: "Demo Advertiser",
    },
    create: {
      email: demoEmail,
      passwordHash: demoHash,
      role: "ADVERTISER",
      name: "Demo Advertiser",
    },
  });
  console.log(`Seeded demo advertiser: ${demoUser.email} (password: demo123!)`);

  const profileData = {
    slug: "front-range-hvac",
    displayName: "Front Range HVAC",
    pitch:
      "Local heating & cooling for Denver metro. Fast installs, honest quotes, 24/7 emergency service.",
    website: "https://example.com/front-range-hvac",
    contact: "hello@frontrangehvac.example",
    logoStoredName: null as string | null,
    logoUrl: null as string | null,
    category: "PROFESSIONAL",
    serviceAreaZips: "80202, 80205, 80206, 80012, 80301",
    published: true,
  };

  const existingProfile = await prisma.advertiserProfile.findUnique({
    where: { userId: demoUser.id },
  });
  if (existingProfile) {
    // Keep slug unique: if another user somehow owns front-range-hvac, update this row's fields only
    const slugOwner = await prisma.advertiserProfile.findUnique({
      where: { slug: profileData.slug },
    });
    const updateSlug =
      !slugOwner || slugOwner.userId === demoUser.id ? profileData.slug : existingProfile.slug;

    await prisma.advertiserProfile.update({
      where: { userId: demoUser.id },
      data: { ...profileData, slug: updateSlug },
    });
    console.log(`Updated demo profile: /a/${updateSlug} (published)`);
  } else {
    // Resolve slug collision with other users
    let slug = profileData.slug;
    let n = 0;
    for (;;) {
      const clash = await prisma.advertiserProfile.findUnique({ where: { slug } });
      if (!clash) break;
      n += 1;
      slug = `${profileData.slug}-${n}`;
    }
    await prisma.advertiserProfile.create({
      data: {
        userId: demoUser.id,
        ...profileData,
        slug,
      },
    });
    console.log(`Seeded demo profile: /a/${slug} (published)`);
  }

  // Ticket C — seed APPROVED creative for demo advertiser (smoke placement path)
  const fs = await import("fs/promises");
  const path = await import("path");
  const { randomUUID } = await import("crypto");

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  let approvedCreative = await prisma.creative.findFirst({
    where: {
      advertiserId: demoUser.id,
      name: "Demo Approved Banner",
      status: "APPROVED",
    },
  });

  if (!approvedCreative) {
    const storedName = `${randomUUID()}.png`;
    const src = path.join(process.cwd(), "demo-ad.png");
    try {
      await fs.copyFile(src, path.join(uploadsDir, storedName));
    } catch {
      // Minimal 1x1 PNG if demo-ad.png missing
      const tiny = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      await fs.writeFile(path.join(uploadsDir, storedName), tiny);
    }
    const st = await fs.stat(path.join(uploadsDir, storedName));
    approvedCreative = await prisma.creative.create({
      data: {
        name: "Demo Approved Banner",
        notes: "Seeded APPROVED creative for Ticket C placement smoke",
        fileName: "demo-ad.png",
        storedName,
        mimeType: "image/png",
        fileSize: st.size,
        status: "APPROVED",
        advertiserId: demoUser.id,
        reviewedAt: new Date(),
      },
    });
    console.log(`Seeded APPROVED creative: ${approvedCreative.name} (id=${approvedCreative.id})`);
  } else {
    console.log(`APPROVED creative already present: ${approvedCreative.id}`);
  }


  // Ticket D — ensure APPROVED placement + 1–2 sample schedules
  const openScreen = await prisma.screen.findFirst({
    where: { inventoryStatus: "OPEN" },
    orderBy: { name: "asc" },
  });
  if (!openScreen) {
    console.log("No OPEN screen — skip schedule seed");
  } else {
    let approvedPlacement = await prisma.placementRequest.findFirst({
      where: {
        advertiserId: demoUser.id,
        creativeId: approvedCreative.id,
        screenId: openScreen.id,
        status: "APPROVED",
      },
    });
    if (!approvedPlacement) {
      // Prefer any existing APPROVED for this advertiser+creative
      approvedPlacement = await prisma.placementRequest.findFirst({
        where: {
          advertiserId: demoUser.id,
          creativeId: approvedCreative.id,
          status: "APPROVED",
        },
      });
    }
    if (!approvedPlacement) {
      approvedPlacement = await prisma.placementRequest.create({
        data: {
          advertiserId: demoUser.id,
          screenId: openScreen.id,
          creativeId: approvedCreative.id,
          status: "APPROVED",
          note: "Seeded APPROVED placement for Ticket D schedules",
          reviewedAt: new Date(),
          reviewedById: admin.id,
        },
      });
      console.log(`Seeded APPROVED placement: ${approvedPlacement.id} on ${openScreen.name}`);
    } else {
      console.log(`APPROVED placement already present: ${approvedPlacement.id}`);
    }

    const oneOffCount = await prisma.schedule.count({
      where: { placementId: approvedPlacement.id, kind: "ONE_OFF" },
    });
    if (oneOffCount === 0) {
      const now = new Date();
      const day = 24 * 60 * 60 * 1000;
      const s1 = await prisma.schedule.create({
        data: {
          placementId: approvedPlacement.id,
          screenId: approvedPlacement.screenId,
          kind: "ONE_OFF",
          startAt: new Date(now.getTime() + 1 * day),
          endAt: new Date(now.getTime() + 8 * day),
          status: "ACTIVE",
          note: "Seeded ACTIVE ONE_OFF demo schedule (next week)",
          createdById: admin.id,
        },
      });
      const s2 = await prisma.schedule.create({
        data: {
          placementId: approvedPlacement.id,
          screenId: approvedPlacement.screenId,
          kind: "ONE_OFF",
          startAt: new Date(now.getTime() + 14 * day),
          endAt: new Date(now.getTime() + 21 * day),
          status: "DRAFT",
          note: "Seeded DRAFT ONE_OFF demo schedule (week+2)",
          createdById: admin.id,
        },
      });
      console.log(`Seeded ONE_OFF schedules: ACTIVE ${s1.id}, DRAFT ${s2.id}`);
    } else {
      console.log(`ONE_OFF schedules already present (${oneOffCount})`);
    }

    // Ticket E — weekly daypart Mon–Fri 09:00–11:00 America/Denver
    // Ticket T — keep an ACTIVE recurring so fill / daypart heat are non-empty
    const today = new Date();
    // Start ~3 weeks back so Ticket T last-7 fill / daypart heat see Mon–Fri blocks
    const startDate = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const d = String(startDate.getDate()).padStart(2, "0");
    const startYmd = `${y}-${m}-${d}`;
    const end = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ey = end.getFullYear();
    const em = String(end.getMonth() + 1).padStart(2, "0");
    const ed = String(end.getDate()).padStart(2, "0");
    const endYmd = `${ey}-${em}-${ed}`;

    let recurring = await prisma.schedule.findFirst({
      where: {
        placementId: approvedPlacement.id,
        kind: "RECURRING",
        note: "Seeded RECURRING Mon–Fri 09:00–11:00 daypart",
        status: "ACTIVE",
      },
    });
    if (!recurring) {
      recurring = await prisma.schedule.findFirst({
        where: {
          placementId: approvedPlacement.id,
          kind: "RECURRING",
          note: "Seeded RECURRING Mon–Fri 09:00–11:00 daypart",
        },
      });
    }
    if (!recurring) {
      const s3 = await prisma.schedule.create({
        data: {
          placementId: approvedPlacement.id,
          screenId: approvedPlacement.screenId,
          kind: "RECURRING",
          weekdays: "1,2,3,4,5",
          startTime: "09:00",
          endTime: "11:00",
          campaignStartDate: startYmd,
          campaignEndDate: endYmd,
          status: "ACTIVE",
          note: "Seeded RECURRING Mon–Fri 09:00–11:00 daypart",
          createdById: admin.id,
        },
      });
      console.log(`Seeded RECURRING daypart: ${s3.id} (${startYmd}→${endYmd} Mon–Fri 09:00–11:00)`);
    } else if (recurring.status !== "ACTIVE") {
      await prisma.schedule.update({
        where: { id: recurring.id },
        data: {
          status: "ACTIVE",
          cancelledAt: null,
          campaignStartDate: startYmd,
          campaignEndDate: endYmd,
          weekdays: "1,2,3,4,5",
          startTime: "09:00",
          endTime: "11:00",
        },
      });
      console.log(`Reactivated RECURRING daypart for Ticket T: ${recurring.id} (${startYmd}→${endYmd})`);
    } else {
      // Refresh campaign window so analytics demos stay in-range
      await prisma.schedule.update({
        where: { id: recurring.id },
        data: {
          campaignStartDate: startYmd,
          campaignEndDate: endYmd,
        },
      });
      console.log(`RECURRING daypart already ACTIVE: ${recurring.id} (window ${startYmd}→${endYmd})`);
    }
  }


  // Ticket J — playable video creative + ACTIVE ONE_OFF covering next 24h for player smoke
  {
    const videoSrc = path.join(process.cwd(), "fixtures", "uploads", "demo-spot.mp4");
    let videoCreative = await prisma.creative.findFirst({
      where: {
        advertiserId: demoUser.id,
        name: "Demo Player Spot",
        status: "APPROVED",
      },
    });
    if (!videoCreative) {
      const storedName = `${randomUUID()}.mp4`;
      try {
        await fs.copyFile(videoSrc, path.join(uploadsDir, storedName));
      } catch {
        // Fallback: copy any existing png as placeholder name (player prefers mp4)
        console.log("demo-spot.mp4 missing — skip video creative file copy");
      }
      try {
        const st = await fs.stat(path.join(uploadsDir, storedName));
        videoCreative = await prisma.creative.create({
          data: {
            name: "Demo Player Spot",
            notes: "Seeded mp4 for Ticket J kiosk player smoke",
            fileName: "demo-spot.mp4",
            storedName,
            mimeType: "video/mp4",
            fileSize: st.size,
            status: "APPROVED",
            advertiserId: demoUser.id,
            reviewedAt: new Date(),
          },
        });
        console.log(`Seeded player video creative: ${videoCreative.id}`);
      } catch (e) {
        console.log("Could not seed video creative", e);
      }
    } else {
      console.log(`Player video creative already present: ${videoCreative.id}`);
    }

    const lobby = await prisma.screen.findFirst({
      where: { name: "Lobby TV" },
    });
    if (videoCreative && lobby) {
      let jPlacement = await prisma.placementRequest.findFirst({
        where: {
          advertiserId: demoUser.id,
          creativeId: videoCreative.id,
          screenId: lobby.id,
          status: "APPROVED",
        },
      });
      if (!jPlacement) {
        jPlacement = await prisma.placementRequest.create({
          data: {
            advertiserId: demoUser.id,
            screenId: lobby.id,
            creativeId: videoCreative.id,
            status: "APPROVED",
            note: "Seeded for Ticket J player playlist",
            reviewedAt: new Date(),
            reviewedById: admin.id,
          },
        });
        console.log(`Seeded Ticket J placement: ${jPlacement.id}`);
      }

      const now = new Date();
      const existingLive = await prisma.schedule.findFirst({
        where: {
          placementId: jPlacement.id,
          status: "ACTIVE",
          kind: "ONE_OFF",
          note: "Ticket J player smoke window (next 48h)",
        },
      });
      if (!existingLive) {
        const live = await prisma.schedule.create({
          data: {
            placementId: jPlacement.id,
            screenId: lobby.id,
            kind: "ONE_OFF",
            startAt: new Date(now.getTime() - 60 * 60 * 1000),
            endAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            status: "ACTIVE",
            note: "Ticket J player smoke window (next 48h)",
            createdById: admin.id,
          },
        });
        console.log(`Seeded Ticket J ACTIVE schedule: ${live.id}`);
      } else {
        // Refresh window so re-seed keeps playlist non-empty
        await prisma.schedule.update({
          where: { id: existingLive.id },
          data: {
            startAt: new Date(now.getTime() - 60 * 60 * 1000),
            endAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            status: "ACTIVE",
          },
        });
        console.log(`Refreshed Ticket J ACTIVE schedule: ${existingLive.id}`);
      }
    } else {
      console.log("Skip Ticket J schedule — missing creative or Lobby TV");
    }
  }



  // Ticket K — optional sample admin folders (idempotent by scope+name)
  async function ensureFolder(scope: "HOST" | "ADVERTISER", name: string, sortOrder: number) {
    const existing = await prisma.adminFolder.findFirst({ where: { scope, name } });
    if (existing) return existing;
    return prisma.adminFolder.create({ data: { scope, name, sortOrder } });
  }
  const gymsFolder = await ensureFolder("HOST", "Gyms & fitness", 0);
  const barsFolder = await ensureFolder("HOST", "Bars & nightlife", 1);
  const localAdvFolder = await ensureFolder("ADVERTISER", "Local services", 0);
  console.log(`Ticket K folders: ${gymsFolder.name}, ${barsFolder.name}, ${localAdvFolder.name}`);

  const denverGym = await prisma.host.findFirst({ where: { name: "Denver Peak Fitness" } });
  if (denverGym) {
    await prisma.adminFolderItem.upsert({
      where: { targetType_targetId: { targetType: "HOST", targetId: denverGym.id } },
      create: { folderId: gymsFolder.id, targetType: "HOST", targetId: denverGym.id, sortOrder: 0 },
      update: { folderId: gymsFolder.id },
    });
  }
  const sportsBar = await prisma.host.findFirst({ where: { name: "Mile High Sports Bar" } });
  if (sportsBar) {
    await prisma.adminFolderItem.upsert({
      where: { targetType_targetId: { targetType: "HOST", targetId: sportsBar.id } },
      create: { folderId: barsFolder.id, targetType: "HOST", targetId: sportsBar.id, sortOrder: 0 },
      update: { folderId: barsFolder.id },
    });
  }
  const demoAdv = await prisma.user.findFirst({
    where: { email: "demo.advertiser@adnabbit.com", role: "ADVERTISER" },
  });
  if (demoAdv) {
    await prisma.adminFolderItem.upsert({
      where: { targetType_targetId: { targetType: "ADVERTISER", targetId: demoAdv.id } },
      create: {
        folderId: localAdvFolder.id,
        targetType: "ADVERTISER",
        targetId: demoAdv.id,
        sortOrder: 0,
      },
      update: { folderId: localAdvFolder.id },
    });
  }

  // Ticket T — analytics relies on ACTIVE schedules + open hours (no fake plays)
  console.log("Ticket T: schedule fill / daypart heat / campaigns use ACTIVE schedules + OpenHours");

    // Ensure at least a couple OPEN screens exist (hosts/screens seeded above)
  const openCount = await prisma.screen.count({ where: { inventoryStatus: "OPEN" } });
  console.log(`OPEN screens available for placement browse: ${openCount}`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
