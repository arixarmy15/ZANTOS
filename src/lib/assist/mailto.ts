/** Builds a mailto: link; the user's own mail program opens it, TradeCheck sends nothing. */
export function mailtoLink(draft: { subject: string; body: string }): string {
  return `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
