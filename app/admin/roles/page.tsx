"use client";

import React, { useState } from "react";
import { Briefcase, Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useJobRolesQuery } from "@/hooks/admin/workers/queries";
import {
  useCreateJobRoleMutation,
  useRenameJobRoleMutation,
  useDeleteJobRoleMutation,
} from "@/hooks/admin/jobRoles/mutations";

interface JobRole {
  id: string;
  name: string;
  createdAt: string;
}

export default function RolesPage() {
  const jobRolesQuery = useJobRolesQuery();
  const rolesList = (jobRolesQuery.data ?? []) as JobRole[];
  const loading = jobRolesQuery.isLoading;

  const createRoleMutation = useCreateJobRoleMutation();
  const renameRoleMutation = useRenameJobRoleMutation();
  const deleteRoleMutation = useDeleteJobRoleMutation();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const [renamingRoleId, setRenamingRoleId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deletingRole, setDeletingRole] = useState<JobRole | null>(null);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }
    try {
      await createRoleMutation.mutateAsync(newRoleName.trim());
      setCreateModalOpen(false);
      setNewRoleName("");
      toast.success("Role created");
    } catch (err: any) {
      toast.error(err.message || "Error creating role");
    }
  };

  const startRename = (role: JobRole) => {
    setRenamingRoleId(role.id);
    setRenameValue(role.name);
  };

  const handleSaveRename = async (roleId: string) => {
    if (!renameValue.trim()) {
      toast.error("Role name cannot be empty");
      return;
    }
    try {
      await renameRoleMutation.mutateAsync({ roleId, name: renameValue.trim() });
      setRenamingRoleId(null);
      toast.success("Role renamed");
    } catch (err: any) {
      toast.error(err.message || "Could not rename role");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteRoleMutation.mutateAsync(deletingRole.id);
      setDeletingRole(null);
      toast.success("Role deleted");
    } catch (err: any) {
      toast.error(err.message || "Could not delete role");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Job Roles
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Manage the organization&apos;s job roles. Workers and courses can be linked to a role.
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold shadow-lg shadow-[#C8D400]/10 rounded-xl text-xs h-10 px-4 gap-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Role
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
              <p className="text-sm font-medium">Fetching roles...</p>
            </div>
          ) : rolesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <Briefcase className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No roles yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Click &ldquo;New Role&rdquo; above to create your first job role.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rolesList.map((role) => (
                  <tr key={role.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">
                      {renamingRoleId === role.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            className="h-8 text-xs bg-background border-border rounded-lg w-40"
                          />
                          <button
                            onClick={() => handleSaveRename(role.id)}
                            disabled={renameRoleMutation.isPending}
                            className="p-1 rounded-lg hover:bg-muted text-emerald-500"
                          >
                            {renameRoleMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setRenamingRoleId(null)}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        role.name
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {format(new Date(role.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startRename(role)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Rename role"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingRole(role)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete role"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleCreateRole}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
                New Role
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-1">
                Give the role a name. You can assign it to workers and courses afterward.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Role Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Forklift Operator"
                  className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="border-border text-muted-foreground text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending}
                className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
              >
                {createRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">Delete Role?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
              This removes <strong className="text-foreground">{deletingRole?.name}</strong>. Any
              worker or course currently linked to it just loses the reference — nothing else about
              them is affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingRole(null)}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteRoleMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white font-extrabold text-xs px-4 rounded-xl"
            >
              {deleteRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
