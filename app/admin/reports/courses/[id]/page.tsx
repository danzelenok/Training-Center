"use client";

import { Fragment, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCourseSnapshotQuery } from "@/hooks/admin/reports/queries";
import type { CourseSnapshotWorker } from "@/hooks/admin/reports/types";
import { STATUS_CONFIG } from "@/components/admin/workers/status-config";

const ROLE_UNKNOWN = "Role unknown";
const NO_JURISDICTION = "No jurisdiction";

function statCounts(list: CourseSnapshotWorker[]) {
  const total = list.length;
  const completed = list.filter((w) => w.status === "completed").length;
  const inProgress = list.filter((w) => w.status === "in_progress").length;
  const notStarted = total - completed - inProgress;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, notStarted, rate };
}

// Sorts group keys alphabetically but always pushes the "unknown" bucket last,
// so a handful of gap-cases don't visually dominate the top of the report.
function sortGroupKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const aUnknown = a === ROLE_UNKNOWN || a === NO_JURISDICTION;
    const bUnknown = b === ROLE_UNKNOWN || b === NO_JURISDICTION;
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
    return a.localeCompare(b);
  });
}

function GroupHeader({ label, list }: { label: string; list: CourseSnapshotWorker[] }) {
  const stats = statCounts(list);
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-muted/40 border-y border-border">
      <span className="text-sm font-bold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground font-mono">
        {stats.completed}/{stats.total} completed ({stats.rate}%)
      </span>
    </div>
  );
}

