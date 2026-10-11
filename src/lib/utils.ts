import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge must know the custom type scale, or it treats `text-body` (size) and
// `text-carbon` (colour) as conflicting and drops one of them.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "small", "body", "reading", "title-sm", "title", "heading", "page"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
