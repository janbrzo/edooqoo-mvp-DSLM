/**
 * WelcomeTestActionsPanel — unified action buttons for the Welcome Test.
 * Plan v6.0: ALWAYS-ON design. All 5 buttons are visible regardless of test
 * state. The first click on any button lazily creates the test + token via
 * the parent's `ensureWelcomeTest()` helper, then runs the requested action.
 *
 * Used by:
 *   - dashboard/WelcomeTestSuggestion (overview banner)
 *   - student-tests/StudentTestsTab (Tests tab)
 *
 * Buttons:
 *   - Send Welcome Test  → email + create+token (hidden on completed; replaced by Re-take)
 *   - Copy Link          → ensure + copy share URL
 *   - Refresh Link       → confirm dialog + rotate token (90d TTL); hidden on completed
 *   - Preview            → ensure + open ?preview=1 in new tab
 *   - View Results       → navigate to test details (disabled until any answer)
 *   - Re-take Test       → completed-only; create new attempt with form B
 */

import { useState } from "react";
import { Copy, RefreshCw, ExternalLink, BarChart3, Send, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

export type WelcomeTestActionsState =
  | "no_test"      // never created
  | "pending"      // assigned, no answers yet
  | "in_progress"  // student started
  | "completed";   // completed/reviewed

interface WelcomeTestActionsPanelProps {
  state: WelcomeTestActionsState;
  /** Share URL when known. Always-on buttons may still be enabled before a URL exists — handlers must lazily create the test. */
  shareUrl: string | null;
  /** Whether the student has answered ≥1 question (drives View Results enabled-state in pending). */
  hasAnyAnswer?: boolean;

  // Handlers — all OPTIONAL. If omitted, the corresponding button is hidden.
  // Each handler is responsible for calling ensureWelcomeTest() internally
  // before performing its action.
  onSend?: () => void | Promise<void>;
  onCopy?: () => void | Promise<void>;
  onRefreshLink?: () => Promise<string | null> | void;
  onPreview?: () => void | Promise<void>;
  onViewResults?: () => void;
  onRetake?: () => void | Promise<void>;

  // Async state passthrough (parent may control spinners externally).
  sending?: boolean;
  refreshing?: boolean;
  retaking?: boolean;

  size?: "sm" | "default";
  /** When true: tighter padding/text — used in narrow banner contexts. */
  compact?: boolean;
  className?: string;
}

export function WelcomeTestActionsPanel({
  state,
  shareUrl,
  hasAnyAnswer = false,
  onSend,
  onCopy,
  onRefreshLink,
  onPreview,
  onViewResults,
  onRetake,
  sending = false,
  refreshing = false,
  retaking = false,
  size = "sm",
  compact = false,
  className,
}: WelcomeTestActionsPanelProps) {
  // Per-button local spinners (only used when parent doesn't control them).
  const [copying, setCopying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false);

  const isCompleted = state === "completed";
  // View Results is meaningful once the student has ≥1 answer OR test is completed.
  const viewResultsEnabled = hasAnyAnswer || isCompleted;

  const handleCopy = async () => {
    if (!onCopy) return;
    setCopying(true);
    try {
      await onCopy();
    } finally {
      setCopying(false);
    }
  };

  const handlePreview = async () => {
    if (!onPreview) return;
    setPreviewing(true);
    try {
      await onPreview();
    } finally {
      setPreviewing(false);
    }
  };

  const runRefresh = async () => {
    if (!onRefreshLink) return;
    setInternalRefreshing(true);
    try {
      const newToken = await onRefreshLink();
      if (newToken) {
        const newUrl = `${window.location.origin}/welcome-test/${newToken}`;
        try {
          await navigator.clipboard.writeText(newUrl);
        } catch {
          // Clipboard may be unavailable — silent.
        }
        toast.success("New link copied (valid for 90 days). Old link no longer works.");
      }
    } finally {
      setInternalRefreshing(false);
    }
  };

  const handleRefreshClick = () => {
    // For an existing test → confirm before invalidating.
    if (state !== "no_test") {
      setConfirmRefreshOpen(true);
      return;
    }
    // For a fresh test, no link exists yet — generate immediately.
    void runRefresh();
  };

  const isRefreshing = refreshing || internalRefreshing;
  const compactCls = compact ? "h-8 px-2.5 text-xs" : "";
  const iconCls = compact ? "h-3.5 w-3.5 mr-1.5" : "h-4 w-4 mr-1.5";

  return (
    <TooltipProvider delayDuration={200}>
      <div className={"flex flex-wrap items-center gap-2 " + (className ?? "")}>
        {/* Copy Link — always visible if handler provided */}
        {onCopy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={size}
                onClick={handleCopy}
                disabled={copying}
                className={compactCls}
              >
                {copying ? (
                  <Loader2 className={iconCls + " animate-spin"} />
                ) : (
                  <Copy className={iconCls} />
                )}
                Copy Link
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy the student's unique Welcome Test link to your clipboard.</TooltipContent>
          </Tooltip>
        )}

        {/* Refresh Link — hidden on completed */}
        {onRefreshLink && !isCompleted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={size}
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className={compactCls}
              >
                {isRefreshing ? (
                  <Loader2 className={iconCls + " animate-spin"} />
                ) : (
                  <RefreshCw className={iconCls} />
                )}
                Refresh Link
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Generate a new share link (valid 90 days). The previous link stops working. Student answers are preserved.
            </TooltipContent>
          </Tooltip>
        )}

        {/* Preview — always visible if handler provided */}
        {onPreview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={size}
                onClick={handlePreview}
                disabled={previewing}
                className={compactCls}
              >
                {previewing ? (
                  <Loader2 className={iconCls + " animate-spin"} />
                ) : (
                  <ExternalLink className={iconCls} />
                )}
                Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Open the test in a new tab as the student would see it (no answers are saved).
            </TooltipContent>
          </Tooltip>
        )}

        {/* View Results — disabled until first answer (with tooltip) */}
        {onViewResults && (
          viewResultsEnabled ? (
            <Button
              variant={isCompleted ? "default" : "outline"}
              size={size}
              onClick={onViewResults}
              className={compactCls}
            >
              <BarChart3 className={iconCls} />
              View Results
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" size={size} disabled className={compactCls}>
                    <BarChart3 className={iconCls} />
                    View Results
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Available after the student answers at least one question.</TooltipContent>
            </Tooltip>
          )
        )}

        {/* Send Welcome Test — visible until completed, then replaced by Re-take */}
        {!isCompleted && onSend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={size}
                onClick={() => onSend()}
                disabled={sending}
                className={compactCls}
              >
                {sending ? (
                  <Loader2 className={iconCls + " animate-spin"} />
                ) : (
                  <Send className={iconCls} />
                )}
                {state === "no_test" ? "Send Welcome Test" : "Re-send Email"}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Email the link to the student. Also copies it to your clipboard.
            </TooltipContent>
          </Tooltip>
        )}

        {isCompleted && onRetake && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size={size} onClick={() => onRetake()} disabled={retaking} className={compactCls}>
                {retaking ? (
                  <Loader2 className={iconCls + " animate-spin"} />
                ) : (
                  <RotateCcw className={iconCls} />
                )}
                Re-take Test
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Create a new attempt of the Welcome Test. We'll compare growth against the previous attempt.
            </TooltipContent>
          </Tooltip>
        )}

        <AlertDialog open={confirmRefreshOpen} onOpenChange={setConfirmRefreshOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh share link?</AlertDialogTitle>
              <AlertDialogDescription>
                Refreshing the link will invalidate the previous URL. The student's
                existing answers will be preserved. The new link is valid for 90 days
                and will be copied to your clipboard automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmRefreshOpen(false);
                  void runRefresh();
                }}
              >
                Refresh & Copy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}