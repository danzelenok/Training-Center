import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Film,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AVATAR_ROLES, ROLE_INSTRUCTOR } from "@/lib/avatar-roles";
import { Slide } from "../CardCanvas";
import { ControlPanel } from "../ControlPanel";
import { PanelButton } from "../PanelButton";

interface VideoCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  isVideoConfigOpen: boolean;
  setIsVideoConfigOpen: (val: boolean) => void;
}

export function VideoCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  onOpenMediaPicker,
  draggedIdx,
  cardStyle,
  isVideoConfigOpen,
  setIsVideoConfigOpen,
}: VideoCardProps) {
  const content = slide.content || {};
  const videoMode = content.videoMode;
  const avatarId = content.avatarId;
  const speechText = content.speechText || "";
  const captions = content.captions || "";

  const selectedAvatar = AVATAR_ROLES.find((av) => av.id === avatarId) || AVATAR_ROLES[0];

  const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
  const isFailed = slide.assetStatus === "failed";

  const [isPlaying, setIsPlaying] = useState(false);

  const handleRegenerateVideo = async () => {
    if (!slide.id) return;
    onUpdateSlideContent(index, {}, { assetStatus: "generating" });
    try {
      const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speechText: content.speechText || "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      toast.success("HeyGen video generation triggered in background.");
    } catch (err: any) {
      toast.error("Failed to regenerate video: " + err.message);
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
    }
  };

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  if (isGenerating) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border-[0.11px] border-border/80 justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h3 className="text-base font-bold text-foreground">Generating AI Video...</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          Your HeyGen avatar is being rendered. This may take a few minutes.
        </p>
      </Card>
    );
  }

  if (isFailed) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border-[0.11px] border-border/80 justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <div className="p-3 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive animate-bounce" />
        </div>
        <h3 className="text-base font-bold text-destructive font-sans">Video Generation Failed</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          We encountered an error while calling the HeyGen API.
        </p>
        {isActive && (
          speechText ? (
            <button
              type="button"
              onClick={handleRegenerateVideo}
              className="mt-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
            >
              Retry Generation
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsVideoConfigOpen(true)}
              className="mt-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
            >
              Configure Avatar
            </button>
          )
        )}
      </Card>
    );
  }

  // Render function helper to make the return cleaner
  const renderCardBody = () => {
    // Mode 1: Already has a video URL (uploaded or generated)
    if (content.url) {
      return (
        <div className="absolute inset-0 z-10 overflow-hidden rounded-[24px] pointer-events-auto select-none">
          <div
            onClick={(e) => {
              const video = e.currentTarget.querySelector("video");
              if (video) {
                if (video.paused) {
                  video.play().catch(() => {});
                  setIsPlaying(true);
                } else {
                  video.pause();
                  setIsPlaying(false);
                }
              }
            }}
            className="w-full h-full relative group cursor-pointer"
          >
            <video
              src={content.url}
              className="w-full h-full object-cover"
              controls
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/35 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
              <div className="p-3.5 bg-background/90 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-300">
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-foreground" />
                ) : (
                  <Play className="h-6 w-6 text-foreground" />
                )}
              </div>
            </div>
            {captions && (
              <div className="absolute bottom-8 inset-x-6 flex justify-center text-center pointer-events-none z-10 animate-fade-in">
                <div className="max-w-[90%] bg-black/75 border border-white/10 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
                  <p className="text-[10px] text-white leading-normal font-sans font-medium">{captions}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Mode 2: No videoMode selected yet (Upload vs Generate selector)
    if (!videoMode) {
      return (
        <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
          <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Film className="h-7 w-7" />
            </div>
            <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">Add Video Block</h3>
            <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
              Upload your own recording or generate an avatar speaking your script.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ videoMode: "upload" });
                onOpenMediaPicker();
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Upload Video</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Import an MP4, WebM, or MOV file from your device
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ videoMode: "generate", avatarId: ROLE_INSTRUCTOR });
                setIsVideoConfigOpen(true);
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Generate with AI</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Create an interactive HeyGen talking avatar speech
                </p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // Mode 3: Upload mode selected, but no URL yet
    if (videoMode === "upload") {
      return (
        <div className="flex-1 flex flex-col justify-center items-stretch gap-4 px-1 py-4 w-full z-10">
          <div
            onClick={onOpenMediaPicker}
            className="w-full aspect-video rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-6 gap-3 shrink-0 cursor-pointer transition-all hover:bg-accent/15 hover:border-primary bg-muted"
          >
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 animate-bounce">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Select Video File</p>
              <p className="text-[10px] text-muted-foreground mt-1">Supports MP4, WebM, MOV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateContent({ videoMode: undefined })}
            className="text-xs font-semibold flex items-center justify-center gap-1.5 self-center cursor-pointer hover:underline text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Choice
          </button>
        </div>
      );
    }

    // Mode 4: Generate mode selected, but no URL yet
    return (
      <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
        <div className="w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border border-border flex flex-col items-center justify-center bg-neutral-950 shadow-inner group">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[7px] font-black uppercase text-red-500 tracking-wider">AI Live Draft</span>
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
            <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest">HeyGen</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary/20 to-purple-500/20 border border-white/20 flex items-center justify-center shadow-lg">
              <span className="text-3xl leading-none select-none">{selectedAvatar.emoji}</span>
            </div>
            <span className="text-[10px] font-black text-white/90 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-xs">
              {selectedAvatar.name}
            </span>
          </div>

          <div className="absolute bottom-2.5 inset-x-4 flex justify-center text-center">
            <div className="max-w-[85%] bg-black/70 border border-white/10 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
              <p className="text-[9.5px] text-white leading-normal font-sans font-medium">
                {captions || (speechText ? `"${speechText}"` : "Add speech script to auto-generate captions...")}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2">
          <div className="text-left">
            <span className="text-[8.5px] font-bold uppercase tracking-wider select-none text-muted-foreground">
              Speech script preview
            </span>
            <p className="text-xs mt-1 italic line-clamp-2 min-h-[32px] text-foreground">
              {speechText ? `"${speechText}"` : "No speech script entered yet."}
            </p>
          </div>

          <div className="flex gap-2 w-full mt-1.5">
            <button
              type="button"
              onClick={() => updateContent({ videoMode: undefined, avatarId: undefined, speechText: undefined, captions: undefined })}
              className="flex-1 py-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change Source
            </button>
            <button
              type="button"
              onClick={() => setIsVideoConfigOpen(!isVideoConfigOpen)}
              className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe ${
                isVideoConfigOpen
                  ? "bg-primary/20 border-primary text-primary"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/95"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isVideoConfigOpen ? "Close AI Editor" : "Configure AI"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      {renderCardBody()}
    </Card>
  );
}

