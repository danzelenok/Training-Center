"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Sparkles,
  Send,
  RotateCcw,
  XCircle,
  Loader2,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle,
  FileText,
  Clock,
  Copy,
  Lock,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoursesQuery, useJurisdictionsQuery, useJobRolesQuery } from "@/hooks/admin/workers/queries";
import { RoleMultiSelect } from "@/components/admin/RoleMultiSelect";
import { useMeQuery } from "@/hooks/admin/useMeQuery";
import {
  useCreateCourseMutation,
  useRevokeCourseMutation,
  useDeleteCourseMutation,
  useCloneCourseMutation,
} from "@/hooks/admin/courses/mutations";
import { PublishCourseDialog } from "@/components/admin/courses/PublishCourseDialog";
import { BrowseCloneDialog } from "@/components/admin/courses/BrowseCloneDialog";

interface Course {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  ownerJurisdictionId: string;
  roleIds: string[];
  telegramMessageId: string | null;
  telegramGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const coursesQuery = useCoursesQuery("all");
  const courses = (coursesQuery.data ?? []) as Course[];
  const loading = coursesQuery.isLoading;
  const meQuery = useMeQuery();
  const me = meQuery.data;
  const jurisdictionsQuery = useJurisdictionsQuery();
  const jurisdictions = jurisdictionsQuery.data ?? [];
  const jobRolesQuery = useJobRolesQuery();
  const jobRoles = jobRolesQuery.data ?? [];

  const canWrite = (course: Course) =>
    me?.role === "org_admin" || (me?.role === "jurisdiction_admin" && course.ownerJurisdictionId === me.jurisdiction?.id);

  // New Course Dialog states
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [openBrowseDialog, setOpenBrowseDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newJurisdictionId, setNewJurisdictionId] = useState<string | null>(null);
  const cloneCourseMutation = useCloneCourseMutation();

