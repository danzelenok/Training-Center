import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeamsQuery, useWorkerDetailQuery } from "@/hooks/admin/workers/queries";
import { useUpdateWorkerTeamsMutation } from "@/hooks/admin/workers/mutations";
import { workerDisplayName } from "@/hooks/admin/workers/types";

interface TeamPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string | null;
}

export function TeamPickerDialog({ open, onOpenChange, workerId }: TeamPickerDialogProps) {
  const { data: teamsList = [] } = useTeamsQuery();
  const { data: worker } = useWorkerDetailQuery(workerId);
  const updateWorkerTeams = useUpdateWorkerTeamsMutation();

  const handleToggle = (teamId: string, checked: boolean) => {
    if (!workerId || !worker) return;
    const currentIds = worker.teams.map((t) => t.id);
    const nextIds = checked ? [...currentIds, teamId] : currentIds.filter((id) => id !== teamId);
    updateWorkerTeams.mutate({ workerId, teamIds: nextIds, checked });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            Edit Teams
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Choose which teams {worker ? workerDisplayName(worker) : "this worker"} belongs to.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2 py-2">
          {teamsList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No teams yet. Create one from the Teams page.
            </div>
          ) : (
            teamsList.map((team) => {
              const checked = worker?.teams.some((t) => t.id === team.id) ?? false;
              return (
                <label
                  key={team.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                    checked ? "border-[#C8D400]/50 bg-[#C8D400]/10" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={updateWorkerTeams.isPending}
                    onCheckedChange={(v) => handleToggle(team.id, v === true)}
                  />
                  <span className="text-xs font-medium text-foreground">{team.name}</span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
