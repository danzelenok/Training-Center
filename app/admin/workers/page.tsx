"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import { normalizePhone } from "@/lib/phone";
import { useWorkersQuery, useCoursesQuery, useJurisdictionsQuery, useJobRolesQuery } from "@/hooks/admin/workers/queries";
import { useMeQuery } from "@/hooks/admin/useMeQuery";
import {
  useCreateWorkerMutation,
  useReissueInviteMutation,
  useUnbindWorkerMutation,
  useToggleWorkerActiveMutation,
  useAssignCourseMutation,
} from "@/hooks/admin/workers/mutations";
import { workerDisplayName, type Worker } from "@/hooks/admin/workers/types";
import { WorkersStatsCards } from "@/components/admin/workers/WorkersStatsCards";
import { WorkersTable } from "@/components/admin/workers/WorkersTable";
import { AddWorkerDialog } from "@/components/admin/workers/AddWorkerDialog";
import { DuplicateWorkerDialog } from "@/components/admin/workers/DuplicateWorkerDialog";
import { InviteLinkDialog } from "@/components/admin/workers/InviteLinkDialog";
import { UnbindConfirmDialog } from "@/components/admin/workers/UnbindConfirmDialog";
import { ManagerPickerDialog } from "@/components/admin/workers/ManagerPickerDialog";
import { JurisdictionPickerDialog } from "@/components/admin/workers/JurisdictionPickerDialog";
import { WorkerDetailSheet } from "@/components/admin/workers/WorkerDetailSheet";

