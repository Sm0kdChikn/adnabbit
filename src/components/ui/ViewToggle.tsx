"use client";

import { useListView, type ListViewMode } from "./useListView";

function ListIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

const OPTIONS: { value: ListViewMode; label: string; icon: typeof ListIcon }[] = [
  { value: "list", label: "List", icon: ListIcon },
  { value: "grid", label: "Grid", icon: GridIcon },
];

type Props = {
  className?: string;
};

export function ViewToggle({ className = "" }: Props) {
  const { view, setView, mounted } = useListView();

  return (
    <div
      role="group"
      aria-label="List or grid view"
      className={`inline-flex items-center rounded-md border border-border bg-surface p-0.5 text-sm shadow-sm ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && view === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            aria-pressed={active}
            title={label}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition ${
              active
                ? "bg-accent-dim text-accent shadow-sm"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Icon />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
