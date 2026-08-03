"use client";

import React, { useState } from "react";
import {
  FileText,
  TrendingUp,
  Award,
  CheckCircle,
  Download,
  Calendar,
  Zap,
  Loader2,
  Trash2,
  Star,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoursesQuery } from "@/hooks/admin/workers/queries";
import { useReportsQuery, usePollResponsesQuery } from "@/hooks/admin/reports/queries";
import { useDeleteReportMutation } from "@/hooks/admin/reports/mutations";

export default function ReportsPage() {
  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const coursesQuery = useCoursesQuery("published");
  const reportsQuery = useReportsQuery(selectedCourse, selectedStatus);
  const pollResponsesQuery = usePollResponsesQuery(selectedCourse);
  const deleteReportMutation = useDeleteReportMutation();

  const reports = reportsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const loading = reportsQuery.isLoading;
  const pollResponses = pollResponsesQuery.data ?? [];
  const pollLoading = pollResponsesQuery.isLoading;

  const handleDeleteReport = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteReportMutation.mutateAsync(id);
      toast.success("Record deleted");
    } catch (err: any) {
      toast.error(err.message || "Could not delete record");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportData = () => {
    const params = new URLSearchParams();
    if (selectedCourse && selectedCourse !== "all") {
      params.append("courseId", selectedCourse);
    }
    if (selectedStatus && selectedStatus !== "all") {
      params.append("status", selectedStatus);
    }

    const url = `/api/reports/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance_report_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV report download triggered successfully!");
  };

  // Metrics Calculations
  const totalCount = reports.length;
  const completedCount = reports.filter((r) => r.status === "completed").length;
  const completionRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : "0.0";

  const scores = reports.map((r) => r.quizScore).filter((s) => s !== null) as number[];
  const avgQuizScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0.0";

  // Dynamic Course Stats for the graph (group reports by course name)
  const courseGroups: Record<string, { completions: number; active: number; total: number; scores: number[] }> = {};
  reports.forEach((r) => {
    if (!courseGroups[r.courseName]) {
      courseGroups[r.courseName] = { completions: 0, active: 0, total: 0, scores: [] };
    }
    const group = courseGroups[r.courseName];
    group.total++;
    if (r.status === "completed") group.completions++;
    if (r.status === "in_progress") group.active++;
    if (r.quizScore !== null) group.scores.push(r.quizScore);
  });

  const coursesStats = Object.entries(courseGroups).map(([title, stats]) => {
    const completions = Math.round((stats.completions / stats.total) * 100);
    const active = Math.round((stats.active / stats.total) * 100);
    const avgScore = stats.scores.length > 0
      ? `${Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)}%`
      : "N/A";
    return { title, completions, active, avgScore };
  });

  // Recent completions (completed, sorted by date)
  const recentCompletions = reports
    .filter((r) => r.status === "completed")
    .slice(0, 5)
    .map((r) => ({
      worker: r.workerName,
      course: r.courseName,
      score: r.quizScore !== null ? `${r.quizScore}%` : "—",
      date: r.completedAt ? format(new Date(r.completedAt), "MMM d, HH:mm") : "Just now",
    }));

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Analytics & Reports
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Review organizational compliance scores, average quiz statistics, and download compliance audits.
          </p>
        </div>

        <Button
          onClick={handleExportData}
          disabled={loading || totalCount === 0}
          className="h-11 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold shadow-lg shadow-[#C8D400]/25 gap-2 border-0 cursor-pointer transition-all duration-200"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Completion Rate</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? "..." : `${completionRate}%`}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Average Quiz Score</span>
            <Award className="h-5 w-5 text-[#C8D400]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? "..." : `${avgQuizScore}%`}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Passing: 80%</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Records</span>
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? "..." : totalCount}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Active filtered list</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 transition-all duration-300">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compliant Workers</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1B2A6B] dark:text-white">
              {loading ? "..." : totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : "0%"}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">Completions ratio</span>
          </div>
        </div>
      </div>

      {/* Visual Chart Mockup (Pure CSS & HTML) and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dynamic Progress Funnel Bar Graph */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#C8D400]" /> Module Completion Progress
            </h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Updated realtime
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
              </div>
            ) : coursesStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No course statistics available.</p>
            ) : (
              coursesStats.map((item, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground/90">{item.title}</span>
                    <span className="text-muted-foreground font-mono">
                      {item.completions}% complete ({item.active}% active, Avg: {item.avgScore})
                    </span>
                  </div>
                  <div className="relative h-4.5 w-full bg-background border border-border rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.completions}%` }}
                      className="h-full bg-gradient-to-r from-[#1B2A6B] to-[#C8D400] shadow-md rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Completion Feed */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 transition-all duration-300">
          <h3 className="text-base font-extrabold text-[#1B2A6B] dark:text-[#C8D400] flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> Recent completions
          </h3>

          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentCompletions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No recent completions found.</p>
            ) : (
              recentCompletions.map((log, index) => (
                <div key={index} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground/90 truncate">{log.worker}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{log.course}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <span className="inline-flex rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20">
                      {log.score}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">{log.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Filtering & Table Panel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full sm:w-64 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter by Course</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border text-foreground">
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-64 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter by Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border text-foreground">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
              <p className="text-sm font-medium">Fetching report details...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No reports found
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Try adjusting your filters or check that workers are active.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Worker Name</th>
                  <th className="px-6 py-4">Course</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Completion Date</th>
                  <th className="px-6 py-4">Quiz Score</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report, index) => (
                  <tr key={index} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-[#1B2A6B] dark:text-white">
                      {report.workerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {report.courseName}
                    </td>
                    <td className="px-6 py-4">
                      {report.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-2.5 py-1 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/20">
                          Completed
                        </span>
                      ) : report.status === "in_progress" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 px-2.5 py-1 text-xs font-semibold border border-yellow-200 dark:border-yellow-500/20">
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                          Not Started
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {report.completedAt
                        ? format(new Date(report.completedAt), "yyyy-MM-dd HH:mm")
                        : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-foreground">
                      {report.quizScore !== null ? `${report.quizScore}%` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        disabled={deletingId === report.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Delete record"
                      >
                        {deletingId === report.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Poll Feedback Section */}
      {(pollLoading || pollResponses.length > 0) && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#C8D400]" />
            <h3 className="text-base font-extrabold text-[#1B2A6B] dark:text-[#C8D400]">
              Poll Feedback
            </h3>
            <span className="ml-auto text-xs text-muted-foreground font-semibold">
              {pollResponses.length} {pollResponses.length === 1 ? "response" : "responses"}
            </span>
          </div>

          {pollLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#C8D400]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-4">Worker</th>
                    <th className="px-6 py-4">Course</th>
                    <th className="px-6 py-4">Question</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Comment</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pollResponses.map((pr) => (
                    <tr key={pr.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-sm text-[#1B2A6B] dark:text-white">{pr.workerName}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{pr.courseName}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-[180px] truncate">
                        {pr.question || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {pr.rating ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            <Star className="h-3 w-3" />
                            {pr.rating}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground max-w-[200px]">
                        {pr.comment ? (
                          <span className="italic text-muted-foreground">&ldquo;{pr.comment}&rdquo;</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">no comment</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {format(new Date(pr.createdAt), "yyyy-MM-dd HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
