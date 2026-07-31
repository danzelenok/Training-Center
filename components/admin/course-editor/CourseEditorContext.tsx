"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Slide } from "./CardCanvas";
import type { Course, MediaLibraryFile } from "@/hooks/admin/course-editor/types";
import {
  useCourseQuery,
  useMediaFilesQuery,
  useGenerationPollingQuery,
} from "@/hooks/admin/course-editor/queries";
import {
  useAutosaveMutation,
  useSaveCourseMutation,
  useUploadFileMutation,
  useGenerateAIMutation,
  usePPTXUploadMutation,
} from "@/hooks/admin/course-editor/mutations";

export type { Course, MediaLibraryFile };

interface CourseEditorContextType {
  course: Course | null;
  slidesList: Slide[];
  loading: boolean;
  saveStatus: "saved" | "saving" | "error" | null;
  activeSlideIndex: number | null;
  importing: boolean;
  publishing: boolean;
  mediaPickerOpen: boolean;
  mediaFiles: MediaLibraryFile[];
  mediaLoading: boolean;
  activeTab: "library" | "upload" | "pexels";
  isDragOver: boolean;
  pexelsQuery: string;
  pexelsResults: { id: number; url: string; thumbnail: string; photographer: string }[];
  pexelsLoading: boolean;
  styleDialogOpen: boolean;
  themeImagePending: boolean;
  aiDialogOpen: boolean;
  aiPrompt: string;
  aiModel: "fast" | "advanced";
  aiUseLNI: boolean;
  aiGenerating: boolean;

  publishDialogOpen: boolean;
  publishAssignTo: "all" | "teams" | "specific";
  publishWorkerIds: string[];
  publishTeamIds: string[];
  publishNotifyTelegram: boolean;
  publishWorkersList: { id: string; label: string }[];
  publishTeamsList: { id: string; label: string; memberCount: number }[];
  publishWorkersLoading: boolean;

  setSlidesList: React.Dispatch<React.SetStateAction<Slide[]>>;
  setActiveSlideIndex: (idx: number | null) => void;
  setMediaPickerOpen: (open: boolean) => void;
  setActiveTab: (tab: "library" | "upload" | "pexels") => void;
  setIsDragOver: (dragOver: boolean) => void;
  setPexelsQuery: (query: string) => void;
  setStyleDialogOpen: (open: boolean) => void;
  setThemeImagePending: (pending: boolean) => void;
  setAiDialogOpen: (open: boolean) => void;
  setAiPrompt: (prompt: string) => void;
  setAiModel: (model: "fast" | "advanced") => void;
  setAiUseLNI: (value: boolean) => void;

  setPublishDialogOpen: (open: boolean) => void;
  setPublishAssignTo: (value: "all" | "teams" | "specific") => void;
  setPublishWorkerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPublishTeamIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPublishNotifyTelegram: (value: boolean) => void;
  confirmPublish: () => Promise<void>;

  updateCourseStyle: (type: string, value: string) => void;
  fetchCourse: () => Promise<void>;
  fetchMediaFiles: () => Promise<void>;
  openMediaPicker: () => void;
  handleUploadFile: (file: File) => Promise<void>;
  searchPexels: (query: string) => Promise<void>;
  handleSelectPexelsPhoto: (photo: { id: number; url: string; thumbnail: string; photographer: string }) => void;
  handleSelectFromLibrary: (file: MediaLibraryFile) => void;
  updateCourseMeta: (field: "title" | "description", value: string) => void;
  toggleAutoAssignNewWorkers: () => void;
  addSlide: (type: Slide["type"]) => void;
  deleteSlide: (indexToDelete: number) => void;
  duplicateSlide: (indexToDuplicate: number) => void;
  updateActiveSlideContent: (index: number, updatedFields: any, slideFields?: any) => void;
  handleSaveCourse: () => Promise<void>;
  handlePublish: () => Promise<void>;
  handleGenerateAI: () => Promise<void>;
  handlePPTXUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const CourseEditorContext = createContext<CourseEditorContextType | undefined>(undefined);

export function CourseEditorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [course, setCourse] = useState<Course | null>(null);
  const [slidesList, setSlidesList] = useState<Slide[]>([]);
  const slidesListRef = useRef<Slide[]>([]);
  slidesListRef.current = slidesList;

