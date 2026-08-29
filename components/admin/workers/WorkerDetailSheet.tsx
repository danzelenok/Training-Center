import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Loader2,
  Pencil,
  Printer,
  X,
  UserX,
  UserCheck,
  CheckCircle,
  Clock,
  UserCog,
  MapPin,
  BookOpen,
  Trophy,
  Layers,
  MessageSquare,
  Star,
  Trash2,
  CheckCheck,
  RefreshCw,
  Unlink,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhoneDisplay, formatPhoneInput } from "@/lib/phone";
import { useWorkerDetailQuery, useJobRolesQuery } from "@/hooks/admin/workers/queries";
import { useMeQuery } from "@/hooks/admin/useMeQuery";
import {
  useSaveWorkerEditMutation,
  useRemoveCourseMutation,
  useMarkCompletedMutation,
  useDeleteWorkerMutation,
  useUpdateWorkerRoleMutation,
} from "@/hooks/admin/workers/mutations";
import { workerDisplayName, type Worker, type Course, type WorkerDetail } from "@/hooks/admin/workers/types";
import { STATUS_CONFIG } from "./status-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_ROLE = "__none__";

const EMPLOYMENT_EVENT_LABELS: Record<string, string> = {
  hired: "Hired",
  role_changed: "Role Changed",
  deactivated: "Deactivated",
  reactivated: "Reactivated",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printWorkerReport(worker: WorkerDetail) {
  const name = escapeHtml(workerDisplayName(worker));
  const created = format(new Date(worker.createdAt), "dd MMM yyyy");
  const deactivated = worker.deactivatedAt
    ? format(new Date(worker.deactivatedAt), "dd MMM yyyy")
    : null;
  const completedCount = worker.courses.filter((c) => c.status === "completed").length;

  const historyRows = worker.employmentHistory
    .map((e) => {
      const label = EMPLOYMENT_EVENT_LABELS[e.eventType] ?? e.eventType;
      const detail = e.newRoleName ? ` (${escapeHtml(e.newRoleName)})` : "";
      return `<tr><td>${label}${detail}</td><td>${format(new Date(e.eventDate), "dd MMM yyyy")}</td></tr>`;
    })
    .join("");

  const rows = worker.courses
    .map((c) => {
      const cfg = STATUS_CONFIG[c.status];
      return `<tr>
        <td>${escapeHtml(c.courseTitle)}</td>
        <td>${cfg.label}</td>
        <td>${format(new Date(c.assignedAt), "dd MMM yyyy")}</td>
        <td>${c.completedAt ? format(new Date(c.completedAt), "dd MMM yyyy") : "—"}</td>
        <td>${c.quizScore !== null ? `${c.quizScore}%` : "—"}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Worker Report - ${name}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
  .meta div { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; text-align: left; }
  th { background: #f2f2f2; }
</style>
</head>
<body>
  <h1>Worker Report — ${name}</h1>
  <div class="meta">
    <div>Created: ${created}</div>
    <div>Status: ${worker.active ? "Active" : `Deactivated${deactivated ? ` on ${deactivated}` : ""}`}</div>
    <div>Courses assigned: ${worker.courses.length} &middot; Completed: ${completedCount}</div>
  </div>
  <h2>Employment History</h2>
  <table>
    <thead>
      <tr><th>Event</th><th>Date</th></tr>
    </thead>
    <tbody>
      ${historyRows}
    </tbody>
  </table>
  <h2>Courses</h2>
  <table>
    <thead>
      <tr><th>Course</th><th>Status</th><th>Assigned</th><th>Completed</th><th>Quiz Score</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5" style="text-align:center;color:#888;">No courses assigned</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  const reportWindow = window.open("", "_blank", "width=800,height=900");
  if (!reportWindow) {
    toast.error("Please allow pop-ups to print the worker report.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  setTimeout(() => reportWindow.print(), 250);
}

interface WorkerDetailSheetProps {
  workerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishedCourses: Course[];
  reissuingWorkerId: string | null;
  onReissueInvite: (worker: Worker) => void;
  togglingActiveId: string | null;
  onToggleActive: (worker: Worker) => void;
  assigningWorkerId: string | null;
  onAssignCourse: (workerId: string, courseId: string) => void;
  onOpenUnbindConfirm: (worker: Worker) => void;
  onOpenManagerPicker: () => void;
  onOpenJurisdictionPicker: () => void;
}

export function WorkerDetailSheet({
  workerId,
  open,
  onOpenChange,
  publishedCourses,
  reissuingWorkerId,
  onReissueInvite,
  togglingActiveId,
  onToggleActive,
  assigningWorkerId,
  onAssignCourse,
  onOpenUnbindConfirm,
  onOpenManagerPicker,
  onOpenJurisdictionPicker,
}: WorkerDetailSheetProps) {
  const { data: worker, isLoading: loadingDetail } = useWorkerDetailQuery(workerId);
  const { data: me } = useMeQuery();
  // Same rule the courses list uses to hide write actions for a course owned
  // by another jurisdiction: jurisdiction_admin can only write workers whose
  // jurisdiction matches their own, org_admin is unrestricted. Every mutation
  // this sheet can trigger (rename, deactivate, reissue/unbind, manager,
  // course assignment, delete) now 403s server-side for a foreign
  // worker too (see app/api/workers/[id], .../assign, .../invites, .../unbind,
  // app/api/reports/[id]) — this just keeps the UI from offering a button
  // that would only ever fail.
  const canEdit =
    !!worker && (me?.role === "org_admin" || (me?.role === "jurisdiction_admin" && worker.jurisdiction?.id === me.jurisdiction?.id));
  // A jurisdiction_admin's state is fixed — the picker can only ever no-op
  // for them (see JurisdictionPickerDialog/app/api/workers/[id] route), so
  // don't offer it at all rather than show an edit control that quietly
  // does nothing useful.
  const canEditJurisdiction = me?.role !== "jurisdiction_admin";

  const [editingWorker, setEditingWorker] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editingRole, setEditingRole] = useState(false);

  const saveEdit = useSaveWorkerEditMutation();
  const removeCourse = useRemoveCourseMutation();
  const markCompleted = useMarkCompletedMutation();
  const deleteWorker = useDeleteWorkerMutation();
  const updateRole = useUpdateWorkerRoleMutation();
  const { data: jobRoles = [] } = useJobRolesQuery();

  const startEditingWorker = () => {
    if (!worker) return;
    setEditName(workerDisplayName(worker));
    setEditPhone(worker.phone ? formatPhoneInput(worker.phone) : "");
    setEditingWorker(true);
  };

  const handleSaveWorkerEdit = () => {
    if (!worker) return;
    if (!editName.trim()) {
      toast.error("Please enter worker name");
      return;
    }
    saveEdit.mutate(
      { workerId: worker.id, name: editName.trim(), phone: editPhone.trim() },
      { onSuccess: () => setEditingWorker(false) }
    );
  };

  const handleRemoveCourse = (assignmentId: string) => {
    if (!worker) return;
    removeCourse.mutate({ assignmentId, workerId: worker.id });
  };

  const handleMarkCompleted = (progressId: string | null, assignmentId: string) => {
    if (!worker) return;
    markCompleted.mutate({ progressId, assignmentId, workerId: worker.id });
  };

  const handleRoleChange = (roleId: string) => {
    if (!worker) return;
    updateRole.mutate(
      { workerId: worker.id, roleId: roleId === NO_ROLE ? null : roleId },
      { onSuccess: () => setEditingRole(false) }
    );
  };

  const handleDeleteWorker = () => {
    if (!worker) return;
    if (!window.confirm(`Delete ${workerDisplayName(worker)}? This cannot be undone.`)) return;
    deleteWorker.mutate({ workerId: worker.id }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          {editingWorker && worker ? (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Full Name
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="bg-background border-border text-foreground text-xs h-9 rounded-xl"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Phone Number
                </label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))}
                  placeholder="(555) 123-4567"
                  className="bg-background border-border text-foreground text-xs h-9 rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSaveWorkerEdit}
                  disabled={saveEdit.isPending}
                  className="flex-1 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl gap-1.5"
                >
                  {saveEdit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingWorker(false)}
                  disabled={saveEdit.isPending}
                  className="border-border text-muted-foreground text-xs rounded-xl gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <SheetTitle className="text-xl font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
              {worker ? workerDisplayName(worker) : "Loading..."}
              {worker && canEdit && (
                <button
                  onClick={startEditingWorker}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit worker"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {worker && (
                <button
                  onClick={() => printWorkerReport(worker)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Print / save worker report"
                >
                  <Printer className="h-4 w-4" />
                </button>
              )}
            </SheetTitle>
          )}
          {worker && !editingWorker && (
            <SheetDescription className="text-sm text-muted-foreground space-y-1">
              {worker.phone && (
                <span className="block font-normal text-foreground">Phone: {formatPhoneDisplay(worker.phone)}</span>
              )}
              <div className="pt-1 flex flex-wrap gap-1.5">
                {!canEdit && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-xs font-bold">
                    <MapPin className="h-3.5 w-3.5" /> Read-only — another jurisdiction
                  </span>
                )}
                {!worker.active && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold">
                    <UserX className="h-3.5 w-3.5" /> Deactivated
                  </span>
                )}
                {worker.telegramUserId ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                    <CheckCircle className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5" /> Not Connected
                  </span>
                )}
              </div>
              <span className="block text-xs pt-1">
                Created {format(new Date(worker.createdAt), "dd MMM yyyy")}
                {!worker.active && worker.deactivatedAt && (
                  <> &middot; Deactivated {format(new Date(worker.deactivatedAt), "dd MMM yyyy")}</>
                )}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
            <p className="text-sm">Loading worker details...</p>
          </div>
        ) : worker ? (
          <div className="flex flex-col gap-6 mt-4 px-4 pb-6">

            {/* Action bar for invites */}
            {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReissueInvite(worker)}
                disabled={reissuingWorkerId === worker.id}
                className="flex-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 font-bold text-xs gap-1.5 rounded-xl"
              >
                {reissuingWorkerId === worker.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Reissue Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenUnbindConfirm(worker)}
                className="flex-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 font-bold text-xs gap-1.5 rounded-xl"
              >
                <Unlink className="h-3.5 w-3.5" />
                Reset Telegram
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleActive(worker)}
                disabled={togglingActiveId === worker.id}
                className={`flex-1 font-bold text-xs gap-1.5 rounded-xl ${
                  worker.active
                    ? "text-destructive border-destructive/30 hover:bg-destructive/10"
                    : "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                }`}
              >
                {togglingActiveId === worker.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : worker.active ? (
                  <UserX className="h-3.5 w-3.5" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                {worker.active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {(["not_started", "in_progress", "completed"] as const).map((s) => {
                const count = worker.courses.filter((c) => c.status === s).length;
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <div
                    key={s}
                    className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${cfg.className}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xl font-extrabold">{count}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-center">
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Manager */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5" />
                  Manager
                </h3>
                {canEdit && (
                  <button
                    onClick={onOpenManagerPicker}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit manager"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {worker.manager ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground">
                  <UserCog className="h-3 w-3 text-muted-foreground" />
                  {worker.manager.name}
                </span>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No manager assigned yet.
                </div>
              )}
            </div>

            {/* Job role */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5" />
                  Role
                </h3>
                {canEdit && !editingRole && (
                  <button
                    onClick={() => setEditingRole(true)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit role"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingRole ? (
                <Select
                  value={worker.role?.id ?? NO_ROLE}
                  onValueChange={handleRoleChange}
                  open
                  onOpenChange={(open) => !open && setEditingRole(false)}
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
              ) : worker.role ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground">
                  <UserCog className="h-3 w-3 text-muted-foreground" />
                  {worker.role.name}
                </span>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No role assigned yet.
                </div>
              )}
            </div>

            {/* State / jurisdiction */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  State
                </h3>
                {canEditJurisdiction && (
                  <button
                    onClick={onOpenJurisdictionPicker}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit state"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {worker.jurisdiction ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {worker.jurisdiction.code} &middot; {worker.jurisdiction.name}
                </span>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No state assigned yet.
                </div>
              )}
            </div>

            {/* Courses list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                Courses
              </h3>

              {worker.courses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No courses assigned yet
                </div>
              ) : (
                worker.courses.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  const Icon = cfg.icon;
                  const coursePollResponses = (worker.pollResponses ?? []).filter(
                    (pr) => pr.courseId === c.courseId
                  );
                  const isRemoving = removeCourse.isPending && removeCourse.variables?.assignmentId === c.assignmentId;
                  const isMarkingCompleted =
                    markCompleted.isPending && markCompleted.variables?.assignmentId === c.assignmentId;
                  return (
                    <div
                      key={c.assignmentId}
                      className="rounded-xl border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground leading-tight">
                          {c.courseTitle}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${cfg.className}`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleRemoveCourse(c.assignmentId)}
                              disabled={isRemoving}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Remove course"
                            >
                              {isRemoving
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <div>
                          <span className="font-semibold text-foreground">Assigned</span>
                          <p>{format(new Date(c.assignedAt), "dd MMM yyyy")}</p>
                        </div>
                        {c.status === "completed" && c.completedAt && (
                          <div>
                            <span className="font-semibold text-foreground">Completed</span>
                            <p>{format(new Date(c.completedAt), "dd MMM yyyy")}</p>
                          </div>
                        )}
                        {c.status !== "not_started" && (
                          <div>
                            <span className="font-semibold text-foreground">Last Activity</span>
                            <p>{format(new Date(c.updatedAt), "dd MMM yyyy HH:mm")}</p>
                          </div>
                        )}
                        {c.status !== "completed" && c.totalSlides > 0 && (
                          <div>
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              Slide
                            </span>
                            <p>{c.currentSlideIndex + 1} / {c.totalSlides}</p>
                          </div>
                        )}
                        {c.quizScore !== null && (
                          <div>
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-[#C8D400]" />
                              Quiz Score
                            </span>
                            <p className="font-bold text-[#1B2A6B] dark:text-[#C8D400]">
                              {c.quizScore}%
                            </p>
                          </div>
                        )}
                      </div>

                      {c.status !== "completed" && canEdit && (
                        <button
                          onClick={() => handleMarkCompleted(c.progressId, c.assignmentId)}
                          disabled={isMarkingCompleted}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1.5 transition-colors disabled:opacity-50"
                        >
                          {isMarkingCompleted ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCheck className="h-3.5 w-3.5" />
                          )}
                          Mark as Completed
                        </button>
                      )}

                      {coursePollResponses.length > 0 && (
                        <div className="pt-2 border-t border-border space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" /> Poll Feedback
                          </p>
                          {coursePollResponses.map((pr) => (
                            <div key={pr.id} className="rounded-lg bg-muted/40 border border-border/50 p-2.5 space-y-1">
                              {pr.question && (
                                <p className="text-[11px] font-semibold text-foreground/80 leading-snug">
                                  {pr.question}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {pr.rating && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                                    <Star className="h-2.5 w-2.5" />
                                    {pr.rating}
                                  </span>
                                )}
                                {pr.comment && (
                                  <p className="text-[11px] text-muted-foreground italic">
                                    &ldquo;{pr.comment}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Assign new course from sheet */}
            {worker.active && canEdit && (
              <div className="pt-2 border-t border-border">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assigningWorkerId === worker.id}
                      className="w-full text-[#C8D400] border-[#C8D400]/40 hover:bg-[#C8D400]/10 font-bold text-xs gap-2 rounded-xl"
                    >
                      {assigningWorkerId === worker.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <BookOpen className="h-3.5 w-3.5" />
                          Assign Course <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card border border-border text-foreground rounded-xl shadow-lg p-1 z-50">
                    {publishedCourses.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No published courses available
                      </div>
                    ) : (
                      publishedCourses.map((course) => (
                        <DropdownMenuItem
                          key={course.id}
                          onClick={() => onAssignCourse(worker.id, course.id)}
                          className="cursor-pointer hover:bg-muted text-xs rounded-lg px-3 py-2 transition-colors font-medium"
                        >
                          {course.title}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {canEdit && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteWorker}
                disabled={deleteWorker.isPending}
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 font-bold text-xs gap-2 rounded-xl"
              >
                {deleteWorker.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Worker
                  </>
                )}
              </Button>
            </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
