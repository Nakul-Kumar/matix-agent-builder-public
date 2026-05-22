import type { ReactNode } from "react";

export type ResultCardDotTone = "ok" | "warn" | "muted" | "accent" | "none";

export interface ResultCardProps {
  category: string;
  title: string;
  preview?: string | null;
  footnote?: ReactNode;
  footnoteAlign?: "right" | "left";
  dotTone?: ResultCardDotTone;
  onClick?: () => void;
  href?: string;
  compact?: boolean;
  ariaLabel?: string;
}

export function ResultCard({
  category,
  title,
  preview,
  footnote,
  footnoteAlign = "right",
  dotTone = "none",
  onClick,
  href,
  compact,
  ariaLabel,
}: ResultCardProps) {
  const interactive = Boolean(onClick || href);
  const hasPreview = preview != null && preview !== "";
  const isCompact = compact || !hasPreview;

  const className = [
    "resultCard",
    interactive ? "is-interactive" : "",
    isCompact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="resultCardCategory">{category}</span>
      <span className="resultCardTitle">{title}</span>
      {hasPreview && (
        <span className="resultCardPreview">{preview}</span>
      )}
      {footnote != null && (
        <span
          className={`resultCardFootnote resultCardFootnote--${footnoteAlign}`}
        >
          {dotTone !== "none" && (
            <span
              className={`resultDot resultDot--${dotTone}`}
              aria-hidden="true"
            />
          )}
          {footnote}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
      >
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={className} aria-label={ariaLabel}>
      {inner}
    </div>
  );
}
