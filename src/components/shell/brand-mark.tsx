import { useId } from "react";

// The TradeCheck mark: two ruled lines reconciled by one tick (design/brand/mark.svg).
export function BrandMark({ className }: { className?: string }) {
  const maskId = `tc-knockout-${useId()}`;
  const tick = "M9.1 15 12.1 18.5 21.1 5.5";
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <path
            d={tick}
            stroke="#000"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} stroke="var(--color-slate)" strokeWidth="2" strokeLinecap="round">
        <path d="M2.6 9H18.6" />
        <path d="M2.6 15H8.6" />
      </g>
      <path
        d={tick}
        stroke="var(--color-harbor)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
