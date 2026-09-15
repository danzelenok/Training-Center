"use client";

import { useState } from "react";
import { Loader2, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkersQuery, useJobRolesQuery } from "@/hooks/admin/workers/queries";
import { RoleMultiSelect } from "@/components/admin/RoleMultiSelect";
import { usePublishCourseMutation, type PublishCourseResult } from "@/hooks/admin/course-editor/mutations";

interface PublishCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  // "publish": first Go Live for a draft course — creates run #1.
  // "relaunch": "Relaunch" on an already-published course —
  // creates a new course_runs row and a fresh set of assignments/due dates
  // for whoever the audience picker below resolves to this time, without
  // touching older runs' assignments/progress (see
  // app/api/courses/[id]/publish/route.ts). A plain re-notification of the
  // CURRENT run with no new run is a different, separate action — see
  // the "Resend" button next to this one, backed by
  // app/api/courses/[id]/resend/route.ts.
  mode: "publish" | "relaunch";
  // When the caller needs the published course's fields reflected somewhere
  // other than the courses list — e.g. the course editor's own local state,
  // which must NOT go through a ["course", id] invalidate (that would reset
  // the editor's active slide back to 0) — pass this instead of relying on
  // the default `invalidateQueries(["courses"])`. When provided, it fully
  // replaces the default invalidate; the caller owns refreshing whatever it
  // needs refreshed.
  onPublishSuccess?: (result: PublishCourseResult) => void;
  // Roles currently linked to this course (course_roles — the effective
  // scope from the last run) — used to seed the roles dropdown for a
  // relaunch instead of always starting from "All roles", per the spec's
  // "prefilled with the last run's roles".
  initialRoleIds?: string[];
  // The course's owner jurisdiction — the "Specific workers" list must only
  // ever offer workers from this jurisdiction, same scope the "All current
  // workers in this jurisdiction" option already enforces server-side.
  courseJurisdictionId?: string | null;
}

export function PublishCourseDialog({ open, onOpenChange, courseId, mode, onPublishSuccess, initialRoleIds, courseJurisdictionId }: PublishCourseDialogProps) {
  const queryClient = useQueryClient();
  const workersQuery = useWorkersQuery();
  const jobRolesQuery = useJobRolesQuery();
  const publishMutation = usePublishCourseMutation(courseId ?? "");
  const isRelaunch = mode === "relaunch";

  const [assignTo, setAssignTo] = useState<"all" | "specific">("all");
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset the form each time the dialog transitions from closed to open
  // (adjust-during-render, not an effect — same pattern as the picker dialogs
  // in components/admin/workers/*PickerDialog.tsx).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAssignTo("all");
      setWorkerIds([]);
      setRoleIds(initialRoleIds ?? []);
      setNotifyTelegram(true);
    }
  }

  const workersList = (workersQuery.data?.workers ?? [])
    .filter((w) => w.active && (!courseJurisdictionId || w.jurisdictionId === courseJurisdictionId))
    .map((w) => ({
      id: w.id,
      label: w.displayName || [w.firstName, w.lastName].filter(Boolean).join(" ") || w.telegramUsername || w.telegramUserId || "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const pickersLoading = workersQuery.isLoading;
  const jobRolesList = jobRolesQuery.data ?? [];

  const handleConfirm = async () => {
    if (!courseId) return;
    const toastMsg = isRelaunch
      ? (notifyTelegram ? "Starting a new run & notifying assigned workers…" : "Starting a new run…")
      : (notifyTelegram ? "Publishing & sending direct messages to workers…" : "Publishing course…");
    const toastId = toast.loading(toastMsg);
    try {
      const data = await publishMutation.mutateAsync({
        assignTo,
        workerIds: assignTo === "specific" ? workerIds : [],
        roleIds: assignTo === "all" ? roleIds : [],
        notifyWorkers: notifyTelegram,
      });
      if (onPublishSuccess) {
        onPublishSuccess(data);
      } else {
        queryClient.invalidateQueries({ queryKey: ["courses"] });
      }
      const successMsg = isRelaunch
        ? "New run published! Assigned workers notified."
        : notifyTelegram
          ? "Course is LIVE! Direct messages sent to assigned workers."
          : "Course published without announcements.";
      toast.success(successMsg, { id: toastId });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Publishing failed", { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            {isRelaunch ? "Relaunch Course" : "Publish Course"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            {isRelaunch
              ? "Starts a new run of this course — past completions stay on record separately. Review who should be assigned this run, then confirm."
              : "Choose who can see this course and whether to post an announcement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Assign to
            </p>
            <RadioGroup
              value={assignTo}
              onValueChange={(v) => setAssignTo(v as "all" | "specific")}
              className="space-y-2"
            >
              <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="all" className="mt-0.5" />
                <div className="w-full">
                  <p className="text-xs font-bold text-foreground">All current workers in this jurisdiction</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Every worker in this course&apos;s jurisdiction gets access immediately (optionally restrict to specific roles below). Future workers who match will also be auto-assigned.
                  </p>
                  {assignTo === "all" && (
                    <div className="mt-3">
                      <RoleMultiSelect
                        roles={jobRolesList}
                        selectedIds={roleIds}
                        onToggle={(roleId, checked) =>
                          setRoleIds((prev) =>
                            checked ? [...prev, roleId] : prev.filter((x) => x !== roleId)
                          )
                        }
                        placeholder="All roles"
                      />
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="specific" className="mt-0.5" />
                <div className="w-full">
                  <p className="text-xs font-bold text-foreground">Specific workers</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Only the workers you select below will see this course.
                  </p>
                  {assignTo === "specific" && (
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-1 pr-1">
                      {pickersLoading ? (
                        <p className="text-[10px] text-muted-foreground">Loading workers…</p>
                      ) : workersList.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">No registered workers yet.</p>
                      ) : (
                        workersList.map((w) => (
                          <label key={w.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={workerIds.includes(w.id)}
                              onCheckedChange={(checked) =>
                                setWorkerIds((prev) =>
                                  checked ? [...prev, w.id] : prev.filter((x) => x !== w.id)
                                )
                              }
                            />
                            <span className="text-xs text-foreground">{w.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">Send announcement via DM to assigned workers</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Sends a direct Telegram message with a &ldquo;Start Learning&rdquo; button to each assigned worker.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifyTelegram}
              onClick={() => setNotifyTelegram(!notifyTelegram)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                notifyTelegram ? "bg-[#C8D400]" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  notifyTelegram ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:text-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={publishMutation.isPending || (assignTo === "specific" && workerIds.length === 0)}
            className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold border-0 text-xs px-4"
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : isRelaunch ? (
              <RotateCcw className="h-4 w-4 mr-1.5" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {isRelaunch ? "Start New Run" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
