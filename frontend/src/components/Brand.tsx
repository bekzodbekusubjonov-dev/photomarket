import { useId } from "react";

/** PhotoMarket belgisi: binafsha kvadrat ichida kamera diafragmasi (barcha joyda — sarlavha, shartnoma, chek). */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="PhotoMarket">
      <defs>
        <linearGradient id={id} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeLinecap="round"><circle cx="32" cy="32" r="18" strokeWidth="3.4"/><g strokeWidth="2.6"><line x1="32.00" y1="14.00" x2="37.89" y2="34.75"/><line x1="47.59" y1="23.00" x2="32.57" y2="38.48"/><line x1="47.59" y1="41.00" x2="26.68" y2="35.73"/><line x1="32.00" y1="50.00" x2="26.11" y2="29.25"/><line x1="16.41" y1="41.00" x2="31.43" y2="25.52"/><line x1="16.41" y1="23.00" x2="37.32" y2="28.27"/></g></g><circle cx="49.5" cy="15" r="4" fill="#fbbf24"/>
    </svg>
  );
}

export function BrandWord({ className }: { className?: string }) {
  return <span className={className}>Photo<b>Market</b></span>;
}
