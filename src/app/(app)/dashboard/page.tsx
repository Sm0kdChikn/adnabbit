import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "./SubmitButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "HOST") redirect("/host");

  const creatives = await prisma.creative.findMany({
    where: { advertiserId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your creatives</h1>
          <p className="text-sm text-slate-600">Upload, submit for review, and track status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/screens"
            className="rounded-md bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Browse screens
          </Link>
          <Link
            href="/placements"
            className="rounded-md bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Placements
          </Link>
          <Link
            href="/profile"
            className="rounded-md bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Public profile
          </Link>
          <Link
            href="/creatives/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Upload creative
          </Link>
        </div>
      </div>

      {creatives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No creatives yet.{" "}
          <Link href="/creatives/new" className="text-indigo-600 hover:underline">
            Upload your first
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {creatives.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{c.name}</h2>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {c.fileName} · {(c.fileSize / 1024).toFixed(1)} KB · {c.mimeType}
                  </p>
                  {c.notes && <p className="text-sm text-slate-600">{c.notes}</p>}
                  {c.status === "REJECTED" && c.rejectReason && (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      <span className="font-medium">Rejection reason:</span> {c.rejectReason}
                    </p>
                  )}
                  <a
                    href={`/api/uploads/${c.storedName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sm text-indigo-600 hover:underline"
                  >
                    View file
                  </a>
                </div>
                {(c.status === "DRAFT" || c.status === "REJECTED") && (
                  <SubmitButton creativeId={c.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
