import { AlertTriangle, UserCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatPhoneDisplay } from "@/lib/phone";
import { workerDisplayName, type Worker } from "@/hooks/admin/workers/types";

interface DuplicateWorkerDialogProps {
  candidate: Worker | null;
  onOpenChange: (open: boolean) => void;
  onReactivate: () => void;
  onViewExisting: () => void;
  onCancel: () => void;
  onCreateAnyway: () => void;
  creating: boolean;
}

export function DuplicateWorkerDialog({
  candidate,
  onOpenChange,
  onReactivate,
  onViewExisting,
  onCancel,
  onCreateAnyway,
  creating,
}: DuplicateWorkerDialogProps) {
  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Possible Duplicate
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            A worker with a matching name or phone number already exists.
          </DialogDescription>
        </DialogHeader>

        {candidate && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-bold text-foreground">{workerDisplayName(candidate)}</p>
            <p className="text-xs text-muted-foreground">
              {candidate.active ? (
                "Active"
              ) : (
                <>
                  Deactivated
                  {candidate.deactivatedAt &&
                    ` on ${format(new Date(candidate.deactivatedAt), "dd MMM yyyy")}`}
                </>
              )}
              {candidate.phone && ` · ${formatPhoneDisplay(candidate.phone)}`}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {candidate && !candidate.active && (
            <Button
              type="button"
              onClick={onReactivate}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl gap-1.5"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Reactivate This Worker Instead
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onViewExisting}
            className="w-full border-border text-foreground text-xs rounded-xl"
          >
            View Existing Worker
          </Button>
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCreateAnyway}
              disabled={creating}
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs rounded-xl"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create New Anyway"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
