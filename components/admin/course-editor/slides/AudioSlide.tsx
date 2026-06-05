import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Slide } from "../CardCanvas";
import { ControlPanel } from "../ControlPanel";
import { PanelButton } from "../PanelButton";

interface AudioCardProps {
  slide: Slide;
  isActive: boolean;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  audioTranscriptToolsOpen: boolean;
  setAudioTranscriptToolsOpen: (val: boolean) => void;
  audioToolsOpen: boolean;
  setAudioToolsOpen: (val: boolean) => void;
}

export function AudioCard({
  slide,
  isActive,
  index,
  onUpdateSlideContent,
  onOpenMediaPicker,
  draggedIdx,
  cardStyle,
  audioTranscriptToolsOpen,
  setAudioTranscriptToolsOpen,
  audioToolsOpen,
  setAudioToolsOpen,
}: AudioCardProps) {
  const content = slide.content || {};
  const audioMode = content.audioMode;
  const speechText = content.speechText || "";
  const voiceId = content.voiceId || "anna";
  const captions = content.captions || "";

  const mockVoices = [
    { id: "anna", name: "Anna (Female)" },
    { id: "james", name: "James (Male)" },
    { id: "sofia", name: "Sofia (Pro)" },
    { id: "alex", name: "Alex (Kid)" },
  ];

  const selectedVoice = mockVoices.find((v) => v.id === voiceId) || mockVoices[0];

  const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
  const isFailed = slide.assetStatus === "failed";

  // Audio Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0.1);
  const [speed, setSpeed] = useState(1);
  const [isCCActive, setIsCCActive] = useState(false);

  // Microphone Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync index change or deactivated slide - stop playing & recording
  useEffect(() => {
    if (!isActive) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopRecording();
      setRecordingTime(0);
      setAudioBlobUrl(null);
    }
  }, [isActive]);

  const handleRegenerateAudio = async (overrideScript?: string) => {
    if (!slide.id) return;
    onUpdateSlideContent(index, {}, { assetStatus: "generating" });
    try {
      const scriptToUse =
        overrideScript !== undefined
          ? overrideScript
          : content.audioScript || content.text || content.body || "";
      const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioScript: scriptToUse }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      toast.success("AI audio generation triggered in background.");
    } catch (err: any) {
      toast.error("Failed to regenerate audio: " + err.message);
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
    }
  };

  // Recording Controls
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlobUrl(audioUrl);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed", err);
      toast.error("Failed to access microphone: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const saveRecording = () => {
    if (audioBlobUrl) {
      onUpdateSlideContent(index, { url: audioBlobUrl, audioMode: "record" });
      toast.success("Voice recording applied successfully!");
      setAudioBlobUrl(null);
    }
  };

  const discardRecording = () => {
    setAudioBlobUrl(null);
    setRecordingTime(0);
  };

  // Custom Audio Player Actions
  const percent = (currentTime / duration) * 100;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleScrub = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const updateContent = (fields: any) => {
    onUpdateSlideContent(index, fields);
  };

  const bodyText = content.body || content.text || "";
  const bodyLen = bodyText.length;
  let bodyTextClass = "bg-transparent border-none font-medium focus:outline-none w-full resize-none leading-relaxed text-center text-foreground placeholder-muted-foreground/40 focus:ring-0";
  if (bodyLen < 100) {
    bodyTextClass += " text-xl md:text-2xl";
  } else if (bodyLen < 300) {
    bodyTextClass += " text-lg md:text-xl";
  } else {
    bodyTextClass += " text-base md:text-lg";
  }

  // 1. Generation loading state
  if (isGenerating) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border border-border/80 shadow-md justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h3 className="text-base font-bold text-foreground">Generating AI Voiceover...</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          Please wait while we generate speech audio from your script.
        </p>
      </Card>
    );
  }

  // 2. Generation failed state
  if (isFailed) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border border-border/80 shadow-md justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <div className="p-3 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive animate-bounce" />
        </div>
        <h3 className="text-base font-bold text-destructive font-sans">Audio Generation Failed</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          We encountered an error while calling the OpenAI Text-to-Speech API.
        </p>
        {isActive && (
          <button
            type="button"
            onClick={() => handleRegenerateAudio()}
            className="mt-2 text-xs font-bold bg-primary hover:bg-primary/95 text-primary-foreground py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
          >
            Retry Generation
          </button>
        )}
      </Card>
    );
  }

  // Render function helper to make the return cleaner
  const renderCardBody = () => {
    // Mode A: Audio url exists - render player
    if (content.url) {
      return (
        <div className="flex-1 flex flex-col justify-between pt-10 pb-16 min-h-0 w-full z-10">
          <audio
            ref={(node) => {
              audioRef.current = node;
              if (node) {
                node.playbackRate = speed;
              }
            }}
            src={content.url}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              setCurrentTime(el.currentTime);
              if (el.duration && el.duration !== duration) {
                setDuration(el.duration);
              }
            }}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (el.duration) {
                setDuration(el.duration);
              }
            }}
            onDurationChange={(e) => {
              const el = e.currentTarget;
              if (el.duration) {
                setDuration(el.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
          />

          <div className="w-full text-left shrink-0 mt-8 px-4">
            <textarea
              ref={(node) => {
                if (node) {
                  node.style.height = "auto";
                  node.style.height = `${node.scrollHeight}px`;
                }
              }}
              disabled={!isActive}
              value={content.body || content.text || ""}
              onChange={(e) => {
                updateContent({ body: e.target.value, text: e.target.value });
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="Enter a short description or information about the audio file"
              rows={1}
              className={bodyTextClass}
            />
          </div>

          {isCCActive && captions && (
            <div className="w-full flex justify-center text-center animate-fade-in z-25 my-auto pointer-events-none px-4">
              <div className="max-w-[90%] bg-black/85 border border-white/10 px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md">
                <p className="text-[10px] text-white leading-normal font-sans font-medium">{captions}</p>
              </div>
            </div>
          )}

          <div className="w-full shrink-0 px-0.5 mt-auto mb-6">
            <div className="w-full bg-[#030b35]/95 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md text-white no-swipe">
              <button
                type="button"
                onClick={togglePlay}
                className="h-8 w-8 rounded-lg border border-white/90 flex items-center justify-center bg-transparent transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5 fill-white text-white shrink-0" />
                ) : (
                  <Play className="h-4.5 w-4.5 fill-white text-white shrink-0 translate-x-[1px]" />
                )}
              </button>

              <div className="flex-1 flex items-center min-w-0">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => handleScrub(parseFloat(e.target.value))}
                  className="w-full h-[3.5px] rounded-lg appearance-none cursor-pointer accent-white bg-white/20 hover:accent-primary transition-colors"
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${percent}%, rgba(255,255,255,0.2) ${percent}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                />
              </div>

              <div className="flex items-center gap-2.5 shrink-0 pl-1 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setAudioTranscriptToolsOpen(!audioTranscriptToolsOpen);
                    setAudioToolsOpen(false);
                  }}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    audioTranscriptToolsOpen ? "text-primary bg-white/10" : "text-white/70 hover:text-white"
                  }`}
                  title="Toggle Transcript"
                >
                  <FileText className="h-4.5 w-4.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCCActive(!isCCActive)}
                  className={`h-8 w-8 border rounded-lg flex items-center justify-center text-[9px] font-black tracking-tighter transition-all cursor-pointer shrink-0 ${
                    isCCActive
                      ? "border-primary text-primary bg-primary/10 font-extrabold shadow-sm shadow-primary/25"
                      : "border-white/20 text-white/70 hover:text-white"
                  }`}
                  title="Toggle Captions"
                >
                  cc
                </button>

                <button
                  type="button"
                  onClick={changeSpeed}
                  className="text-[10px] font-black text-white hover:text-primary px-1 h-8 flex items-center justify-center min-w-[28px] cursor-pointer transition-colors shrink-0"
                  title="Playback Speed"
                >
                  {speed}x
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Mode B: Selector Choice
    if (!audioMode) {
      return (
        <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
          <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/25 text-primary">
              <Music className="h-7 w-7" />
            </div>
            <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">Add Audio Block</h3>
            <p className="text-xs max-w-[220px] leading-normal text-muted-foreground">
              Upload an audio file, generate with AI text-to-speech, or record with your microphone.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ audioMode: "upload" });
                onOpenMediaPicker();
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Upload Audio</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Import an MP3, WAV, or OGG file from your device
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ audioMode: "generate", voiceId: "anna" });
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Generate with AI</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Convert text script to AI voice narration automatically
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ audioMode: "record" });
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 shrink-0">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Record Mic</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Record voice comments directly using your system microphone
                </p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // Mode C: AI Text to Speech Configurator
    if (audioMode === "generate") {
      return (
        <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
          <div className="w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border border-border flex flex-col items-center justify-center bg-muted shadow-inner group">
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[7px] font-black uppercase text-primary tracking-wider">AI Voice Studio</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <span className="text-[10px] font-black text-foreground uppercase tracking-wider bg-background px-2 py-0.5 rounded-md border border-border">
                {selectedVoice.name}
              </span>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2">
            <div className="text-left flex flex-col gap-1">
              <span className="text-[8.5px] font-bold uppercase tracking-wider select-none text-muted-foreground">
                Select AI voice actor
              </span>
              <div className="flex gap-1">
                {mockVoices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => updateContent({ voiceId: v.id })}
                    className={`flex-1 py-1 rounded-lg border text-[8px] font-bold transition-all cursor-pointer no-swipe ${
                      voiceId === v.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-left">
              <span className="text-[8.5px] font-bold uppercase tracking-wider select-none text-muted-foreground">
                Voice script editor
              </span>
              <textarea
                value={speechText}
                onChange={(e) => {
                  const val = e.target.value;
                  updateContent({ speechText: val, audioScript: val, body: val, text: val });
                }}
                placeholder="Enter script text for the AI voice to read..."
                rows={2}
                className="w-full rounded-xl border border-border bg-card text-foreground px-2 py-1.5 text-[9px] mt-1 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-colors placeholder-muted-foreground/30"
              />
            </div>

            <div className="flex gap-2 w-full mt-1">
              <button
                type="button"
                onClick={() => updateContent({ audioMode: undefined, voiceId: undefined, speechText: undefined, captions: undefined })}
                className="flex-1 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  if (!speechText.trim()) {
                    toast.error("Please enter script text to synthesize");
                    return;
                  }
                  handleRegenerateAudio(speechText);
                }}
                className="flex-1 py-2 rounded-xl border border-primary bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> Generate voice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Mode D: Live Microphone Recorder
    return (
      <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
        <div className="w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border border-border flex flex-col items-center justify-center bg-neutral-950 shadow-inner group">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2.5 py-0.5 rounded-full backdrop-blur-xs select-none">
            <span className={`h-1.5 w-1.5 rounded-full bg-red-500 ${isRecording ? "animate-ping" : ""}`} />
            <span className="text-[7.5px] font-black uppercase text-red-500 tracking-wider">
              {isRecording ? "Live Mic Recording" : "Voice Recorder"}
            </span>
          </div>

          <div className="text-center flex flex-col items-center gap-1">
            {isRecording ? (
              <>
                <span className="text-3xl font-black text-white tracking-widest font-mono select-none">
                  {formatTime(recordingTime)}
                </span>
                <span className="text-[8px] text-white/50 uppercase tracking-widest select-none">
                  Recording in progress
                </span>
              </>
            ) : audioBlobUrl ? (
              <>
                <span className="text-base font-bold text-white mb-2">Recording ready!</span>
                <audio src={audioBlobUrl} controls className="max-w-[200px] h-8 bg-transparent" />
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-full bg-red-500/10 text-red-500 mb-1 border border-red-500/10 shrink-0">
                  <Mic className="h-6 w-6" />
                </div>
                <span className="text-[9px] text-white/60 uppercase tracking-widest select-none">Ready to record</span>
              </>
            )}
          </div>

          {isRecording && (
            <div className="absolute bottom-3 inset-x-6 flex items-center justify-center gap-1 select-none">
              {[0.4, 0.8, 0.5, 0.9, 0.6, 0.8, 0.3, 0.7, 0.5, 0.9, 0.4].map((h, i) => (
                <div
                  key={i}
                  style={{
                    height: `${h * 24}px`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                  className="w-[2.5px] bg-red-500 rounded-full animate-pulse"
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full flex flex-col gap-2">
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer no-swipe text-xs animate-pulse"
            >
              <div className="h-2 w-2 rounded-xs bg-white shrink-0" />
              Stop Recording
            </button>
          ) : audioBlobUrl ? (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={discardRecording}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe"
              >
                Record Again
              </button>
              <button
                type="button"
                onClick={saveRecording}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold flex items-center justify-center gap-1.5 cursor-pointer no-swipe text-[10px] transition-colors"
              >
                <Check className="h-3.5 w-3.5" /> Use Recording
              </button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => updateContent({ audioMode: undefined })}
                className="flex-1 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <button
                type="button"
                onClick={startRecording}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer no-swipe text-[10px]"
              >
                <Mic className="h-3.5 w-3.5" /> Start Recording
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border border-border/80 shadow-md transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      {renderCardBody()}
    </Card>
  );
}

interface AudioToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  audioToolsOpen: boolean;
  setAudioToolsOpen: (val: boolean) => void;
  audioTranscriptToolsOpen: boolean;
  setAudioTranscriptToolsOpen: (val: boolean) => void;
}

export function AudioToolbar({
  slide,
  index,
  onUpdateSlideContent,
  onOpenMediaPicker,
  audioToolsOpen,
  setAudioToolsOpen,
  audioTranscriptToolsOpen,
  setAudioTranscriptToolsOpen,
}: AudioToolbarProps) {
  const content = slide.content || {};
  const captions = content.captions || "";
  const forceCompletion = content.forceCompletion === true;
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  const handleRegenerateAudio = async () => {
    if (!slide.id) return;
    onUpdateSlideContent(index, {}, { assetStatus: "generating" });
    try {
      const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioScript: content.audioScript || content.text || content.body || "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      toast.success("AI audio generation triggered in background.");
    } catch (err: any) {
      toast.error("Failed to regenerate audio: " + err.message);
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
    }
  };

  return (
    <ControlPanel
      below={
        audioToolsOpen ? (
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
                onClick={handleRegenerateAudio}
                className="p-1.5 border border-border rounded-xl bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer"
                title="Regenerate Audio"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={onOpenMediaPicker}
                className="p-1.5 border border-border rounded-xl bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer"
                title="Replace Audio"
              >
                <Upload className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  updateContent({
                    url: undefined,
                    audioMode: undefined,
                    captions: undefined,
                    speechText: undefined,
                    voiceId: undefined,
                  });
                }}
                className="p-1.5 border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 rounded-xl text-destructive transition-all cursor-pointer"
                title="Remove Audio"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
        ) : audioTranscriptToolsOpen ? (
        <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-row items-center no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
          <button
            type="button"
            disabled={isGeneratingCaptions}
            onClick={() => {
              setIsGeneratingCaptions(true);
              setTimeout(() => {
                setIsGeneratingCaptions(false);
                const desc = content.body || "Safety Briefing Announcement";
                const generatedSub = `Attention all employees. Please review this vital safety bulletin: "${desc}". Let's stay alert and work safely today.`;
                updateContent({ captions: generatedSub });
                toast.success("AI automatic subtitles generated successfully!");
              }, 1200);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[8px] font-black uppercase shrink-0 ${
              isGeneratingCaptions ? "opacity-50" : ""
            } border-border bg-card hover:bg-accent text-card-foreground`}
          >
            {isGeneratingCaptions ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Gen...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" /> Auto-Gen
              </>
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
        icon={<Music className="h-4.5 w-4.5 shrink-0" />}
        label="Audio Config Options"
        isActive={audioToolsOpen}
        onClick={() => {
          setAudioToolsOpen(!audioToolsOpen);
          setAudioTranscriptToolsOpen(false);
        }}
        variant="primary"
      />
      <PanelButton
        icon={<FileText className="h-4.5 w-4.5 shrink-0" />}
        label="Transcript & Subtitle Options"
        isActive={audioTranscriptToolsOpen}
        onClick={() => {
          setAudioTranscriptToolsOpen(!audioTranscriptToolsOpen);
          setAudioToolsOpen(false);
        }}
        variant="primary"
      />
    </ControlPanel>
  );
}
