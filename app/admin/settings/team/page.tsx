"use client";

import { useState } from "react";
import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useJurisdictionsQuery } from "@/hooks/admin/workers/queries";
import { useTeamQuery } from "@/hooks/admin/team/queries";
import { useChangeAdminRoleMutation, useRemoveAdminMutation, useRevokeInvitationMutation } from "@/hooks/admin/team/mutations";
import type { TeamMember, PendingTeamInvitation } from "@/hooks/admin/team/types";
import { InviteAdminDialog } from "@/components/admin/team/InviteAdminDialog";

function memberName(m: TeamMember) {
  const parts = [m.firstName, m.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : m.identifier;
}

function RoleBadge({ member }: { member: TeamMember }) {
  if (!member.role) {
    return <Badge variant="outline" className="border-amber-400 text-amber-500">role not set</Badge>;
  }
  if (member.role === "org_admin") {
    return <Badge className="bg-[#1B2A6B] text-white">Org admin</Badge>;
  }
  return (
    <Badge className="bg-[#C8D400] text-[#1B2A6B]">
      Jurisdiction admin{member.jurisdiction ? ` · ${member.jurisdiction.code}` : ""}
    </Badge>
  );
}

export default function TeamSettingsPage() {
  const teamQuery = useTeamQuery();
  const jurisdictionsQuery = useJurisdictionsQuery();
  const jurisdictions = jurisdictionsQuery.data ?? [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingTeamInvitation | null>(null);

  const changeRole = useChangeAdminRoleMutation();
  const removeAdmin = useRemoveAdminMutation();
  const revokeInvitation = useRevokeInvitationMutation();

  const members = teamQuery.data?.members ?? [];
  const pendingInvitations = teamQuery.data?.pendingInvitations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2A6B] dark:text-[#C8D400]">Team</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage who has admin access, and which jurisdiction they manage.
          </p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl gap-1.5"
        >
          <UserPlus className="h-4 w-4" />
          Invite Admin
        </Button>
      </div>

      {teamQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : teamQuery.isError ? (
        <p className="text-sm text-red-500">Failed to load team members.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.clerkUserId}>
                  <TableCell className="font-medium">{memberName(m)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.identifier}</TableCell>
                  <TableCell><RoleBadge member={m} /></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs rounded-lg"
                      onClick={() => setEditTarget(m)}
                    >
                      {m.role ? "Change role" : "Set role"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs rounded-lg border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => setRemoveTarget(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">
                    No team members yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {pendingInvitations.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Pending Invitations
              </h2>
              <Table>
                <TableBody>
                  {pendingInvitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                      <TableCell>
                        {inv.requestedRole === "org_admin" ? (
                          <Badge className="bg-[#1B2A6B] text-white">Org admin</Badge>
                        ) : inv.requestedRole === "jurisdiction_admin" ? (
                          <Badge className="bg-[#C8D400] text-[#1B2A6B]">
                            Jurisdiction admin{inv.jurisdiction ? ` · ${inv.jurisdiction.code}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline">unknown role</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs rounded-lg border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => setRevokeTarget(inv)}
                          title="Revoke invitation"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <InviteAdminDialog open={inviteOpen} onOpenChange={setInviteOpen} jurisdictions={jurisdictions} />

      {/* Change-role fallback dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Set Role
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              {editTarget ? memberName(editTarget) : ""} — this only updates our records, it does not
              resend an invite. Use this if their role never got applied automatically.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <EditRoleForm
              member={editTarget}
              jurisdictions={jurisdictions}
              onSubmit={(role, jurisdictionId) => {
                changeRole.mutate(
                  { clerkUserId: editTarget.clerkUserId, role, jurisdictionId },
                  { onSuccess: () => setEditTarget(null) }
                );
              }}
              onCancel={() => setEditTarget(null)}
              saving={changeRole.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500">Remove Admin?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
              <strong className="text-foreground">{removeTarget ? memberName(removeTarget) : ""}</strong> will
              lose admin access and be removed from the organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              disabled={removeAdmin.isPending}
              onClick={() => {
                if (!removeTarget) return;
                removeAdmin.mutate(
                  { clerkUserId: removeTarget.clerkUserId },
                  { onSuccess: () => setRemoveTarget(null) }
                );
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs px-4 rounded-xl"
            >
              {removeAdmin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke invitation confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500">Revoke Invitation?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
              The invite link sent to <strong className="text-foreground">{revokeTarget?.email ?? ""}</strong> will
              stop working immediately. This cannot be undone — you&apos;ll need to send a new invite if you change
              your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              disabled={revokeInvitation.isPending}
              onClick={() => {
                if (!revokeTarget) return;
                revokeInvitation.mutate(
                  { invitationId: revokeTarget.id },
                  { onSuccess: () => setRevokeTarget(null) }
                );
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs px-4 rounded-xl"
            >
              {revokeInvitation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditRoleForm({
  member,
  jurisdictions,
  onSubmit,
  onCancel,
  saving,
}: {
  member: TeamMember;
  jurisdictions: { id: string; code: string; name: string }[];
  onSubmit: (role: "org_admin" | "jurisdiction_admin", jurisdictionId: string | null) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [role, setRole] = useState<"org_admin" | "jurisdiction_admin">(member.role ?? "jurisdiction_admin");
  const [jurisdictionId, setJurisdictionId] = useState<string | null>(member.jurisdiction?.id ?? null);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Role</label>
        <Select value={role} onValueChange={(v) => setRole(v as "org_admin" | "jurisdiction_admin")}>
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
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">State</label>
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
      <DialogFooter className="gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="border-border text-muted-foreground text-xs rounded-xl">
          Cancel
        </Button>
        <Button
          disabled={saving || (role === "jurisdiction_admin" && !jurisdictionId)}
          onClick={() => onSubmit(role, role === "jurisdiction_admin" ? jurisdictionId : null)}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </div>
  );
}
