"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  CheckCircle,
  CheckCheck,
  Clock,
  Loader2,
  ChevronDown,
  BookOpen,
  Trophy,
  PlayCircle,
  CircleDashed,
  Star,
  MessageSquare,
  Trash2,
  Layers,
  UserPlus,
  Copy,
  Check,
  RefreshCw,
  Unlink,
  AlertTriangle,
  Pencil,
  X,
  UserX,
  UserCheck,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizePhone, formatPhoneDisplay, formatPhoneInput } from "@/lib/phone";

interface TeamRef {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone?: string | null;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coursesAssigned: number;
  teams: TeamRef[];
}

interface Course {
  id: string;
  title: string;
  status: string;
}

interface WorkerCourseProgress {
  assignmentId: string;
  progressId: string | null;
  courseId: string;
  courseTitle: string;
  status: "not_started" | "in_progress" | "completed";
  currentSlideIndex: number;
  quizScore: number | null;
  completedAt: string | null;
  assignedAt: string;
  updatedAt: string;
  totalSlides: number;
}

interface WorkerPollResponse {
  id: string;
  courseId: string;
  slideIndex: number;
  rating: string | null;
  comment: string | null;
  createdAt: string;
  question: string | null;
}

interface WorkerStatusEvent {
  id: string;
  status: "active" | "deactivated";
  changedAt: string;
}

interface WorkerDetail extends Worker {
  courses: WorkerCourseProgress[];
  pollResponses: WorkerPollResponse[];
  statusHistory: WorkerStatusEvent[];
}

