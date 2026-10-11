"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Limits } from "./use-error-message";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

/**
 * Drop area plus a real "Browse files" button for keyboard and screen-reader users. File
 * type and size are checked again on the server by magic bytes; nothing here is trusted.
 */
export function Dropzone({
  limits,
  retentionHours,
  disabled,
  onFiles,
}: {
  limits: Limits;
  retentionHours: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const t = useTranslations("upload");
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const descriptionId = useId();

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        "grid justify-items-start gap-1.5 rounded-sm border border-dashed border-control-border bg-paper p-5 transition-control",
        dragging && "border-harbor bg-harbor-tint",
      )}
    >
      <Upload aria-hidden="true" className="size-5 text-slate" />
      <p className="font-medium">{t("dropTitle")}</p>
      <div id={descriptionId} className="grid gap-1 text-small text-slate">
        <p>{t("limits", limits)}</p>
        <p>{t("privacy", { hours: retentionHours })}</p>
      </div>
      <Button
        className="mt-2"
        disabled={disabled}
        aria-describedby={descriptionId}
        onClick={() => input.current?.click()}
      >
        {t("browse")}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
