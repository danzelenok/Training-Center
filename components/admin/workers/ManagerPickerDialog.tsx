import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWorkersQuery, useWorkerDetailQuery } from "@/hooks/admin/workers/queries";
import { useUpdateWorkerManagerMutation } from "@/hooks/admin/workers/mutations";
import { workerDisplayName } from "@/hooks/admin/workers/types";

const NO_MANAGER = "__none__";

interface ManagerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string | null;
}

export function ManagerPickerDialog({ open, onOpenChange, workerId }: ManagerPickerDialogProps) {
  const { data: workersData } = useWorkersQuery();
  const { data: worker } = useWorkerDetailQuery(workerId);
  const updateManager = useUpdateWorkerManagerMutation();

  const [selected, setSelected] = useState<string>(NO_MANAGER);
  const [wasOpen, setWasOpen] = useState(open);

  // Re-sync the selection from the worker's current manager each time the
  // dialog transitions from closed to open (adjust-during-render, not an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(worker?.manager?.id ?? NO_MANAGER);
  }

  const candidates = (workersData?.workers ?? []).filter((w) => w.active && w.id !== workerId);

  const handleSave = () => {
    if (!workerId) return;
    updateManager.mutate(
      { workerId, managerId: selected === NO_MANAGER ? null : selected },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            Set Manager
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Choose who {worker ? workerDisplayName(worker) : "this worker"} reports to.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="max-h-80 overflow-y-auto space-y-2 py-2"
        >
          <label className="flex items-center gap-2.5 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <RadioGroupItem value={NO_MANAGER} />
            <span className="text-xs font-medium text-foreground">No manager</span>
          </label>
          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No other active workers to choose from.
            </div>
          ) : (
            candidates.map((w) => (
              <label
                key={w.id}
                className="flex items-center gap-2.5 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <RadioGroupItem value={w.id} />
                <span className="text-xs font-medium text-foreground">{workerDisplayName(w)}</span>
              </label>
            ))
          )}
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateManager.isPending}
            className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl gap-1.5"
          >
            {updateManager.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
