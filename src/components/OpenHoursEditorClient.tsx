"use client";

import { useRouter } from "next/navigation";
import { OpenHoursEditor, type WeeklyHourRow } from "./OpenHoursEditor";

type Props = {
  timezone: string;
  initialWeekly: WeeklyHourRow[];
  showCustomToggle?: boolean;
  useCustomHours?: boolean;
  showForceLive?: boolean;
  forceLiveUntil?: string | null;
  summary?: string | null;
  isOpenNow?: boolean | null;
  savePath: string;
  title?: string;
  description?: string;
  openNowLabel?: string;
  closedNowLabel?: string;
  clearButtonLabel?: string;
  clearOkMessage?: string;
  saveButtonLabel?: string;
  footerNote?: string | null;
  showOvernightPreset?: boolean;
};

export function OpenHoursEditorClient(props: Props) {
  const router = useRouter();
  return (
    <OpenHoursEditor {...props} onSaved={() => router.refresh()} />
  );
}