  // Auto-save states and hooks
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | null>("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const prevPollStatusesRef = useRef<Record<string, string>>({});

  const courseQuery = useCourseQuery(id);
  const loading = courseQuery.isLoading;

  const autosaveMutation = useAutosaveMutation(id);
  // useMutation() returns a fresh result object every render (TanStack Query
  // doesn't memoize it), so depending on `autosaveMutation` itself below would
  // recreate triggerAutoSave — and re-fire the effect that calls it — on every
  // render, including the one caused by its own setSaveStatus("saved"). That
  // self-sustaining saving->saved->saving loop is what left the Sidebar
  // indicator stuck showing "Saving..." even though each cycle's save request
  // genuinely succeeds. `.mutate` itself is stable (memoized on the internal
  // observer), so depend on that instead.
  const autosaveMutate = autosaveMutation.mutate;

  const triggerAutoSave = useCallback(() => {
    if (loading || !course) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(() => {
      autosaveMutate(
        {
          title: course.title,
          description: course.description,
          themeType: course.themeType || "preset",
          themeValue: course.themeValue || "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
          autoAssignNewWorkers: course.autoAssignNewWorkers,
          slides: slidesListRef.current,
        },
        {
          onSuccess: (data) => {
            if (Array.isArray(data.slides)) {
              const serverIds = data.slides.map((s: Slide) => s.id).filter(Boolean);
              const hasIdChanges = slidesListRef.current.some((slide, idx) => serverIds[idx] && slide.id !== serverIds[idx]);
              if (hasIdChanges) {
                isInitialLoad.current = true;
                setSlidesList(prev => prev.map((slide, idx) => ({
                  ...slide,
                  id: serverIds[idx] || slide.id,
                })));
              }
            }
            setSaveStatus("saved");
          },
          onError: (err: Error) => {
            console.error("Auto-save error:", err);
            setSaveStatus("error");
          },
        }
      );
    }, 1500);
  }, [course, loading, autosaveMutate]);

  useEffect(() => {
    if (loading || !course) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    triggerAutoSave();
  }, [
    slidesList,
    course?.title,
    course?.description,
    course?.themeType,
    course?.themeValue,
    triggerAutoSave,
    loading
  ]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Active slide index being edited
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);

  // States for interactive processes
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Media library & upload states
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "upload" | "pexels">("library");
  const [isDragOver, setIsDragOver] = useState(false);
  const [pexelsQuery, setPexelsQuery] = useState("");
  const [pexelsResults, setPexelsResults] = useState<{ id: number; url: string; thumbnail: string; photographer: string }[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);

  // Course styling states
  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [themeImagePending, setThemeImagePending] = useState(false);

  const updateCourseStyle = (type: string, value: string) => {
    if (!course) return;
    setCourse({
      ...course,
      themeType: type,
      themeValue: value,
    });
  };

  // AI generation states
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<"fast" | "advanced">("advanced");
  const [aiUseLNI, setAiUseLNI] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Publish dialog states — untouched in this task (task 2.2)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishAssignTo, setPublishAssignTo] = useState<"all" | "teams" | "specific">("all");
  const [publishWorkerIds, setPublishWorkerIds] = useState<string[]>([]);
  const [publishTeamIds, setPublishTeamIds] = useState<string[]>([]);
  const [publishNotifyTelegram, setPublishNotifyTelegram] = useState(true);
  const [publishWorkersList, setPublishWorkersList] = useState<{ id: string; label: string }[]>([]);
  const [publishTeamsList, setPublishTeamsList] = useState<{ id: string; label: string; memberCount: number }[]>([]);
  const [publishWorkersLoading, setPublishWorkersLoading] = useState(false);

  // Sync course + slidesList from the server whenever a fresh payload for
  // this courseId arrives — mirrors the old fetchCourse() success path.
  // Fires on: initial mount, courseId change, and the invalidate triggered
  // by useGenerateAIMutation's onSuccess (replaces the old `await
  // fetchCourse()` re-call). No isInitialLoad reset here — matching the
  // original, which relied on the ref's default `true` to skip only the
  // very first sync; a later AI-generation refetch is expected to fall
  // through to triggerAutoSave and persist the freshly generated slides,
  // same as before.
  useEffect(() => {
    if (!courseQuery.data) return;
    const data = courseQuery.data;
    setCourse(data);
    const loadedSlides = (data.slides || []).map((s: Slide) => ({
      ...s,
      id: s.id || crypto.randomUUID()
    }));
    setSlidesList(loadedSlides);
    if (data.slides && data.slides.length > 0) {
      setActiveSlideIndex(0);
    }
  }, [courseQuery.data]);

