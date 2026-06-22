"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  CheckCircle,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface Worker {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
  coursesAssigned: number;
}

interface Course {
  id: string;
  title: string;
  status: string;
}

interface WorkerCourseProgress {
  progressId: string;
  courseId: string;
  courseTitle: string;
  status: "not_started" | "in_progress" | "completed";
  currentSlideIndex: number;
  quizScore: number | null;
  completedAt: string | null;
  assignedAt: string;
  updatedAt: string;
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

interface WorkerDetail extends Worker {
  courses: WorkerCourseProgress[];
  pollResponses: WorkerPollResponse[];
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [activeThisWeek, setActiveThisWeek] = useState(0);
  const [pendingModules, setPendingModules] = useState(0);

  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);

  const [selectedWorker, setSelectedWorker] = useState<WorkerDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [deletingWorker, setDeletingWorker] = useState(false);

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      if (!res.ok) throw new Error("Failed to fetch workers");

      const total = res.headers.get("x-total-count");
      const active = res.headers.get("x-active-this-week");
      const pending = res.headers.get("x-pending-modules");

      if (total !== null) setTotalEnrolled(parseInt(total, 10));
      if (active !== null) setActiveThisWeek(parseInt(active, 10));
      if (pending !== null) setPendingModules(parseInt(pending, 10));

      const data = await res.json();
      setWorkersList(data);
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

  const openWorkerDetail = async (worker: Worker) => {
    setSheetOpen(true);
    setLoadingDetail(true);
    setSelectedWorker(null);
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchWorkers(), fetchCourses()]);
      setLoading(false);
    };
    init();
  }, []);

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

  const handleRemoveCourse = async (progressId: string) => {
    setRemovingCourseId(progressId);
    try {
      const res = await fetch(`/api/reports/${progressId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove course");
      setSelectedWorker((prev) =>
        prev ? { ...prev, courses: prev.courses.filter((c) => c.progressId !== progressId) } : prev
      );
      await fetchWorkers();
      toast.success("Course removed");
    } catch (err: any) {
      toast.error(err.message || "Could not remove course");
    } finally {
      setRemovingCourseId(null);
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
    const displayName = w.displayName?.toLowerCase() || "";
    const username = w.telegramUsername?.toLowerCase() || "";
    const firstName = w.firstName?.toLowerCase() || "";
    const lastName = w.lastName?.toLowerCase() || "";
    const query = search.toLowerCase();
    return (
      displayName.includes(query) ||
      username.includes(query) ||
      firstName.includes(query) ||
      lastName.includes(query)
    );
  });

  const workerDisplayName = (w: Worker | WorkerDetail | null) => {
    if (!w) return "";
    if (w.displayName) return w.displayName;
    const name = [w.firstName, w.lastName].filter(Boolean).join(" ");
    if (name) return name;
    if (w.telegramUsername) return w.telegramUsername;
    return w.telegramUserId;
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
            Monitor registered workers, inspect active Telegram session IDs, and assign safety training modules.
          </p>
        </div>
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
              Total Enrolled
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
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, first or last name..."
              className="pl-9 bg-background border-border text-foreground rounded-xl placeholder-muted-foreground focus-visible:ring-primary h-10"
            />
          </div>
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
                No workers have opened the Mini App yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Once workers launch the Telegram Mini App, they will automatically appear here.
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
                Try searching for another name or username.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Telegram Username</th>
                  <th className="px-6 py-4">Joined Date</th>
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
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-[#1B2A6B] dark:text-white">
                      {worker.telegramUsername ? `@${worker.telegramUsername}` : "—"}
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
                            disabled={assigningWorkerId === worker.id}
                            className="text-[#C8D400] hover:bg-[#C8D400]/10 hover:text-[#B6C200] text-xs font-bold rounded-lg cursor-pointer h-9 px-3 gap-1"
                          >
                            {assigningWorkerId === worker.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                Assign Course <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-card border border-border text-foreground rounded-xl shadow-lg p-1 z-50">
                          {publishedCourses.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">
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

      {/* Worker Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold text-[#1B2A6B] dark:text-[#C8D400]">
              {selectedWorker ? workerDisplayName(selectedWorker) : "Loading..."}
            </SheetTitle>
            {selectedWorker && (
              <SheetDescription className="text-sm text-muted-foreground space-y-1">
                {selectedWorker.telegramUsername && (
                  <span className="font-mono">@{selectedWorker.telegramUsername}</span>
                )}
                <span className="block">
                  Joined {format(new Date(selectedWorker.createdAt), "dd MMM yyyy")}
                </span>
              </SheetDescription>
            )}
          </SheetHeader>

          {loadingDetail ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
              <p className="text-sm">Loading worker details...</p>
            </div>
          ) : selectedWorker ? (
            <div className="flex flex-col gap-6 mt-2">

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
                        key={c.progressId}
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
                              onClick={() => handleRemoveCourse(c.progressId)}
                              disabled={removingCourseId === c.progressId}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Remove course"
                            >
                              {removingCourseId === c.progressId
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
              <div className="pt-2 border-t border-border">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assigningWorkerId === selectedWorker.id}
                      className="w-full text-[#C8D400] border-[#C8D400]/40 hover:bg-[#C8D400]/10 font-bold text-xs gap-2"
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

              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteWorker}
                  disabled={deletingWorker}
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 font-bold text-xs gap-2"
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
