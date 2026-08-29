"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkersQuery } from "@/hooks/admin/workers/queries";
import { usePublishCourseMutation } from "@/hooks/admin/course-editor/mutations";

interface PublishCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  // Draft courses get the full audience picker (this is the one and only
  // moment assignments are created — see app/api/courses/[id]/publish/route.ts,
  // the "isFirstPublish" branch). Already-published courses can only re-notify
  // whoever is already assigned; the endpoint silently ignores assignTo/workerIds
  // once isFirstPublish is false, so the picker would just be inert UI.
  alreadyPublished: boolean;
}

export function PublishCourseDialog({ open, onOpenChange, courseId, alreadyPublished }: PublishCourseDialogProps) {
  const queryClient = useQueryClient();
  const workersQuery = useWorkersQuery();
  const publishMutation = usePublishCourseMutation(courseId ?? "");

  const [assignTo, setAssignTo] = useState<"all" | "specific">("all");
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset the form each time the dialog transitions from closed to open
  // (adjust-during-render, not an effect — same pattern as the picker dialogs
  // in components/admin/workers/*PickerDialog.tsx).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAssignTo("all");
      setWorkerIds([]);
      setNotifyTelegram(true);
    }
  }

  const workersList = (workersQuery.data?.workers ?? [])
    .filter((w) => w.active)
    .map((w) => ({
      id: w.id,
      label: w.displayName || [w.firstName, w.lastName].filter(Boolean).join(" ") || w.telegramUsername || w.telegramUserId || "",
    }));
  const pickersLoading = workersQuery.isLoading;

  const handleConfirm = async () => {
    if (!courseId) return;
    const toastMsg = alreadyPublished
      ? (notifyTelegram ? "Resending & notifying assigned workers…" : "Resending…")
      : (notifyTelegram ? "Publishing & sending direct messages to workers…" : "Publishing course…");
    const toastId = toast.loading(toastMsg);
    try {
      await publishMutation.mutateAsync({
        assignTo,
        workerIds: assignTo === "specific" ? workerIds : [],
        notifyWorkers: notifyTelegram,
      });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      const successMsg = alreadyPublished
        ? "Announcement resent to assigned workers."
        : notifyTelegram
          ? "Course is LIVE! Direct messages sent to assigned workers."
          : "Course published without announcements.";
      toast.success(successMsg, { id: toastId });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Publishing failed", { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
            {alreadyPublished ? "Resend Announcement" : "Publish Course"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            {alreadyPublished
              ? "This course is already published. Choose whether to re-send the Telegram announcement to everyone currently assigned."
              : "Choose who can see this course and whether to post an announcement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {!alreadyPublished && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Assign to
              </p>
              <RadioGroup
                value={assignTo}
                onValueChange={(v) => setAssignTo(v as "all" | "specific")}
                className="space-y-2"
              >
                <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="all" className="mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground">All current workers</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Every registered worker gets access immediately. Future workers will also be auto-assigned.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="specific" className="mt-0.5" />
                  <div className="w-full">
                    <p className="text-xs font-bold text-foreground">Specific workers</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Only the workers you select below will see this course.
                    </p>
                    {assignTo === "specific" && (
                      <div className="mt-3 max-h-40 overflow-y-auto space-y-1 pr-1">
                        {pickersLoading ? (
                          <p className="text-[10px] text-muted-foreground">Loading workers…</p>
                        ) : workersList.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No registered workers yet.</p>
                        ) : (
                          workersList.map((w) => (
                            <label key={w.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={workerIds.includes(w.id)}
                                onCheckedChange={(checked) =>
                                  setWorkerIds((prev) =>
                                    checked ? [...prev, w.id] : prev.filter((x) => x !== w.id)
                                  )
                                }
                              />
                              <span className="text-xs text-foreground">{w.label}</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">Send announcement via DM to assigned workers</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Sends a direct Telegram message with a &ldquo;Start Learning&rdquo; button to each assigned worker.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifyTelegram}
              onClick={() => setNotifyTelegram(!notifyTelegram)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                notifyTelegram ? "bg-[#C8D400]" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  notifyTelegram ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:text-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              publishMutation.isPending ||
              (!alreadyPublished && assignTo === "specific" && workerIds.length === 0)
            }
            className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold border-0 text-xs px-4"
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {alreadyPublished ? "Resend" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