export default function WorkersPage() {
  const workersQuery = useWorkersQuery();
  const coursesQuery = useCoursesQuery();
  const jurisdictionsQuery = useJurisdictionsQuery();
  const jobRolesQuery = useJobRolesQuery();
  const meQuery = useMeQuery();
  const me = meQuery.data;
  const workersList = workersQuery.data?.workers ?? [];
  const publishedCourses = coursesQuery.data ?? [];
  const jurisdictionsList = jurisdictionsQuery.data ?? [];
  const jobRolesList = jobRolesQuery.data ?? [];
  const lockedJurisdiction = me?.role === "jurisdiction_admin" ? me.jurisdiction ?? null : null;

  const createWorker = useCreateWorkerMutation();
  const reissueInvite = useReissueInviteMutation();
  const unbindWorker = useUnbindWorkerMutation();
  const toggleActive = useToggleWorkerActiveMutation();
  const assignCourse = useAssignCourseMutation();

  // Worker creation modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [newWorkerManagerId, setNewWorkerManagerId] = useState<string | null>(null);
  const [newWorkerJurisdictionId, setNewWorkerJurisdictionId] = useState<string | null>(null);
  const [newWorkerRoleId, setNewWorkerRoleId] = useState<string | null>(null);

  // Possible-duplicate warning shown before creating a new worker
  const [duplicateCandidate, setDuplicateCandidate] = useState<Worker | null>(null);

  // Generated invite link modal — shared by create / reissue / unbind flows
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [activeInviteUrl, setActiveInviteUrl] = useState("");
  const [activeInviteWorkerName, setActiveInviteWorkerName] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Unbind warning modal
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [unbindTargetWorker, setUnbindTargetWorker] = useState<Worker | null>(null);

  // Worker detail sheet (pickers opened from within the sheet)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [jurisdictionPickerOpen, setJurisdictionPickerOpen] = useState(false);

  const openInviteModal = (name: string, url: string) => {
    setActiveInviteWorkerName(name);
    setActiveInviteUrl(url);
    setCopiedLink(false);
    setLinkModalOpen(true);
  };

  const openWorkerDetail = (worker: Worker) => {
    setSelectedWorkerId(worker.id);
    setSheetOpen(true);
  };

  // Loosely matches on name (token order ignored) or normalized phone, so a
  // returning worker re-entered as "Last First" instead of "First Last" is still caught.
  const findPossibleDuplicate = (name: string, phone: string): Worker | null => {
    const inputTokens = name.toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    if (!inputTokens && !normalizedPhone) return null;

    return (
      workersList.find((w) => {
        const wTokens = workerDisplayName(w).toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");
        const nameMatches = inputTokens.length > 0 && wTokens === inputTokens;
        const phoneMatches = normalizedPhone !== null && w.phone === normalizedPhone;
        return nameMatches || phoneMatches;
      }) ?? null
    );
  };

  const performCreateWorker = () => {
    createWorker.mutate(
      {
        name: newWorkerName.trim(),
        phone: newWorkerPhone.trim(),
        managerId: newWorkerManagerId,
        // The API ignores this for a jurisdiction_admin anyway (forces their
        // own jurisdiction), but send the real value rather than whatever's
        // left in state from a picker they can't see.
        jurisdictionId: lockedJurisdiction ? lockedJurisdiction.id : newWorkerJurisdictionId,
        roleId: newWorkerRoleId,
      },
      {
        onSuccess: (data) => {
          setCreateModalOpen(false);
          openInviteModal(data.worker.displayName || newWorkerName, data.inviteUrl);
          setNewWorkerName("");
          setNewWorkerPhone("");
          setNewWorkerManagerId(null);
          setNewWorkerJurisdictionId(null);
          setNewWorkerRoleId(null);
        },
      }
    );
  };

  const handleCreateWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) {
      toast.error("Please enter worker name");
      return;
    }
    if (!lockedJurisdiction && jurisdictionsList.length > 0 && !newWorkerJurisdictionId) {
      toast.error("Please select a state");
      return;
    }
    const duplicate = findPossibleDuplicate(newWorkerName.trim(), newWorkerPhone.trim());
    if (duplicate) {
      setDuplicateCandidate(duplicate);
      return;
    }
    performCreateWorker();
  };

  const handleCreateAnyway = () => {
    setDuplicateCandidate(null);
    performCreateWorker();
  };

  const handleReactivateDuplicate = () => {
    if (!duplicateCandidate) return;
    toggleActive.mutate({ workerId: duplicateCandidate.id, nextActive: !duplicateCandidate.active });
    setDuplicateCandidate(null);
    setCreateModalOpen(false);
    setNewWorkerName("");
    setNewWorkerPhone("");
    setNewWorkerManagerId(null);
    setNewWorkerJurisdictionId(null);
    setNewWorkerRoleId(null);
  };

  const handleViewDuplicate = () => {
    if (!duplicateCandidate) return;
    const worker = duplicateCandidate;
    setDuplicateCandidate(null);
    setCreateModalOpen(false);
    openWorkerDetail(worker);
  };

  const handleReissueInvite = (worker: Worker) => {
    reissueInvite.mutate(
      { workerId: worker.id },
      { onSuccess: (data) => openInviteModal(workerDisplayName(worker), data.inviteUrl) }
    );
  };

  const handleOpenUnbindConfirm = (worker: Worker) => {
    setUnbindTargetWorker(worker);
    setUnbindConfirmOpen(true);
  };

  const handleConfirmUnbind = () => {
    if (!unbindTargetWorker) return;
    const worker = unbindTargetWorker;
    unbindWorker.mutate(
      { workerId: worker.id },
      {
        onSuccess: (data) => {
          setUnbindConfirmOpen(false);
          openInviteModal(workerDisplayName(worker), data.inviteUrl);
          setUnbindTargetWorker(null);
        },
      }
    );
  };

  const handleCopyLink = () => {
    if (!activeInviteUrl) return;
    navigator.clipboard.writeText(activeInviteUrl);
    setCopiedLink(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleToggleActive = (worker: Worker) => {
    toggleActive.mutate({ workerId: worker.id, nextActive: !worker.active });
  };

  const handleAssignCourse = (workerId: string, courseId: string) => {
    assignCourse.mutate({ workerId, courseId });
  };

  const assigningWorkerId = assignCourse.isPending ? assignCourse.variables?.workerId ?? null : null;
  const reissuingWorkerId = reissueInvite.isPending ? reissueInvite.variables?.workerId ?? null : null;
  const togglingActiveId = toggleActive.isPending ? toggleActive.variables?.workerId ?? null : null;

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Workers Management
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Manage worker records, generate personal Telegram invite links, and track course assignments.
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold shadow-lg shadow-[#C8D400]/10 rounded-xl text-xs h-10 px-4 gap-2 cursor-pointer shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Add Worker
        </Button>
      </div>

      <WorkersStatsCards
        loading={workersQuery.isLoading}
        totalEnrolled={workersQuery.data?.totalCount ?? 0}
        activeThisWeek={workersQuery.data?.activeThisWeek ?? 0}
        pendingModules={workersQuery.data?.pendingModules ?? 0}
      />

      <WorkersTable
        workers={workersList}
        loading={workersQuery.isLoading}
        deactivatedCount={workersQuery.data?.deactivatedCount ?? 0}
        publishedCourses={publishedCourses}
        jurisdictions={jurisdictionsList}
        assigningWorkerId={assigningWorkerId}
        reissuingWorkerId={reissuingWorkerId}
        togglingActiveId={togglingActiveId}
        onOpenWorkerDetail={openWorkerDetail}
        onAssignCourse={handleAssignCourse}
        onReissueInvite={handleReissueInvite}
        onOpenUnbindConfirm={handleOpenUnbindConfirm}
        onToggleActive={handleToggleActive}
      />

      <AddWorkerDialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        name={newWorkerName}
        phone={newWorkerPhone}
        onNameChange={setNewWorkerName}
        onPhoneChange={setNewWorkerPhone}
        onSubmit={handleCreateWorkerSubmit}
        creating={createWorker.isPending}
        managerCandidates={workersList.filter((w) => w.active)}
        managerId={newWorkerManagerId}
        onManagerChange={setNewWorkerManagerId}
        jurisdictions={jurisdictionsList}
        jurisdictionId={newWorkerJurisdictionId}
        onJurisdictionChange={setNewWorkerJurisdictionId}
        lockedJurisdiction={lockedJurisdiction}
        jobRoles={jobRolesList}
        roleId={newWorkerRoleId}
        onRoleChange={setNewWorkerRoleId}
      />

      <DuplicateWorkerDialog
        candidate={duplicateCandidate}
        onOpenChange={(open) => !open && setDuplicateCandidate(null)}
        onReactivate={handleReactivateDuplicate}
        onViewExisting={handleViewDuplicate}
        onCancel={() => setDuplicateCandidate(null)}
        onCreateAnyway={handleCreateAnyway}
        creating={createWorker.isPending}
      />

      <InviteLinkDialog
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        workerName={activeInviteWorkerName}
        inviteUrl={activeInviteUrl}
        copied={copiedLink}
        onCopy={handleCopyLink}
      />

      <UnbindConfirmDialog
        open={unbindConfirmOpen}
        onOpenChange={(open) => {
          setUnbindConfirmOpen(open);
          if (!open) setUnbindTargetWorker(null);
        }}
        targetWorker={unbindTargetWorker}
        onConfirm={handleConfirmUnbind}
        unbinding={unbindWorker.isPending}
      />

      <ManagerPickerDialog
        open={managerPickerOpen}
        onOpenChange={setManagerPickerOpen}
        workerId={selectedWorkerId}
      />

      <JurisdictionPickerDialog
        open={jurisdictionPickerOpen}
        onOpenChange={setJurisdictionPickerOpen}
        workerId={selectedWorkerId}
      />

      <WorkerDetailSheet
        workerId={selectedWorkerId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        publishedCourses={publishedCourses}
        reissuingWorkerId={reissuingWorkerId}
        onReissueInvite={handleReissueInvite}
        togglingActiveId={togglingActiveId}
        onToggleActive={handleToggleActive}
        assigningWorkerId={assigningWorkerId}
        onAssignCourse={handleAssignCourse}
        onOpenUnbindConfirm={handleOpenUnbindConfirm}
        onOpenManagerPicker={() => setManagerPickerOpen(true)}
        onOpenJurisdictionPicker={() => setJurisdictionPickerOpen(true)}
      />
    </div>
  );
}
