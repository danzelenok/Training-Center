"use client";

import React, { useState, useEffect } from "react";
import { Users2, Plus, Loader2, Pencil, Trash2, X, Check, UsersRound, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Team {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

interface WorkerOption {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
}

export default function TeamsPage() {
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [activeWorkers, setActiveWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [renamingTeamId, setRenamingTeamId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [rosterSheetOpen, setRosterSheetOpen] = useState(false);
  const [rosterTeam, setRosterTeam] = useState<Team | null>(null);
  const [rosterMemberIds, setRosterMemberIds] = useState<string[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");

  const workerName = (w: WorkerOption) =>
    w.displayName || [w.firstName, w.lastName].filter(Boolean).join(" ") || "Unnamed Worker";

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      setTeamsList(data);
    } catch (err: any) {
      toast.error(err.message || "Could not load teams");
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      if (!res.ok) throw new Error("Failed to fetch workers");
      const data = await res.json();
      setActiveWorkers((data.workers || []).filter((w: WorkerOption) => w.active));
    } catch (err: any) {
      toast.error(err.message || "Could not load workers");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTeams(), fetchWorkers()]);
      setLoading(false);
    };
    init();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }
    setCreatingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team");

      setCreateModalOpen(false);
      setNewTeamName("");
      await fetchTeams();
      toast.success("Team created");
      await openRoster(data);
    } catch (err: any) {
      toast.error(err.message || "Error creating team");
    } finally {
      setCreatingTeam(false);
    }
  };

  const startRename = (team: Team) => {
    setRenamingTeamId(team.id);
    setRenameValue(team.name);
  };

  const handleSaveRename = async (teamId: string) => {
    if (!renameValue.trim()) {
      toast.error("Team name cannot be empty");
      return;
    }
    setSavingRename(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename team");

      setRenamingTeamId(null);
      await fetchTeams();
      toast.success("Team renamed");
    } catch (err: any) {
      toast.error(err.message || "Could not rename team");
    } finally {
      setSavingRename(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTeam) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${deletingTeam.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
      setDeletingTeam(null);
      await fetchTeams();
      toast.success("Team deleted");
    } catch (err: any) {
      toast.error(err.message || "Could not delete team");
    } finally {
      setDeleting(false);
    }
  };

  const openRoster = async (team: Team) => {
    setRosterTeam(team);
    setRosterSheetOpen(true);
    setRosterSearch("");
    setLoadingRoster(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`);
      if (!res.ok) throw new Error("Failed to fetch team roster");
      const data = await res.json();
      setRosterMemberIds((data.members || []).map((m: { id: string }) => m.id));
    } catch (err: any) {
      toast.error(err.message || "Could not load team roster");
      setRosterSheetOpen(false);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleToggleRosterMember = async (workerId: string, checked: boolean) => {
    if (!rosterTeam) return;
    const nextIds = checked
      ? [...rosterMemberIds, workerId]
      : rosterMemberIds.filter((id) => id !== workerId);

    setSavingRoster(true);
    try {
      const res = await fetch(`/api/teams/${rosterTeam.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerIds: nextIds }),
      });
      if (!res.ok) throw new Error("Failed to update roster");

      setRosterMemberIds(nextIds);
      await fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Could not update roster");
    } finally {
      setSavingRoster(false);
    }
  };

  const filteredRosterWorkers = activeWorkers.filter((w) =>
    workerName(w).toLowerCase().includes(rosterSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Teams
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Group workers into teams so courses can be published to a whole team at once.
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold shadow-lg shadow-[#C8D400]/10 rounded-xl text-xs h-10 px-4 gap-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
              <p className="text-sm font-medium">Fetching teams...</p>
            </div>
          ) : teamsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <Users2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No teams yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Click &ldquo;New Team&rdquo; above to create your first team.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Members</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamsList.map((team) => (
                  <tr key={team.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">
                      {renamingTeamId === team.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            className="h-8 text-xs bg-background border-border rounded-lg w-40"
                          />
                          <button
                            onClick={() => handleSaveRename(team.id)}
                            disabled={savingRename}
                            className="p-1 rounded-lg hover:bg-muted text-emerald-500"
                          >
                            {savingRename ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setRenamingTeamId(null)}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        team.name
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openRoster(team)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground font-semibold text-xs border border-border cursor-pointer transition-colors"
                      >
                        <UsersRound className="h-3 w-3" />
                        {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {format(new Date(team.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startRename(team)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Rename team"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTeam(team)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete team"
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

      {/* Create Team Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleCreateTeam}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
                New Team
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-1">
                Give the team a name, then add its members on the next step.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Team Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Crew A"
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
                disabled={creatingTeam}
                className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
              >
                {creatingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">Delete Team?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
              This removes <strong className="text-foreground">{deletingTeam?.name}</strong> and its
              roster. Workers keep any courses already assigned to them — their training history is
              not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingTeam(null)}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white font-extrabold text-xs px-4 rounded-xl"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster Sheet */}
      <Sheet open={rosterSheetOpen} onOpenChange={setRosterSheetOpen}>
        <SheetContent
          className="w-full sm:max-w-lg overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold text-[#1B2A6B] dark:text-[#C8D400]">
              {rosterTeam?.name}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Select which active workers belong to this team. Removing a worker here does not
              affect courses already assigned to them.
            </SheetDescription>
          </SheetHeader>

          {loadingRoster ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
              <p className="text-sm">Loading roster...</p>
            </div>
          ) : (
            <div className="mt-4 px-4 pb-6 space-y-3">
              {activeWorkers.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search workers..."
                    className="bg-background border-border text-foreground text-xs h-9 rounded-xl pl-8"
                  />
                </div>
              )}
              <div className="space-y-2">
                {activeWorkers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No active workers to add.
                  </div>
                ) : filteredRosterWorkers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No workers match your search.
                  </div>
                ) : (
                  filteredRosterWorkers.map((w) => {
                    const checked = rosterMemberIds.includes(w.id);
                    return (
                      <label
                        key={w.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? "border-[#C8D400]/50 bg-[#C8D400]/10" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={savingRoster}
                          onCheckedChange={(v) => handleToggleRosterMember(w.id, v === true)}
                        />
                        <span className="text-xs font-medium text-foreground">{workerName(w)}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
