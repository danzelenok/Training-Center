"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Slide } from "./CardCanvas";

export interface MediaLibraryFile {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  fileType: string;
  size?: number;
  mime?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  telegramMessageId: string | null;
  telegramGroupId: string | null;
  slides: Slide[];
  generationStatus?: "none" | "pending" | "generating" | "ready" | "failed";
  themeType?: string;
  themeValue?: string;
}

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
  slideUploading: boolean;
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

  setSlidesList: React.Dispatch<React.SetStateAction<Slide[]>>;
  setActiveSlideIndex: (idx: number | null) => void;
  setMediaPickerOpen: (open: boolean) => void;
  setMediaLoading: (loading: boolean) => void;
  setSlideUploading: (uploading: boolean) => void;
  setActiveTab: (tab: "library" | "upload" | "pexels") => void;
  setIsDragOver: (dragOver: boolean) => void;
  setPexelsQuery: (query: string) => void;
  setStyleDialogOpen: (open: boolean) => void;
  setThemeImagePending: (pending: boolean) => void;
  setAiDialogOpen: (open: boolean) => void;
  setAiPrompt: (prompt: string) => void;
  setAiModel: (model: "fast" | "advanced") => void;
  setAiUseLNI: (value: boolean) => void;

  updateCourseStyle: (type: string, value: string) => void;
  fetchCourse: () => Promise<void>;
  fetchMediaFiles: () => Promise<void>;
  openMediaPicker: () => void;
  handleUploadFile: (file: File) => Promise<void>;
  searchPexels: (query: string) => Promise<void>;
  handleSelectPexelsPhoto: (photo: { id: number; url: string; thumbnail: string; photographer: string }) => void;
  handleSelectFromLibrary: (file: MediaLibraryFile) => void;
  handleSlideDirectUpload: (file: File) => Promise<void>;
  updateCourseMeta: (field: "title" | "description", value: string) => void;
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
  const [loading, setLoading] = useState(true);

  // Auto-save states and hooks
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | null>("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const prevPollStatusesRef = useRef<Record<string, string>>({});

  const triggerAutoSave = useCallback(() => {
    if (loading || !course) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: course.title,
            description: course.description,
            themeType: course.themeType || "preset",
            themeValue: course.themeValue || "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
            slides: slidesListRef.current,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Failed to save changes");
        }

        const data = await res.json();
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
      } catch (err: any) {
        console.error("Auto-save error:", err);
        setSaveStatus("error");
      }
    }, 1500);
  }, [id, course, loading]);

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
  const [mediaFiles, setMediaFiles] = useState<MediaLibraryFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [slideUploading, setSlideUploading] = useState(false);
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

  // Fetch Course details & slides
  const fetchCourse = async () => {
    try {
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error("Course not found");
      const data = await res.json();
      setCourse(data);
      const loadedSlides = (data.slides || []).map((s: Slide) => ({
        ...s,
        id: s.id || crypto.randomUUID()
      }));
      setSlidesList(loadedSlides);
      if (data.slides && data.slides.length > 0) {
        setActiveSlideIndex(0);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load course details");
      router.push("/admin/courses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  // Poll only while Inngest is actively processing slides
  const anySlideGenerating = slidesList.some(
    (s) => s.assetStatus === "generating"
  );

  useEffect(() => {
    const shouldPoll = course?.generationStatus === "generating" || anySlideGenerating;
    if (!shouldPoll) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${id}/generation-status`);
        if (res.ok) {
          const data = await res.json();

          // Detect status transitions from server response (before state update)
          (data.slides || []).forEach((serverSlide: any) => {
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
              const match = data.slides?.find((s: any) => s.id === slide.id);
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

          const mediaSlides = (data.slides || []).filter((s: any) => s.type === "audio" || s.type === "dialogue" || s.type === "video");
          const allDone =
            mediaSlides.length === 0 ||
            mediaSlides.every((s: any) => s.assetStatus === "ready" || s.assetStatus === "failed");

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
        }
      } catch (err) {
        console.error("Error polling generation status:", err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [course?.generationStatus, anySlideGenerating, id]);

  const fetchMediaFiles = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error("Failed to load media library");
      const data = await res.json();
      setMediaFiles(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setMediaLoading(false);
    }
  }, []);

  const openMediaPicker = () => {
    setActiveTab("library");
    setMediaPickerOpen(true);
    fetchMediaFiles();
  };

  // Upload and auto-apply file logic for the Media Library Sheet
  const handleUploadFile = async (file: File) => {
    setMediaLoading(true);
    const toastId = toast.loading(`Uploading ${file.name} to library…`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Upload failed");

      // Refresh the media library list
      await fetchMediaFiles();

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
    } finally {
      setMediaLoading(false);
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
      imageKitFileId: undefined,
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
      imageKitFileId: file.fileId,
    });
    setMediaPickerOpen(false);
    toast.success(`Media set: ${file.name}`);
  };

  // Direct Card Upload logic
  const handleSlideDirectUpload = async (file: File) => {
    if (activeSlideIndex === null) return;
    setSlideUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}…`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Upload failed");

      updateActiveSlideContent(activeSlideIndex, {
        url: data.url,
        imageUrl: data.url,
        imageKitFileId: data.fileId,
      });
      toast.success(`${file.name} uploaded and applied!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: toastId });
    } finally {
      setSlideUploading(false);
    }
  };

  // Update Course Meta (title, desc)
  const updateCourseMeta = (field: "title" | "description", value: string) => {
    if (!course) return;
    setCourse({ ...course, [field]: value });
  };

  // Add slide manually
  const addSlide = (type: Slide["type"]) => {
    let newContent = {};

    if (type === "text") {
      newContent = { heading: "New Slide Title", body: "Add your micro-learning contents here..." };
    } else if (type === "video") {
      newContent = { heading: "New Video Card", body: "", url: "", imageKitFileId: "" };
    } else if (type === "audio") {
      newContent = { heading: "New Audio Card", body: "", audioScript: "", url: "", imageKitFileId: "" };
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
        correctIndex: 0,
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

  // Save changes to database via API
  const handleSaveCourse = async () => {
    if (!course?.title.trim()) {
      toast.error("Course title cannot be empty");
      return;
    }
    setSaveStatus("saving");
    const toastId = toast.loading("Saving changes to server...");
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.title,
          description: course.description,
          themeType: course.themeType || "preset",
          themeValue: course.themeValue || "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
          slides: slidesListRef.current,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to save changes");
      }
      const data = await res.json();

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

  // Broadcast module on Telegram
  const handlePublish = async () => {
    if (slidesList.length === 0) {
      toast.error("Cannot publish a course without slides. Add cards or import a PPTX first.");
      return;
    }
    await handleSaveCourse();
    setPublishing(true);
    const toastId = toast.loading("Publishing module & posting announcement to Telegram Group...");
    try {
      const res = await fetch(`/api/courses/${id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed");

      toast.success("Course is LIVE! Announcement sent directly to workers group.", { id: toastId });
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

  // AI Slides generation
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a description for the course.");
      return;
    }
    setAiGenerating(true);
    const toastId = toast.loading("AI is generating course structure…");
    try {
      const res = await fetch(`/api/courses/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, model: aiModel, useLNI: aiUseLNI }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate course");

      toast.success("AI Course generated successfully!", { id: toastId });
      setAiDialogOpen(false);
      setAiPrompt("");
      await fetchCourse();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate course", { id: toastId });
    } finally {
      setAiGenerating(false);
    }
  };

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
      const res = await fetch(`/api/courses/${id}/upload`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": encodeURIComponent(file.name),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Upload failed");

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
        slideUploading,
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
        setMediaLoading,
        setSlideUploading,
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
        handleSlideDirectUpload,
        updateCourseMeta,
        addSlide,
        deleteSlide,
        duplicateSlide,
        updateActiveSlideContent,
        handleSaveCourse,
        handlePublish,
        handleGenerateAI,
        handlePPTXUpload,
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