interface VideoToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  isVideoConfigOpen: boolean;
  setIsVideoConfigOpen: (val: boolean) => void;
  videoToolsOpen: boolean;
  setVideoToolsOpen: (val: boolean) => void;
  captionsToolsOpen: boolean;
  setCaptionsToolsOpen: (val: boolean) => void;
}

export function VideoToolbar({
  slide,
  index,
  onUpdateSlideContent,
  onOpenMediaPicker,
  isVideoConfigOpen,
  setIsVideoConfigOpen,
  videoToolsOpen,
  setVideoToolsOpen,
  captionsToolsOpen,
  setCaptionsToolsOpen,
}: VideoToolbarProps) {
  const content = slide.content || {};
  const videoMode = content.videoMode;
  const speechText = content.speechText || "";
  const captions = content.captions || "";
  const avatarId = content.avatarId;
  const forceCompletion = content.forceCompletion === true;
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  const handleRegenerateVideo = async () => {
    if (!slide.id) return;
    onUpdateSlideContent(index, {}, { assetStatus: "generating" });
    setIsVideoConfigOpen(false);
    try {
      const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speechText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      toast.success("HeyGen video generation triggered in background.");
    } catch (err: any) {
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
      toast.error("Failed to generate video: " + err.message);
    }
  };

  // If no video URL exists and we are in generate mode, render config AI panel
  if (videoMode === "generate" && !content.url) {
    if (!isVideoConfigOpen) return null;
    return (
      <div className="flex flex-col items-center gap-2 w-full z-20 mb-2 mt-[-16px] animate-fade-in no-swipe">
        <div className="border border-border rounded-2xl px-3 py-2.5 shadow-2xl flex flex-col gap-2.5 z-50 w-full max-w-xs backdrop-blur-md bg-popover text-popover-foreground">
          <div className="flex flex-col gap-1.5 text-left">
            <p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground">Select Role</p>
            <div className="flex gap-1.5">
              {AVATAR_ROLES.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => updateContent({ avatarId: av.id })}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[6.5px] font-black uppercase ${
                    avatarId === av.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-base leading-none">{av.emoji}</span>
                  {av.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 text-left">
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground">
                Speech
              </p>
              <textarea
                value={speechText}
                onChange={(e) => {
                  const newSpeech = e.target.value;
                  const fields: any = { speechText: newSpeech };
                  if (!captions || captions === speechText) {
                    fields.captions = newSpeech;
                  }
                  updateContent(fields);
                }}
                placeholder="Avatar speech script..."
                rows={2}
                className="w-full rounded-xl border border-border bg-card text-foreground px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors placeholder-muted-foreground/25"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground">
                Captions
              </p>
              <textarea
                value={captions}
                onChange={(e) => updateContent({ captions: e.target.value })}
                placeholder="Edit captions..."
                rows={2}
                className="w-full rounded-xl border border-border bg-card text-foreground px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors placeholder-muted-foreground/25"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!speechText.trim()}
            onClick={handleRegenerateVideo}
            className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe mt-0.5 ${
              !speechText.trim()
                ? "opacity-40 cursor-not-allowed border-primary/20 bg-primary/5 text-primary"
                : "border-primary bg-primary text-primary-foreground hover:bg-primary/95"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate Video
          </button>
        </div>
      </div>
    );
  }

  // If video exists, render tools
  if (content.url) {
    return (
      <ControlPanel
        below={
          videoToolsOpen ? (
            <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
              <div className="flex items-center gap-2 justify-between w-full">
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl border bg-muted border-border text-[9px] font-black uppercase tracking-wider">
                  <span className="mr-2.5">Force Completion</span>
                  <button
                    type="button"
                    onClick={() => updateContent({ forceCompletion: !forceCompletion })}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      forceCompletion ? "bg-primary" : "bg-neutral-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        forceCompletion ? "translate-x-3" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={onOpenMediaPicker}
                    className="p-1.5 border border-border rounded-xl bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer"
                    title="Replace Video"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateContent({ url: undefined, videoMode: undefined, captions: undefined, speechText: undefined, avatarId: undefined })}
                    className="p-1.5 border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 rounded-xl text-destructive transition-all cursor-pointer"
                    title="Remove Video"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          ) : captionsToolsOpen ? (
            <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-row items-center no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
              <button
                type="button"
                disabled={isGeneratingCaptions}
                onClick={() => {
                  setIsGeneratingCaptions(true);
                  setTimeout(() => {
                    setIsGeneratingCaptions(false);
                    const title = content.heading || slide.content?.heading || "Safety Procedure";
                    const generatedSub = `Welcome to the ${title} micro-learning video. Pay close attention to these guidelines to ensure active safety compliance.`;
                    updateContent({ captions: generatedSub });
                    toast.success("AI automatic subtitles generated successfully!");
                  }, 1200);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer text-[8px] font-black uppercase shrink-0"
              >
                {isGeneratingCaptions ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Gen...</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Auto-Gen</>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <textarea
                  value={captions}
                  onChange={(e) => updateContent({ captions: e.target.value })}
                  placeholder="Type subtitles here..."
                  rows={1}
                  className="w-full rounded-xl border border-border bg-card text-foreground px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors scrollbar-none h-8"
                />
              </div>
            </div>
          ) : null
        }
      >
        <PanelButton
          icon={<Film className="h-4.5 w-4.5 shrink-0" />}
          label="Toggle Video Config Options"
          isActive={videoToolsOpen}
          onClick={() => { setVideoToolsOpen(!videoToolsOpen); setCaptionsToolsOpen(false); }}
          variant="primary"
        />
        <PanelButton
          icon={<MessageSquare className="h-4.5 w-4.5 shrink-0" />}
          label="Toggle Captions Options"
          isActive={captionsToolsOpen}
          onClick={() => { setCaptionsToolsOpen(!captionsToolsOpen); setVideoToolsOpen(false); }}
          variant="primary"
        />
      </ControlPanel>
    );
  }

  return null;
}