  // Actions states
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);

  // List filters — all client-side over the already-fetched `courses` array
  // (GET /api/courses already returns ownerJurisdictionId/status/slideCount
  // for every course, so nothing here needs a new API call).
  const [searchQuery, setSearchQuery] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || jurisdictionFilter !== "all" || statusFilter !== "all" || roleFilter.length > 0;
  const clearFilters = () => {
    setSearchQuery("");
    setJurisdictionFilter("all");
    setStatusFilter("all");
    setRoleFilter([]);
  };
  const toggleRoleFilter = (roleId: string, checked: boolean) => {
    setRoleFilter((prev) => (checked ? [...prev, roleId] : prev.filter((id) => id !== roleId)));
  };

  const filteredCourses = courses.filter((course) => {
    if (jurisdictionFilter !== "all" && course.ownerJurisdictionId !== jurisdictionFilter) return false;
    if (statusFilter !== "all" && course.status !== statusFilter) return false;
    if (roleFilter.length > 0 && !course.roleIds.some((id) => roleFilter.includes(id))) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !course.title.toLowerCase().includes(q) && !course.description.toLowerCase().includes(q)) return false;
    return true;
  });

  // Publish/Resend dialog — audience picker for a first publish, re-notify
  // confirmation for an already-published course (see PublishCourseDialog).
  // Both used to fire straight at POST /api/courses/:id/publish with no
  // body, which the API defaults to assignTo: "all" — broadcasting (and, on
  // first publish, assigning) to literally every worker in the org with no
  // way to scope it. Routing through the same dialog the course editor uses
  // fixes that.
  const [publishDialogCourseId, setPublishDialogCourseId] = useState<string | null>(null);
  const [publishDialogAlreadyPublished, setPublishDialogAlreadyPublished] = useState(false);

  const createCourseMutation = useCreateCourseMutation();
  const revokeCourseMutation = useRevokeCourseMutation();
  const deleteCourseMutation = useDeleteCourseMutation();

  const creating = createCourseMutation.isPending;
  const revokingId = revokeCourseMutation.isPending ? revokeCourseMutation.variables ?? null : null;
  const deletingId = deleteCourseMutation.isPending ? deleteCourseMutation.variables ?? null : null;

  // Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (me?.role === "org_admin" && !newJurisdictionId) {
      toast.error("Pick a state for this course.");
      return;
    }

    try {
      const data = await createCourseMutation.mutateAsync({
        title: newTitle,
        description: newDescription,
        jurisdictionId: me?.role === "org_admin" ? newJurisdictionId : undefined,
      });

      toast.success("Course created successfully!");
      setOpenNewDialog(false);
      setNewTitle("");
      setNewDescription("");
      setNewJurisdictionId(null);

      // Redirect to course editor
      router.push(`/admin/courses/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Error creating course");
    }
  };

  // Publish Course — opens the audience-picker dialog rather than firing
  // straight at the API; see the publishDialogCourseId comment above.
  const openPublishDialog = (id: string, alreadyPublished: boolean) => {
    setPublishDialogAlreadyPublished(alreadyPublished);
    setPublishDialogCourseId(id);
  };

  // Revoke Course (delete Telegram message, reset to draft)
  const handleRevokeCourse = async (id: string) => {
    if (!confirm("Revoke this course? The Telegram message will be deleted and the course will return to draft.")) {
      return;
    }
    const toastId = toast.loading("Revoking course...");
    try {
      await revokeCourseMutation.mutateAsync(id);
      toast.success("Course revoked. Telegram message deleted.", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke course", { id: toastId });
    }
  };

  // Delete Course
  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course and all its slides? This action is permanent!")) {
      return;
    }

    try {
      await deleteCourseMutation.mutateAsync(id);
      toast.success("Course deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Error deleting course");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A6B] dark:text-[#C8D400] sm:text-4xl">
            Course Management
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Create, configure, AI-generate, and publish safety training modules for workers.
          </p>
        </div>

        {/* Two entry points: start a new course from scratch, or clone an existing one */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpenBrowseDialog(true)}
            className="h-11 border-border text-foreground gap-2 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            Clone Existing
          </Button>
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
          <DialogTrigger asChild>
            <Button className="h-11 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold shadow-lg shadow-[#C8D400]/25 gap-2 border-0 cursor-pointer transition-all duration-200 hover:scale-[1.02]">
              <Plus className="h-5 w-5 stroke-[2.5]" />
              New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1B2A6B] dark:text-[#C8D400]">Create Safety Course</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Enter details for the new training course. Once created, you can write slides manually or generate them with AI.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCourse} className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="title" className="text-xs font-semibold text-muted-foreground">
                  Course Title
                </label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Fire Safety and Evacuation Protocol"
                  className="bg-background border-border focus:border-primary text-foreground rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="description" className="text-xs font-semibold text-muted-foreground">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Summarize the core topics covered in this training..."
                  className="bg-background border-border focus:border-primary text-foreground rounded-lg min-h-[100px]"
                />
              </div>
              {me?.role === "org_admin" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    State <span className="text-red-400">*</span>
                  </label>
                  <Select value={newJurisdictionId ?? undefined} onValueChange={setNewJurisdictionId}>
                    <SelectTrigger className="w-full bg-background border-border rounded-lg">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border text-foreground">
                      {jurisdictions.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name} ({j.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : me?.jurisdiction ? (
                <p className="text-xs text-muted-foreground">
                  Creating in: <span className="font-semibold text-foreground">{me.jurisdiction.name}</span>
                </p>
              ) : null}
              <DialogFooter className="pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenNewDialog(false)}
                  className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Course"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      {courses.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or description..."
              className="bg-card border-border pl-9 rounded-xl h-10"
            />
          </div>
          <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-card border-border rounded-xl h-10">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent className="bg-card border border-border text-foreground">
              <SelectItem value="all">All states</SelectItem>
              {jurisdictions.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.code} &middot; {j.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "draft" | "published")}>
            <SelectTrigger className="w-full sm:w-[150px] bg-card border-border rounded-xl h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border border-border text-foreground">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          {jobRoles.length > 0 && (
            <div className="w-full sm:w-[180px]">
              <RoleMultiSelect
                roles={jobRoles}
                selectedIds={roleFilter}
                onToggle={toggleRoleFilter}
                placeholder="Any role"
              />
            </div>
          )}
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="h-10 border-border text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Courses List Container */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
            <p className="text-sm font-medium">Fetching courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">No Courses Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Get started by creating your first safety training course. You can design custom slides or upload a PPTX presentation.
            </p>
            <Button
              onClick={() => setOpenNewDialog(true)}
              className="bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" /> Create First Course
            </Button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground mb-4">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400] mb-1">No courses match your filters</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Try a different search term or clear the filters below.
            </p>
            <Button
              onClick={clearFilters}
              className="bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
            >
              <X className="mr-2 h-4 w-4" /> Clear filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">State</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Slides</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCourses.map((course) => {
                  const writable = canWrite(course);
                  const jurisdictionCode = jurisdictions.find((j) => j.id === course.ownerJurisdictionId)?.code;
                  return (
                  <tr
                    key={course.id}
                    onClick={() => router.push(`/admin/courses/${course.id}`)}
                    className="hover:bg-[#C8D400]/5 dark:hover:bg-[#C8D400]/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-semibold text-[#1B2A6B] dark:text-white group-hover:text-[#C8D400] transition-colors truncate">
                        {course.title}
                      </div>
                      <div
                        className={`text-xs text-muted-foreground mt-0.5 ${expandedDescId === course.id ? "" : "truncate"}`}
                        onClick={(e) => {
                          if (!course.description) return;
                          e.stopPropagation();
                          setExpandedDescId(expandedDescId === course.id ? null : course.id);
                        }}
                        title={course.description && expandedDescId !== course.id ? "Click to expand" : undefined}
                        style={course.description ? { cursor: "pointer" } : undefined}
                      >
                        {course.description || "No description provided"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{jurisdictionCode ?? "?"}</Badge>
                        {!writable && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Read-only — owned by another jurisdiction" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {course.status === "published" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20">
                          <CheckCircle className="h-3.5 w-3.5" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C8D400]/10 px-2.5 py-1 text-xs font-semibold text-[#C8D400] border border-[#C8D400]/20 dark:bg-[#C8D400]/20">
                          <Clock className="h-3.5 w-3.5" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        {course.slideCount} {course.slideCount === 1 ? "slide" : "slides"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(course.createdAt), "MMM d, yyyy")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {!writable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cloneCourseMutation.isPending}
                            onClick={() => {
                              cloneCourseMutation.mutate(
                                { courseId: course.id },
                                {
                                  onSuccess: (data) => {
                                    toast.success("Course cloned — it's now an independent draft.");
                                    router.push(`/admin/courses/${data.id}`);
                                  },
                                }
                              );
                            }}
                            title="Clone to my jurisdiction"
                            className="h-9 px-3 text-xs font-semibold text-foreground hover:bg-muted rounded-lg cursor-pointer gap-1.5"
                          >
                            {cloneCourseMutation.isPending && cloneCourseMutation.variables?.courseId === course.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Clone
                          </Button>
                        )}
                        {writable && (
                        <>
                        {/* Edit Button */}
                        <Link href={`/admin/courses/${course.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-foreground hover:bg-muted hover:text-[#C8D400] rounded-lg cursor-pointer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>

                        {/* Publish Button (Only for drafts with slides) */}
                        {course.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={course.slideCount === 0}
                            onClick={() => openPublishDialog(course.id, false)}
                            className="h-9 px-3 text-xs font-semibold text-[#C8D400] hover:bg-[#C8D400]/10 hover:text-[#B6C200] disabled:opacity-40 disabled:hover:bg-transparent rounded-lg cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Broadcast
                          </Button>
                        )}

                        {/* Resend Button (Only for published courses) */}
                        {course.status === "published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingId === course.id}
                            onClick={() => openPublishDialog(course.id, true)}
                            title="Resend to Telegram"
                            className="h-9 w-9 p-0 text-muted-foreground hover:bg-[#C8D400]/10 hover:text-[#C8D400] rounded-lg cursor-pointer"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Revoke Button (Only for published courses) */}
                        {course.status === "published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingId === course.id}
                            onClick={() => handleRevokeCourse(course.id)}
                            title="Revoke course from Telegram"
                            className="h-9 w-9 p-0 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400 rounded-lg cursor-pointer"
                          >
                            {revokingId === course.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </Button>
                        )}
 
                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === course.id}
                          onClick={() => handleDeleteCourse(course.id)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 rounded-lg cursor-pointer"
                        >
                          {deletingId === course.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PublishCourseDialog
        open={publishDialogCourseId !== null}
        onOpenChange={(open) => !open && setPublishDialogCourseId(null)}
        courseId={publishDialogCourseId}
        alreadyPublished={publishDialogAlreadyPublished}
      />

      <BrowseCloneDialog
        open={openBrowseDialog}
        onOpenChange={setOpenBrowseDialog}
        courses={courses}
        jurisdictions={jurisdictions}
        me={me}
      />
    </div>
  );
}