  useEffect(() => {
    if (courseQuery.isError) {
      toast.error(courseQuery.error?.message || "Failed to load course details");
      router.push("/admin/courses");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseQuery.isError]);

  // fetchCourse() is kept on the facade only for interface parity — nothing
  // currently calls it (page.tsx/Sidebar/CardCanvas never did either); the
  // useCourseQuery + sync effect above now own the fetch lifecycle.
  const fetchCourse = useCallback(async () => {
    await courseQuery.refetch();
  }, [courseQuery]);

  // Poll only while Inngest is actively processing slides
  const anySlideGenerating = slidesList.some(
    (s) => s.assetStatus === "generating"
  );
  const shouldPoll = course?.generationStatus === "generating" || anySlideGenerating;

  const generationPollingQuery = useGenerationPollingQuery(id, shouldPoll);

  useEffect(() => {
    const data = generationPollingQuery.data;
    if (!data) return;

    // Detect status transitions from server response (before state update)
    (data.slides || []).forEach((serverSlide) => {
      const prev = prevPollStatusesRef.current[serverSlide.id];
      if (prev === "generating" && serverSlide.assetStatus === "failed") {
        const label = serverSlide.type.charAt(0).toUpperCase() + serverSlide.type.slice(1);
        toast.error(`${label} generation failed.`);
      }
      prevPollStatusesRef.current[serverSlide.id] = serverSlide.assetStatus;
    });

    // Prevent this update from triggering auto-save
    isInitialLoad.current = true;
    setSlidesList((prevSlides) =>
      prevSlides.map((slide) => {
        // Only match by ID — never fall back to position to avoid assigning
        // a wrong ID when slide counts differ, which causes duplicate PKs on save
        const match = data.slides?.find((s) => s.id === slide.id);
        if (match) {
          return {
            ...slide,
            assetStatus: match.assetStatus,
            // Only merge server-generated URL fields — never overwrite user-edited content
            content: {
              ...slide.content,
              ...(match.content?.url !== undefined && { url: match.content.url }),
              ...(match.content?.assetUrl !== undefined && { assetUrl: match.content.assetUrl }),
              ...(match.content?.captions !== undefined && { captions: match.content.captions }),
              ...(match.content?.instructorVideoUrl !== undefined && { instructorVideoUrl: match.content.instructorVideoUrl }),
              ...(match.content?.studentVideoUrl !== undefined && { studentVideoUrl: match.content.studentVideoUrl }),
              ...(match.content?.slots !== undefined && { slots: match.content.slots }),
            },
          };
        }
        return slide;
      })
    );

    const mediaSlides = (data.slides || []).filter((s) => s.type === "audio" || s.type === "dialogue" || s.type === "video");
    const allDone =
      mediaSlides.length === 0 ||
      mediaSlides.every((s) => s.assetStatus === "ready" || s.assetStatus === "failed");

    if (allDone) {
      setCourse((prev) => prev ? { ...prev, generationStatus: "ready" } : null);
      fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationStatus: "ready" }),
      }).catch(() => {});
    } else {
      setCourse((prev) => prev ? { ...prev, generationStatus: data.generationStatus } : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationPollingQuery.data, id]);

  const mediaFilesQuery = useMediaFilesQuery(mediaPickerOpen);
  const uploadFileMutation = useUploadFileMutation();
  const mediaFiles = mediaFilesQuery.data ?? [];
  const mediaLoading = mediaFilesQuery.isFetching || uploadFileMutation.isPending;

  const openMediaPicker = () => {
    setActiveTab("library");
    setMediaPickerOpen(true);
  };

  // fetchMediaFiles() is kept on the facade only for interface parity;
  // nothing currently calls it directly (openMediaPicker used to, now the
  // useMediaFilesQuery's `enabled: mediaPickerOpen` owns that trigger).
  const fetchMediaFiles = useCallback(async () => {
    await mediaFilesQuery.refetch();
  }, [mediaFilesQuery]);

  // Upload and auto-apply file logic for the Media Library Sheet
  const handleUploadFile = async (file: File) => {
    const toastId = toast.loading(`Uploading ${file.name} to library…`);
    try {
      const data = await uploadFileMutation.mutateAsync(file);

      // Auto-select/apply the uploaded file
      const uploadedFile: MediaLibraryFile = {
        fileId: data.fileId,
        name: file.name,
        url: data.url,
        fileType: file.type,
      };
      handleSelectFromLibrary(uploadedFile);
      toast.success(`${file.name} uploaded and applied!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: toastId });
    }
  };

  const searchPexels = async (query: string) => {
    if (!query.trim()) return;
    setPexelsLoading(true);
    try {
      const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Pexels search failed");
      const data = await res.json();
      setPexelsResults(data);
    } catch {
      toast.error("Failed to search Pexels");
    } finally {
      setPexelsLoading(false);
    }
  };

  const handleSelectPexelsPhoto = (photo: { id: number; url: string; thumbnail: string; photographer: string }) => {
    if (themeImagePending) {
      updateCourseStyle("image", photo.url);
      setThemeImagePending(false);
      setMediaPickerOpen(false);
      setStyleDialogOpen(true);
      toast.success("Course theme background set!");
      return;
    }
    if (activeSlideIndex === null) return;
    updateActiveSlideContent(activeSlideIndex, {
      url: photo.url,
      imageUrl: photo.url,
    });
    setMediaPickerOpen(false);
    toast.success("Pexels photo applied!");
  };

  const handleSelectFromLibrary = (file: MediaLibraryFile) => {
    if (themeImagePending) {
      updateCourseStyle("image", file.url);
      setThemeImagePending(false);
      setMediaPickerOpen(false);
      setStyleDialogOpen(true);
      toast.success(`Course theme background set!`);
      return;
    }
    if (activeSlideIndex === null) return;
    // Update active slide media asset
    updateActiveSlideContent(activeSlideIndex, {
      url: file.url,
      imageUrl: file.url,
    });
    setMediaPickerOpen(false);
    toast.success(`Media set: ${file.name}`);
  };

  // Update Course Meta (title, desc)
  const updateCourseMeta = (field: "title" | "description", value: string) => {
    if (!course) return;
    setCourse({ ...course, [field]: value });
  };

  const toggleAutoAssignNewWorkers = () => {
    if (!course) return;
    setCourse({ ...course, autoAssignNewWorkers: !course.autoAssignNewWorkers });
  };

  // Add slide manually
  const addSlide = (type: Slide["type"]) => {
    let newContent = {};

    if (type === "text") {
      newContent = { heading: "New Slide Title", body: "Add your micro-learning contents here..." };
    } else if (type === "video") {
      newContent = { heading: "New Video Card", body: "", url: "" };
    } else if (type === "audio") {
      newContent = { heading: "New Audio Card", body: "", audioScript: "", url: "" };
    } else if (type === "dialogue") {
      newContent = {
        heading: "Foreman & Worker Briefing",
        dialogueLines: [
          { character: "Supervisor", text: "Verify that your helmet is secure before working." },
          { character: "Worker", text: "Got it! Chin-strap is securely clicked." }
        ]
      };
    } else if (type === "chat") {
      newContent = {
        heading: "Chat Discussion",
        chatBubbles: [
          { id: "1", align: "left", type: "text", text: "Make sure to lock out power breakers." },
          { id: "2", align: "right", type: "text", text: "Understood, LOTO complete!" }
        ]
      };
    } else if (type === "poll") {
      newContent = {
        heading: "",
      };
    } else {
      newContent = {
        heading: "",
        options: ["", ""],
        quizType: "single",
        correctIndices: [0],
        correctAnswer: "",
        explanation: ""
      };
    }

    const insertIdx = activeSlideIndex !== null ? activeSlideIndex + 1 : slidesList.length;

    const newSlide: Slide = {
      id: crypto.randomUUID(),
      type,
      content: newContent,
      order: insertIdx + 1,
      assetStatus: "ready"
    };

    const newList = [...slidesList];
    newList.splice(insertIdx, 0, newSlide);

    // Re-index all order properties
    const reorderedList = newList.map((slide, idx) => ({
      ...slide,
      order: idx + 1,
    }));

    setSlidesList(reorderedList);
    setActiveSlideIndex(insertIdx);
    toast.success(`${type.toUpperCase()} block added!`);
  };

  // Delete slide
  const deleteSlide = (indexToDelete: number) => {
    const targetSlide = slidesList[indexToDelete];
    const filtered = slidesList.filter((_, idx) => idx !== indexToDelete);
    const reordered = filtered.map((slide, idx) => ({
      ...slide,
      order: idx + 1,
    }));

    setSlidesList(reordered);

    if (reordered.length === 0) {
      setActiveSlideIndex(null);
    } else if (activeSlideIndex === indexToDelete) {
      setActiveSlideIndex(Math.max(0, indexToDelete - 1));
    } else if (activeSlideIndex !== null && activeSlideIndex > indexToDelete) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }

    toast.info("Slide removed", {
      action: {
        label: "Undo",
        onClick: () => {
          const newList = [...filtered];
          newList.splice(indexToDelete, 0, targetSlide);
          const reorderedBack = newList.map((slide, idx) => ({
            ...slide,
            order: idx + 1,
          }));
          setSlidesList(reorderedBack);
          setActiveSlideIndex(indexToDelete);
          toast.success("Slide restored");
        }
      },
      duration: 6000,
    });
  };

  // Duplicate slide
  const duplicateSlide = (indexToDuplicate: number) => {
    const target = slidesList[indexToDuplicate];
    const newSlide: Slide = {
      ...target,
      id: crypto.randomUUID(),
      order: slidesList.length + 1,
      content: JSON.parse(JSON.stringify(target.content)) // deep copy
    };
    const newList = [...slidesList];
    newList.splice(indexToDuplicate + 1, 0, newSlide);

    // Re-index orders
    const updated = newList.map((slide, idx) => ({
      ...slide,
      order: idx + 1,
    }));
    setSlidesList(updated);
    setActiveSlideIndex(indexToDuplicate + 1);
    toast.success("Slide duplicated successfully!");
  };

  // Update content of the active slide — functional setState so concurrent calls never overwrite each other
  const updateActiveSlideContent = useCallback((index: number, updatedFields: any, slideFields?: any) => {
    setSlidesList(prev => {
      const newList = [...prev];
      newList[index] = {
        ...newList[index],
        content: {
          ...newList[index].content,
          ...updatedFields,
        },
        ...slideFields,
      };
      return newList;
    });
  }, []);

  const saveCourseMutation = useSaveCourseMutation(id);

  // Save changes to database via API
  const handleSaveCourse = async () => {
    if (!course?.title.trim()) {
      toast.error("Course title cannot be empty");
      return;
    }
    setSaveStatus("saving");
    const toastId = toast.loading("Saving changes to server...");
    try {
      const data = await saveCourseMutation.mutateAsync({
        title: course.title,
        description: course.description,
        themeType: course.themeType || "preset",
        themeValue: course.themeValue || "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        slides: slidesListRef.current,
      });

      isInitialLoad.current = true;
      setCourse(data);
      // Only sync server-assigned IDs — don't overwrite local content that may have changed during the fetch
      if (Array.isArray(data.slides)) {
        const serverSlides: Slide[] = data.slides;
        setSlidesList(prev => prev.map((slide, idx) => ({
          ...slide,
          id: serverSlides[idx]?.id || slide.id,
        })));
      }
      setSaveStatus("saved");
      toast.success("All changes saved successfully!", { id: toastId });
    } catch (err: any) {
      setSaveStatus("error");
      toast.error(err.message || "Error saving changes", { id: toastId });
    }
  };

  // Open publish dialog (validate first, save, fetch workers, then open)
  // — untouched in this task (task 2.2 owns the publish flow)
  const handlePublish = async () => {
    if (slidesList.length === 0) {
      toast.error("Cannot publish a course without slides. Add cards or import a PPTX first.");
      return;
    }
    await handleSaveCourse();

    // Reset dialog state
    setPublishAssignTo("all");
    setPublishWorkerIds([]);
    setPublishTeamIds([]);
    setPublishNotifyTelegram(true);

    // Fetch workers (for "specific") and teams (for "teams") pickers
    setPublishWorkersLoading(true);
    setPublishDialogOpen(true);
    try {
      const [workersRes, teamsRes] = await Promise.all([
        fetch("/api/workers"),
        fetch("/api/teams"),
      ]);
      if (workersRes.ok) {
        const data = await workersRes.json();
        setPublishWorkersList(
          (data.workers || [])
            .filter((w: any) => w.active)
            .map((w: any) => ({
              id: w.id,
              label: w.displayName || [w.firstName, w.lastName].filter(Boolean).join(" ") || w.telegramUsername || w.telegramUserId,
            }))
        );
      }
      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setPublishTeamsList(
          data.map((t: any) => ({ id: t.id, label: t.name, memberCount: t.memberCount }))
        );
      }
    } catch {
      // Non-fatal — pickers just stay empty, user can still use "all"
    } finally {
      setPublishWorkersLoading(false);
    }
  };

  // Actually submit the publish with chosen options — untouched in this
  // task (task 2.2 owns the publish flow)
  const confirmPublish = async () => {
    setPublishDialogOpen(false);
    setPublishing(true);
    const toastMsg = publishNotifyTelegram
      ? "Publishing & sending direct messages to workers…"
      : "Publishing course…";
    const toastId = toast.loading(toastMsg);
    try {
      const res = await fetch(`/api/courses/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignTo: publishAssignTo,
          workerIds: publishAssignTo === "specific" ? publishWorkerIds : [],
          teamIds: publishAssignTo === "teams" ? publishTeamIds : [],
          notifyWorkers: publishNotifyTelegram,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed");

      const successMsg = publishNotifyTelegram
        ? "Course is LIVE! Direct messages sent to assigned workers."
        : "Course published without announcements.";
      toast.success(successMsg, { id: toastId });

      if (course) {
        setCourse({
          ...course,
          status: "published",
          telegramMessageId: data.telegramMessageId,
          telegramGroupId: data.telegramGroupId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Error during publication", { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  const generateAIMutation = useGenerateAIMutation(id);

  // AI Slides generation
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a description for the course.");
      return;
    }
    setAiGenerating(true);
    const toastId = toast.loading("AI is generating course structure…");
    try {
      await generateAIMutation.mutateAsync({ prompt: aiPrompt, model: aiModel, useLNI: aiUseLNI });

      toast.success("AI Course generated successfully!", { id: toastId });
      setAiDialogOpen(false);
      setAiPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate course", { id: toastId });
    } finally {
      setAiGenerating(false);
    }
  };

  const pptxUploadMutation = usePPTXUploadMutation(id);

  // PPTX Parser
  const handlePPTXUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pptx")) {
      toast.error("Only PowerPoint (.pptx) files are supported");
      return;
    }
    if (!confirm("Importing slides will overwrite ALL existing slides. Proceed?")) {
      event.target.value = "";
      return;
    }
    setImporting(true);
    const toastId = toast.loading("Uploading and parsing PowerPoint slides...");
    try {
      const data = await pptxUploadMutation.mutateAsync(file);

      toast.success(`Successfully imported ${data.slides?.length || 0} slides!`, { id: toastId });
      const importedSlides = (data.slides || []).map((s: Slide) => ({
        ...s,
        id: s.id || crypto.randomUUID()
      }));
      setSlidesList(importedSlides);
      if (data.slides && data.slides.length > 0) {
        setActiveSlideIndex(0);
      }
    } catch (err: any) {
      toast.error(err.message || "PPTX Import error", { id: toastId });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <CourseEditorContext.Provider
      value={{
        course,
        slidesList,
        loading,
        saveStatus,
        activeSlideIndex,
        importing,
        publishing,
        mediaPickerOpen,
        mediaFiles,
        mediaLoading,
        activeTab,
        isDragOver,
        pexelsQuery,
        pexelsResults,
        pexelsLoading,
        styleDialogOpen,
        themeImagePending,
        aiDialogOpen,
        aiPrompt,
        aiModel,
        aiUseLNI,
        aiGenerating,

        setSlidesList,
        setActiveSlideIndex,
        setMediaPickerOpen,
        setActiveTab,
        setIsDragOver,
        setPexelsQuery,
        setStyleDialogOpen,
        setThemeImagePending,
        setAiDialogOpen,
        setAiPrompt,
        setAiModel,
        setAiUseLNI,

        updateCourseStyle,
        fetchCourse,
        fetchMediaFiles,
        openMediaPicker,
        handleUploadFile,
        searchPexels,
        handleSelectPexelsPhoto,
        handleSelectFromLibrary,
        updateCourseMeta,
        toggleAutoAssignNewWorkers,
        addSlide,
        deleteSlide,
        duplicateSlide,
        updateActiveSlideContent,
        handleSaveCourse,
        handlePublish,
        handleGenerateAI,
        handlePPTXUpload,
        publishDialogOpen,
        publishAssignTo,
        publishWorkerIds,
        publishTeamIds,
        publishNotifyTelegram,
        publishWorkersList,
        publishTeamsList,
        publishWorkersLoading,
        setPublishDialogOpen,
        setPublishAssignTo,
        setPublishWorkerIds,
        setPublishTeamIds,
        setPublishNotifyTelegram,
        confirmPublish,
      }}
    >
      {children}
    </CourseEditorContext.Provider>
  );
}

export function useCourseEditor() {
  const context = useContext(CourseEditorContext);
  if (context === undefined) {
    throw new Error("useCourseEditor must be used within a CourseEditorProvider");
  }
  return context;
}
