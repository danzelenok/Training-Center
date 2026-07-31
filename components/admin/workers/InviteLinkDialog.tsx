import { CheckCircle, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  inviteUrl: string;
  copied: boolean;
  onCopy: () => void;
}

export function InviteLinkDialog({
  open,
  onOpenChange,
  workerName,
  inviteUrl,
  copied,
  onCopy,
}: InviteLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            Invite Link Ready
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Send this link to <strong className="text-foreground">{workerName}</strong>. Valid for 14 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="p-3 bg-muted/40 border border-border rounded-xl font-mono text-xs break-all text-foreground select-all">
            {inviteUrl}
          </div>

          <Button
            onClick={onCopy}
            className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs h-10 rounded-xl gap-2 cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link Copied!" : "Copy Invite Link"}
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground text-xs w-full rounded-xl"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
