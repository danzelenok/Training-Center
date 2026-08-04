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
import { useJurisdictionsQuery, useWorkerDetailQuery } from "@/hooks/admin/workers/queries";
import { useUpdateWorkerJurisdictionMutation } from "@/hooks/admin/workers/mutations";
import { workerDisplayName } from "@/hooks/admin/workers/types";

const NO_JURISDICTION = "__none__";

interface JurisdictionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string | null;
}

export function JurisdictionPickerDialog({ open, onOpenChange, workerId }: JurisdictionPickerDialogProps) {
  const { data: jurisdictions } = useJurisdictionsQuery();
  const { data: worker } = useWorkerDetailQuery(workerId);
  const updateJurisdiction = useUpdateWorkerJurisdictionMutation();

  const [selected, setSelected] = useState<string>(NO_JURISDICTION);
  const [wasOpen, setWasOpen] = useState(open);

  // Re-sync the selection from the worker's current state each time the
  // dialog transitions from closed to open (adjust-during-render, not an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(worker?.jurisdiction?.id ?? NO_JURISDICTION);
  }

  const candidates = jurisdictions ?? [];

  const handleSave = () => {
    if (!workerId) return;
    updateJurisdiction.mutate(
      { workerId, jurisdictionId: selected === NO_JURISDICTION ? null : selected },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            Set State
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Choose which state&apos;s regulations apply to {worker ? workerDisplayName(worker) : "this worker"}.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="max-h-80 overflow-y-auto space-y-2 py-2"
        >
          <label className="flex items-center gap-2.5 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <RadioGroupItem value={NO_JURISDICTION} />
            <span className="text-xs font-medium text-foreground">No state assigned</span>
          </label>
          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No states configured for this organization.
            </div>
          ) : (
            candidates.map((j) => (
              <label
                key={j.id}
                className="flex items-center gap-2.5 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <RadioGroupItem value={j.id} />
                <span className="text-xs font-medium text-foreground">{j.code} &middot; {j.name}</span>
              </label>
            ))
          )}
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateJurisdiction.isPending}
            className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl gap-1.5"
          >
            {updateJurisdiction.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
