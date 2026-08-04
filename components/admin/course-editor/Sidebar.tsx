"use client";

import React from "react";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  HelpCircle,
  MessageSquare,
  Users,
  BarChart3,
  Loader2,
  Upload,
  Sparkles,
  Send,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourseEditor } from "./CourseEditorContext";

export default function Sidebar() {
  const {
    addSlide,
    handlePublish,
    publishing,
    course,
    setAiDialogOpen,
    slidesList,
    saveStatus,
    handlePPTXUpload,
    importing,
    toggleAutoAssignNewWorkers,
    jurisdictionsList,
    setAddendumDialogOpen,
    setAddendumJurisdictionIds,
  } = useCourseEditor();

  const injectors = [
    { type: "text", label: "Card", icon: FileText, desc: "Standard text & bullets" },
    { type: "quiz", label: "Quiz", icon: HelpCircle, desc: "Interactive evaluation" },
    { type: "video", label: "Video", icon: Film, desc: "MP4 Video player card" },
    { type: "audio", label: "Audio", icon: Music, desc: "Voiceover playback" },
    { type: "chat", label: "Chat", icon: MessageSquare, desc: "WhatsApp simulation" },
    { type: "dialogue", label: "Roleplay", icon: Users, desc: "Foreman vs Worker tree" },
    { type: "poll", label: "Rate", icon: BarChart3, desc: "Feedback rating scale" },
  ] as const;

  const status = course?.status || "draft";
  const hasSlides = slidesList.length > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-md flex flex-col h-[calc(100vh-140px)] xl:sticky xl:top-[100px] overflow-hidden">
      {/* 1. Header Title */}
      <h3 className="text-xs font-bold text-[#1B2A6B] dark:text-[#C8D400] uppercase tracking-wider mb-2.5 shrink-0">
        Add Block Type
      </h3>

      {/* 2. Scrollable injectors block list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 mb-4 scrollbar-thin">
        {injectors.map((inj) => (
          <button
            key={inj.type}
            onClick={() => addSlide(inj.type)}
            className="w-full text-left flex items-center gap-3 p-2 rounded-xl border border-border bg-background/50 hover:bg-[#C8D400]/5 dark:hover:bg-[#C8D400]/10 hover:border-[#C8D400]/40 transition-all duration-200 group text-foreground cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-[#C8D400]/10 group-hover:text-[#C8D400] transition-colors shrink-0">
              <inj.icon className="h-4 w-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground group-hover:text-foreground transition-colors truncate">
                {inj.label}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-normal mt-0.5">
                {inj.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* 3. Pinned bottom action buttons & status */}
      <div className="space-y-3 pt-3 border-t border-border shrink-0 mt-auto">
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setAiDialogOpen(true)}
            variant="outline"
            className="w-full bg-[#C8D400]/10 hover:bg-[#C8D400]/20 text-[#1B2A6B] dark:text-[#C8D400] border border-[#C8D400]/30 font-bold cursor-pointer h-10 px-4 transition-all duration-250 gap-1.5 flex items-center justify-center text-xs rounded-xl"
          >
            <Sparkles className="h-4 w-4 text-[#C8D400] shrink-0" />
            Generate with AI
          </Button>

          {hasSlides && jurisdictionsList.length > 0 && (
            <Button
              onClick={() => {
                setAddendumJurisdictionIds(jurisdictionsList.map((j) => j.id));
                setAddendumDialogOpen(true);
              }}
              variant="outline"
              className="w-full bg-card hover:bg-muted text-foreground border border-border font-bold cursor-pointer h-10 px-4 transition-all duration-250 gap-1.5 flex items-center justify-center text-xs rounded-xl"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              Generate state variants
            </Button>
          )}

          {status === "draft" && (
            <label className="w-full cursor-pointer shrink-0">
              <input
                type="file"
                accept=".pptx"
                onChange={handlePPTXUpload}
                disabled={importing}
                className="hidden"
              />
              <span className="inline-flex items-center justify-center bg-card hover:bg-muted text-foreground border border-border w-full font-bold h-10 px-4 transition-all duration-250 rounded-xl gap-1.5 text-xs select-none">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" />
                )}
                Import Presentation
              </span>
            </label>
          )}
        </div>

        {/* Auto-save Status Indicator */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-border/80 bg-background/30 text-[10px] font-bold text-muted-foreground select-none">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8D400] shrink-0" />
              <span>Saving changes...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-500/90">All changes saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-red-400">Save failed (reconnecting...)</span>
            </>
          )}
        </div>

        <button
          onClick={toggleAutoAssignNewWorkers}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-background/50 hover:bg-muted/50 transition-colors text-xs text-foreground"
        >
          <span className="font-semibold">Auto-assign to new workers</span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              course?.autoAssignNewWorkers ? "bg-[#C8D400]" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                course?.autoAssignNewWorkers ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
        </button>

        {status === "draft" && (
          <Button
            onClick={handlePublish}
            disabled={publishing || !hasSlides || saveStatus === "saving"}
            className="w-full bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold border-0 shadow-lg shadow-[#C8D400]/10 cursor-pointer h-10 transition-transform duration-200 hover:scale-[1.02] gap-1.5 flex items-center justify-center text-xs rounded-xl"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Send className="h-4 w-4 shrink-0" />
            )}
            Go Live on TG
          </Button>
        )}
      </div>
    </div>
  );
}
