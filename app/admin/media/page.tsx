"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash2,
  Copy,
  Check,
  Loader2,
  Image as ImageIcon,
  Film,
  Music,
  File,
  RefreshCw,
  X,
  Play,
  ExternalLink,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { useMediaFilesQuery } from "@/hooks/admin/course-editor/queries";
import { useUploadFileMutation } from "@/hooks/admin/course-editor/mutations";
import { useDeleteMediaFileMutation } from "@/hooks/admin/media/mutations";
import type { MediaLibraryFile } from "@/hooks/admin/course-editor/types";

type MediaFile = MediaLibraryFile;

type FilterType = "all" | "image" | "video" | "audio";

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(file: MediaFile): "image" | "video" | "audio" | "other" {
  const mime = file.mime || "";
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg|avif)$/.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(name)) return "audio";
  return "other";
}

// ─── Preview Lightbox ────────────────────────────────────────────────────────

function PreviewModal({
  file,
  onClose,
  onDelete,
}: {
  file: MediaFile;
  onClose: () => void;
  onDelete: (file: MediaFile) => void;
}) {
  const category = getFileCategory(file);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopied(true);
      toast.success("URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {category === "image" && <ImageIcon className="h-4 w-4 text-[#C8D400] shrink-0" />}
            {category === "video" && <Film className="h-4 w-4 text-blue-400 shrink-0" />}
            {category === "audio" && <Music className="h-4 w-4 text-purple-400 shrink-0" />}
            {category === "other" && <File className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-semibold text-foreground truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size || 0)}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={handleCopy}
              title="Copy URL"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-[#C8D400]" /> : <Copy className="h-4 w-4" />}
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => { onClose(); onDelete(file); }}
              title="Delete"
              className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex items-center justify-center bg-black/20 overflow-auto" style={{ maxHeight: "75vh" }}>
          {category === "image" && (
            <img
              src={file.url}
              alt={file.name}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: "75vh" }}
            />
          )}
          {category === "video" && (
            <video
              src={file.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-b-2xl"
              style={{ maxHeight: "75vh" }}
            />
          )}
          {category === "audio" && (
            <div className="flex flex-col items-center justify-center gap-6 p-12">
              <div className="p-6 rounded-3xl bg-purple-400/10 border border-purple-400/20">
                <Music className="h-16 w-16 text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">{file.name}</p>
              <audio src={file.url} controls autoPlay className="w-full max-w-sm" />
            </div>
          )}
          {category === "other" && (
            <div className="flex flex-col items-center justify-center gap-4 p-12">
              <File className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No preview available for this file type.</p>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#C8D400] text-[#1B2A6B] font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#B6C200] transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Open File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  file,
  onConfirm,
  onCancel,
  deleting,
}: {
  file: MediaFile;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <Trash2 className="h-5 w-5 text-red-500" />
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Delete File?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This will permanently remove{" "}
            <span className="font-semibold text-foreground">{file.name}</span> from storage.
            This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-border" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0 font-bold"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Video Thumbnail ──────────────────────────────────────────────────────────

function VideoThumbnail({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={`${url}#t=0.5`}
        className={`w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Film className="h-8 w-8 text-blue-400 animate-pulse" />
        </div>
      )}
      {/* Play icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="p-2 rounded-full bg-black/40 backdrop-blur-sm">
          <Play className="h-5 w-5 text-white fill-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Media Card ───────────────────────────────────────────────────────────────

function MediaCard({
  file,
  onDelete,
  onPreview,
}: {
  file: MediaFile;
  onDelete: (file: MediaFile) => void;
  onPreview: (file: MediaFile) => void;
}) {
  const [copied, setCopied] = useState(false);
  const category = getFileCategory(file);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(file.url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div
      className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-[#C8D400]/30 transition-all duration-300 flex flex-col cursor-pointer"
      onClick={() => onPreview(file)}
    >
      {/* Thumbnail area */}
      <div className="relative h-40 bg-background flex items-center justify-center overflow-hidden">
        {category === "image" ? (
          <img
            src={file.thumbnailUrl || `${file.url}?tr=w-320,h-160,fo-auto`}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : category === "video" ? (
          <VideoThumbnail url={file.url} />
        ) : category === "audio" ? (
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <div className="p-4 rounded-2xl bg-purple-400/15 border border-purple-400/20">
              <Music className="h-8 w-8 text-purple-400" />
            </div>
            <span className="text-[10px] font-bold text-purple-400/70 uppercase tracking-wider">Audio</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-4 rounded-2xl bg-muted/50">
              <File className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Hover overlay tint (non-interactive, let clicks pass through to open preview) */}
        <div className="absolute inset-0 bg-black/5 dark:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Action buttons (positioned in the top-right corner) */}
        <div
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            title="Copy URL"
            className="p-1.5 bg-background/80 dark:bg-background/90 backdrop-blur-md border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#C8D400]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(file); }}
            title="Delete"
            className="p-1.5 bg-background/80 dark:bg-background/90 backdrop-blur-md border border-border rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* File info footer */}
      <div className="px-3 py-2.5 border-t border-border flex-1 flex flex-col justify-between gap-1 min-h-0">
        <p className="text-xs font-semibold text-foreground truncate" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatBytes(file.size || 0)}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {category}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MediaManagerPage() {
  const mediaFilesQuery = useMediaFilesQuery(true);
  const uploadFileMutation = useUploadFileMutation();
  const deleteMediaFileMutation = useDeleteMediaFileMutation();

  const files = mediaFilesQuery.data ?? [];
  const loading = mediaFilesQuery.isLoading;
  const uploading = uploadFileMutation.isPending;
  const deleting = deleteMediaFileMutation.isPending;

  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading(`Uploading ${file.name}…`);
    try {
      await uploadFileMutation.mutateAsync(file);
      toast.success(`${file.name} uploaded successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const toastId = toast.loading(`Deleting ${deleteTarget.name}…`);
    try {
      await deleteMediaFileMutation.mutateAsync(deleteTarget.fileId);
      toast.success(`${deleteTarget.name} deleted`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Delete failed", { id: toastId });
    } finally {
      setDeleteTarget(null);
    }
  };

  const imageCount = files.filter((f) => getFileCategory(f) === "image").length;
  const videoCount = files.filter((f) => getFileCategory(f) === "video").length;
  const audioCount = files.filter((f) => getFileCategory(f) === "audio").length;

  const filteredFiles = filter === "all" ? files
    : files.filter((f) => getFileCategory(f) === filter);

  const filterTabs: { key: FilterType; label: string; value: number; icon: React.ElementType; color: string; bg: string; activeBg: string; activeBorder: string }[] = [
    { key: "all",   label: "All Files", value: files.length,  icon: File,      color: "text-foreground",   bg: "bg-muted/50",       activeBg: "bg-[#1B2A6B]/10 dark:bg-[#C8D400]/10", activeBorder: "border-[#1B2A6B]/30 dark:border-[#C8D400]/30" },
    { key: "image", label: "Images",    value: imageCount,     icon: ImageIcon, color: "text-[#C8D400]",    bg: "bg-[#C8D400]/10",   activeBg: "bg-[#C8D400]/15",  activeBorder: "border-[#C8D400]/50" },
    { key: "video", label: "Videos",    value: videoCount,     icon: Film,      color: "text-blue-400",     bg: "bg-blue-400/10",    activeBg: "bg-blue-400/15",   activeBorder: "border-blue-400/50" },
    { key: "audio", label: "Audio",     value: audioCount,     icon: Music,     color: "text-purple-400",   bg: "bg-purple-400/10",  activeBg: "bg-purple-400/15", activeBorder: "border-purple-400/50" },
  ];

  return (
    <div className="space-y-6">
      <Toaster theme="dark" closeButton richColors />

      {/* Preview Lightbox */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDelete={(f) => { setPreviewFile(null); setDeleteTarget(f); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmDialog
          file={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2A6B] dark:text-[#C8D400]">
            Media Library
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage uploaded images, videos, and audio files stored on Cloudflare R2 storage.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mediaFilesQuery.refetch()}
            disabled={loading}
            className="border-border text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="inline-flex items-center justify-center gap-2 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold border-0 shadow-lg shadow-[#C8D400]/20 h-9 px-4 rounded-md text-sm transition-all duration-200 hover:scale-[1.02] cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload File
            </span>
          </label>
        </div>
      </div>

      {/* Filter Tabs (formerly inert stats cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filterTabs.map(({ key, label, value, icon: Icon, color, bg, activeBg, activeBorder }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 shadow-sm text-left
                ${isActive
                  ? `${activeBg} ${activeBorder} shadow-md scale-[1.02]`
                  : "bg-card border-border hover:border-muted-foreground/30 hover:shadow-md hover:scale-[1.01]"
                }`}
            >
              <div className={`p-2.5 rounded-xl ${isActive ? activeBg : bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-extrabold text-foreground leading-none">{value}</p>
                <p className={`text-[11px] mt-0.5 font-semibold ${isActive ? color : "text-muted-foreground"}`}>
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active filter label */}
      {filter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredFiles.length}</span> {filter} file{filteredFiles.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setFilter("all")}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Media Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
          <p className="text-sm font-medium">Loading media library…</p>
        </div>
      ) : filteredFiles.length === 0 && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 border border-dashed border-border rounded-2xl text-muted-foreground">
          <div className="p-5 rounded-2xl bg-muted/50">
            <Upload className="h-10 w-10" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">No media files yet</p>
            <p className="text-sm mt-1">Upload an image, video, or audio file to get started.</p>
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*,video/*,audio/*" onChange={handleUpload} disabled={uploading} className="hidden" />
            <span className="inline-flex items-center gap-2 bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold h-10 px-5 rounded-lg text-sm cursor-pointer transition-all hover:scale-[1.02]">
              <Upload className="h-4 w-4" /> Upload your first file
            </span>
          </label>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 border border-dashed border-border rounded-2xl text-muted-foreground">
          <p className="text-sm font-medium">No {filter} files found.</p>
          <button onClick={() => setFilter("all")} className="text-xs underline hover:text-foreground transition-colors">
            Show all files
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map((file) => (
            <MediaCard
              key={file.fileId}
              file={file}
              onDelete={setDeleteTarget}
              onPreview={setPreviewFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
