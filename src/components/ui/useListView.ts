"use client";

import { useCallback, useEffect, useState } from "react";

export type ListViewMode = "list" | "grid";

const STORAGE_KEY = "adnabbit-list-view";
const EVENT_NAME = "adnabbit-list-view";

function readStored(): ListViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "list" || v === "grid") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

/**
 * Shared list/grid preference. Syncs across ViewToggle + CardList on the
 * same page via a custom event, and across tabs via the storage event.
 */
export function useListView() {
  const [view, setViewState] = useState<ListViewMode>("list");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setViewState(readStored());

    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "list" || e.newValue === "grid") {
        setViewState(e.newValue);
      }
    }

    function onCustom(e: Event) {
      const detail = (e as CustomEvent<ListViewMode>).detail;
      if (detail === "list" || detail === "grid") setViewState(detail);
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  const setView = useCallback((next: ListViewMode) => {
    setViewState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }, []);

  return {
    view: mounted ? view : ("list" as ListViewMode),
    setView,
    mounted,
  };
}
