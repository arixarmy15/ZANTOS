import type * as React from "react";

// The <html> element is rendered by `[locale]/layout.tsx`, which knows the language and
// text direction.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
