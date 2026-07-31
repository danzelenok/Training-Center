import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatPhoneInput } from "@/lib/phone";

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  creating: boolean;
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
