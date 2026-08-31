import type { Slide } from "@/components/admin/course-editor/CardCanvas";

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
  ownerJurisdictionId: string;
  roleIds: string[];
  autoAssignNewWorkers: boolean;
  telegramMessageId: string | null;
  telegramGroupId: string | null;
  slides: Slide[];
  generationStatus?: "none" | "pending" | "generating" | "ready" | "failed";
  themeType?: string;
  themeValue?: string;
  themePaletteId?: string | null;
  themeVariantId?: string | null;
}

export interface GenerationStatusSlide {
  id: string;
  type: string;
  assetStatus: "pending" | "generating" | "ready" | "failed";
  content?: {
    url?: string;
    assetUrl?: string;
    captions?: string;
    instructorVideoUrl?: string;
    studentVideoUrl?: string;
    slots?: { slotIndex: number; avatarId: string; videoUrl?: string }[];
  };
}

export interface GenerationStatusResponse {
  generationStatus?: "none" | "pending" | "generating" | "ready" | "failed";
  slides: GenerationStatusSlide[];
}

export const courseEditorKeys = {
  course: (courseId: string) => ["course", courseId] as const,
  mediaFiles: () => ["media-files"] as const,
  generationStatus: (courseId: string) => ["course", courseId, "generation-status"] as const,
};
