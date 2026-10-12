"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-(--scrim) data-[state=open]:animate-overlay-in data-[state=closed]:animate-fade-out" />
  );
}

/** Centred dialog: focus is trapped and returned to the trigger; Escape closes. */
export function DialogContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel: string }) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          // Centred with auto margins so the entry animation's transform cannot shift it.
          "fixed inset-0 z-50 m-auto grid h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] gap-4 overflow-auto",
          "rounded-md bg-paper p-6 shadow-overlay data-[state=open]:animate-dialog-in data-[state=closed]:animate-fade-out",
          // Phones: a bottom sheet within thumb reach, clear of the home indicator.
          "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:m-0 max-sm:max-h-[calc(100dvh-3rem)] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:animate-sheet-up",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-2 top-2 inline-flex size-10 pointer-coarse:size-11 items-center justify-center rounded-sm text-slate transition-control hover:bg-ledger hover:text-carbon"
        >
          <X aria-hidden="true" className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Full-height panel at the inline-end edge, used for the phone menu. */
export function SheetContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel: string }) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 end-0 z-50 grid w-[min(320px,100%)] content-start gap-6 overflow-auto bg-paper p-6 shadow-overlay",
          "pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-overlay-in data-[state=closed]:animate-fade-out",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-2 top-[calc(0.5rem+env(safe-area-inset-top))] inline-flex size-11 items-center justify-center rounded-sm text-slate transition-control hover:bg-ledger hover:text-carbon"
        >
          <X aria-hidden="true" className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pe-10 text-title", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-slate", className)} {...props} />;
}
