import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { workerDisplayName, type Worker } from "@/hooks/admin/workers/types";

interface UnbindConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetWorker: Worker | null;
  onConfirm: () => void;
  unbinding: boolean;
}

export function UnbindConfirmDialog({
  open,
  onOpenChange,
  targetWorker,
  onConfirm,
  unbinding,
}: UnbindConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reset Telegram Connection?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
            Worker <strong className="text-foreground">{targetWorker ? workerDisplayName(targetWorker) : ""}</strong> will lose access under their current Telegram account until they click the newly generated invite link.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground text-xs rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={unbinding}
            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-4 rounded-xl"
          >
            {unbinding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset & Generate New Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