const STATUS_CONFIG = {
  not_started: {
    label: "Not Started",
    icon: CircleDashed,
    className: "text-muted-foreground bg-muted border-border",
  },
  in_progress: {
    label: "In Progress",
    icon: PlayCircle,
    className: "text-blue-600 bg-blue-500/10 border-blue-500/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  },
};

export default function WorkersPage() {
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [publishedCourses, setPublishedCourses] = useState<Course[]>([]);
  const [teamsList, setTeamsList] = useState<TeamRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "deactivated">("active");

  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [activeThisWeek, setActiveThisWeek] = useState(0);
  const [pendingModules, setPendingModules] = useState(0);
  const [deactivatedCount, setDeactivatedCount] = useState(0);
  const [savingWorkerTeams, setSavingWorkerTeams] = useState(false);

  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);

  const [selectedWorker, setSelectedWorker] = useState<WorkerDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [markingCompleted, setMarkingCompleted] = useState<string | null>(null);
  const [deletingWorker, setDeletingWorker] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  // Worker detail edit states
  const [editingWorker, setEditingWorker] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingWorkerEdit, setSavingWorkerEdit] = useState(false);

  // Worker creation modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [creatingWorker, setCreatingWorker] = useState(false);

  // Possible-duplicate warning shown before creating a new worker
  const [duplicateCandidate, setDuplicateCandidate] = useState<Worker | null>(null);

  // Generated Invite Link modal states
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [activeInviteUrl, setActiveInviteUrl] = useState("");
  const [activeInviteWorkerName, setActiveInviteWorkerName] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Unbind warning modal states
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [unbindTargetWorker, setUnbindTargetWorker] = useState<Worker | null>(null);
  const [unbindingWorker, setUnbindingWorker] = useState(false);
  const [reissuingWorkerId, setReissuingWorkerId] = useState<string | null>(null);

  // Team picker dialog (opened on demand from the worker detail panel)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      if (!res.ok) throw new Error("Failed to fetch workers");

      const data = await res.json();
      setWorkersList(data.workers);
      setTotalEnrolled(data.totalCount ?? 0);
      setActiveThisWeek(data.activeThisWeek ?? 0);
      setPendingModules(data.pendingModules ?? 0);
      setDeactivatedCount(data.deactivatedCount ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Could not load workers");
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      const data = await res.json();
      setPublishedCourses(data.filter((c: any) => c.status === "published"));
    } catch (err: any) {
      toast.error(err.message || "Could not load courses");
    }
  };

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

  const openWorkerDetail = async (worker: Worker) => {
    setSheetOpen(true);
    setLoadingDetail(true);
    setSelectedWorker(null);
    setEditingWorker(false);
    try {
      const res = await fetch(`/api/workers/${worker.id}`);
      if (!res.ok) throw new Error("Failed to fetch worker details");
      const data = await res.json();
      setSelectedWorker(data);
    } catch (err: any) {
      toast.error(err.message || "Could not load worker details");
      setSheetOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const startEditingWorker = () => {
    if (!selectedWorker) return;
    setEditName(workerDisplayName(selectedWorker));
    setEditPhone(selectedWorker.phone ? formatPhoneInput(selectedWorker.phone) : "");
    setEditingWorker(true);
  };

  const handleSaveWorkerEdit = async () => {
    if (!selectedWorker) return;
    if (!editName.trim()) {
      toast.error("Please enter worker name");
      return;
    }
    setSavingWorkerEdit(true);
    try {
      const res = await fetch(`/api/workers/${selectedWorker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update worker");

      setSelectedWorker((prev) => (prev ? { ...prev, ...data } : prev));
      setEditingWorker(false);
      await fetchWorkers();
      toast.success("Worker updated");
    } catch (err: any) {
      toast.error(err.message || "Could not update worker");
    } finally {
      setSavingWorkerEdit(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchWorkers(), fetchCourses(), fetchTeams()]);
      setLoading(false);
    };
    init();
  }, []);

  // Handle manual worker creation (POST /api/admin/workers)
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

  const performCreateWorker = async () => {
    setCreatingWorker(true);
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkerName.trim(),
          phone: newWorkerPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create worker");

      setCreateModalOpen(false);
      setNewWorkerName("");
      setNewWorkerPhone("");
      await fetchWorkers();

      // Show invite link popup
      setActiveInviteWorkerName(data.worker.displayName || newWorkerName);
      setActiveInviteUrl(data.inviteUrl);
      setCopiedLink(false);
      setLinkModalOpen(true);
      toast.success("Worker created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Error creating worker");
    } finally {
      setCreatingWorker(false);
    }
  };

  const handleCreateWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) {
      toast.error("Please enter worker name");
      return;
    }

    const duplicate = findPossibleDuplicate(newWorkerName.trim(), newWorkerPhone.trim());
    if (duplicate) {
      setDuplicateCandidate(duplicate);
      return;
    }

    await performCreateWorker();
  };

  const handleCreateAnyway = async () => {
    setDuplicateCandidate(null);
    await performCreateWorker();
  };

  const handleReactivateDuplicate = async () => {
    if (!duplicateCandidate) return;
    await handleToggleActive(duplicateCandidate);
    setDuplicateCandidate(null);
    setCreateModalOpen(false);
    setNewWorkerName("");
    setNewWorkerPhone("");
  };

  const handleViewDuplicate = () => {
    if (!duplicateCandidate) return;
    const worker = duplicateCandidate;
    setDuplicateCandidate(null);
    setCreateModalOpen(false);
    openWorkerDetail(worker);
  };

  // Handle invite link reissuance (POST /api/admin/workers/[id]/invites)
  const handleReissueInvite = async (worker: Worker) => {
    setReissuingWorkerId(worker.id);
    const toastId = toast.loading("Generating new invite link...");
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}/invites`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reissue invite link");

      setActiveInviteWorkerName(workerDisplayName(worker));
      setActiveInviteUrl(data.inviteUrl);
      setCopiedLink(false);
      setLinkModalOpen(true);
      toast.success("New invite link generated!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Could not reissue invite link", { id: toastId });
    } finally {
      setReissuingWorkerId(null);
    }
  };

  // Handle Telegram unbind + link reissue (POST /api/admin/workers/[id]/unbind)
  const handleConfirmUnbind = async () => {
    if (!unbindTargetWorker) return;
    setUnbindingWorker(true);
    const toastId = toast.loading("Resetting Telegram connection...");
    try {
      const res = await fetch(`/api/admin/workers/${unbindTargetWorker.id}/unbind`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset Telegram connection");

      setUnbindConfirmOpen(false);
      await fetchWorkers();
      if (selectedWorker?.id === unbindTargetWorker.id) {
        setSelectedWorker((prev) => (prev ? { ...prev, telegramUserId: null } : prev));
      }

      setActiveInviteWorkerName(workerDisplayName(unbindTargetWorker));
      setActiveInviteUrl(data.inviteUrl);
      setCopiedLink(false);
      setLinkModalOpen(true);
      toast.success("Telegram connection reset. New invite link generated!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Could not reset Telegram connection", { id: toastId });
    } finally {
      setUnbindingWorker(false);
      setUnbindTargetWorker(null);
    }
  };

  const handleCopyLink = () => {
    if (!activeInviteUrl) return;
    navigator.clipboard.writeText(activeInviteUrl);
    setCopiedLink(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleAssignCourse = async (workerId: string, courseId: string) => {
    setAssigningWorkerId(workerId);
    const toastId = toast.loading("Assigning course...");
    try {
      const res = await fetch(`/api/workers/${workerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (!res.ok) throw new Error("Failed to assign course");
      const data = await res.json();

      if (data.isNew) {
        toast.success("Course assigned successfully!", { id: toastId });
      } else {
        toast.info("Worker is already assigned to this course.", { id: toastId });
      }

      await fetchWorkers();

      if (selectedWorker?.id === workerId) {
        const detailRes = await fetch(`/api/workers/${workerId}`);
        if (detailRes.ok) setSelectedWorker(await detailRes.json());
      }
    } catch (err: any) {
      toast.error(err.message || "Error assigning course", { id: toastId });
    } finally {
      setAssigningWorkerId(null);
    }
  };

  const handleRemoveCourse = async (assignmentId: string) => {
    setRemovingCourseId(assignmentId);
    try {
      const res = await fetch(`/api/reports/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove course");
      setSelectedWorker((prev) =>
        prev ? { ...prev, courses: prev.courses.filter((c) => c.assignmentId !== assignmentId) } : prev
      );
      await fetchWorkers();
      toast.success("Course removed");
    } catch (err: any) {
      toast.error(err.message || "Could not remove course");
    } finally {
      setRemovingCourseId(null);
    }
  };

  const handleMarkCompleted = async (progressId: string | null, assignmentId: string) => {
    const idToUse = progressId ?? assignmentId;
    setMarkingCompleted(assignmentId);
    try {
      const res = await fetch(`/api/reports/${idToUse}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to mark as completed");
      setSelectedWorker((prev) =>
        prev
          ? {
              ...prev,
              courses: prev.courses.map((c) =>
                c.assignmentId === assignmentId
                  ? { ...c, status: "completed" as const, completedAt: new Date().toISOString() }
                  : c
              ),
            }
          : prev
      );
      await fetchWorkers();
      toast.success("Marked as completed");
    } catch (err: any) {
      toast.error(err.message || "Could not mark as completed");
    } finally {
      setMarkingCompleted(null);
    }
  };

  const handleToggleActive = async (worker: Worker) => {
    const nextActive = !worker.active;
    setTogglingActiveId(worker.id);
    try {
      const res = await fetch(`/api/workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update worker status");

      setWorkersList((prev) =>
        prev.map((w) =>
          w.id === worker.id ? { ...w, active: nextActive, deactivatedAt: data.deactivatedAt ?? null } : w
        )
      );
      if (selectedWorker?.id === worker.id) {
        setSelectedWorker((prev) =>
          prev ? { ...prev, active: nextActive, deactivatedAt: data.deactivatedAt ?? null } : prev
        );
      }
      toast.success(nextActive ? "Worker reactivated" : "Worker deactivated");
    } catch (err: any) {
      toast.error(err.message || "Could not update worker status");
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleToggleWorkerTeam = async (teamId: string, checked: boolean) => {
    if (!selectedWorker) return;
    const currentIds = selectedWorker.teams.map((t) => t.id);
    const nextIds = checked ? [...currentIds, teamId] : currentIds.filter((id) => id !== teamId);

    setSavingWorkerTeams(true);
    try {
      const res = await fetch(`/api/workers/${selectedWorker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: nextIds }),
      });
      if (!res.ok) throw new Error("Failed to update teams");

      const team = teamsList.find((t) => t.id === teamId);
      setSelectedWorker((prev) =>
        prev
          ? {
              ...prev,
              teams: checked
                ? [...prev.teams, team ?? { id: teamId, name: "" }]
                : prev.teams.filter((t) => t.id !== teamId),
            }
          : prev
      );
      await fetchWorkers();
      toast.success(checked ? "Added to team" : "Removed from team");
    } catch (err: any) {
      toast.error(err.message || "Could not update teams");
    } finally {
      setSavingWorkerTeams(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (!selectedWorker) return;
    if (!window.confirm(`Delete ${workerDisplayName(selectedWorker)}? This cannot be undone.`)) return;
    setDeletingWorker(true);
    try {
      const res = await fetch(`/api/workers/${selectedWorker.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete worker");
      setSheetOpen(false);
      setSelectedWorker(null);
      await fetchWorkers();
      toast.success("Worker deleted");
    } catch (err: any) {
      toast.error(err.message || "Could not delete worker");
    } finally {
      setDeletingWorker(false);
    }
  };

  const filteredWorkers = workersList.filter((w) => {
    if (statusTab === "active" && !w.active) return false;
    if (statusTab === "deactivated" && w.active) return false;

    const displayName = w.displayName?.toLowerCase() || "";
    const firstName = w.firstName?.toLowerCase() || "";
    const lastName = w.lastName?.toLowerCase() || "";
    const phoneDigits = w.phone?.replace(/\D/g, "") || "";
    const query = search.toLowerCase();
    const queryDigits = search.replace(/\D/g, "");
    return (
      displayName.includes(query) ||
      firstName.includes(query) ||
      lastName.includes(query) ||
      (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
    );
  });

  const workerDisplayName = (w: Worker | WorkerDetail | null) => {
    if (!w) return "";
    if (w.displayName) return w.displayName;
    const name = [w.firstName, w.lastName].filter(Boolean).join(" ");
    if (name) return name;
    return "Unnamed Worker";
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const handlePrintWorkerReport = (worker: WorkerDetail) => {
    const name = escapeHtml(workerDisplayName(worker));
    const created = format(new Date(worker.createdAt), "dd MMM yyyy");
    const deactivated = worker.deactivatedAt
      ? format(new Date(worker.deactivatedAt), "dd MMM yyyy")
      : null;
    const completedCount = worker.courses.filter((c) => c.status === "completed").length;

    const historyRows = [
      `<tr><td>Hired</td><td>${created}</td></tr>`,
      ...worker.statusHistory.map(
        (e) =>
          `<tr><td>${e.status === "deactivated" ? "Deactivated" : "Reactivated"}</td><td>${format(
            new Date(e.changedAt),
            "dd MMM yyyy"
          )}</td></tr>`
      ),
    ].join("");

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
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Header */}
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

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalEnrolled}
            </p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Total Workers
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : activeThisWeek}
            </p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Active This Week
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8D400]/10 border border-[#C8D400]/20 text-[#C8D400]">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : pendingModules}
            </p>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Pending Modules
            </p>
          </div>
        </div>
      </div>

      {/* Filtering & Table Panel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search worker by name or phone..."
              className="bg-background border-border text-foreground rounded-xl placeholder-muted-foreground focus-visible:ring-primary h-10 text-xs"
            />
          </div>
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as "active" | "deactivated")}>
            <TabsList>
              <TabsTrigger value="active" className="text-xs gap-1.5">
                Active
              </TabsTrigger>
              <TabsTrigger value="deactivated" className="text-xs gap-1.5">
                Deactivated
                {deactivatedCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[10px] font-bold">
                    {deactivatedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Workers Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
              <p className="text-sm font-medium">Fetching workers...</p>
            </div>
          ) : workersList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No workers created yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Click &ldquo;Add Worker&rdquo; above to create a worker record and generate an invite link.
              </p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No results found
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Try searching for another name or phone number.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Teams</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4">Courses Assigned</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWorkers.map((worker) => (
                  <tr
                    key={worker.id}
                    onClick={() => openWorkerDetail(worker)}
                    className="hover:bg-muted/20 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">
                      {workerDisplayName(worker)}
                      {worker.phone && (
                        <p className="text-xs text-muted-foreground font-normal">{formatPhoneDisplay(worker.phone)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {!worker.active && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold">
                            <UserX className="h-3 w-3" /> Deactivated
                          </span>
                        )}
                        {worker.telegramUserId ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                            <CheckCircle className="h-3 w-3" /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-semibold">
                            <Clock className="h-3 w-3" /> Not Connected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {worker.teams.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          worker.teams.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#1B2A6B]/10 text-[#1B2A6B] dark:bg-[#C8D400]/10 dark:text-[#C8D400] text-[10px] font-semibold border border-border"
                            >
                              {t.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {format(new Date(worker.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-xs border border-border">
                        {worker.coursesAssigned} courses
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={assigningWorkerId === worker.id || reissuingWorkerId === worker.id}
                            className="text-[#C8D400] hover:bg-[#C8D400]/10 hover:text-[#B6C200] text-xs font-bold rounded-lg cursor-pointer h-9 px-3 gap-1"
                          >
                            {reissuingWorkerId === worker.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                Actions <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-card border border-border text-foreground rounded-xl shadow-lg p-1 z-50">
                          {worker.active && (
                            <>
                              <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Course Assignment
                              </div>
                              {publishedCourses.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">
                                  No published courses available
                                </div>
                              ) : (
                                publishedCourses.map((course) => (
                                  <DropdownMenuItem
                                    key={course.id}
                                    onClick={() => handleAssignCourse(worker.id, course.id)}
                                    className="cursor-pointer hover:bg-muted text-xs rounded-lg px-3 py-2 transition-colors font-medium"
                                  >
                                    {course.title}
                                  </DropdownMenuItem>
                                ))
                              )}
                              <DropdownMenuSeparator className="bg-border" />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleReissueInvite(worker)}
                            className="cursor-pointer hover:bg-muted text-xs rounded-lg px-3 py-2 transition-colors font-semibold text-blue-400 gap-2"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Reissue Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setUnbindTargetWorker(worker);
                              setUnbindConfirmOpen(true);
                            }}
                            className="cursor-pointer hover:bg-destructive/10 text-xs rounded-lg px-3 py-2 transition-colors font-semibold text-destructive gap-2"
                          >
                            <Unlink className="h-3.5 w-3.5" /> Reset Telegram Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(worker)}
                            disabled={togglingActiveId === worker.id}
                            className={`cursor-pointer text-xs rounded-lg px-3 py-2 transition-colors font-semibold gap-2 ${
                              worker.active
                                ? "hover:bg-destructive/10 text-destructive"
                                : "hover:bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            {worker.active ? (
                              <>
                                <UserX className="h-3.5 w-3.5" /> Deactivate Worker
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" /> Reactivate Worker
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Worker Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleCreateWorkerSubmit}>
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
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
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
                  value={newWorkerPhone}
                  onChange={(e) => setNewWorkerPhone(formatPhoneInput(e.target.value))}
                  placeholder="(555) 123-4567"
                  className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
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
                disabled={creatingWorker}
                className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4 rounded-xl"
              >
                {creatingWorker ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Generate Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Possible Duplicate Warning Modal */}
      <Dialog open={!!duplicateCandidate} onOpenChange={(open) => !open && setDuplicateCandidate(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Possible Duplicate
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              A worker with a matching name or phone number already exists.
            </DialogDescription>
          </DialogHeader>

          {duplicateCandidate && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-bold text-foreground">{workerDisplayName(duplicateCandidate)}</p>
              <p className="text-xs text-muted-foreground">
                {duplicateCandidate.active ? (
                  "Active"
                ) : (
                  <>
                    Deactivated
                    {duplicateCandidate.deactivatedAt &&
                      ` on ${format(new Date(duplicateCandidate.deactivatedAt), "dd MMM yyyy")}`}
                  </>
                )}
                {duplicateCandidate.phone && ` · ${formatPhoneDisplay(duplicateCandidate.phone)}`}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {duplicateCandidate && !duplicateCandidate.active && (
              <Button
                type="button"
                onClick={handleReactivateDuplicate}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Reactivate This Worker Instead
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleViewDuplicate}
              className="w-full border-border text-foreground text-xs rounded-xl"
            >
              View Existing Worker
            </Button>
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateCandidate(null)}
                className="flex-1 border-border text-muted-foreground text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateAnyway}
                disabled={creatingWorker}
                className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs rounded-xl"
              >
                {creatingWorker ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create New Anyway"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Display Generated Invite Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Invite Link Ready
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Send this link to <strong className="text-foreground">{activeInviteWorkerName}</strong>. Valid for 14 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 bg-muted/40 border border-border rounded-xl font-mono text-xs break-all text-foreground select-all">
              {activeInviteUrl}
            </div>

            <Button
              onClick={handleCopyLink}
              className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs h-10 rounded-xl gap-2 cursor-pointer"
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? "Link Copied!" : "Copy Invite Link"}
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkModalOpen(false)}
              className="border-border text-muted-foreground text-xs w-full rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Telegram Unbind Confirmation Warning Modal */}
      <Dialog open={unbindConfirmOpen} onOpenChange={setUnbindConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reset Telegram Connection?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2 leading-relaxed">
              Worker <strong className="text-foreground">{unbindTargetWorker ? workerDisplayName(unbindTargetWorker) : ""}</strong> will lose access under their current Telegram account until they click the newly generated invite link.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setUnbindConfirmOpen(false);
                setUnbindTargetWorker(null);
              }}
              className="border-border text-muted-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUnbind}
              disabled={unbindingWorker}
              className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-4 rounded-xl"
            >
              {unbindingWorker ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset & Generate New Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Picker Modal */}
      <Dialog open={teamPickerOpen} onOpenChange={setTeamPickerOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Edit Teams
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Choose which teams {selectedWorker ? workerDisplayName(selectedWorker) : "this worker"} belongs to.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {teamsList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No teams yet. Create one from the Teams page.
              </div>
            ) : (
              teamsList.map((team) => {
                const checked = selectedWorker?.teams.some((t) => t.id === team.id) ?? false;
                return (
                  <label
                    key={team.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                      checked ? "border-[#C8D400]/50 bg-[#C8D400]/10" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={savingWorkerTeams}
                      onCheckedChange={(v) => handleToggleWorkerTeam(team.id, v === true)}
                    />
                    <span className="text-xs font-medium text-foreground">{team.name}</span>
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setTeamPickerOpen(false)}
              className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Worker Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="w-full sm:max-w-lg overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader>
            {editingWorker && selectedWorker ? (
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
                    disabled={savingWorkerEdit}
                    className="flex-1 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs rounded-xl gap-1.5"
                  >
                    {savingWorkerEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingWorker(false)}
                    disabled={savingWorkerEdit}
                    className="border-border text-muted-foreground text-xs rounded-xl gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <SheetTitle className="text-xl font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
                {selectedWorker ? workerDisplayName(selectedWorker) : "Loading..."}
                {selectedWorker && (
                  <button
                    onClick={startEditingWorker}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit worker"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {selectedWorker && (
                  <button
                    onClick={() => handlePrintWorkerReport(selectedWorker)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Print / save worker report"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                )}
              </SheetTitle>
            )}
            {selectedWorker && !editingWorker && (
              <SheetDescription className="text-sm text-muted-foreground space-y-1">
                {selectedWorker.phone && (
                  <span className="block font-normal text-foreground">Phone: {formatPhoneDisplay(selectedWorker.phone)}</span>
                )}
                <div className="pt-1 flex flex-wrap gap-1.5">
                  {!selectedWorker.active && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold">
                      <UserX className="h-3.5 w-3.5" /> Deactivated
                    </span>
                  )}
                  {selectedWorker.telegramUserId ? (
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
                  Created {format(new Date(selectedWorker.createdAt), "dd MMM yyyy")}
                  {!selectedWorker.active && selectedWorker.deactivatedAt && (
                    <> &middot; Deactivated {format(new Date(selectedWorker.deactivatedAt), "dd MMM yyyy")}</>
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
          ) : selectedWorker ? (
            <div className="flex flex-col gap-6 mt-4 px-4 pb-6">

              {/* Action bar for invites */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReissueInvite(selectedWorker)}
                  disabled={reissuingWorkerId === selectedWorker.id}
                  className="flex-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 font-bold text-xs gap-1.5 rounded-xl"
                >
                  {reissuingWorkerId === selectedWorker.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Reissue Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUnbindTargetWorker(selectedWorker);
                    setUnbindConfirmOpen(true);
                  }}
                  className="flex-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 font-bold text-xs gap-1.5 rounded-xl"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Reset Telegram
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(selectedWorker)}
                  disabled={togglingActiveId === selectedWorker.id}
                  className={`flex-1 font-bold text-xs gap-1.5 rounded-xl ${
                    selectedWorker.active
                      ? "text-destructive border-destructive/30 hover:bg-destructive/10"
                      : "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                  }`}
                >
                  {togglingActiveId === selectedWorker.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : selectedWorker.active ? (
                    <UserX className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  {selectedWorker.active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {(["not_started", "in_progress", "completed"] as const).map((s) => {
                  const count = selectedWorker.courses.filter((c) => c.status === s).length;
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

              {/* Teams */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Teams
                  </h3>
                  <button
                    onClick={() => setTeamPickerOpen(true)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit teams"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selectedWorker.teams.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No team assigned yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedWorker.teams.map((team) => (
                      <span
                        key={team.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground"
                      >
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {team.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Courses list */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" />
                  Courses
                </h3>

                {selectedWorker.courses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No courses assigned yet
                  </div>
                ) : (
                  selectedWorker.courses.map((c) => {
                    const cfg = STATUS_CONFIG[c.status];
                    const Icon = cfg.icon;
                    const coursePollResponses = (selectedWorker.pollResponses ?? []).filter(
                      (pr) => pr.courseId === c.courseId
                    );
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
                            <button
                              onClick={() => handleRemoveCourse(c.assignmentId)}
                              disabled={removingCourseId === c.assignmentId}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Remove course"
                            >
                              {removingCourseId === c.assignmentId
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </button>
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

                        {c.status !== "completed" && (
                          <button
                            onClick={() => handleMarkCompleted(c.progressId, c.assignmentId)}
                            disabled={markingCompleted === c.assignmentId}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1.5 transition-colors disabled:opacity-50"
                          >
                            {markingCompleted === c.assignmentId ? (
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
              {selectedWorker.active && (
                <div className="pt-2 border-t border-border">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={assigningWorkerId === selectedWorker.id}
                        className="w-full text-[#C8D400] border-[#C8D400]/40 hover:bg-[#C8D400]/10 font-bold text-xs gap-2 rounded-xl"
                      >
                        {assigningWorkerId === selectedWorker.id ? (
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
                            onClick={() => handleAssignCourse(selectedWorker.id, course.id)}
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

              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteWorker}
                  disabled={deletingWorker}
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 font-bold text-xs gap-2 rounded-xl"
                >
                  {deletingWorker ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Worker
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
