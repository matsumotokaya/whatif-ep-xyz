export function PremiumCrown({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path d="M3 7l4 4 5-7 5 7 4-4-1.6 11H4.6L3 7zm1.8 13h14.4v1.2a.8.8 0 01-.8.8H5.6a.8.8 0 01-.8-.8V20z" />
    </svg>
  );
}
