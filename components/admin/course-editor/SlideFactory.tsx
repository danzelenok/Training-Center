import React from "react";
import { Slide } from "./CardCanvas";
import { TextCard, TextToolbar } from "./slides/TextSlide";
import { AudioCard, AudioToolbar } from "./slides/AudioSlide";
import { VideoCard, VideoToolbar } from "./slides/VideoSlide";
import { QuizCard } from "./slides/QuizSlide";
import { DialogueCard, DialogueToolbar } from "./slides/DialogueSlide";
import { ChatCard, ChatToolbar } from "./slides/ChatSlide";
import { PollCard } from "./slides/PollSlide";

export interface SlideCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  draggedIdx: number | null;
  cardStyle: React.CSSProperties;
  
  handleResizeStart?: (
    e: React.MouseEvent | React.TouchEvent,
    slideIdx: number,
    align: "top" | "bottom",
    currentVolume: number
  ) => void;
  handleChatResizeStart?: (
    e: React.MouseEvent | React.TouchEvent,
    slideIdx: number,
    currentVolume: number
  ) => void;
  
  audioTranscriptToolsOpen?: boolean;
  setAudioTranscriptToolsOpen?: (open: boolean) => void;
  audioToolsOpen?: boolean;
  setAudioToolsOpen?: (open: boolean) => void;
  
  isVideoConfigOpen?: boolean;
  setIsVideoConfigOpen?: (open: boolean) => void;
  
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
  
  selectedBubbleIdx?: number | null;
  setSelectedBubbleIdx?: (idx: number | null) => void;
  chatBubblesToolsOpen?: boolean;
}

export interface SlideToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  onOpenMediaPicker: () => void;
  
  imageToolsOpen?: boolean;
  setImageToolsOpen?: (open: boolean) => void;
  
  audioToolsOpen?: boolean;
  setAudioToolsOpen?: (open: boolean) => void;
  audioTranscriptToolsOpen?: boolean;
  setAudioTranscriptToolsOpen?: (open: boolean) => void;
  
  isVideoConfigOpen?: boolean;
  setIsVideoConfigOpen?: (open: boolean) => void;
  videoToolsOpen?: boolean;
  setVideoToolsOpen?: (open: boolean) => void;
  captionsToolsOpen?: boolean;
  setCaptionsToolsOpen?: (open: boolean) => void;
  
  chatBubblesToolsOpen?: boolean;
  setChatBubblesToolsOpen?: (open: boolean) => void;
  selectedBubbleIdx?: number | null;
  setSelectedBubbleIdx?: (idx: number | null) => void;
}

export const slideRegistry: Record<
  Slide["type"],
  {
    Card: React.ComponentType<SlideCardProps>;
    Toolbar?: React.ComponentType<SlideToolbarProps>;
  }
> = {
  text: { Card: TextCard as React.ComponentType<SlideCardProps>, Toolbar: TextToolbar as React.ComponentType<SlideToolbarProps> },
  audio: { Card: AudioCard as React.ComponentType<SlideCardProps>, Toolbar: AudioToolbar as React.ComponentType<SlideToolbarProps> },
  video: { Card: VideoCard as React.ComponentType<SlideCardProps>, Toolbar: VideoToolbar as React.ComponentType<SlideToolbarProps> },
  chat: { Card: ChatCard as React.ComponentType<SlideCardProps>, Toolbar: ChatToolbar as React.ComponentType<SlideToolbarProps> },
  quiz: { Card: QuizCard as React.ComponentType<SlideCardProps> },
  dialogue: { Card: DialogueCard as React.ComponentType<SlideCardProps>, Toolbar: DialogueToolbar as React.ComponentType<SlideToolbarProps> },
  poll: { Card: PollCard as React.ComponentType<SlideCardProps> },
};
