"use client";

import { useRouter } from "next/navigation";
import { FileText, Loader2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useReportCoursesQuery } from "@/hooks/admin/reports/queries";

export function CourseReportsTab() {
  const router = useRouter();
  const coursesQuery = useReportCoursesQuery();
  const courses = coursesQuery.data ?? [];
  const loading = coursesQuery.isLoading;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Pick a course to see a compliance snapshot of the workforce as of its publish date.
      </p>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
              <p className="text-sm font-medium">Fetching courses...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">
                No courses yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Create and publish a course to see its compliance snapshot here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Course</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Published</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((course) => {
                  const canDrillDown = course.status === "published" && !!course.publishedAt;
                  return (
                    <tr
                      key={course.id}
                      onClick={() => canDrillDown && router.push(`/admin/reports/courses/${course.id}`)}
                      className={`transition-colors ${
                        canDrillDown ? "hover:bg-muted/20 cursor-pointer" : "opacity-60"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">{course.title}</td>
                      <td className="px-6 py-4">
                        {course.status === "published" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-2.5 py-1 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/20">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                            Draft — no snapshot yet
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {course.publishedAt ? format(new Date(course.publishedAt), "yyyy-MM-dd HH:mm") : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canDrillDown && <ChevronRight className="h-4 w-4 text-muted-foreground inline-block" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
