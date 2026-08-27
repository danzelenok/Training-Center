"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCloneCourseMutation } from "@/hooks/admin/courses/mutations";
import type { JurisdictionRef } from "@/hooks/admin/workers/types";
import type { MeResponse } from "@/hooks/admin/useMeQuery";

interface CourseListItem {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  ownerJurisdictionId: string;
  slideCount: number;
}

interface BrowseCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseListItem[];
  jurisdictions: JurisdictionRef[];
  me: MeResponse | undefined;
}

function jurisdictionLabel(id: string, jurisdictions: JurisdictionRef[]) {
  return jurisdictions.find((j) => j.id === id)?.code ?? "?";
}

export function BrowseCloneDialog({ open, onOpenChange, courses, jurisdictions, me }: BrowseCloneDialogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [orgAdminTargetJurisdiction, setOrgAdminTargetJurisdiction] = useState<string | null>(null);
  const cloneCourse = useCloneCourseMutation();

  const filtered = courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  const handleClone = (courseId: string) => {
    const jurisdictionId = me?.role === "org_admin" ? orgAdminTargetJurisdiction : undefined;
    if (me?.role === "org_admin" && !jurisdictionId) {
      toast.error("Pick a target state first.");
      return;
    }
    cloneCourse.mutate(
      { courseId, jurisdictionId },
      {
        onSuccess: (data) => {
          toast.success("Course cloned — it's now an independent draft.");
          onOpenChange(false);
          router.push(`/admin/courses/${data.id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            Clone an Existing Course
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Browse courses across every jurisdiction in your organization. Cloning makes a fully
            independent copy — editing it never changes the original.
          </DialogDescription>
        </DialogHeader>

        {me?.role === "org_admin" && (
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Clone into which state? <span className="text-red-400">*</span>
            </label>
            <Select value={orgAdminTargetJurisdiction ?? undefined} onValueChange={setOrgAdminTargetJurisdiction}>
              <SelectTrigger className="w-full bg-background border-border rounded-xl h-10">
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
        )}

        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="bg-background border-border text-foreground pl-9 rounded-xl h-10"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 pt-1">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-8">No courses found.</p>
          )}
          {filtered.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{course.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {jurisdictionLabel(course.ownerJurisdictionId, jurisdictions)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {course.slideCount} {course.slideCount === 1 ? "slide" : "slides"} ·{" "}
                    {course.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                disabled={cloneCourse.isPending}
                onClick={() => handleClone(course.id)}
                className="shrink-0 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-bold text-xs rounded-lg gap-1.5"
              >
                {cloneCourse.isPending && cloneCourse.variables?.courseId === course.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Clone
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
