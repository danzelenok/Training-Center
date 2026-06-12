"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
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

interface Course {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  telegramMessageId: string | null;
  telegramGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // New Course Dialog states
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Actions states
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Fetch Courses
  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      const data = await res.json();
      setCourses(data);
    } catch (err: any) {
      toast.error(err.message || "Could not load courses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
        }),
      });

      if (!res.ok) throw new Error("Failed to create course");
      const data = await res.json();

      toast.success("Course created successfully!");
      setOpenNewDialog(false);
      setNewTitle("");
      setNewDescription("");

      // Redirect to course editor
      router.push(`/admin/courses/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Error creating course");
    } finally {
      setCreating(false);
    }
  };

  // Publish Course
  const handlePublishCourse = async (id: string) => {
    setPublishingId(id);
    const toastId = toast.loading("Publishing course & broadcasting to Telegram...");
    try {
      const res = await fetch(`/api/courses/${id}/publish`, {
        method: "POST",
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await res.json()).error
          : `Server error ${res.status}`;
        throw new Error(msg || "Failed to publish course");
      }
      const data = await res.json();

      toast.success("Course published and Telegram alert broadcasted!", { id: toastId });
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || "Publishing failed", { id: toastId });
    } finally {
      setPublishingId(null);
    }
  };

  // Revoke Course (delete Telegram message, reset to draft)
  const handleRevokeCourse = async (id: string) => {
    if (!confirm("Revoke this course? The Telegram message will be deleted and the course will return to draft.")) {
      return;
    }
    setRevokingId(id);
    const toastId = toast.loading("Revoking course...");
    try {
      const res = await fetch(`/api/courses/${id}/publish`, { method: "DELETE" });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await res.json()).error
          : `Server error ${res.status}`;
        throw new Error(msg || "Failed to revoke course");
      }
      toast.success("Course revoked. Telegram message deleted.", { id: toastId });
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke course", { id: toastId });
    } finally {
      setRevokingId(null);
    }
  };

  // Resend Course (send new Telegram announcement)
  const handleResendCourse = async (id: string) => {
    setResendingId(id);
    const toastId = toast.loading("Resending to Telegram...");
    try {
      const res = await fetch(`/api/courses/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await res.json()).error
          : `Server error ${res.status}`;
        throw new Error(msg || "Failed to resend course");
      }
      const data = await res.json();
      toast.success("Course resent to Telegram!", { id: toastId });
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend course", { id: toastId });
    } finally {
      setResendingId(null);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course and all its slides? This action is permanent!")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete course");
      toast.success("Course deleted successfully");
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || "Error deleting course");
    } finally {
      setDeletingId(null);
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

        {/* New Course Button + Dialog */}
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Slides</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((course) => (
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
                            disabled={course.slideCount === 0 || publishingId === course.id}
                            onClick={() => handlePublishCourse(course.id)}
                            className="h-9 px-3 text-xs font-semibold text-[#C8D400] hover:bg-[#C8D400]/10 hover:text-[#B6C200] disabled:opacity-40 disabled:hover:bg-transparent rounded-lg cursor-pointer"
                          >
                            {publishingId === course.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5 mr-1" /> Broadcast
                              </>
                            )}
                          </Button>
                        )}

                        {/* Resend Button (Only for published courses) */}
                        {course.status === "published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={resendingId === course.id || revokingId === course.id}
                            onClick={() => handleResendCourse(course.id)}
                            title="Resend to Telegram"
                            className="h-9 w-9 p-0 text-muted-foreground hover:bg-[#C8D400]/10 hover:text-[#C8D400] rounded-lg cursor-pointer"
                          >
                            {resendingId === course.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        {/* Revoke Button (Only for published courses) */}
                        {course.status === "published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingId === course.id || resendingId === course.id}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
