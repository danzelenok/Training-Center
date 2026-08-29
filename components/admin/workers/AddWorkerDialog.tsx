import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatPhoneInput } from "@/lib/phone";
import { workerDisplayName, type Worker, type JurisdictionRef, type JobRoleRef } from "@/hooks/admin/workers/types";

const NO_MANAGER = "__none__";
const NO_ROLE = "__none__";

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  creating: boolean;
  managerCandidates: Worker[];
  managerId: string | null;
  onManagerChange: (managerId: string | null) => void;
  jurisdictions: JurisdictionRef[];
  jurisdictionId: string | null;
  onJurisdictionChange: (jurisdictionId: string | null) => void;
  // Set when the caller is a jurisdiction_admin: the state is fixed to their
  // own and not editable — the server ignores any other value anyway (see
  // app/api/admin/workers/route.ts), this just keeps the UI honest instead
  // of offering a choice that silently doesn't do what it says.
  lockedJurisdiction?: JurisdictionRef | null;
  jobRoles: JobRoleRef[];
  roleId: string | null;
  onRoleChange: (roleId: string | null) => void;
}

export function AddWorkerDialog({
  open,
  onOpenChange,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onSubmit,
  creating,
  managerCandidates,
  managerId,
  onManagerChange,
  jurisdictions,
  jurisdictionId,
  onJurisdictionChange,
  lockedJurisdiction,
  jobRoles,
  roleId,
  onRoleChange,
}: AddWorkerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Add New Worker
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Enter worker details to create a record and generate a unique Telegram invite link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Full Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. John Doe"
                className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Phone Number
              </label>
              <Input
                value={phone}
                onChange={(e) => onPhoneChange(formatPhoneInput(e.target.value))}
                placeholder="(555) 123-4567"
                className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Manager
              </label>
              <Select
                value={managerId ?? NO_MANAGER}
                onValueChange={(v) => onManagerChange(v === NO_MANAGER ? null : v)}
              >
                <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border text-foreground">
                  <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                  {managerCandidates.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workerDisplayName(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {jobRoles.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Role
                </label>
                <Select
                  value={roleId ?? NO_ROLE}
                  onValueChange={(v) => onRoleChange(v === NO_ROLE ? null : v)}
                >
                  <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                    <SelectValue placeholder="No role" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border text-foreground">
                    <SelectItem value={NO_ROLE}>No role</SelectItem>
                    {jobRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {lockedJurisdiction ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  State
                </label>
                <div className="w-full bg-muted/40 border border-border rounded-xl h-10 px-3 flex items-center text-xs font-medium text-foreground">
                  {lockedJurisdiction.code} &middot; {lockedJurisdiction.name}
                </div>
              </div>
            ) : jurisdictions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  State <span className="text-red-400">*</span>
                </label>
                <Select
                  value={jurisdictionId ?? undefined}
                  onValueChange={(v) => onJurisdictionChange(v)}
                >
                  <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border text-foreground">
                    {jurisdictions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Generate Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
