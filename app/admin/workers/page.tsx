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

interface Worker {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  coursesAssigned: number;
}

interface Course {
  id: string;
  title: string;
  status: string;
}

export default function WorkersPage() {
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [publishedCourses, setPublishedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Stats
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [activeThisWeek, setActiveThisWeek] = useState(0);
  const [pendingModules, setPendingModules] = useState(0);

  // Loading state for assigning courses per worker
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      if (!res.ok) throw new Error("Failed to fetch workers");

      // Extract stats from headers
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
    } catch (err: any) {
      toast.error(err.message || "Error assigning course", { id: toastId });
    } finally {
      setAssigningWorkerId(null);
    }
  };

  const filteredWorkers = workersList.filter((w) => {
    const username = w.telegramUsername?.toLowerCase() || "";
    const firstName = w.firstName?.toLowerCase() || "";
    const lastName = w.lastName?.toLowerCase() || "";
    const query = search.toLowerCase();

    return (
      username.includes(query) ||
      firstName.includes(query) ||
      lastName.includes(query)
    );
  });

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
                Ни один воркер ещё не открывал Mini App
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
                  <th className="px-6 py-4">Telegram Username</th>
                  <th className="px-6 py-4">First Name</th>
                  <th className="px-6 py-4">Last Name</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4">Courses Assigned</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-[#1B2A6B] dark:text-white">
                      {worker.telegramUsername ? `@${worker.telegramUsername}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {worker.firstName || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {worker.lastName || "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {format(new Date(worker.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-xs border border-border">
                        {worker.coursesAssigned} courses
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
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
    </div>
  );
}
