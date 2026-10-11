"use client";

import { Direction } from "radix-ui";
import type * as React from "react";

// Radix primitives (tabs, menus) read the text direction for arrow-key behaviour.
export function Providers({ dir, children }: { dir: "ltr" | "rtl"; children: React.ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
