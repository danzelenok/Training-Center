import type { Slide } from "@/components/admin/course-editor/CardCanvas";
import type { ResolvedThemePalette, ResolvedThemeVariant } from "@/lib/theme";

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
  // Set only on a course created via "Clone to my jurisdiction" — see
  // db/schema.ts. Already returned by GET/PATCH /api/courses/[id] (a plain
  // `select()` includes every column) but wasn't previously in this type;
  // added to gate Sidebar.tsx's "Adapt to Jurisdiction" button (only
  // meaningful for a course that has clone lineage to adapt from).
  sourceOfCloneId?: string | null;
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
  // Server-resolved join of the two ids above — read-only, populated by
  // GET/PATCH /api/courses/[id], never sent back in a save payload.
  themePalette?: ResolvedThemePalette | null;
  themeVariant?: ResolvedThemeVariant | null;
  // Course-level overrides, independent of the palette — see lib/theme.ts.
  fontFamilyOverride?: string | null;
  textColorOverride?: string | null;
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
