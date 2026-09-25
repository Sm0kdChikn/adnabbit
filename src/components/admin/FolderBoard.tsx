"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardList,
  CardListItem,
  EmptyState,
} from "@/components/ui";
import type { AdminFolderScope } from "@/lib/types";

export type FolderDto = {
  id: string;
  scope: string;
  name: string;
  sortOrder: number;
  items: { id: string; targetId: string; sortOrder: number }[];
};

export type HostFolderItem = {
  id: string;
  name: string;
  verticalLabel: string;
  screenCount: number;
  ownerEmail: string | null;
  notes: string | null;
};

export type AdvertiserFolderItem = {
  id: string;
  name: string | null;
  email: string;
  creativeCount: number;
  profileSlug: string | null;
  profilePublished: boolean;
};

type Props = {
  scope: AdminFolderScope;
  folders: FolderDto[];
  hosts?: HostFolderItem[];
  advertisers?: AdvertiserFolderItem[];
  emptyLabel?: ReactNode;
};

type DragPayload =
  | { kind: "folder"; folderId: string }
  | { kind: "item"; targetId: string; fromFolderId: string | null };

const UNFILED = "__unfiled__";

function parseDrag(data: string): DragPayload | null {
  try {
    return JSON.parse(data) as DragPayload;
  } catch {
    return null;
  }
}

function HostCard({ h }: { h: HostFolderItem }) {
  return (
    <Card glow className="flex h-full flex-col p-4 pl-12">
      <div className="flex flex-1 flex-col gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={`/admin/hosts/${h.id}`}
            className="font-semibold text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {h.name}
          </Link>
          <p className="text-sm text-muted">
            {h.verticalLabel} · {h.screenCount} screen
            {h.screenCount === 1 ? "" : "s"}
            {" · "}
            {h.ownerEmail ? `owner ${h.ownerEmail}` : "unclaimed"}
          </p>
          {h.notes && (
            <p className="text-xs text-muted-strong">{h.notes}</p>
          )}
        </div>
        <Link
          href={`/admin/hosts/${h.id}`}
          className="text-sm text-muted hover:text-accent"
          onClick={(e) => e.stopPropagation()}
        >
          Edit
        </Link>
      </div>
    </Card>
  );
}

function AdvertiserCard({ a }: { a: AdvertiserFolderItem }) {
  return (
    <Card glow className="flex h-full flex-col p-4 pl-12">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-foreground">
          {a.name || "Unnamed"}
        </p>
        <p className="text-sm text-accent">{a.email}</p>
        <p className="text-sm text-muted">
          {a.creativeCount} creative
          {a.creativeCount === 1 ? "" : "s"}
          {a.profileSlug
            ? ` · profile /a/${a.profileSlug}${
                a.profilePublished ? "" : " (draft)"
              }`
            : " · no public profile"}
        </p>
        {a.profileSlug && a.profilePublished && (
          <Link
            href={`/a/${a.profileSlug}`}
            className="inline-block text-sm text-muted hover:text-accent"
            onClick={(e) => e.stopPropagation()}
          >
            View public profile
          </Link>
        )}
      </div>
    </Card>
  );
}

