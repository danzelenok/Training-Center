import { useState } from "react";
import {
  Search,
  Users,
  CheckCircle,
  Clock,
  Loader2,
  ChevronDown,
  RefreshCw,
  Unlink,
  UserX,
  UserCheck,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPhoneDisplay } from "@/lib/phone";
import { workerDisplayName, type Worker, type Course } from "@/hooks/admin/workers/types";
import { useMeQuery } from "@/hooks/admin/useMeQuery";

interface WorkersTableProps {
  workers: Worker[];
  loading: boolean;
  deactivatedCount: number;
  publishedCourses: Course[];
  assigningWorkerId: string | null;
  reissuingWorkerId: string | null;
  togglingActiveId: string | null;
  onOpenWorkerDetail: (worker: Worker) => void;
  onAssignCourse: (workerId: string, courseId: string) => void;
  onReissueInvite: (worker: Worker) => void;
  onOpenUnbindConfirm: (worker: Worker) => void;
  onToggleActive: (worker: Worker) => void;
}

export function WorkersTable({
  workers,
  loading,
  deactivatedCount,
  publishedCourses,
  assigningWorkerId,
  reissuingWorkerId,
  togglingActiveId,
  onOpenWorkerDetail,
  onAssignCourse,
  onReissueInvite,
  onOpenUnbindConfirm,
  onToggleActive,
}: WorkersTableProps) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "deactivated">("active");
  const { data: me } = useMeQuery();
  // Same rule as WorkerDetailSheet: every action in this row's dropdown now
  // 403s server-side for a worker outside a jurisdiction_admin's own state
  // (see app/api/workers/[id]/{assign,invites,unbind} and app/api/reports/[id]).
  const canEdit = (worker: Worker) =>
    me?.role === "org_admin" || (me?.role === "jurisdiction_admin" && worker.jurisdictionId === me.jurisdiction?.id);

  const filteredWorkers = workers.filter((w) => {
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

  return (
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
        ) : workers.length === 0 ? (
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
                  onClick={() => onOpenWorkerDetail(worker)}
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
                    {!canEdit(worker) ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 h-9"
                        title="Read-only — another jurisdiction"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    ) : (
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
                                  onClick={() => onAssignCourse(worker.id, course.id)}
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
                          onClick={() => onReissueInvite(worker)}
                          className="cursor-pointer hover:bg-muted text-xs rounded-lg px-3 py-2 transition-colors font-semibold text-blue-400 gap-2"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reissue Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onOpenUnbindConfirm(worker)}
                          className="cursor-pointer hover:bg-destructive/10 text-xs rounded-lg px-3 py-2 transition-colors font-semibold text-destructive gap-2"
                        >
                          <Unlink className="h-3.5 w-3.5" /> Reset Telegram Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleActive(worker)}
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
