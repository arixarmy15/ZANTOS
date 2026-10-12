import type { Metadata } from "next";

// Checks hold uploaded business documents: never index them or follow their links.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ChecksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
