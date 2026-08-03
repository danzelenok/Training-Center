import { AlertTriangle, Loader2 } from "lucide-react";

interface AssetGenerationStatusProps {
  status: "generating" | "failed";
  title: string;
  description: string;
  /** Only Video's failed h3 omits font-sans — everyone else's matches this default. */
  titleClassName?: string;
  isActive?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  actionClassName?: string;
}

const DEFAULT_FAILED_TITLE_CLASS = "text-base font-bold text-destructive font-sans";
const DEFAULT_ACTION_CLASS =
  "mt-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans";

/**
 * Purely presentational — no state, no fetch. Renders the icon/heading/
 * description/retry-button content that goes *inside* each slide's own
 * (untouched) outer <Card> wrapper for its "generating" and "failed"
 * asset states. Colors/classes are parameterized rather than hardcoded
 * because Dialogue/Audio/Video each have small, real styling differences
 * (button color, title font) that predate this refactor and shouldn't be
 * silently normalized.
 */
export function AssetGenerationStatus({
  status,
  title,
  description,
  titleClassName,
  isActive,
  actionLabel,
  onAction,
  actionClassName,
}: AssetGenerationStatusProps) {
  if (status === "generating") {
    return (
      <>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">{description}</p>
      </>
    );
  }

  return (
    <>
      <div className="p-3 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
        <AlertTriangle className="h-8 w-8 text-destructive animate-bounce" />
      </div>
      <h3 className={titleClassName || DEFAULT_FAILED_TITLE_CLASS}>{title}</h3>
      <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">{description}</p>
      {isActive && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={actionClassName || DEFAULT_ACTION_CLASS}
        >
          {actionLabel}
        </button>
      )}
    </>
  );
}