function WorkerRows({ list }: { list: CourseSnapshotWorker[] }) {
  return (
    <>
      {list.map((w) => {
        const cfg = STATUS_CONFIG[w.status];
        const Icon = cfg.icon;
        return (
          <tr key={w.workerId} className="hover:bg-muted/20 transition-colors">
            <td className="px-6 py-3 text-sm font-semibold text-foreground">{w.workerName}</td>
            <td className="px-6 py-3 text-sm text-muted-foreground">{w.roleName ?? ROLE_UNKNOWN}</td>
            <td className="px-6 py-3 text-sm text-muted-foreground">{w.jurisdictionName ?? NO_JURISDICTION}</td>
            <td className="px-6 py-3">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${cfg.className}`}
              >
                <Icon className="h-3 w-3" />
                {cfg.label}
              </span>
            </td>
            <td className="px-6 py-3 text-muted-foreground text-xs">
              {w.completedAt ? format(new Date(w.completedAt), "yyyy-MM-dd HH:mm") : "—"}
            </td>
            <td className="px-6 py-3 font-mono text-sm text-foreground">
              {w.quizScore !== null ? `${w.quizScore}%` : "—"}
            </td>
          </tr>
        );
      })}
    </>
  );
}

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      <th className="px-6 py-4">Worker</th>
      <th className="px-6 py-4">Role</th>
      <th className="px-6 py-4">Jurisdiction (current)</th>
      <th className="px-6 py-4">Status</th>
      <th className="px-6 py-4">Completed</th>
      <th className="px-6 py-4">Quiz Score</th>
    </tr>
  </thead>
);

export default function CourseSnapshotPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [groupByRole, setGroupByRole] = useState(true);
  const [groupByJurisdiction, setGroupByJurisdiction] = useState(false);

  const { data, isLoading, error } = useCourseSnapshotQuery(courseId);

  const workers = useMemo(() => data?.workers ?? [], [data]);
  const overall = useMemo(() => statCounts(workers), [workers]);

  const grouped = useMemo(() => {
    if (!groupByRole && !groupByJurisdiction) return null;

    if (groupByRole && groupByJurisdiction) {
      const byRole = new Map<string, Map<string, CourseSnapshotWorker[]>>();
      for (const w of workers) {
        const roleKey = w.roleName ?? ROLE_UNKNOWN;
        const jKey = w.jurisdictionName ?? NO_JURISDICTION;
        if (!byRole.has(roleKey)) byRole.set(roleKey, new Map());
        const inner = byRole.get(roleKey)!;
        if (!inner.has(jKey)) inner.set(jKey, []);
        inner.get(jKey)!.push(w);
      }
      return { kind: "nested" as const, byRole };
    }

    const single = new Map<string, CourseSnapshotWorker[]>();
    for (const w of workers) {
      const key = groupByRole ? w.roleName ?? ROLE_UNKNOWN : w.jurisdictionName ?? NO_JURISDICTION;
      if (!single.has(key)) single.set(key, []);
      single.get(key)!.push(w);
    }
    return { kind: "single" as const, single };
  }, [workers, groupByRole, groupByJurisdiction]);

  const handleExport = (fmt: "csv" | "xlsx") => {
    const url = `/api/reports/courses/${courseId}/export?format=${fmt}`;
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`${fmt === "csv" ? "CSV" : "Excel"} download triggered`);
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      <button
        onClick={() => router.push("/admin/reports")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Reports
      </button>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
          <p className="text-sm font-medium">Building snapshot...</p>
        </div>
      ) : error ? (
        <div className="bg-card border border-destructive/30 rounded-2xl p-8 text-center">
          <p className="text-sm text-destructive font-semibold">{error.message}</p>
        </div>
      ) : data ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400]">
                {data.course.title}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                Workforce snapshot as of publish date — {format(new Date(data.course.publishedAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport("csv")}
                disabled={workers.length === 0}
                variant="outline"
                className="h-10 gap-2 text-xs font-bold"
              >
                <FileText className="h-4 w-4" />
                CSV
              </Button>
              <Button
                onClick={() => handleExport("xlsx")}
                disabled={workers.length === 0}
                className="h-10 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold gap-2 border-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workforce</p>
              <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white mt-1">{overall.total}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completed</p>
              <p className="text-2xl font-extrabold text-emerald-500 mt-1">{overall.completed}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In Progress</p>
              <p className="text-2xl font-extrabold text-blue-500 mt-1">{overall.inProgress}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-extrabold text-[#1B2A6B] dark:text-white mt-1">{overall.rate}%</p>
            </div>
          </div>

          {/* Group-by controls */}
          <div className="flex flex-wrap items-center gap-4 bg-card border border-border rounded-2xl px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Group by</span>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <Checkbox checked={groupByRole} onCheckedChange={(v) => setGroupByRole(v === true)} />
              Role
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <Checkbox checked={groupByJurisdiction} onCheckedChange={(v) => setGroupByJurisdiction(v === true)} />
              Jurisdiction (current — not historical, see note below)
            </label>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              {workers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <p className="text-muted-foreground text-sm max-w-md">
                    No workers were active as of the publish date.
                  </p>
                </div>
              ) : !grouped ? (
                <table className="w-full text-left border-collapse">
                  {TABLE_HEAD}
                  <tbody className="divide-y divide-border">
                    <WorkerRows list={workers} />
                  </tbody>
                </table>
              ) : grouped.kind === "single" ? (
                <table className="w-full text-left border-collapse">
                  {TABLE_HEAD}
                  <tbody className="divide-y divide-border">
                    {sortGroupKeys([...grouped.single.keys()]).map((key) => (
                      <Fragment key={key}>
                        <tr>
                          <td colSpan={6} className="p-0">
                            <GroupHeader label={key} list={grouped.single.get(key)!} />
                          </td>
                        </tr>
                        <WorkerRows list={grouped.single.get(key)!} />
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  {TABLE_HEAD}
                  <tbody className="divide-y divide-border">
                    {sortGroupKeys([...grouped.byRole.keys()]).map((roleKey) => {
                      const inner = grouped.byRole.get(roleKey)!;
                      const roleList = [...inner.values()].flat();
                      return (
                        <Fragment key={roleKey}>
                          <tr>
                            <td colSpan={6} className="p-0">
                              <GroupHeader label={roleKey} list={roleList} />
                            </td>
                          </tr>
                          {sortGroupKeys([...inner.keys()]).map((jKey) => (
                            <Fragment key={jKey}>
                              <tr>
                                <td colSpan={6} className="px-6 py-2 pl-10 text-xs font-semibold text-muted-foreground bg-muted/10">
                                  {jKey} ({inner.get(jKey)!.length})
                                </td>
                              </tr>
                              <WorkerRows list={inner.get(jKey)!} />
                            </Fragment>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground max-w-2xl">
            Role is reconstructed from employment history as of the publish date — workers with no role
            event before that date show as &ldquo;{ROLE_UNKNOWN}&rdquo; rather than a guess. Jurisdiction
            is not versioned in the system yet, so it always reflects the worker&apos;s current jurisdiction,
            not necessarily their jurisdiction on the publish date.
          </p>
        </>
      ) : null}
    </div>
  );
}
