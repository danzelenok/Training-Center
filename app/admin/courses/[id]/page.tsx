"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  FolderOpen,
  Check,
  Film,
  Music,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Eye,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

// Decoupled components
import Sidebar from "@/components/admin/course-editor/Sidebar";
import CardCanvas, { Slide } from "@/components/admin/course-editor/CardCanvas";

import {
  CourseEditorProvider,
  useCourseEditor,
} from "@/components/admin/course-editor/CourseEditorContext";

export default function CourseEditorPage() {
  return (
    <CourseEditorProvider>
      <CourseEditorContent />
    </CourseEditorProvider>
  );
}

function CourseEditorContent() {
  const params = useParams();
  const id = params?.id as string;

  const {
    course,
    slidesList,
    loading,
    saveStatus,
    activeSlideIndex,
    setActiveSlideIndex,
    importing,
    publishing,
    mediaPickerOpen,
    setMediaPickerOpen,
    mediaFiles,
    mediaLoading,
    slideUploading,
    activeTab,
    setActiveTab,
    isDragOver,
    setIsDragOver,
    pexelsQuery,
    setPexelsQuery,
    pexelsResults,
    pexelsLoading,
    styleDialogOpen,
    setStyleDialogOpen,
    themeImagePending,
    setThemeImagePending,
    aiDialogOpen,
    setAiDialogOpen,
    aiPrompt,
    setAiPrompt,
    aiModel,
    setAiModel,
    aiGenerating,

    updateCourseStyle,
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
    setSlidesList,
  } = useCourseEditor();

  const handlePreview = async () => {
    await handleSaveCourse();
    window.open(`/admin/courses/${id}/preview`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-[#C8D400] shrink-0" />
        <p className="text-sm font-medium">Loading Course editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-full">
      <Toaster theme="dark" closeButton richColors />

      {/* Real-time Asset Generation Progress Banner */}
      {course?.generationStatus === "generating" && (() => {
        const totalMedia = slidesList.filter(s => s.type === "audio" || s.type === "dialogue" || s.type === "video").length;
        const readyMedia = slidesList.filter(s => (s.type === "audio" || s.type === "dialogue" || s.type === "video") && s.assetStatus === "ready").length;
        return (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-blue-400 font-semibold animate-pulse select-none">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
            <span>Generating assets… {readyMedia} of {totalMedia} ready</span>
          </div>
        );
      })()}

      {/* Editor Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3 animate-fade-in">
          <Link href="/admin/courses">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border-border bg-card text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-transform duration-200 hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={course?.title || ""}
              onChange={(e) => updateCourseMeta("title", e.target.value)}
              className="text-lg font-extrabold text-[#1B2A6B] dark:text-[#C8D400] bg-transparent border-b border-dashed border-transparent hover:border-border focus:border-[#C8D400] focus:outline-none transition-all px-1 max-w-sm w-full"
              placeholder="Course Title"
            />
            {course?.status === "published" ? (
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20 shrink-0">
                Live
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-[#C8D400]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C8D400] border border-[#C8D400]/20 dark:bg-[#C8D400]/20 shrink-0">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* TOP RIGHT HEADER CONTROLS — STYLE COURSE */}
        <div className="flex items-center gap-2 animate-fade-in shrink-0">
          <Button
            variant="outline"
            className="bg-card hover:bg-muted text-foreground border border-border font-bold cursor-pointer h-9 px-3.5 transition-all duration-200 gap-1.5 rounded-xl text-xs"
            onClick={handlePreview}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Dialog open={styleDialogOpen} onOpenChange={setStyleDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-card hover:bg-muted text-foreground border border-border font-bold cursor-pointer h-9 px-3.5 transition-all duration-200 gap-1.5 rounded-xl text-xs"
              >
                <span>🎨</span> Style Course
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
                  Course Theme & Style
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs mt-1">
                  Customize the visual theme of your micro-learning course cards.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-3">
                {/* Presets Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Theme Presets
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Preset 1: Premium Light */}
                    <button
                      type="button"
                      onClick={() => {
                        updateCourseStyle("preset", "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)");
                      }}
                      className={`p-2 rounded-xl border text-center font-bold text-[9px] h-20 flex flex-col items-center justify-center cursor-pointer transition-all ${
                        course?.themeType === "preset" && course?.themeValue === "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)"
                          ? "border-[#C8D400] ring-1 ring-[#C8D400]/40 bg-[#C8D400]/5 text-[#C8D400]"
                          : "border-border bg-background hover:border-muted-foreground/30 text-foreground"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] border border-border mb-1" />
                      Light Premium
                    </button>

                    {/* Preset 2: Deep Navy */}
                    <button
                      type="button"
                      onClick={() => {
                        updateCourseStyle("preset", "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)");
                      }}
                      className={`p-2 rounded-xl border text-center font-bold text-[9px] h-20 flex flex-col items-center justify-center cursor-pointer transition-all ${
                        course?.themeType === "preset" && course?.themeValue === "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)"
                          ? "border-[#C8D400] ring-1 ring-[#C8D400]/40 bg-[#C8D400]/5 text-[#C8D400]"
                          : "border-border bg-background hover:border-muted-foreground/30 text-foreground"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] border border-border mb-1" />
                      Deep Navy
                    </button>

                    {/* Preset 3: Safety Lime */}
                    <button
                      type="button"
                      onClick={() => {
                        updateCourseStyle("preset", "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)");
                      }}
                      className={`p-2 rounded-xl border text-center font-bold text-[9px] h-20 flex flex-col items-center justify-center cursor-pointer transition-all ${
                        course?.themeType === "preset" && course?.themeValue === "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                          ? "border-[#C8D400] ring-1 ring-[#C8D400]/40 bg-[#C8D400]/5 text-[#C8D400]"
                          : "border-border bg-background hover:border-muted-foreground/30 text-foreground"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#11998e] to-[#38ef7d] border border-border mb-1" />
                      Safety Lime
                    </button>
                  </div>
                </div>

                {/* Custom Solid Color */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Custom Solid Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={course?.themeType === "color" ? course?.themeValue : "#ffffff"}
                      onChange={(e) => updateCourseStyle("color", e.target.value)}
                      className="w-10 h-8 rounded-lg border border-border bg-transparent cursor-pointer p-0.5"
                    />
                    <Input
                      type="text"
                      placeholder="#FFFFFF"
                      value={course?.themeType === "color" ? course?.themeValue : ""}
                      onChange={(e) => updateCourseStyle("color", e.target.value)}
                      className="font-mono text-xs bg-background border-border h-8 flex-1"
                    />
                  </div>
                </div>

                {/* Background Image Selection */}
                <div className="space-y-2 pt-2 border-t border-border/80">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Custom Background Image
                  </label>
                  {course?.themeType === "image" && course?.themeValue ? (
                    <div className="relative w-full h-20 rounded-xl overflow-hidden border border-border bg-neutral-900 group">
                      <img
                        src={course.themeValue}
                        alt="Custom theme background"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setThemeImagePending(true);
                          openMediaPicker();
                          setStyleDialogOpen(false);
                        }}
                        className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-bold transition-all cursor-pointer rounded-xl"
                      >
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setThemeImagePending(true);
                        openMediaPicker();
                        setStyleDialogOpen(false);
                      }}
                      className="w-full bg-background border border-border text-foreground hover:bg-muted font-bold text-xs h-9 px-4 rounded-xl gap-1.5 flex items-center justify-center cursor-pointer"
                    >
                      <span>🖼️</span> Select Background Image
                    </Button>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setStyleDialogOpen(false);
                    handleSaveCourse();
                  }}
                  className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-xs px-4"
                >
                  Apply Theme
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>



      {/* 2-COLUMN WORKSPACE GRID (Left/Center Carousel, Right Sidebar injectors) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMN 1 — LEFT/CENTER: CAROUSEL DECK CANVAS (xl:col-span-10 lg:col-span-9 col-span-12) */}
        <div className="xl:col-span-10 lg:col-span-9 col-span-12">
          {slidesList.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-md text-muted-foreground flex flex-col items-center justify-center gap-3">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40 shrink-0" />
              <p className="text-sm font-bold">No cards in this safety course.</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Add standard cards, quiz evaluations, simulated messaging chats, roleplays, or gold-star feedback polls in the sidebar to assemble your module!
              </p>
            </div>
          ) : (
            <CardCanvas />
          )}
        </div>

        {/* COLUMN 2 — RIGHT: SIDEBAR Block Injectors & Save/GoLive (xl:col-span-2 lg:col-span-3 col-span-12) */}
        <div className="xl:col-span-2 lg:col-span-3 col-span-12">
          <Sidebar />
        </div>

      </div>

      {/* Global Media Library Selector popover sheet */}
      <Sheet open={mediaPickerOpen} onOpenChange={(open) => {
        setMediaPickerOpen(open);
        if (!open) {
          setThemeImagePending(false);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0 border-l border-border bg-card">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border bg-card">
            <SheetTitle className="text-base font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Media Manager
            </SheetTitle>
          </SheetHeader>

          {/* Custom Sleek Tabs */}
          <div className="flex border-b border-border bg-muted/20">
            <button
              type="button"
              onClick={() => setActiveTab("library")}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer
                ${activeTab === "library"
                  ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
            >
              📁 Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer
                ${activeTab === "upload"
                  ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
            >
              📤 Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pexels")}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer
                ${activeTab === "pexels"
                  ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
            >
              🔍 Pexels
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "library" ? (
              mediaLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-[#C8D400] shrink-0" />
                </div>
              ) : mediaFiles.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No media assets found in library.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaFiles.map((file) => {
                    const isImg = /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(file.name) || (file.mime || "").startsWith("image/");
                    const isVid = /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name) || (file.mime || "").startsWith("video/");
                    const isAud = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name) || (file.mime || "").startsWith("audio/");
                    return (
                      <button
                        key={file.fileId}
                        type="button"
                        onClick={() => handleSelectFromLibrary(file)}
                        className="group relative flex flex-col rounded-xl border border-border overflow-hidden hover:border-[#C8D400]/60 hover:shadow-md transition-all duration-200 bg-card text-left cursor-pointer"
                      >
                        <div className="relative h-24 bg-background flex items-center justify-center overflow-hidden">
                          {isImg ? (
                            <img
                              src={file.thumbnailUrl || `${file.url}?tr=w-200,h-96,fo-auto`}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : isVid ? (
                            <Film className="h-7 w-7 text-blue-400 shrink-0" />
                          ) : isAud ? (
                            <Music className="h-7 w-7 text-purple-400 shrink-0" />
                          ) : (
                            <FolderOpen className="h-7 w-7 text-muted-foreground shrink-0" />
                          )}
                          <div className="absolute inset-0 bg-[#C8D400]/0 group-hover:bg-[#C8D400]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Check className="h-6 w-6 text-[#C8D400] drop-shadow shrink-0" />
                          </div>
                        </div>
                        <div className="px-2 py-1.5 border-t border-border/40">
                          <p className="text-[10px] font-semibold text-foreground truncate">{file.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : activeTab === "upload" ? (() => {
              const activeSlide = activeSlideIndex !== null ? slidesList[activeSlideIndex] : null;
              const activeSlideType = activeSlide?.type || "text";
              let acceptTypes = "image/*,video/*,audio/*";
              let typeInstructions = "Supports images, videos, or audio files";
              if (activeSlideType === "text") {
                acceptTypes = "image/*";
                typeInstructions = "Supports PNG, JPEG, GIF, WebP (Images)";
              } else if (activeSlideType === "video") {
                acceptTypes = "video/*";
                typeInstructions = "Supports MP4, WebM, MOV (Videos)";
              } else if (activeSlideType === "audio") {
                acceptTypes = "audio/*";
                typeInstructions = "Supports MP3, WAV, OGG, M4A (Audio)";
              }

              return (
                <div className="flex flex-col justify-center items-center py-6 h-full min-h-[350px]">
                  {mediaLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Loader2 className="h-10 w-10 animate-spin text-[#C8D400] shrink-0" />
                      <p className="text-xs text-muted-foreground font-semibold">Uploading and processing file...</p>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          handleUploadFile(file);
                        }
                      }}
                      className={`w-full max-w-md aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-6 gap-4 cursor-pointer transition-all duration-300 group
                        ${isDragOver
                          ? "border-[#C8D400] bg-[#C8D400]/10 scale-[1.02]"
                          : "border-border hover:border-[#C8D400]/50 hover:bg-neutral-500/5 bg-card/65"
                        }`}
                      onClick={() => {
                        const fileInput = document.getElementById("media-upload-input");
                        if (fileInput) fileInput.click();
                      }}
                    >
                      <input
                        id="media-upload-input"
                        type="file"
                        accept={acceptTypes}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadFile(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className={`p-4 rounded-full transition-all duration-300
                        ${isDragOver
                          ? "bg-[#C8D400]/20 text-[#C8D400]"
                          : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-[#C8D400]/10 group-hover:text-[#C8D400]"
                        }`}>
                        <Upload className="h-8 w-8 animate-pulse shrink-0" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Drag & drop your file here</p>
                        <p className="text-xs text-muted-foreground mt-0.5">or click to browse files</p>
                      </div>
                      <div className="px-4 py-1.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/60">
                        <p className="text-[10px] font-semibold text-muted-foreground">{typeInstructions}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex flex-col gap-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchPexels(pexelsQuery);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={pexelsQuery}
                    onChange={(e) => setPexelsQuery(e.target.value)}
                    placeholder="Search photos, e.g. safety helmet"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#C8D400]"
                  />
                  <button
                    type="submit"
                    disabled={pexelsLoading || !pexelsQuery.trim()}
                    className="px-4 py-2 rounded-lg bg-[#C8D400] text-[#1B2A6B] text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-[#d4e000] transition-colors"
                  >
                    {pexelsLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : "Search"}
                  </button>
                </form>

                {pexelsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-[#C8D400] shrink-0" />
                  </div>
                ) : pexelsResults.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    {pexelsQuery ? "No photos found. Try different keywords." : "Enter keywords to search Pexels."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pexelsResults.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => handleSelectPexelsPhoto(photo)}
                        className="group relative flex flex-col rounded-xl border border-border overflow-hidden hover:border-[#C8D400]/60 hover:shadow-md transition-all duration-200 bg-card text-left cursor-pointer"
                      >
                        <div className="relative h-24 bg-background flex items-center justify-center overflow-hidden">
                          <img
                            src={photo.thumbnail}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-[#C8D400]/0 group-hover:bg-[#C8D400]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Check className="h-6 w-6 text-[#C8D400] drop-shadow shrink-0" />
                          </div>
                        </div>
                        <div className="px-2 py-1.5 border-t border-border/40">
                          <p className="text-[10px] font-semibold text-muted-foreground truncate">{photo.photographer}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Global Radix Dialog for AI Slide Generation */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B2A6B] dark:text-[#C8D400]">
              Generate Course with AI
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Describe the safety topic and Gemini will create a full slide deck.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Course Topic & Details
              </label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. A 5-slide course on scaffold safety for construction workers, covering setup, load limits, fall protection, and a quiz."
                className="w-full bg-background border-border text-foreground rounded-lg focus:border-primary min-h-[100px] resize-none text-xs"
                disabled={aiGenerating}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Generation Model
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAiModel("fast")}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer
                    ${aiModel === "fast"
                      ? "bg-[#C8D400]/5 dark:bg-[#C8D400]/10 border-[#C8D400]/50 ring-1 ring-[#C8D400]/30 shadow-xs"
                      : "bg-background border-border hover:border-muted-foreground/30"
                    }`}
                  disabled={aiGenerating}
                >
                  <span className={`text-xs font-extrabold ${aiModel === "fast" ? "text-[#C8D400]" : "text-foreground"}`}>
                    Fast
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Generates slides quickly using the high-performance Flash model.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAiModel("advanced")}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer
                    ${aiModel === "advanced"
                      ? "bg-[#1B2A6B]/5 dark:bg-[#C8D400]/10 border-[#1B2A6B]/30 dark:border-[#C8D400]/40 ring-1 ring-primary/20 shadow-xs"
                      : "bg-background border-border hover:border-muted-foreground/30"
                    }`}
                  disabled={aiGenerating}
                >
                  <span className={`text-xs font-extrabold ${aiModel === "advanced" ? "text-[#1B2A6B] dark:text-[#C8D400]" : "text-foreground"}`}>
                    Advanced
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Deep reasoning and plan structure using the state-of-the-art Pro model.
                  </span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setAiDialogOpen(false); setAiPrompt(""); }}
              disabled={aiGenerating}
              className="border-border text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAI}
              disabled={aiGenerating}
              className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold border-0 shadow-lg shadow-[#C8D400]/25 text-xs px-4"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
