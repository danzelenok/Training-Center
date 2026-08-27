"use client";

import { useState } from "react";
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
import type { AdminRole, JurisdictionRef } from "@/hooks/admin/team/types";
import { useInviteAdminMutation } from "@/hooks/admin/team/mutations";

interface InviteAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jurisdictions: JurisdictionRef[];
}

export function InviteAdminDialog({ open, onOpenChange, jurisdictions }: InviteAdminDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("jurisdiction_admin");
  const [jurisdictionId, setJurisdictionId] = useState<string | null>(null);
  const inviteAdmin = useInviteAdminMutation();

  const reset = () => {
    setEmail("");
    setRole("jurisdiction_admin");
    setJurisdictionId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "jurisdiction_admin" && !jurisdictionId) return;
    inviteAdmin.mutate(
      { email, role, jurisdictionId: role === "jurisdiction_admin" ? jurisdictionId : null },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Invite New Admin
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Send an invite with a pre-assigned role. The role becomes active once they accept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Email <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Role <span className="text-red-400">*</span>
              </label>
              <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border text-foreground">
                  <SelectItem value="jurisdiction_admin">Jurisdiction admin</SelectItem>
                  <SelectItem value="org_admin">Org admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "jurisdiction_admin" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  State <span className="text-red-400">*</span>
                </label>
                <Select value={jurisdictionId ?? undefined} onValueChange={(v) => setJurisdictionId(v)}>
                  <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border text-foreground">
                    {jurisdictions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.name} ({j.code})
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
              disabled={inviteAdmin.isPending || !email || (role === "jurisdiction_admin" && !jurisdictionId)}
              className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
            >
              {inviteAdmin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