export function FolderBoard({
  scope,
  folders: initialFolders,
  hosts = [],
  advertisers = [],
  emptyLabel = "Nothing here yet.",
}: Props) {
  const router = useRouter();
  const [folders, setFolders] = useState(initialFolders);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const allIds = useMemo(() => {
    if (scope === "HOST") return hosts.map((h) => h.id);
    return advertisers.map((a) => a.id);
  }, [scope, hosts, advertisers]);

  const hostById = useMemo(() => {
    const m = new Map<string, HostFolderItem>();
    for (const h of hosts) m.set(h.id, h);
    return m;
  }, [hosts]);

  const advertiserById = useMemo(() => {
    const m = new Map<string, AdvertiserFolderItem>();
    for (const a of advertisers) m.set(a.id, a);
    return m;
  }, [advertisers]);

  const membership = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) {
      for (const it of f.items) map.set(it.targetId, f.id);
    }
    return map;
  }, [folders]);

  const unfiledIds = useMemo(
    () => allIds.filter((id) => !membership.has(id)),
    [allIds, membership]
  );

  const folderItemIds = useCallback(
    (folderId: string) => {
      const f = folders.find((x) => x.id === folderId);
      if (!f) return [];
      return [...f.items]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .map((i) => i.targetId)
        .filter((id) => allIds.includes(id));
    },
    [folders, allIds]
  );

  const refresh = () => router.refresh();

  async function api(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    const data = await api("/api/admin/folders", "POST", { scope, name });
    if (!data?.folder) return;
    setFolders((prev) => [...prev, data.folder]);
    setNewName("");
    refresh();
  }

  async function renameFolder(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    const data = await api(`/api/admin/folders/${id}`, "PATCH", { name });
    if (!data?.folder) return;
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: data.folder.name } : f))
    );
    setRenamingId(null);
    refresh();
  }

  async function deleteFolder(id: string) {
    if (
      !confirm(
        "Delete this folder? Items will be moved to Unfiled. Hosts/advertisers are not deleted."
      )
    ) {
      return;
    }
    const data = await api(`/api/admin/folders/${id}`, "DELETE");
    if (!data?.ok) return;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    refresh();
  }

  async function persistFolderOrder(orderedIds: string[]) {
    const data = await api("/api/admin/folders/reorder", "PATCH", {
      scope,
      orderedIds,
    });
    if (data?.folders) {
      setFolders(data.folders);
      refresh();
    }
  }

  async function moveItem(
    targetId: string,
    folderId: string | null,
    opts?: { orderedInDest?: string[] }
  ) {
    setFolders((prev) => {
      const next = prev.map((f) => ({
        ...f,
        items: f.items.filter((i) => i.targetId !== targetId),
      }));
      if (folderId) {
        const dest = next.find((f) => f.id === folderId);
        if (dest) {
          const maxOrder =
            dest.items.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;
          dest.items = [
            ...dest.items,
            {
              id: `tmp-${targetId}`,
              targetId,
              sortOrder: opts?.orderedInDest?.indexOf(targetId) ?? maxOrder,
            },
          ];
          if (opts?.orderedInDest) {
            dest.items = opts.orderedInDest.map((tid, idx) => {
              const existing = dest.items.find((i) => i.targetId === tid);
              return {
                id: existing?.id || `tmp-${tid}`,
                targetId: tid,
                sortOrder: idx,
              };
            });
          }
        }
      }
      return next;
    });

    const data = await api("/api/admin/folders/items", "PATCH", {
      targetType: scope,
      targetId,
      folderId,
    });
    if (!data) {
      refresh();
      return;
    }

    if (opts?.orderedInDest && folderId) {
      await api("/api/admin/folders/items", "PATCH", {
        targetType: scope,
        folderId,
        orderedTargetIds: opts.orderedInDest,
      });
    }
    refresh();
  }

  async function reorderItemsInFolder(
    folderId: string,
    orderedTargetIds: string[]
  ) {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          items: orderedTargetIds.map((tid, idx) => {
            const existing = f.items.find((i) => i.targetId === tid);
            return {
              id: existing?.id || `tmp-${tid}`,
              targetId: tid,
              sortOrder: idx,
            };
          }),
        };
      })
    );
    await api("/api/admin/folders/items", "PATCH", {
      targetType: scope,
      folderId,
      orderedTargetIds,
    });
    refresh();
  }

  function onFolderDragStart(e: React.DragEvent, folderId: string) {
    const payload: DragPayload = { kind: "folder", folderId };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(folderId);
  }

  function onItemDragStart(
    e: React.DragEvent,
    targetId: string,
    fromFolderId: string | null
  ) {
    e.stopPropagation();
    const payload: DragPayload = { kind: "item", targetId, fromFolderId };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(targetId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverKey(null);
  }

  async function handleDropOnFolder(
    e: React.DragEvent,
    destFolderId: string | null
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
    const payload = parseDrag(e.dataTransfer.getData("application/json"));
    if (!payload) return;

    if (payload.kind === "folder") {
      if (destFolderId === null) return;
      const fromIdx = folders.findIndex((f) => f.id === payload.folderId);
      const toIdx = folders.findIndex((f) => f.id === destFolderId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      const next = [...folders];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setFolders(next);
      await persistFolderOrder(next.map((f) => f.id));
      return;
    }

    const currentFolder = membership.get(payload.targetId) ?? null;
    if (currentFolder === destFolderId) return;
    await moveItem(payload.targetId, destFolderId);
  }

  async function handleDropOnItem(
    e: React.DragEvent,
    destFolderId: string | null,
    beforeTargetId: string
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
    const payload = parseDrag(e.dataTransfer.getData("application/json"));
    if (!payload || payload.kind !== "item") return;
    if (payload.targetId === beforeTargetId) return;

    if (destFolderId === null) {
      if ((membership.get(payload.targetId) ?? null) !== null) {
        await moveItem(payload.targetId, null);
      }
      return;
    }

    const ids = folderItemIds(destFolderId).filter(
      (id) => id !== payload.targetId
    );
    const insertAt = ids.indexOf(beforeTargetId);
    if (insertAt < 0) ids.push(payload.targetId);
    else ids.splice(insertAt, 0, payload.targetId);

    const wasInFolder =
      (membership.get(payload.targetId) ?? null) === destFolderId;
    if (!wasInFolder) {
      await moveItem(payload.targetId, destFolderId, {
        orderedInDest: ids,
      });
    } else {
      await reorderItemsInFolder(destFolderId, ids);
    }
  }

  function sectionDropProps(key: string, folderId: string | null) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverKey(key);
      },
      onDragLeave: () => {
        setDragOverKey((k) => (k === key ? null : k));
      },
      onDrop: (e: React.DragEvent) => handleDropOnFolder(e, folderId),
    };
  }

  function renderCard(targetId: string) {
    if (scope === "HOST") {
      const h = hostById.get(targetId);
      return h ? <HostCard h={h} /> : null;
    }
    const a = advertiserById.get(targetId);
    return a ? <AdvertiserCard a={a} /> : null;
  }

  function renderItemRow(targetId: string, fromFolderId: string | null) {
    return (
      <div
        draggable
        onDragStart={(e) => onItemDragStart(e, targetId, fromFolderId)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverKey(`item:${targetId}`);
        }}
        onDrop={(e) => handleDropOnItem(e, fromFolderId, targetId)}
        className={`relative cursor-grab active:cursor-grabbing ${
          dragOverKey === `item:${targetId}`
            ? "rounded-xl ring-2 ring-accent/50"
            : ""
        } ${draggingId === targetId ? "opacity-50" : ""}`}
      >
        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-background-elevated/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted opacity-70">
          drag
        </div>
        {renderCard(targetId)}
      </div>
    );
  }

  function renderSection(
    key: string,
    title: string,
    folderId: string | null,
    targetIds: string[],
    opts?: { folder?: FolderDto; draggableFolder?: boolean }
  ) {
    const isCollapsed = !!collapsed[key];
    const isOver = dragOverKey === key;
    return (
      <Card
        key={key}
        className={`overflow-hidden ${
          isOver ? "border-accent/60 shadow-glow-sm" : ""
        }`}
        {...sectionDropProps(key, folderId)}
      >
        <div
          className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-3 py-2"
          draggable={!!opts?.draggableFolder && !!opts.folder}
          onDragStart={
            opts?.folder
              ? (e) => onFolderDragStart(e, opts.folder!.id)
              : undefined
          }
          onDragEnd={onDragEnd}
        >
          <button
            type="button"
            onClick={() =>
              setCollapsed((c) => ({ ...c, [key]: !c[key] }))
            }
            className="rounded px-1 text-muted hover:text-foreground"
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
          {renamingId === folderId && folderId ? (
            <form
              className="flex flex-1 flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                renameFolder(folderId);
              }}
            >
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                autoFocus
              />
              <Button type="submit" size="sm" disabled={busy}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRenamingId(null)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <h2 className="flex-1 text-sm font-semibold text-foreground">
                {title}
                <span className="ml-2 text-xs font-normal text-muted">
                  ({targetIds.length})
                </span>
              </h2>
              {opts?.draggableFolder && (
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  drag folder
                </span>
              )}
              {folderId && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenamingId(folderId);
                      setRenameValue(title);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteFolder(folderId)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        {!isCollapsed && (
          <div className="min-h-[3rem] p-3">
            {targetIds.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">
                Drop items here
              </p>
            ) : (
              <CardList>
                {targetIds.map((id) => (
                  <CardListItem key={id}>
                    {renderItemRow(id, folderId)}
                  </CardListItem>
                ))}
              </CardList>
            )}
          </div>
        )}
      </Card>
    );
  }

  const sortedFolders = [...folders].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createFolder();
          }}
        >
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted">
            New folder
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Downtown gyms"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <Button type="submit" size="sm" disabled={busy || !newName.trim()}>
            Create folder
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Drag folders to reorder. Drag items into a folder or into{" "}
          <strong className="text-muted-strong">Unfiled</strong>. Delete folder
          unfiles items only — never deletes hosts or advertisers.
        </p>
        {error && (
          <p className="mt-2 text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}
      </Card>

      {allIds.length === 0 && sortedFolders.length === 0 ? (
        <EmptyState>{emptyLabel}</EmptyState>
      ) : (
        <div className="space-y-3">
          {sortedFolders.map((f) =>
            renderSection(f.id, f.name, f.id, folderItemIds(f.id), {
              folder: f,
              draggableFolder: true,
            })
          )}
          {renderSection(UNFILED, "Unfiled", null, unfiledIds)}
        </div>
      )}
    </div>
  );
}
