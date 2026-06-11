import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Film,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_INSTRUCTOR } from "@/lib/avatar-roles";
import { fetchAvatarsList, CHAD_FALLBACK_IMAGE, FLORIN_FALLBACK_IMAGE } from "../AvatarSelector";
import { Slide } from "../CardCanvas";
import { MediaPlayerBar } from "../MediaPlayerBar";
import { ControlPanel } from "../ControlPanel";
import { PanelButton } from "../PanelButton";
import { SlideTypeSelector } from "./SlideTypeSelector";

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
  mode?: "edit" | "play";
  onCompleted?: () => void;
}

export function VideoCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  onOpenMediaPicker,
  draggedIdx,
  cardStyle,
  setIsVideoConfigOpen,
  mode,
  onCompleted,
}: VideoCardProps) {
  const content = slide.content || {};
  const videoMode = content.videoMode;
  const avatarId = content.avatarId;
  const speechText = content.speechText || "";
  const captions = content.captions || "";

  const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
  const isFailed = slide.assetStatus === "failed";

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isCCActive, setIsCCActive] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0.1);
  const [speed, setSpeed] = useState(1);
  const [chadImage, setChadImage] = useState(CHAD_FALLBACK_IMAGE);
  const [florinImage, setFlorinImage] = useState(FLORIN_FALLBACK_IMAGE);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoPlayStartedRef = useRef(false);

  useEffect(() => {
    fetchAvatarsList().then((list) => {
      const chad = list.find((a: any) => a.name.toLowerCase() === "chad");
      const florin = list.find((a: any) => a.name.toLowerCase() === "florin");
      if (chad?.preview_image_url) setChadImage(chad.preview_image_url);
      if (florin?.preview_image_url) setFlorinImage(florin.preview_image_url);
    });
  }, []);

  useEffect(() => {
    if (mode !== "play" || !content.url) return;
    autoPlayStartedRef.current = false;
    setIsBuffering(true);
    setIsPlaying(false);

    const el = videoRef.current;
    if (!el) return;

    const startPlay = () => {
      autoPlayStartedRef.current = true;
      setIsBuffering(false);
      el.play().catch(() => {});
      setIsPlaying(true);
    };

    if (el.readyState >= 3) {
      startPlay();
    } else {
      el.addEventListener("canplay", startPlay, { once: true });
      return () => el.removeEventListener("canplay", startPlay);
    }
  }, [mode, content.url]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play().catch(() => {}); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };
  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };
  const handleScrub = (val: number) => {
    if (videoRef.current) { videoRef.current.currentTime = val; setCurrentTime(val); }
  };

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

  const handleGenerateVideo = async () => {
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
      toast.error("Failed to generate video: " + err.message);
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
    }
  };

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  if (isGenerating) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 justify-center items-center text-center p-6 gap-3 z-0 ${
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
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <div className="p-3 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive animate-bounce" />
        </div>
        <h3 className="text-base font-bold text-destructive">Video Generation Failed</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          We encountered an error while calling the HeyGen API.
        </p>
        {isActive && (
          speechText ? (
            <button
              type="button"
              onClick={handleRegenerateVideo}
              className="mt-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe"
            >
              Retry Generation
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsVideoConfigOpen(true)}
              className="mt-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe"
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
      if (mode === "play") {
        return (
          <div className="absolute inset-0 z-10 overflow-hidden rounded-[24px]">
            {isBuffering && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 pointer-events-none">
                <div className="h-10 w-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}
            <video
              ref={(node) => {
                videoRef.current = node;
                if (node) node.playbackRate = speed;
              }}
              src={content.url}
              className="w-full h-full object-cover pointer-events-none"
              playsInline
              preload="auto"
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                setCurrentTime(el.currentTime);
                if (el.duration && el.duration !== duration) setDuration(el.duration);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); onCompleted?.(); }}
            />
            {isCCActive && captions && (
              <div className="absolute bottom-16 inset-x-6 flex justify-center text-center pointer-events-none z-10 animate-fade-in">
                <div className="max-w-[90%] bg-black/85 border border-white/10 px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md">
                  <p className="text-[10px] text-white leading-normal font-medium">{captions}</p>
                </div>
              </div>
            )}
            {transcriptOpen && content.speechText && (
              <div className="absolute bottom-16 inset-x-6 flex justify-center text-center pointer-events-none z-10 animate-fade-in">
                <div className="max-w-[90%] bg-black/85 border border-white/10 px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md">
                  <p className="text-[10px] text-white leading-normal font-medium">{content.speechText}</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent">
              <MediaPlayerBar
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                speed={speed}
                onTogglePlay={togglePlay}
                onScrub={handleScrub}
                onChangeSpeed={changeSpeed}
                isCCActive={isCCActive}
                onToggleCC={() => setIsCCActive(!isCCActive)}
                transcriptOpen={transcriptOpen}
                onToggleTranscript={() => setTranscriptOpen(!transcriptOpen)}
              />
            </div>
          </div>
        );
      }

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
                  <p className="text-[10px] text-white leading-normal font-medium">{captions}</p>
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
        <SlideTypeSelector
          headerIcon={<Film className="h-7 w-7" />}
          title="Add Video Block"
          description="Upload your own recording or generate an avatar speaking your script."
          options={[
            { value: "upload", label: "Upload Video", icon: <Upload className="h-5 w-5" />, iconBg: "bg-blue-500/10 text-blue-500" },
            { value: "generate", label: "Generate with AI", icon: <Sparkles className="h-5 w-5" />, iconBg: "bg-purple-500/10 text-purple-500" },
          ]}
          onSelect={(value) => {
            if (value === "upload") {
              updateContent({ videoMode: "upload" });
              onOpenMediaPicker();
            } else {
              updateContent({ videoMode: "generate", avatarId: ROLE_INSTRUCTOR });
              setIsVideoConfigOpen(true);
            }
          }}
        />
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
      <div className="flex-1 flex flex-col py-2 min-h-0 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground select-none">
            Select Avatar
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateContent({ avatarId: "instructor" })}
              className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all cursor-pointer no-swipe ${
                avatarId === "instructor"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted hover:bg-accent/20"
              }`}
            >
              <div className="w-11 h-11 rounded-full border-2 border-primary bg-[#E2E5E9] overflow-hidden">
                <img src={chadImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }} alt="Chad" />
              </div>
              <span className="text-[10px] font-medium">Instructor</span>
            </button>
            <button
              type="button"
              onClick={() => updateContent({ avatarId: "student" })}
              className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all cursor-pointer no-swipe ${
                avatarId === "student"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-border bg-muted hover:bg-accent/20"
              }`}
            >
              <div className="w-11 h-11 rounded-full border-2 border-blue-500 bg-[#E2E5E9] overflow-hidden">
                <img src={florinImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }} alt="Florin" />
              </div>
              <span className="text-[10px] font-medium">Student</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
          <span className="text-[10px] font-medium text-muted-foreground select-none">
            Speech Script
          </span>
          <textarea
            value={speechText}
            onChange={(e) => {
              const newSpeech = e.target.value;
              const fields: any = { speechText: newSpeech };
              if (!captions || captions === speechText) fields.captions = newSpeech;
              updateContent(fields);
            }}
            placeholder="Enter what the avatar should say..."
            className="flex-1 w-full rounded-xl border border-border bg-muted text-foreground px-3 py-2 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors placeholder-muted-foreground/40"
          />
        </div>

        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={() => updateContent({ videoMode: undefined, avatarId: undefined, speechText: undefined, captions: undefined })}
            className="flex-1 py-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Change Source
          </button>
          <button
            type="button"
            disabled={!speechText.trim()}
            onClick={handleGenerateVideo}
            className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe ${
              !speechText.trim()
                ? "opacity-40 cursor-not-allowed border-blue-600/20 bg-blue-600/5 text-blue-600"
                : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate Video
          </button>
        </div>
      </div>
    );
  };

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${
        mode === "play"
          ? "relative w-full h-full"
          : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"
      } origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
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
  videoToolsOpen,
  setVideoToolsOpen,
  captionsToolsOpen,
  setCaptionsToolsOpen,
}: VideoToolbarProps) {
  const content = slide.content || {};
  const videoMode = content.videoMode;
  const captions = content.captions || "";
  const forceCompletion = content.forceCompletion === true;
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  if (videoMode === "generate" && !content.url) return null;

  // If video exists, render tools
  if (content.url) {
    return (
      <ControlPanel
        below={
          videoToolsOpen ? (
            <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
              <div className="flex items-center gap-2 justify-between w-full">
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl border bg-muted border-border text-[10px] font-medium">
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer text-xs font-semibold shrink-0"
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
