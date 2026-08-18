/** Inline teacup icon — lucide-react has no tea icon, so this mirrors
 *  lucide's stroke conventions (24x24 viewBox, `currentColor`, 2px round
 *  stroke) and renders a cup with handle, saucer, and rising steam. Used
 *  in place of the old `Coffee` icon for the "Buy me a cup of tea" donate
 *  affordance. Stateless; safe to render at any size. */
export function TeaCupIcon({
  className,
  size = 24,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  size?: number;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      {/* steam */}
      <path d="M8 3c0 1 .8 1.5.8 2.5S8 7 8 8" />
      <path d="M12 3c0 1 .8 1.5.8 2.5S12 7 12 8" />
      {/* cup + handle */}
      <path d="M4 9h11v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
      <path d="M15 10h2.5a2 2 0 0 1 0 4H15" />
      {/* saucer */}
      <path d="M3 20h13" />
    </svg>
  );
}
